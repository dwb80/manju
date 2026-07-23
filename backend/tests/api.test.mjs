import assert from "node:assert/strict";
import { mkdtemp, mkdir, rm, stat, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { createServer } from "../dist/src/http/router.js";
import { createAppContext } from "../dist/src/services/app.js";
import { FakeAIClient } from "../dist/src/ai/fake-ai-client.js";

async function withServer(fn) {
  const root = await mkdtemp(path.join(os.tmpdir(), "agnes-api-"));
  const ctx = await createAppContext(root, { mediaCacheEnabled: false, aiClient: new FakeAIClient() });
  const server = createServer(ctx);
  await new Promise(resolve => server.listen(0, resolve));
  const address = server.address();
  const base = `http://127.0.0.1:${address.port}`;
  try {
    await fn(base, root);
  } finally {
    await new Promise(resolve => server.close(resolve));
    await ctx.close();
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

    const project = await json(base, "/api/projects", { method: "POST", body: JSON.stringify({ name: "短剧项目", owner: "local-admin", storage_mode: "existing", storage_path: "client-a/short-video" }) });
    assert.equal(project.storage_mode, "existing");
    assert.equal(project.storage_path, "client-a/short-video");
    // 评审 P0-H14 修复：createProject 会自动建约定的项目目录树
    // （主数据走 SQLite，目录只承担媒体/导出/上传），测试同步检查这几个目录
    await stat(path.join(root, "data", "projects", "client-a", "short-video", "exports"));
    await stat(path.join(root, "data", "projects", "client-a", "short-video", "media", "images"));
    await stat(path.join(root, "data", "projects", "client-a", "short-video", "media", "videos"));
    await stat(path.join(root, "data", "projects", "client-a", "short-video", "uploads"));
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
  const ctx = await createAppContext(root, { mediaCacheEnabled: false, aiClient: new FakeAIClient() });
  const server = createServer(ctx);
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
    await ctx.close();
    await rm(root, { recursive: true, force: true });
  }
});

test("upload endpoint stores image files under media uploads", async () => {
  await withServer(async (base) => {
    const form = new FormData();
    form.append("files", new Blob([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10, 0])], { type: "image/png" }), "sample.png");

    const response = await fetch(`${base}/api/uploads`, { method: "POST", body: form });
    const payload = await response.json();
    assert.equal(payload.code, 0, payload.message);
    assert.equal(payload.data.length, 1);
    assert.match(payload.data[0].url, /^\/media\/uploads\/local-admin\/\d{4}-\d{2}-\d{2}\/[0-9a-f-]{36}\.png$/);

    const stored = await fetch(`${base}${payload.data[0].url}`);
    assert.equal(stored.status, 200);
    assert.equal(stored.headers.get("content-type"), "image/png");
  });
});

test("assistant feedback is persisted, replaceable and removable", async () => {
  await withServer(async (base) => {
    const conversation = await json(base, "/api/assistant/conversations", {
      method: "POST",
      body: JSON.stringify({ title: "反馈测试" }),
    });
    const message = await json(base, `/api/assistant/conversations/${conversation.id}/messages`, {
      method: "POST",
      body: JSON.stringify({ role: "assistant", content: "请评价这条回答", meta: { model: "fake" } }),
    });

    const liked = await json(base, `/api/assistant/messages/${message.id}/feedback`, {
      method: "PATCH",
      body: JSON.stringify({ feedback: "up" }),
    });
    assert.equal(liked.meta.feedback, "up");
    assert.ok(liked.meta.feedback_at);

    const disliked = await json(base, `/api/assistant/messages/${message.id}/feedback`, {
      method: "PATCH",
      body: JSON.stringify({ feedback: "down" }),
    });
    assert.equal(disliked.meta.feedback, "down");

    const cleared = await json(base, `/api/assistant/messages/${message.id}/feedback`, {
      method: "PATCH",
      body: JSON.stringify({ feedback: null }),
    });
    assert.equal("feedback" in cleared.meta, false);
    assert.equal(cleared.meta.model, "fake");

    const messages = await json(base, `/api/assistant/conversations/${conversation.id}/messages`);
    assert.equal("feedback" in messages[0].meta, false);
  });
});

