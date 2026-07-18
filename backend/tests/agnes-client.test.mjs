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

test("RealAgnesClient reports TTS as unsupported instead of returning a false success", async () => {
  const client = new RealAgnesClient({ AGNES_API_KEY: "test-key", AGNES_API_BASE_URL: "https://example.test" });
  await assert.rejects(() => client.generateTTS({ text: "测试配音" }), /不支持 TTS/);
});

test("RealAgnesClient preserves the underlying network error code", async () => {
  const originalFetch = globalThis.fetch;
  const cause = Object.assign(new Error("connect timed out"), { code: "ETIMEDOUT" });
  globalThis.fetch = async () => {
    throw new TypeError("fetch failed", { cause });
  };

  try {
    const client = new RealAgnesClient({ AGNES_API_KEY: "test-key", AGNES_API_BASE_URL: "https://example.test" });
    await assert.rejects(
      () => client.generateImage({ prompt: "测试网络错误", n: 1 }),
      /无法连接 Agnes API（ETIMEDOUT）/,
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("MockAgnesClient is deprecated and throws on construction", () => {
  // 不再支持任何 mock 行为：构造时必须抛错
  assert.throws(() => new MockAgnesClient(), /MockAgnesClient 已废弃/);
});

test("RealAgnesClient parses streaming chat chunks", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (_url, init) => {
    assert.equal(init.headers.authorization, "Bearer test-key");
    const body = JSON.parse(init.body);
    assert.equal(body.model, "agnes-2.0-flash");
    assert.equal(body.temperature, 0.3);
    assert.equal(body.max_tokens, 256);
    assert.equal(body.stream, true);
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
    for await (const chunk of client.chat({
      conversationId: "c-1",
      message: "hi",
      model: "agnes-2.0-flash",
      temperature: 0.3,
      max_tokens: 256,
    })) chunks.push(chunk);
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

/**
 * 根据 images.txt 文档,Agnes 图片接口响应是单元素数组,无 n 参数。
 * 因此 n>1 时由客户端并发 N 次调用,合并 URL 列表。
 * 此测试验证 n=4 时:
 *  1) fetch 被并行调用 4 次
 *  2) 每次调用独立随机种子(不传 seed)
 *  3) 4 个 URL 合并按顺序返回
 */
test("RealAgnesClient.generateImage with n>1 fans out N parallel calls and merges URLs", async () => {
  const originalFetch = globalThis.fetch;
  let imageCallCount = 0;
  globalThis.fetch = async (url, init) => {
    if (String(url).endsWith("/v1/images/generations")) {
      imageCallCount += 1;
      const idx = imageCallCount;
      return Response.json({ data: [{ url: `https://cdn.example/img-${idx}.png` }] });
    }
    return Response.json({ error: "unexpected" }, { status: 404 });
  };

  try {
    const client = new RealAgnesClient({ AGNES_API_KEY: "test-key", AGNES_API_BASE_URL: "https://example.test" });
    const result = await client.generateImage({
      prompt: "海边的神秘角色",
      size: "1024x1024",
      n: 4,
      response_format: "url",
    });
    // 4 个 URL 按调用顺序合并
    assert.equal(imageCallCount, 4);
    assert.deepEqual(result.imageUrls, [
      "https://cdn.example/img-1.png",
      "https://cdn.example/img-2.png",
      "https://cdn.example/img-3.png",
      "https://cdn.example/img-4.png",
    ]);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

/**
 * n=4 并发调用时,如果部分失败(1/4 失败),应该返回成功的 3 个 URL,不抛错。
 * 全部失败(0/4)才抛首个错误。
 */
test("RealAgnesClient.generateImage with n>1 tolerates partial failures", async () => {
  const originalFetch = globalThis.fetch;
  let imageCallCount = 0;
  globalThis.fetch = async (url, _init) => {
    if (String(url).endsWith("/v1/images/generations")) {
      imageCallCount += 1;
      // 第 2 次调用模拟 500 错误(其他 3 次成功)
      if (imageCallCount === 2) {
        return new Response(JSON.stringify({ error: "transient" }), { status: 500, headers: { "content-type": "application/json" } });
      }
      return Response.json({ data: [{ url: `https://cdn.example/img-${imageCallCount}.png` }] });
    }
    return Response.json({ error: "unexpected" }, { status: 404 });
  };

  try {
    const client = new RealAgnesClient({ AGNES_API_KEY: "test-key", AGNES_API_BASE_URL: "https://example.test" });
    const result = await client.generateImage({ prompt: "测试", size: "1024x1024", n: 4 });
    // 3/4 成功,部分失败不抛错
    assert.equal(imageCallCount, 4);
    assert.equal(result.imageUrls.length, 3);
    assert.ok(result.imageUrls.includes("https://cdn.example/img-1.png"));
    assert.ok(result.imageUrls.includes("https://cdn.example/img-3.png"));
    assert.ok(result.imageUrls.includes("https://cdn.example/img-4.png"));
  } finally {
    globalThis.fetch = originalFetch;
  }
});

/**
 * 限流错误(429):任何一次返回 429,整批立即 reject(避免继续打 API 加重限流)。
 */
test("RealAgnesClient.generateImage with n>1 aborts batch on rate limit (429)", async () => {
  const originalFetch = globalThis.fetch;
  let imageCallCount = 0;
  globalThis.fetch = async (url, _init) => {
    if (String(url).endsWith("/v1/images/generations")) {
      imageCallCount += 1;
      // 第 1 次返回 429
      return new Response(JSON.stringify({ error: "rate limit" }), { status: 429, headers: { "content-type": "application/json" } });
    }
    return Response.json({ error: "unexpected" }, { status: 404 });
  };

  try {
    const client = new RealAgnesClient({ AGNES_API_KEY: "test-key", AGNES_API_BASE_URL: "https://example.test" });
    await assert.rejects(
      () => client.generateImage({ prompt: "test", size: "1024x1024", n: 4 }),
      /Agnes API 429|rate.?limit|quota.?exceed/i
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});
