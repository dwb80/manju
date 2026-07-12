const state = {
  activeTab: "chat",
  conversationId: "",
  conversations: [],
  videoPollTimer: 0,
  imageAttachment: null,
};

async function api(path, options = {}) {
  const response = await fetch(path, {
    headers: { "content-type": "application/json", ...(options.headers || {}) },
    ...options,
  });
  const payload = await response.json();
  if (payload.code !== 0) throw new Error(payload.message);
  return payload.data;
}

function statusText(status) {
  return {
    pending: "排队中",
    processing: "生成中",
    success: "已完成",
    failed: "失败",
  }[status] || status;
}

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text) node.textContent = text;
  return node;
}

function formatBytes(bytes) {
  if (!bytes) return "";
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

function renderImageAttachment() {
  const box = document.querySelector("#imageAttachmentPreview");
  box.replaceChildren();
  if (!state.imageAttachment) {
    box.className = "attachment-preview empty";
    return;
  }
  box.className = "attachment-preview";
  const card = el("div", "attachment-card");
  const img = el("img");
  img.src = state.imageAttachment.dataUrl;
  img.alt = state.imageAttachment.name;
  img.onclick = () => openImagePreview(state.imageAttachment.dataUrl, { id: "reference-image", prompt: state.imageAttachment.name });
  const meta = el("div", "attachment-meta");
  meta.append(
    el("strong", "", state.imageAttachment.name),
    el("small", "", state.imageAttachment.size ? `参考图 · ${formatBytes(state.imageAttachment.size)}` : "参考图"),
  );
  const remove = el("button", "attachment-remove", "×");
  remove.type = "button";
  remove.title = "移除参考图";
  remove.onclick = () => {
    state.imageAttachment = null;
    document.querySelector("#imageAttachmentInput").value = "";
    renderImageAttachment();
  };
  card.append(img, meta, remove);
  box.append(card);
}

async function attachImageFile(file) {
  if (!file) return;
  if (!file.type.startsWith("image/")) throw new Error("请选择图片文件");
  if (file.size > 10 * 1024 * 1024) throw new Error("图片不能超过 10MB");
  state.imageAttachment = {
    name: file.name,
    size: file.size,
    dataUrl: await readFileAsDataUrl(file),
  };
  renderImageAttachment();
}

function attachImageUrl(url) {
  state.imageAttachment = {
    name: "已生成图片",
    size: 0,
    dataUrl: url,
  };
  renderImageAttachment();
}

async function loadConversations() {
  state.conversations = await api("/api/conversations");
  if (!state.conversations.length) state.conversations = [await api("/api/conversations", { method: "POST", body: JSON.stringify({}) })];
  state.conversationId ||= state.conversations[0].id;
  renderConversations();
  await loadMessages();
}

function renderConversations() {
  const q = document.querySelector("#search").value.toLowerCase();
  const list = document.querySelector("#conversations");
  list.replaceChildren();
  state.conversations.filter(c => c.title.toLowerCase().includes(q)).forEach((conversation) => {
    const item = el("button", `item ${conversation.id === state.conversationId ? "active" : ""}`);
    item.textContent = `${conversation.is_pinned ? "★ " : ""}${conversation.title}`;
    item.onclick = async () => {
      state.conversationId = conversation.id;
      renderConversations();
      await loadMessages();
    };
    list.append(item);
  });
}

async function loadMessages() {
  const messages = await api(`/api/conversations/${state.conversationId}/messages`);
  const box = document.querySelector("#messages");
  box.replaceChildren();
  messages.forEach(renderMessage);
  box.scrollTop = box.scrollHeight;
}

function renderMessage(message) {
  const box = document.querySelector("#messages");
  const node = el("article", `message ${message.role}`, message.content);
  box.append(node);
  box.scrollTop = box.scrollHeight;
  return node;
}

async function sendChat(text) {
  renderMessage({ role: "user", content: text });
  const assistant = renderMessage({ role: "assistant", content: "" });
  const response = await fetch("/api/chat", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ conversationId: state.conversationId, message: text }),
  });
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const events = buffer.split("\n\n");
    buffer = events.pop() || "";
    for (const event of events) {
      const dataLine = event.split("\n").find(line => line.startsWith("data: "));
      if (!dataLine) continue;
      const chunk = JSON.parse(dataLine.slice(6));
      assistant.textContent += chunk.content || "";
    }
  }
  await loadConversations();
}