test("project workbench routes support nested resources, summary and exports", async () => {
  await withServer(async (base) => {
    const project = await json(base, "/api/projects", { method: "POST", body: JSON.stringify({ name: "工作台回归项目", owner: "local-admin" }) });
    const other = await json(base, "/api/projects", { method: "POST", body: JSON.stringify({ name: "隔离项目", owner: "local-admin" }) });

    const member = await json(base, `/api/projects/${project.id}/members`, { method: "POST", body: JSON.stringify({ name: "导演", role: "负责人" }) });
    const episode = await json(base, `/api/projects/${project.id}/episodes`, { method: "POST", body: JSON.stringify({ episode: 1, title: "第一集" }) });
    const task = await json(base, `/api/projects/${project.id}/tasks`, { method: "POST", body: JSON.stringify({ title: "绘制分镜" }) });
    const issue = await json(base, `/api/projects/${project.id}/issues`, { method: "POST", body: JSON.stringify({ title: "角色一致性", severity: "high" }) });
    const milestone = await json(base, `/api/projects/${project.id}/milestones`, { method: "POST", body: JSON.stringify({ title: "首集交付" }) });
    const script = await json(base, `/api/projects/${project.id}/scripts`, { method: "POST", body: JSON.stringify({ episode: 1, title: "第一集剧本", content: "场景：雨夜街道" }) });
    const storyboard = await json(base, `/api/projects/${project.id}/storyboards`, { method: "POST", body: JSON.stringify({ episode: 1, title: "街道远景", prompt: "雨夜街道远景" }) });
    const review = await json(base, `/api/projects/${project.id}/reviews`, { method: "POST", body: JSON.stringify({ target_type: "storyboard", target_id: storyboard.id, comment: "需要加强光影" }) });
    const clip = await json(base, `/api/projects/${project.id}/clips`, { method: "POST", body: JSON.stringify({ storyboard_id: storyboard.id, title: "镜头一" }) });

    assert.equal((await json(base, `/api/projects/${project.id}/members`))[0].id, member.id);
    assert.equal((await json(base, `/api/projects/${project.id}/episodes`))[0].id, episode.id);
    assert.equal((await json(base, `/api/projects/${project.id}/scripts`))[0].id, script.id);
    assert.equal((await json(base, `/api/projects/${project.id}/reviews`))[0].id, review.id);
    assert.equal((await json(base, `/api/projects/${project.id}/clips`))[0].id, clip.id);

    const softDeleted = await json(base, `/api/projects/${project.id}/scripts/${script.id}`, { method: "DELETE" });
    assert.ok(softDeleted.deleted_at);
    assert.equal((await json(base, `/api/projects/${project.id}/scripts`)).length, 0);
    assert.equal((await json(base, `/api/projects/${project.id}/scripts?deleted=1`))[0].id, script.id);
    const restoredScript = await json(base, `/api/projects/${project.id}/scripts/${script.id}/restore`, { method: "POST" });
    assert.equal(restoredScript.id, script.id);

    const completed = await json(base, `/api/projects/${project.id}/tasks/${task.id}`, { method: "PUT", body: JSON.stringify({ status: "done" }) });
    assert.equal(completed.status, "done");
    const resolved = await json(base, `/api/projects/${project.id}/issues/${issue.id}`, { method: "PUT", body: JSON.stringify({ status: "resolved" }) });
    assert.equal(resolved.status, "resolved");
    await json(base, `/api/projects/${project.id}/milestones/${milestone.id}`, { method: "PUT", body: JSON.stringify({ status: "done" }) });

    const summary = await json(base, `/api/projects/${project.id}/summary`);
    assert.equal(summary.members, 1);
    assert.equal(summary.episodes, 1);
    assert.equal(summary.tasks, 1);
    assert.equal(summary.completed_tasks, 1);
    assert.equal(summary.open_issues, 0);
    assert.equal(summary.open_milestones, 0);

    const crossProject = await fetch(`${base}/api/projects/${other.id}/tasks/${task.id}`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ status: "done" }),
    });
    assert.notEqual(crossProject.status, 200);

    const manifest = await json(base, `/api/projects/${project.id}/exports/manifest.json`);
    assert.equal(manifest.project.id, project.id);
    const csv = await fetch(`${base}/api/projects/${project.id}/exports/storyboards.csv`);
    assert.equal(csv.status, 200);
    assert.match(await csv.text(), /街道远景/);
    const scriptsText = await fetch(`${base}/api/projects/${project.id}/exports/scripts.txt`);
    assert.equal(scriptsText.status, 200);
    assert.match(await scriptsText.text(), /第一集剧本/);
  });
});

