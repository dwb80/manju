import assert from "node:assert/strict";
import { mkdtemp, mkdir, rm, stat, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { createServer } from "../dist/src/http/router.js";
import { createAppContext } from "../dist/src/services/app.js";

async function withServer(fn) {
  const root = await mkdtemp(path.join(os.tmpdir(), "agnes-api-"));
  const server = createServer(createAppContext(root, { mediaCacheEnabled: false }));
  await new Promise(resolve => server.listen(0, resolve));
  const address = server.address();
  const base = `http://127.0.0.1:${address.port}`;
  try {
    await fn(base, root);
  } finally {
    await new Promise(resolve => server.close(resolve));
    for (let attempt = 0; attempt < 5; attempt += 1) {
      try {
        await rm(root, { recursive: true, force: true });
        break;
      } catch (error) {
        if (attempt === 4) throw error;
        await new Promise(resolve => setTimeout(resolve, 250));
      }
    }
  }
}

async function json(base, pathName, init = {}) {
  const response = await fetch(`${base}${pathName}`, {
    headers: { "content-type": "application/json" },
    ...init,
  });
  const payload = await response.json();
  assert.equal(payload.code, 0, payload.message);
  return payload.data;
}

test("core API flow creates chat, image, video and favorite records", async () => {
  await withServer(async (base) => {
    const conversation = await json(base, "/api/conversations", { method: "POST", body: JSON.stringify({ title: "测试会话" }) });
    assert.equal(conversation.title, "测试会话");
    const other = await json(base, "/api/conversations", { method: "POST", body: JSON.stringify({ title: "另一个会话" }) });

    const chat = await fetch(`${base}/api/chat`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ conversationId: conversation.id, message: "你好" }),
    });
    const streamText = await chat.text();
    assert.match(streamText, /event: done/);

    const messages = await json(base, `/api/conversations/${conversation.id}/messages`);
    assert.equal(messages.length, 2);

    const image = await json(base, "/api/images/generate", { method: "POST", body: JSON.stringify({ conversationId: conversation.id, prompt: "绿色工作台", n: 2 }) });
    await json(base, "/api/images/generate", { method: "POST", body: JSON.stringify({ conversationId: other.id, prompt: "蓝色工作台", n: 1 }) });
    assert.equal(image.image_urls.length, 2);
    assert.equal(image.conversation_id, conversation.id);
    const conversationImages = await json(base, `/api/images?conversationId=${conversation.id}`);
    assert.equal(conversationImages.length, 1);
    assert.equal(conversationImages[0].id, image.id);

    const video = await json(base, "/api/videos/generate", { method: "POST", body: JSON.stringify({ conversationId: conversation.id, prompt: "镜头推进" }) });
    const completed = await json(base, `/api/videos/${video.id}`);
    assert.equal(completed.status, "success");
    assert.ok(completed.video_url);
    assert.equal(completed.conversation_id, conversation.id);
    const otherVideos = await json(base, `/api/videos?conversationId=${other.id}`);
    assert.equal(otherVideos.length, 0);

    const favorite = await json(base, "/api/favorites", { method: "POST", body: JSON.stringify({ type: "image", ref_id: image.id }) });
    assert.equal(favorite.ref_id, image.id);

    await json(base, `/api/conversations/${conversation.id}`, { method: "DELETE" });
    const deletedMessages = await json(base, `/api/conversations/${conversation.id}/messages`);
    assert.equal(deletedMessages.length, 0);
    const deletedImages = await json(base, `/api/images?conversationId=${conversation.id}`);
    assert.equal(deletedImages.length, 0);
    const deletedVideos = await json(base, `/api/videos?conversationId=${conversation.id}`);
    assert.equal(deletedVideos.length, 0);
    const favorites = await json(base, "/api/favorites");
    assert.equal(favorites.some(item => item.ref_id === image.id), false);

    const otherImages = await json(base, `/api/images?conversationId=${other.id}`);
    assert.equal(otherImages.length, 1);
  });
});

