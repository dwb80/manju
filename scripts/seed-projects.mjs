/**
 * 种子数据脚本：把前端 mock-data 中的项目批量导入后端数据库
 * 运行：node scripts/seed-projects.mjs
 */
const PROJECTS = [
  { id: "proj-1", name: "星际迷航：新纪元", category: "科幻冒险漫剧", status: "active", description: "讲述人类在宇宙探索中发现新文明的科幻冒险故事，融合科幻元素与人文关怀", episode_count: 24, owner: "王导演", due_date: "2026-08-15", is_pinned: true, created_at: "2026-06-01T09:00:00Z", updated_at: "2026-07-09T10:30:00Z", storage_path: "/projects/star-trek" },
  { id: "proj-2", name: "江湖风云录", category: "古风武侠剧", status: "active", description: "古风武侠剧，讲述江湖侠客的恩怨情仇，融合传统武侠精神与现代叙事", episode_count: 36, owner: "李制片", due_date: "2026-09-20", is_pinned: true, created_at: "2026-05-15T11:00:00Z", updated_at: "2026-07-08T14:20:00Z", storage_path: "/projects/wuxia" },
  { id: "proj-3", name: "都市爱情故事", category: "现代都市爱情剧", status: "active", description: "讲述都市年轻人的爱情与成长，展现当代都市生活百态", episode_count: 12, owner: "张编辑", due_date: "2026-07-30", is_pinned: false, created_at: "2026-07-01T10:00:00Z", updated_at: "2026-07-09T08:00:00Z", storage_path: "/projects/city-love" },
  { id: "proj-4", name: "奇幻童话世界", category: "奇幻儿童剧", status: "active", description: "为儿童创作的奇幻童话故事，充满想象力和教育意义", episode_count: 18, owner: "刘导演", due_date: "2026-10-10", is_pinned: false, created_at: "2026-06-20T08:00:00Z", updated_at: "2026-07-07T15:00:00Z", storage_path: "/projects/fairy-tales" },
  { id: "proj-5", name: "悬疑推理剧场", category: "悬疑推理剧", status: "active", description: "悬疑推理题材，讲述侦探破解复杂案件的故事", episode_count: 16, owner: "赵编剧", due_date: "2026-08-25", is_pinned: false, created_at: "2026-07-05T12:00:00Z", updated_at: "2026-07-09T11:00:00Z", storage_path: "/projects/suspense" },
  { id: "proj-6", name: "热血青春校园", category: "青春校园剧", status: "active", description: "青春校园题材，讲述学生们的成长、友情与梦想", episode_count: 20, owner: "陈导演", due_date: "2026-09-15", is_pinned: false, created_at: "2026-06-10T09:30:00Z", updated_at: "2026-07-08T16:00:00Z", storage_path: "/projects/youth-campus" },
  { id: "proj-7", name: "历史传奇故事", category: "历史古装剧", status: "active", description: "历史题材古装剧，重现古代英雄人物和重大历史事件", episode_count: 40, owner: "周导演", due_date: "2026-11-01", is_pinned: false, created_at: "2026-05-01T10:00:00Z", updated_at: "2026-07-06T13:00:00Z", storage_path: "/projects/history" },
  { id: "proj-8", name: "搞笑日常漫剧", category: "搞笑喜剧剧", status: "completed", description: "轻松搞笑的日常故事，让观众在欢笑中感受生活乐趣", episode_count: 10, owner: "吴编剧", due_date: "2026-06-30", is_pinned: false, created_at: "2026-03-01T08:00:00Z", updated_at: "2026-06-30T17:00:00Z", storage_path: "/projects/comedy" },
  { id: "proj-9", name: "恐怖惊悚之夜", category: "恐怖惊悚剧", status: "completed", description: "恐怖惊悚题材，营造紧张刺激的氛围，挑战观众心理承受能力", episode_count: 8, owner: "郑导演", due_date: "2026-07-05", is_pinned: false, created_at: "2026-04-15T14:00:00Z", updated_at: "2026-07-05T20:00:00Z", storage_path: "/projects/horror" },
  { id: "proj-10", name: "运动竞技风云", category: "运动竞技剧", status: "completed", description: "运动竞技题材，讲述运动员们的拼搏精神和竞技故事", episode_count: 15, owner: "孙编剧", due_date: "2026-06-20", is_pinned: false, created_at: "2026-02-01T10:00:00Z", updated_at: "2026-06-20T18:00:00Z", storage_path: "/projects/sports" },
  { id: "proj-11", name: "音乐梦想之旅", category: "音乐励志剧", status: "archived", description: "音乐题材励志故事，讲述音乐人追逐梦想的历程", episode_count: 12, owner: "钱导演", due_date: "2026-05-30", is_pinned: false, created_at: "2026-01-10T09:00:00Z", updated_at: "2026-05-30T15:00:00Z", storage_path: "/projects/music-dream" },
];

const BACKEND = process.env.BACKEND_URL || "http://127.0.0.1:3000";

async function main() {
  console.log(`POSTing ${PROJECTS.length} projects to ${BACKEND} ...`);
  for (const p of PROJECTS) {
    const res = await fetch(`${BACKEND}/api/projects`, {
      method: "POST",
      headers: { "content-type": "application/json" },
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
    const text = await res.text();
    if (!res.ok) {
      console.error(`  ✗ ${p.name}: ${res.status} ${text}`);
    } else {
      const payload = JSON.parse(text);
      const id = payload?.data?.id ?? "?";
      console.log(`  ✓ ${p.name}  -> ${id}`);
    }
  }
  const list = await fetch(`${BACKEND}/api/projects`).then((r) => r.json());
  console.log(`\nFinal: ${list?.data?.length ?? 0} projects in DB`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