test("settings never echo API keys and preserve or clear the stored secret explicitly", async () => {
  await withServer(async (base) => {
    const saved = await json(base, "/api/settings", { method: "PUT", body: JSON.stringify({ apiKey: "test-secret-value", apiProvider: "agnes" }) });
    assert.equal("apiKey" in saved, false);
    assert.equal(saved.apiKeyConfigured, true);

    const preserved = await json(base, "/api/settings", { method: "PUT", body: JSON.stringify({ theme: "dark" }) });
    assert.equal(preserved.apiKeyConfigured, true);
    assert.equal("apiKey" in preserved, false);

    const loaded = await json(base, "/api/settings");
    assert.equal(loaded.apiKeyConfigured, true);
    assert.equal("apiKey" in loaded, false);

    const cleared = await json(base, "/api/settings", { method: "PUT", body: JSON.stringify({ clearApiKey: true }) });
    assert.equal(cleared.apiKeyConfigured, false);
    assert.equal("apiKey" in cleared, false);
  });
});

test("publish plans persist and validate referenced videos", async () => {
  await withServer(async (base) => {
    const project = await json(base, "/api/projects", { method: "POST", body: JSON.stringify({ name: "发布测试项目", owner: "local-admin" }) });
    const projectOverview = await json(base, `/api/data/project-overview?projectId=${project.id}`);
    assert.equal(projectOverview.projectId, project.id);
    assert.equal(projectOverview.capacity.project_id, project.id);
    const conversation = await json(base, "/api/conversations", { method: "POST", body: JSON.stringify({ title: "发布测试", project_id: project.id }) });
    const video = await json(base, "/api/videos/generate", { method: "POST", body: JSON.stringify({ conversationId: conversation.id, prompt: "发布成片" }) });
    await json(base, `/api/videos/${video.id}`);

    const plan = await json(base, "/api/publish/plans", { method: "POST", body: JSON.stringify({ projectId: project.id, name: "周五发布", status: "scheduled", videos: [video.id], platforms: ["douyin"], assignee: "运营" }) });
    assert.equal(plan.name, "周五发布");
    assert.deepEqual(plan.videos, [video.id]);
    assert.deepEqual(plan.platforms, ["douyin"]);
    assert.equal((await json(base, "/api/publish/plans")).length, 1);

    const updated = await json(base, `/api/publish/plans/${plan.id}`, { method: "PUT", body: JSON.stringify({ status: "published" }) });
    assert.equal(updated.status, "published");
    await json(base, `/api/publish/plans/${plan.id}`, { method: "DELETE" });
    assert.equal((await json(base, "/api/publish/plans")).length, 0);
  });
});

test("security baseline masks model secrets, limits JSON bodies and rejects unknown origins", async () => {
  await withServer(async (base) => {
    const modelsResponse = await fetch(`${base}/api/models`);
    const modelsPayload = await modelsResponse.json();
    assert.equal(modelsPayload.code, 0);
    assert.ok(Array.isArray(modelsPayload.data));
    for (const model of modelsPayload.data) {
      const headers = model.api_config?.headers ?? {};
      assert.equal(Object.keys(headers).some((key) => /authorization|api-key/i.test(key)), false);
    }

    const tooLarge = await fetch(`${base}/api/settings`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ value: "x".repeat(1024 * 1024 + 1) }),
    });
    assert.equal(tooLarge.status, 413);

    const rejectedOrigin = await fetch(`${base}/api/health`, {
      headers: { origin: "https://malicious.example" },
    });
    assert.equal(rejectedOrigin.status, 403);
  });
});