async function loadImages() {
  const images = await api("/api/images");
  const grid = document.querySelector("#images");
  const status = document.querySelector("#imageStatus");
  grid.replaceChildren();
  const total = images.reduce((sum, task) => sum + task.image_urls.length, 0);
  status.textContent = total ? `共 ${total} 张图片，${images.length} 个生成任务` : "还没有图片";
  images.forEach((task) => {
    task.image_urls.forEach((url) => {
      const card = el("article", "image-card");
      const img = el("img");
      img.src = url;
      img.alt = task.prompt;
      img.onclick = () => openImagePreview(url, task);
      const meta = el("div", "", task.prompt);
      const actions = el("div", "actions");
      const download = el("a", "", "下载");
      download.href = url;
      download.download = `${task.id}.png`;
      download.target = "_blank";
      const open = el("a", "", "打开");
      open.href = url;
      open.target = "_blank";
      const copy = el("button", "", "复制链接");
      copy.type = "button";
      copy.onclick = async () => {
        await navigator.clipboard.writeText(url);
        copy.textContent = "已复制";
      };
      const fav = el("button", "", "收藏");
      fav.type = "button";
      fav.onclick = () => api("/api/favorites", { method: "POST", body: JSON.stringify({ type: "image", ref_id: task.id }) }).then(loadFavorites);
      const edit = el("button", "", "继续编辑");
      edit.type = "button";
      edit.onclick = () => {
        const form = document.querySelector("#imageForm");
        attachImageUrl(url);
        form.prompt.focus();
      };
      const remove = el("button", "", "删除任务");
      remove.type = "button";
      remove.onclick = async () => {
        await api(`/api/images/${task.id}`, { method: "DELETE" });
        await loadImages();
      };
      actions.append(download, open, copy, fav, edit, remove);
      meta.append(actions);
      card.append(img, meta);
      grid.append(card);
    });
  });
}

function openImagePreview(url, task) {
  const dialog = document.querySelector("#imagePreview");
  const image = document.querySelector("#previewImage");
  const actions = document.querySelector("#previewActions");
  image.src = url;
  image.alt = task.prompt;
  actions.replaceChildren();
  const download = el("a", "", "下载");
  download.href = url;
  download.download = `${task.id}.png`;
  download.target = "_blank";
  const copy = el("button", "", "复制链接");
  copy.type = "button";
  copy.onclick = async () => {
    await navigator.clipboard.writeText(url);
    copy.textContent = "已复制";
  };
  const edit = el("button", "", "继续编辑");
  edit.type = "button";
  edit.onclick = () => {
    const form = document.querySelector("#imageForm");
    attachImageUrl(url);
    dialog.close();
    form.prompt.focus();
  };
  actions.append(download, copy, edit);
  dialog.showModal();
}

async function loadVideos() {
  const videos = await api("/api/videos");
  const list = document.querySelector("#videos");
  const status = document.querySelector("#videoStatus");
  list.replaceChildren();
  let hasRunningTask = false;
  status.textContent = videos.length ? `共 ${videos.length} 个视频任务` : "还没有视频任务";
  for (const task of videos) {
    const latest = ["pending", "processing"].includes(task.status) ? await api(`/api/videos/${task.id}`) : task;
    hasRunningTask ||= ["pending", "processing"].includes(latest.status);
    const item = el("article", "item");
    const title = el("div", "item-title");
    title.append(el("strong", "", latest.prompt), el("span", `status-pill ${latest.status}`, statusText(latest.status)));
    item.append(title, el("small", "", `${latest.params?.duration || 5}s · ${latest.params?.ratio || "16:9"} · ${new Date(latest.created_at).toLocaleString()}`));
    if (latest.error) item.append(el("p", "status-line", latest.error));
    if (latest.video_url) {
      const video = el("video");
      video.src = latest.video_url;
      video.controls = true;
      video.preload = "metadata";
      const actions = el("div", "actions");
      const download = el("a", "", "下载");
      download.href = latest.video_url;
      download.download = `${latest.id}.mp4`;
      download.target = "_blank";
      const open = el("a", "", "打开");
      open.href = latest.video_url;
      open.target = "_blank";
      const copy = el("button", "", "复制链接");
      copy.type = "button";
      copy.onclick = async () => {
        await navigator.clipboard.writeText(latest.video_url);
        copy.textContent = "已复制";
      };
      const fav = el("button", "", "收藏");
      fav.type = "button";
      fav.onclick = () => api("/api/favorites", { method: "POST", body: JSON.stringify({ type: "video", ref_id: latest.id }) }).then(loadFavorites);
      const remove = el("button", "", "删除");
      remove.type = "button";
      remove.onclick = async () => {
        await api(`/api/videos/${latest.id}`, { method: "DELETE" });
        await loadVideos();
      };
      actions.append(download, open, copy, fav, remove);
      item.append(video, actions);
    }
    list.append(item);
  }
  updateVideoPolling(hasRunningTask);
}

function updateVideoPolling(shouldPoll) {
  if (state.videoPollTimer) {
    clearInterval(state.videoPollTimer);
    state.videoPollTimer = 0;
  }
  if (shouldPoll && state.activeTab === "video") {
    // 评审 P1-M1 修复：30 次上限（3s × 30 = 90s），防止孤儿任务无限轮询
    state.videoPollCount = 0;
    state.videoPollTimer = window.setInterval(() => {
      state.videoPollCount = (state.videoPollCount || 0) + 1;
      if (state.videoPollCount > 30) {
        clearInterval(state.videoPollTimer);
        state.videoPollTimer = 0;
        const el = document.querySelector("#videoStatus");
        if (el) el.textContent = "视频轮询超时，请手动刷新";
        return;
      }
      loadVideos();
    }, 3000);
    document.querySelector("#videoStatus").textContent = "视频生成中，正在自动刷新";
  }
}

