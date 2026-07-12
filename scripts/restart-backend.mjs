/**
 * 启动后端（dev 已编译后） - 关闭旧进程、清空 SQLite 中的项目数据、启动新进程、重新插入测试项目
 * 用法：node scripts/restart-backend.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { spawn, execSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BACKEND_DIR = path.join(__dirname, "..", "backend");
const DATABASE_FILE = path.join(BACKEND_DIR, "data", "sqlite.db");
const BACKEND = process.env.BACKEND_URL || "http://127.0.0.1:3000";

const PROJECTS = [
  { name: "星际迷航：新纪元", category: "科幻冒险漫剧", status: "active", description: "讲述人类在宇宙探索中发现新文明的科幻冒险故事，融合科幻元素与人文关怀", episode_count: 24, owner: "王导演", due_date: "2026-08-15", is_pinned: true, storage_path: "projects/star-trek" },
  { name: "江湖风云录", category: "古风武侠剧", status: "active", description: "古风武侠剧，讲述江湖侠客的恩怨情仇，融合传统武侠精神与现代叙事", episode_count: 36, owner: "李制片", due_date: "2026-09-20", is_pinned: true, storage_path: "projects/wuxia" },
  { name: "都市爱情故事", category: "现代都市爱情剧", status: "active", description: "讲述都市年轻人的爱情与成长，展现当代都市生活百态", episode_count: 12, owner: "张编辑", due_date: "2026-07-30", is_pinned: false, storage_path: "projects/city-love" },
  { name: "奇幻童话世界", category: "奇幻儿童剧", status: "active", description: "为儿童创作的奇幻童话故事，充满想象力和教育意义", episode_count: 18, owner: "刘导演", due_date: "2026-10-10", is_pinned: false, storage_path: "projects/fairy-tales" },
  { name: "悬疑推理剧场", category: "悬疑推理剧", status: "active", description: "悬疑推理题材，讲述侦探破解复杂案件的故事", episode_count: 16, owner: "赵编剧", due_date: "2026-08-25", is_pinned: false, storage_path: "projects/suspense" },
  { name: "热血青春校园", category: "青春校园剧", status: "active", description: "青春校园题材，讲述学生们的成长、友情与梦想", episode_count: 20, owner: "陈导演", due_date: "2026-09-15", is_pinned: false, storage_path: "projects/youth-campus" },
  { name: "历史传奇故事", category: "历史古装剧", status: "active", description: "历史题材古装剧，重现古代英雄人物和重大历史事件", episode_count: 40, owner: "周导演", due_date: "2026-11-01", is_pinned: false, storage_path: "projects/history" },
  { name: "搞笑日常漫剧", category: "搞笑喜剧剧", status: "completed", description: "轻松搞笑的日常故事，让观众在欢笑中感受生活乐趣", episode_count: 10, owner: "吴编剧", due_date: "2026-06-30", is_pinned: false, storage_path: "projects/comedy" },
  { name: "恐怖惊悚之夜", category: "恐怖惊悚剧", status: "completed", description: "恐怖惊悚题材，营造紧张刺激的氛围，挑战观众心理承受能力", episode_count: 8, owner: "郑导演", due_date: "2026-07-05", is_pinned: false, storage_path: "projects/horror" },
  { name: "运动竞技风云", category: "运动竞技剧", status: "completed", description: "运动竞技题材，讲述运动员们的拼搏精神和竞技故事", episode_count: 15, owner: "孙编剧", due_date: "2026-06-20", is_pinned: false, storage_path: "projects/sports" },
  { name: "音乐梦想之旅", category: "音乐励志剧", status: "archived", description: "音乐题材励志故事，讲述音乐人追逐梦想的历程", episode_count: 12, owner: "钱导演", due_date: "2026-05-30", is_pinned: false, storage_path: "projects/music-dream" },
];

async function api(pathname, options = {}) {
  const res = await fetch(`${BACKEND}${pathname}`, {
    headers: { "content-type": "application/json" },
    ...options,
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`${res.status} ${pathname}: ${text}`);
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

function killOldBackend() {
  console.log("Killing existing backend on port 3000...");
  try {
    if (process.platform === "win32") {
      const out = execSync("netstat -ano | Select-String ':3000.*LISTENING'", { shell: "powershell", encoding: "utf8" });
      const pids = [...out.matchAll(/LISTENING\s+(\d+)/g)].map((m) => m[1]);
      for (const pid of pids) {
        try { execSync(`Stop-Process -Id ${pid} -Force`, { shell: "powershell" }); } catch {}
        console.log(`  stopped PID ${pid}`);
      }
    } else {
      try { execSync("fuser -k 3000/tcp 2>/dev/null"); } catch {}
    }
  } catch (e) {
    console.log("  (no process to kill)");
  }
}

function startBackend() {
  console.log("Starting backend...");
  const child = spawn("node", ["dist/server.js"], {
    cwd: BACKEND_DIR,
    detached: true,
    stdio: ["ignore", "ignore", "ignore"],
    windowsHide: true,
  });
  child.unref();
  console.log("  spawned backend");
}

async function waitBackend(retries = 30) {
  for (let i = 0; i < retries; i += 1) {
    try {
      const res = await fetch(`${BACKEND}/api/projects`);
      if (res.ok) return;
    } catch {}
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error("Backend did not start in time");
}

async function main() {
  killOldBackend();
  await new Promise((r) => setTimeout(r, 1500));
  console.log("\nClearing projects data in SQLite...");
  clearProjectsData();
  startBackend();
  console.log("Waiting for backend...");
  await waitBackend();
  console.log("Backend is up.\n");

  for (const p of PROJECTS) {
    const created = await api("/api/projects", {
      method: "POST",
      body: JSON.stringify({
        name: p.name,
        category: p.category,
        status: p.status,
        description: p.description,
        episode_count: p.episode_count,
        owner: p.owner,
        due_date: p.due_date,
        storage_path: p.storage_path,
      }),
    });
    const id = created?.data?.id ?? "?";
    if (p.is_pinned && id !== "?") {
      await api(`/api/projects/${id}`, {
        method: "PUT",
        body: JSON.stringify({ is_pinned: true }),
      });
    }
    console.log(`  ✓ ${p.name.padEnd(20)}  -> ${id} ${p.is_pinned ? "(置顶)" : ""}`);
  }

  const list = await api("/api/projects");
  console.log(`\nFinal: ${list?.data?.length ?? 0} projects in DB`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
