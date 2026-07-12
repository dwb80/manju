/**
 * 清理并重新填充项目数据
 * 运行：node scripts/reset-projects.mjs
 */
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const PROJECTS = [
  { id: "proj-1", name: "星际迷航：新纪元", category: "科幻冒险漫剧", status: "active", description: "讲述人类在宇宙探索中发现新文明的科幻冒险故事，融合科幻元素与人文关怀", episode_count: 24, owner: "王导演", due_date: "2026-08-15", is_pinned: true, storage_path: "projects/star-trek" },
  { id: "proj-2", name: "江湖风云录", category: "古风武侠剧", status: "active", description: "古风武侠剧，讲述江湖侠客的恩怨情仇，融合传统武侠精神与现代叙事", episode_count: 36, owner: "李制片", due_date: "2026-09-20", is_pinned: true, storage_path: "projects/wuxia" },
  { id: "proj-3", name: "都市爱情故事", category: "现代都市爱情剧", status: "active", description: "讲述都市年轻人的爱情与成长，展现当代都市生活百态", episode_count: 12, owner: "张编辑", due_date: "2026-07-30", is_pinned: false, storage_path: "projects/city-love" },
  { id: "proj-4", name: "奇幻童话世界", category: "奇幻儿童剧", status: "active", description: "为儿童创作的奇幻童话故事，充满想象力和教育意义", episode_count: 18, owner: "刘导演", due_date: "2026-10-10", is_pinned: false, storage_path: "projects/fairy-tales" },
  { id: "proj-5", name: "悬疑推理剧场", category: "悬疑推理剧", status: "active", description: "悬疑推理题材，讲述侦探破解复杂案件的故事", episode_count: 16, owner: "赵编剧", due_date: "2026-08-25", is_pinned: false, storage_path: "projects/suspense" },
  { id: "proj-6", name: "热血青春校园", category: "青春校园剧", status: "active", description: "青春校园题材，讲述学生们的成长、友情与梦想", episode_count: 20, owner: "陈导演", due_date: "2026-09-15", is_pinned: false, storage_path: "projects/youth-campus" },
  { id: "proj-7", name: "历史传奇故事", category: "历史古装剧", status: "active", description: "历史题材古装剧，重现古代英雄人物和重大历史事件", episode_count: 40, owner: "周导演", due_date: "2026-11-01", is_pinned: false, storage_path: "projects/history" },
  { id: "proj-8", name: "搞笑日常漫剧", category: "搞笑喜剧剧", status: "completed", description: "轻松搞笑的日常故事，让观众在欢笑中感受生活乐趣", episode_count: 10, owner: "吴编剧", due_date: "2026-06-30", is_pinned: false, storage_path: "projects/comedy" },
  { id: "proj-9", name: "恐怖惊悚之夜", category: "恐怖惊悚剧", status: "completed", description: "恐怖惊悚题材，营造紧张刺激的氛围，挑战观众心理承受能力", episode_count: 8, owner: "郑导演", due_date: "2026-07-05", is_pinned: false, storage_path: "projects/horror" },
  { id: "proj-10", name: "运动竞技风云", category: "运动竞技剧", status: "completed", description: "运动竞技题材，讲述运动员们的拼搏精神和竞技故事", episode_count: 15, owner: "孙编剧", due_date: "2026-06-20", is_pinned: false, storage_path: "projects/sports" },
  { id: "proj-11", name: "音乐梦想之旅", category: "音乐励志剧", status: "archived", description: "音乐题材励志故事，讲述音乐人追逐梦想的历程", episode_count: 12, owner: "钱导演", due_date: "2026-05-30", is_pinned: false, storage_path: "projects/music-dream" },
];

const BACKEND = process.env.BACKEND_URL || "http://127.0.0.1:3000";

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

async function main() {
  // 1. 通过后端 API 列出并删除现有项目（统一存于 SQLite）
  console.log("Cleaning projects via backend API...");
  const existing = await api("/api/projects");
  const list = existing?.data ?? [];
  for (const p of list) {
    try {
      await api(`/api/projects/${p.id}`, { method: "DELETE" });
      console.log(`  - removed ${p.name} (${p.id})`);
    } catch (err) {
      console.log(`  ! failed to remove ${p.name} (${p.id}):`, err?.message ?? err);
    }
  }

  // 2. 等待片刻让 SQLite 事务落盘
  await new Promise((r) => setTimeout(r, 500));

  // 3. 重新创建项目
  console.log("\nRecreating projects...");
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
        is_pinned: p.is_pinned,
      }),
    });
    const id = created?.data?.id ?? "?";
    console.log(`  ✓ ${p.name.padEnd(20)}  -> ${id}`);

    // 设置 is_pinned
    if (p.is_pinned) {
      await api(`/api/projects/${id}`, {
        method: "PUT",
        body: JSON.stringify({ is_pinned: true }),
      });
    }
  }

  const list = await api("/api/projects");
  console.log(`\nFinal: ${list?.data?.length ?? 0} projects in DB`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