test("default conversation title uses the first user prompt", async () => {
  await withServer(async (base) => {
    const conversation = await json(base, "/api/conversations", { method: "POST", body: JSON.stringify({}) });
    assert.equal(conversation.title, "新的创作会话");

    await json(base, "/api/images/generate", { method: "POST", body: JSON.stringify({ conversationId: conversation.id, prompt: "一张赛博风格的城市夜景，霓虹灯和雨水倒影" }) });
    const conversations = await json(base, "/api/conversations");
    const updated = conversations.find((item) => item.id === conversation.id);

    assert.equal(updated.title, "一张赛博风格的城市夜景，霓虹灯和雨水倒影");
  });
});

test("projects group conversations by project id and storage folder", async () => {
  await withServer(async (base, root) => {
    const projects = await json(base, "/api/projects");
    assert.ok(projects.some(item => item.name === "manju"));

    const project = await json(base, "/api/projects", { method: "POST", body: JSON.stringify({ name: "短剧项目", storage_mode: "existing", storage_path: "client-a/short-video" }) });
    assert.equal(project.storage_mode, "existing");
    assert.equal(project.storage_path, "client-a/short-video");
    await stat(path.join(root, "data", "projects", "client-a", "short-video", "csv"));
    await stat(path.join(root, "data", "projects", "client-a", "short-video", "media", "images"));
    await stat(path.join(root, "data", "projects", "client-a", "short-video", "media", "videos"));
    await writeFile(path.join(root, "data", "projects", "client-a", "short-video", "media", "images", "sample.png"), Buffer.from([137, 80, 78, 71]));
    const projectMedia = await fetch(`${base}/project-media/${project.id}/images/sample.png`);
    assert.equal(projectMedia.status, 200);
    assert.equal(projectMedia.headers.get("content-type"), "image/png");

    const assigned = await json(base, "/api/conversations", { method: "POST", body: JSON.stringify({ title: "项目会话", project_id: project.id }) });
    const unassigned = await json(base, "/api/conversations", { method: "POST", body: JSON.stringify({ title: "未归属会话" }) });

    assert.equal(assigned.project_id, project.id);
    assert.equal(unassigned.project_id, "");

    const projectConversations = await json(base, `/api/conversations?projectId=${project.id}`);
    assert.deepEqual(projectConversations.map(item => item.id), [assigned.id]);

    const unassignedConversations = await json(base, "/api/conversations?projectId=");
    assert.ok(unassignedConversations.some(item => item.id === unassigned.id));
    assert.equal(unassignedConversations.some(item => item.id === assigned.id), false);
  });
});

test("media endpoint serves local files and rejects path traversal", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "agnes-media-"));
  const mediaDir = path.join(root, "data", "media", "images", "2026-07-02");
  await mkdir(mediaDir, { recursive: true });
  await writeFile(path.join(mediaDir, "sample.png"), Buffer.from([137, 80, 78, 71]));
  const server = createServer(createAppContext(root, { mediaCacheEnabled: false }));
  await new Promise(resolve => server.listen(0, resolve));
  const address = server.address();
  const base = `http://127.0.0.1:${address.port}`;

  try {
    const ok = await fetch(`${base}/media/images/2026-07-02/sample.png`);
    assert.equal(ok.status, 200);
    assert.equal(ok.headers.get("content-type"), "image/png");

    const blocked = await fetch(`${base}/media/../../package.json`);
    assert.equal(blocked.status, 404);
  } finally {
    await new Promise(resolve => server.close(resolve));
    await rm(root, { recursive: true, force: true });
  }
});

test("upload endpoint stores image files under media uploads", async () => {
  await withServer(async (base) => {
    const form = new FormData();
    form.append("files", new Blob([Buffer.from([137, 80, 78, 71])], { type: "image/png" }), "sample.png");

    const response = await fetch(`${base}/api/uploads`, { method: "POST", body: form });
    const payload = await response.json();
    assert.equal(payload.code, 0, payload.message);
    assert.equal(payload.data.length, 1);
    assert.match(payload.data[0].url, /^\/media\/uploads\/\d{4}-\d{2}-\d{2}\/sample-[\w-]+\.png$/);

    const stored = await fetch(`${base}${payload.data[0].url}`);
    assert.equal(stored.status, 200);
    assert.equal(stored.headers.get("content-type"), "image/png");
  });
});