function stopVideoPolling() {
  if (!state.videoPollTimer) return;
  clearInterval(state.videoPollTimer);
  state.videoPollTimer = 0;
}

async function loadFavorites() {
  const favorites = await api("/api/favorites");
  const list = document.querySelector("#favoriteList");
  list.replaceChildren();
  favorites.forEach(f => list.append(el("article", "item", `${f.type} · ${f.ref_id}`)));
}

document.querySelectorAll("[data-tab]").forEach(button => {
  button.onclick = async () => {
    stopVideoPolling();
    state.activeTab = button.dataset.tab;
    document.querySelectorAll("[data-tab]").forEach(b => b.classList.remove("active"));
    document.querySelectorAll(".panel").forEach(p => p.classList.remove("active"));
    button.classList.add("active");
    document.querySelector(`#${button.dataset.tab}`).classList.add("active");
    if (button.dataset.tab === "image") await loadImages();
    if (button.dataset.tab === "video") await loadVideos();
    if (button.dataset.tab === "favorites") await loadFavorites();
  };
});

document.querySelector("#newConversation").onclick = async () => {
  const conversation = await api("/api/conversations", { method: "POST", body: JSON.stringify({ title: "新的创作会话" }) });
  state.conversationId = conversation.id;
  await loadConversations();
};
document.querySelector("#search").oninput = renderConversations;
document.querySelector("#chatInput").onkeydown = (event) => {
  if (event.key === "Enter" && !event.shiftKey) {
    event.preventDefault();
    document.querySelector("#chatForm").requestSubmit();
  }
};
document.querySelector("#chatForm").onsubmit = async (event) => {
  event.preventDefault();
  const input = document.querySelector("#chatInput");
  const text = input.value.trim();
  if (!text) return;
  input.value = "";
  await sendChat(text);
};
document.querySelector("#stopChat").onclick = () => api("/api/chat/stop", { method: "POST", body: JSON.stringify({ conversationId: state.conversationId }) });
document.querySelector("#imageForm").onsubmit = async (event) => {
  event.preventDefault();
  const button = event.target.querySelector("button[type=submit]");
  button.disabled = true;
  button.textContent = "生成中";
  document.querySelector("#imageStatus").textContent = "图片生成中";
  try {
    const payload = Object.fromEntries(new FormData(event.target));
    if (state.imageAttachment) payload.image = state.imageAttachment.dataUrl;
    await api("/api/images/generate", { method: "POST", body: JSON.stringify(payload) });
    event.target.reset();
    state.imageAttachment = null;
    renderImageAttachment();
    await loadImages();
  } finally {
    button.disabled = false;
    button.textContent = "生成图片";
  }
};
document.querySelector("#refreshImages").onclick = loadImages;
document.querySelector("#closePreview").onclick = () => document.querySelector("#imagePreview").close();
document.querySelector("#pickImageAttachment").onclick = () => document.querySelector("#imageAttachmentInput").click();
document.querySelector("#imageAttachmentInput").onchange = async (event) => {
  try {
    await attachImageFile(event.target.files?.[0]);
  } catch (error) {
    document.querySelector("#imageStatus").textContent = error.message;
  }
};
document.querySelector("#imageForm").ondragover = (event) => {
  event.preventDefault();
  document.querySelector("#pickImageAttachment").classList.add("active");
};
document.querySelector("#imageForm").ondragleave = () => {
  document.querySelector("#pickImageAttachment").classList.remove("active");
};
document.querySelector("#imageForm").ondrop = async (event) => {
  event.preventDefault();
  document.querySelector("#pickImageAttachment").classList.remove("active");
  try {
    await attachImageFile(event.dataTransfer.files?.[0]);
  } catch (error) {
    document.querySelector("#imageStatus").textContent = error.message;
  }
};
document.querySelector("#videoForm").onsubmit = async (event) => {
  event.preventDefault();
  const button = event.target.querySelector("button[type=submit]");
  button.disabled = true;
  button.textContent = "提交中";
  try {
    await api("/api/videos/generate", { method: "POST", body: JSON.stringify(Object.fromEntries(new FormData(event.target))) });
    event.target.reset();
    await loadVideos();
  } finally {
    button.disabled = false;
    button.textContent = "提交视频任务";
  }
};
document.querySelector("#refreshVideos").onclick = loadVideos;
document.querySelector("#settingsForm").onsubmit = async (event) => {
  event.preventDefault();
  await api("/api/settings", { method: "PUT", body: JSON.stringify(Object.fromEntries(new FormData(event.target))) });
};

await loadConversations();
