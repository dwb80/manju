import assert from "node:assert/strict";
import test from "node:test";
import { RealAgnesClient, createAgnesClient, MockAgnesClient } from "../dist/src/ai/agnes-client.js";

test("createAgnesClient throws when AGNES_API_KEY is missing", () => {
  assert.throws(
    () => createAgnesClient({ AGNES_API_KEY: "" }),
    /AGNES_API_KEY 未配置/,
  );
});

test("createAgnesClient selects real mode when API key exists", () => {
  const real = createAgnesClient({ AGNES_API_KEY: "test-key", AGNES_API_BASE_URL: "https://example.test" });
  assert.ok(real instanceof RealAgnesClient);
});

test("MockAgnesClient is deprecated and throws on construction", () => {
  // 不再支持任何 mock 行为：构造时必须抛错
  assert.throws(() => new MockAgnesClient(), /MockAgnesClient 已废弃/);
});

test("RealAgnesClient parses streaming chat chunks", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (_url, init) => {
    assert.equal(init.headers.authorization, "Bearer test-key");
    const stream = new ReadableStream({
      start(controller) {
        const encoder = new TextEncoder();
        controller.enqueue(encoder.encode('data: {"choices":[{"delta":{"content":"你"}}]}\n\n'));
        controller.enqueue(encoder.encode('data: {"choices":[{"delta":{"content":"好"}}]}\n\n'));
        controller.enqueue(encoder.encode("data: [DONE]\n\n"));
        controller.close();
      },
    });
    return new Response(stream, { status: 200, headers: { "content-type": "text/event-stream" } });
  };

  try {
    const client = new RealAgnesClient({ AGNES_API_KEY: "test-key", AGNES_API_BASE_URL: "https://example.test" });
    const chunks = [];
    for await (const chunk of client.chat({ conversationId: "c-1", message: "hi" })) chunks.push(chunk);
    assert.equal(chunks.map((chunk) => chunk.content).join(""), "你好");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("RealAgnesClient sends official image and video request shapes", async () => {
  const originalFetch = globalThis.fetch;
  const calls = [];
  globalThis.fetch = async (url, init) => {
    calls.push({ url: String(url), body: init.body ? JSON.parse(init.body) : null });
    if (String(url).endsWith("/v1/images/generations")) {
      return Response.json({ data: [{ url: "https://cdn.example/image.png" }] });
    }
    if (String(url).endsWith("/v1/videos")) {
      return Response.json({ video_id: "video-123" });
    }
    if (String(url).endsWith("/agnesapi?video_id=video-123")) {
      return Response.json({ status: "completed", remixed_from_video_id: "https://cdn.example/video.mp4" });
    }
    return Response.json({ error: "unexpected" }, { status: 404 });
  };

  try {
    const client = new RealAgnesClient({ AGNES_API_KEY: "test-key", AGNES_API_BASE_URL: "https://agnes-ai.com/api" });
    const image = await client.generateImage({ prompt: "海边工作室", image: "https://cdn.example/input.png", size: "1024x768", n: 1 });
    assert.deepEqual(image.imageUrls, ["https://cdn.example/image.png"]);

    const video = await client.generateVideo({ prompt: "镜头推进", ratio: "16:9", duration: 5 });
    assert.equal(video.taskId, "video-123");
    const task = await client.queryTask(video.taskId);
    assert.equal(task.status, "success");
    assert.equal(task.videoUrl, "https://cdn.example/video.mp4");

    assert.equal(calls[0].url, "https://apihub.agnes-ai.com/v1/images/generations");
    assert.equal(calls[0].body.model, "agnes-image-2.1-flash");
    assert.equal(calls[0].body.extra_body.response_format, "url");
    assert.equal(calls[0].body.image, undefined);
    assert.deepEqual(calls[0].body.extra_body.image, ["https://cdn.example/input.png"]);
    assert.equal(calls[1].url, "https://apihub.agnes-ai.com/v1/videos");
    assert.equal(calls[1].body.model, "agnes-video-v2.0");
    assert.equal(calls[1].body.width, 1152);
    assert.equal(calls[1].body.height, 768);
    assert.equal(calls[1].body.num_frames, 121);
    assert.equal(calls[1].body.frame_rate, 24);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
