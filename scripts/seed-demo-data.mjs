import { createRequire } from "node:module";
import path from "node:path";
import { mkdirSync } from "node:fs";

const require = createRequire(import.meta.url);
const sqlite = require("node:sqlite");

const DB_FILE = path.resolve(process.argv[2] || "./data/app.sqlite");

console.log(`Using database: ${DB_FILE}`);

mkdirSync(path.dirname(DB_FILE), { recursive: true });
const db = new sqlite.DatabaseSync(DB_FILE);

db.exec("PRAGMA journal_mode = WAL");

db.exec(`
  CREATE TABLE IF NOT EXISTS projects (
    id TEXT PRIMARY KEY,
    name TEXT,
    category TEXT,
    status TEXT,
    description TEXT,
    episode_count INTEGER,
    owner TEXT,
    due_date TEXT,
    is_default INTEGER,
    is_pinned INTEGER,
    created_at TEXT,
    updated_at TEXT,
    storage_path TEXT,
    storage_mode TEXT,
    archived_at TEXT
  )
`);

const now = new Date().toISOString();
const yesterday = new Date(Date.now() - 86400000).toISOString();
const lastWeek = new Date(Date.now() - 7 * 86400000).toISOString();

const projects = [
  {
    id: "p-demo-001",
    name: "盛唐异闻录",
    category: "古风 / 悬疑",
    status: "制作中",
    description: "以唐朝长安城为背景的悬疑探案短剧，融合历史考据与奇幻元素。",
    episode_count: 12,
    owner: "李明",
    due_date: "2026-08-15",
    is_default: 0,
    is_pinned: 1,
    created_at: lastWeek,
    updated_at: yesterday,
    storage_path: "盛唐异闻录-p-demo-001",
    storage_mode: "managed",
    archived_at: "",
  },
  {
    id: "p-demo-002",
    name: "赛博朋克2077同人",
    category: "科幻 / 动作",
    status: "策划中",
    description: "夜之城边缘人的生存故事，探索义体改造与人性的边界。",
    episode_count: 8,
    owner: "张薇",
    due_date: "2026-09-30",
    is_default: 0,
    is_pinned: 0,
    created_at: lastWeek,
    updated_at: lastWeek,
    storage_path: "赛博朋克2077同人-p-demo-002",
    storage_mode: "managed",
    archived_at: "",
  },
  {
    id: "p-demo-003",
    name: "山海经异兽志",
    category: "神话 / 奇幻",
    status: "剧本完成",
    description: "根据《山海经》改编的神话冒险系列，展现上古异兽与人类的共存故事。",
    episode_count: 20,
    owner: "王浩",
    due_date: "2026-10-20",
    is_default: 0,
    is_pinned: 1,
    created_at: yesterday,
    updated_at: yesterday,
    storage_path: "山海经异兽志-p-demo-003",
    storage_mode: "managed",
    archived_at: "",
  },
  {
    id: "p-demo-004",
    name: "都市怪谈录",
    category: "恐怖 / 悬疑",
    status: "分镜中",
    description: "现代都市中的灵异事件调查，每集一个独立故事。",
    episode_count: 10,
    owner: "陈静",
    due_date: "2026-08-30",
    is_default: 0,
    is_pinned: 0,
    created_at: yesterday,
    updated_at: now,
    storage_path: "都市怪谈录-p-demo-004",
    storage_mode: "managed",
    archived_at: "",
  },
  {
    id: "p-demo-005",
    name: "星际探险家",
    category: "科幻 / 冒险",
    status: "交付中",
    description: "人类首次星际移民的冒险故事，探索未知星球的生态与文明。",
    episode_count: 6,
    owner: "刘洋",
    due_date: "2026-07-20",
    is_default: 0,
    is_pinned: 0,
    created_at: lastWeek,
    updated_at: now,
    storage_path: "星际探险家-p-demo-005",
    storage_mode: "managed",
    archived_at: "",
  },
];

const stmt = db.prepare(`
  INSERT OR REPLACE INTO projects
  (id, name, category, status, description, episode_count, owner, due_date, is_default, is_pinned, created_at, updated_at, storage_path, storage_mode, archived_at)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);

for (const p of projects) {
  stmt.run(
    p.id, p.name, p.category, p.status, p.description,
    p.episode_count, p.owner, p.due_date, p.is_default, p.is_pinned,
    p.created_at, p.updated_at, p.storage_path, p.storage_mode, p.archived_at
  );
  console.log(`Inserted project: ${p.name}`);
}

// Create related tables for demo data
db.exec(`
  CREATE TABLE IF NOT EXISTS project_members (
    id TEXT PRIMARY KEY,
    project_id TEXT,
    name TEXT,
    role TEXT,
    contact TEXT,
    notes TEXT,
    created_at TEXT,
    updated_at TEXT
  )
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS project_episodes (
    id TEXT PRIMARY KEY,
    project_id TEXT,
    episode INTEGER,
    title TEXT,
    status TEXT,
    summary TEXT,
    due_date TEXT,
    notes TEXT,
    created_at TEXT,
    updated_at TEXT
  )
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS project_tasks (
    id TEXT PRIMARY KEY,
    project_id TEXT,
    title TEXT,
    status TEXT,
    owner TEXT,
    due_date TEXT,
    notes TEXT,
    created_at TEXT,
    updated_at TEXT
  )
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS project_milestones (
    id TEXT PRIMARY KEY,
    project_id TEXT,
    title TEXT,
    status TEXT,
    owner TEXT,
    due_date TEXT,
    description TEXT,
    created_at TEXT,
    updated_at TEXT
  )
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS project_issues (
    id TEXT PRIMARY KEY,
    project_id TEXT,
    title TEXT,
    severity TEXT,
    status TEXT,
    owner TEXT,
    target_type TEXT,
    target_id TEXT,
    notes TEXT,
    created_at TEXT,
    updated_at TEXT
  )
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS project_scripts (
    id TEXT PRIMARY KEY,
    project_id TEXT,
    episode INTEGER,
    title TEXT,
    content TEXT,
    status TEXT,
    notes TEXT,
    created_at TEXT,
    updated_at TEXT
  )
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS project_storyboards (
    id TEXT PRIMARY KEY,
    project_id TEXT,
    episode INTEGER,
    scene TEXT,
    shot TEXT,
    title TEXT,
    description TEXT,
    dialogue TEXT,
    characters TEXT,
    character_asset_ids TEXT,
    location TEXT,
    scene_asset_id TEXT,
    shot_size TEXT,
    camera_move TEXT,
    duration INTEGER,
    prompt TEXT,
    image_task_id TEXT,
    image_url TEXT,
    video_task_id TEXT,
    video_url TEXT,
    status TEXT,
    notes TEXT,
    created_at TEXT,
    updated_at TEXT
  )
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS project_assets (
    id TEXT PRIMARY KEY,
    project_id TEXT,
    kind TEXT,
    name TEXT,
    prompt TEXT,
    image_url TEXT,
    video_url TEXT,
    folder TEXT,
    tags TEXT,
    is_favorite INTEGER,
    resolution TEXT,
    duration TEXT,
    role_images TEXT,
    role_traits TEXT,
    style_keywords TEXT,
    notes TEXT,
    created_at TEXT,
    updated_at TEXT
  )
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS project_reviews (
    id TEXT PRIMARY KEY,
    project_id TEXT,
    target_type TEXT,
    target_id TEXT,
    reviewer TEXT,
    status TEXT,
    comment TEXT,
    created_at TEXT,
    updated_at TEXT
  )
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS project_clips (
    id TEXT PRIMARY KEY,
    project_id TEXT,
    storyboard_id TEXT,
    episode INTEGER,
    scene TEXT,
    shot TEXT,
    title TEXT,
    source_video_url TEXT,
    duration INTEGER,
    in_point TEXT,
    out_point TEXT,
    order_index INTEGER,
    status TEXT,
    notes TEXT,
    created_at TEXT,
    updated_at TEXT
  )
`);

// Insert demo members
const members = [
  { id: "m-001", project_id: "p-demo-001", name: "李明", role: "导演", contact: "li.ming@example.com", notes: "总负责人", created_at: lastWeek, updated_at: lastWeek },
  { id: "m-002", project_id: "p-demo-001", name: "张薇", role: "编剧", contact: "zhang.wei@example.com", notes: "剧本创作", created_at: lastWeek, updated_at: lastWeek },
  { id: "m-003", project_id: "p-demo-001", name: "王浩", role: "美术", contact: "wang.hao@example.com", notes: "角色与场景设计", created_at: lastWeek, updated_at: lastWeek },
  { id: "m-004", project_id: "p-demo-001", name: "陈静", role: "剪辑", contact: "chen.jing@example.com", notes: "后期制作", created_at: lastWeek, updated_at: lastWeek },
  { id: "m-005", project_id: "p-demo-002", name: "张薇", role: "导演", contact: "zhang.wei@example.com", notes: "赛博朋克项目负责人", created_at: lastWeek, updated_at: lastWeek },
  { id: "m-006", project_id: "p-demo-003", name: "王浩", role: "导演", contact: "wang.hao@example.com", notes: "山海经项目负责人", created_at: yesterday, updated_at: yesterday },
  { id: "m-007", project_id: "p-demo-003", name: "刘洋", role: "编剧", contact: "liu.yang@example.com", notes: "神话考据", created_at: yesterday, updated_at: yesterday },
  { id: "m-008", project_id: "p-demo-004", name: "陈静", role: "导演", contact: "chen.jing@example.com", notes: "都市怪谈负责人", created_at: yesterday, updated_at: yesterday },
  { id: "m-009", project_id: "p-demo-005", name: "刘洋", role: "导演", contact: "liu.yang@example.com", notes: "星际探险负责人", created_at: lastWeek, updated_at: now },
];

const memberStmt = db.prepare(`INSERT OR REPLACE INTO project_members (id, project_id, name, role, contact, notes, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`);
for (const m of members) {
  memberStmt.run(m.id, m.project_id, m.name, m.role, m.contact, m.notes, m.created_at, m.updated_at);
}

// Insert demo episodes
const episodes = [
  { id: "e-001", project_id: "p-demo-001", episode: 1, title: "长安夜雨", status: "已完成", summary: "狄仁杰初入长安，夜雨中的第一桩命案", due_date: "2026-07-10", notes: "", created_at: lastWeek, updated_at: yesterday },
  { id: "e-002", project_id: "p-demo-001", episode: 2, title: "鬼市迷踪", status: "制作中", summary: "追踪线索至地下鬼市", due_date: "2026-07-20", notes: "", created_at: lastWeek, updated_at: yesterday },
  { id: "e-003", project_id: "p-demo-001", episode: 3, title: "镜中妖", status: "剧本完成", summary: "古镜中的妖怪现身", due_date: "2026-07-30", notes: "", created_at: lastWeek, updated_at: lastWeek },
  { id: "e-004", project_id: "p-demo-001", episode: 4, title: "大理寺密档", status: "策划中", summary: "揭开大理寺尘封的秘密", due_date: "2026-08-10", notes: "", created_at: lastWeek, updated_at: lastWeek },
  { id: "e-005", project_id: "p-demo-002", episode: 1, title: "夜之城黎明", status: "策划中", summary: "主角在夜之城的第一个任务", due_date: "2026-08-15", notes: "", created_at: lastWeek, updated_at: lastWeek },
  { id: "e-006", project_id: "p-demo-003", episode: 1, title: "青丘之狐", status: "已完成", summary: "九尾狐的传说", due_date: "2026-08-01", notes: "", created_at: yesterday, updated_at: yesterday },
  { id: "e-007", project_id: "p-demo-003", episode: 2, title: "应龙之怒", status: "制作中", summary: "应龙觉醒引发天灾", due_date: "2026-08-15", notes: "", created_at: yesterday, updated_at: yesterday },
  { id: "e-008", project_id: "p-demo-004", episode: 1, title: "电梯里的哭声", status: "分镜中", summary: "老旧公寓的电梯怪谈", due_date: "2026-07-25", notes: "", created_at: yesterday, updated_at: yesterday },
  { id: "e-009", project_id: "p-demo-005", episode: 1, title: "启程", status: "已完成", summary: "星际飞船升空", due_date: "2026-07-15", notes: "", created_at: lastWeek, updated_at: now },
];

const episodeStmt = db.prepare(`INSERT OR REPLACE INTO project_episodes (id, project_id, episode, title, status, summary, due_date, notes, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
for (const e of episodes) {
  episodeStmt.run(e.id, e.project_id, e.episode, e.title, e.status, e.summary, e.due_date, e.notes, e.created_at, e.updated_at);
}

// Insert demo tasks
const tasks = [
  { id: "t-001", project_id: "p-demo-001", title: "完成第一集剧本", status: "done", owner: "张薇", due_date: "2026-07-05", notes: "", created_at: lastWeek, updated_at: yesterday },
  { id: "t-002", project_id: "p-demo-001", title: "第一集角色设计", status: "done", owner: "王浩", due_date: "2026-07-08", notes: "", created_at: lastWeek, updated_at: yesterday },
  { id: "t-003", project_id: "p-demo-001", title: "第一集分镜制作", status: "done", owner: "李明", due_date: "2026-07-12", notes: "", created_at: lastWeek, updated_at: yesterday },
  { id: "t-004", project_id: "p-demo-001", title: "第一集视频生成", status: "done", owner: "陈静", due_date: "2026-07-15", notes: "", created_at: lastWeek, updated_at: yesterday },
  { id: "t-005", project_id: "p-demo-001", title: "第二集剧本", status: "done", owner: "张薇", due_date: "2026-07-15", notes: "", created_at: lastWeek, updated_at: yesterday },
  { id: "t-006", project_id: "p-demo-001", title: "第二集角色设计", status: "done", owner: "王浩", due_date: "2026-07-18", notes: "", created_at: lastWeek, updated_at: yesterday },
  { id: "t-007", project_id: "p-demo-001", title: "第二集分镜制作", status: "storyboard", owner: "李明", due_date: "2026-07-25", notes: "", created_at: lastWeek, updated_at: yesterday },
  { id: "t-008", project_id: "p-demo-001", title: "第二集视频生成", status: "video", owner: "陈静", due_date: "2026-07-30", notes: "", created_at: lastWeek, updated_at: yesterday },
  { id: "t-009", project_id: "p-demo-001", title: "第三集剧本", status: "script", owner: "张薇", due_date: "2026-07-25", notes: "", created_at: lastWeek, updated_at: lastWeek },
  { id: "t-010", project_id: "p-demo-001", title: "第三集角色设计", status: "todo", owner: "王浩", due_date: "2026-07-30", notes: "", created_at: lastWeek, updated_at: lastWeek },
  { id: "t-011", project_id: "p-demo-002", title: "世界观设定", status: "done", owner: "张薇", due_date: "2026-07-10", notes: "", created_at: lastWeek, updated_at: lastWeek },
  { id: "t-012", project_id: "p-demo-002", title: "主角人设", status: "done", owner: "张薇", due_date: "2026-07-15", notes: "", created_at: lastWeek, updated_at: lastWeek },
  { id: "t-013", project_id: "p-demo-002", title: "第一集剧本", status: "script", owner: "张薇", due_date: "2026-08-01", notes: "", created_at: lastWeek, updated_at: lastWeek },
  { id: "t-014", project_id: "p-demo-003", title: "山海经考据", status: "done", owner: "刘洋", due_date: "2026-07-05", notes: "", created_at: yesterday, updated_at: yesterday },
  { id: "t-015", project_id: "p-demo-003", title: "第一集剧本", status: "done", owner: "王浩", due_date: "2026-07-10", notes: "", created_at: yesterday, updated_at: yesterday },
  { id: "t-016", project_id: "p-demo-003", title: "第一集分镜", status: "done", owner: "王浩", due_date: "2026-07-15", notes: "", created_at: yesterday, updated_at: yesterday },
  { id: "t-017", project_id: "p-demo-003", title: "第二集剧本", status: "script", owner: "刘洋", due_date: "2026-07-20", notes: "", created_at: yesterday, updated_at: yesterday },
  { id: "t-018", project_id: "p-demo-004", title: "第一集剧本", status: "done", owner: "陈静", due_date: "2026-07-15", notes: "", created_at: yesterday, updated_at: yesterday },
  { id: "t-019", project_id: "p-demo-004", title: "第一集分镜", status: "storyboard", owner: "陈静", due_date: "2026-07-22", notes: "", created_at: yesterday, updated_at: yesterday },
  { id: "t-020", project_id: "p-demo-005", title: "第一集制作", status: "done", owner: "刘洋", due_date: "2026-07-10", notes: "", created_at: lastWeek, updated_at: now },
];

const taskStmt = db.prepare(`INSERT OR REPLACE INTO project_tasks (id, project_id, title, status, owner, due_date, notes, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`);
for (const t of tasks) {
  taskStmt.run(t.id, t.project_id, t.title, t.status, t.owner, t.due_date, t.notes, t.created_at, t.updated_at);
}

// Insert demo milestones
const milestones = [
  { id: "ms-001", project_id: "p-demo-001", title: "剧本定稿", status: "done", owner: "张薇", due_date: "2026-07-15", description: "完成全部12集剧本", created_at: lastWeek, updated_at: yesterday },
  { id: "ms-002", project_id: "p-demo-001", title: "角色设计完成", status: "done", owner: "王浩", due_date: "2026-07-20", description: "主要角色设计与资产入库", created_at: lastWeek, updated_at: yesterday },
  { id: "ms-003", project_id: "p-demo-001", title: "第一集交付", status: "done", owner: "李明", due_date: "2026-07-25", description: "第一集视频完成并审核通过", created_at: lastWeek, updated_at: yesterday },
  { id: "ms-004", project_id: "p-demo-001", title: "中期检查", status: "doing", owner: "李明", due_date: "2026-08-10", description: "6集完成度检查", created_at: lastWeek, updated_at: yesterday },
  { id: "ms-005", project_id: "p-demo-001", title: "全部交付", status: "planned", owner: "李明", due_date: "2026-08-15", description: "12集全部完成", created_at: lastWeek, updated_at: lastWeek },
  { id: "ms-006", project_id: "p-demo-002", title: "策划完成", status: "done", owner: "张薇", due_date: "2026-07-20", description: "世界观与角色设定完成", created_at: lastWeek, updated_at: lastWeek },
  { id: "ms-007", project_id: "p-demo-003", title: "第一集交付", status: "done", owner: "王浩", due_date: "2026-07-15", description: "第一集完成", created_at: yesterday, updated_at: yesterday },
  { id: "ms-008", project_id: "p-demo-003", title: "前五集完成", status: "doing", owner: "王浩", due_date: "2026-08-15", description: "前五集制作完成", created_at: yesterday, updated_at: yesterday },
  { id: "ms-009", project_id: "p-demo-004", title: "第一集交付", status: "planned", owner: "陈静", due_date: "2026-07-30", description: "第一集完成交付", created_at: yesterday, updated_at: yesterday },
  { id: "ms-010", project_id: "p-demo-005", title: "项目交付", status: "done", owner: "刘洋", due_date: "2026-07-15", description: "全部6集交付", created_at: lastWeek, updated_at: now },
];

const milestoneStmt = db.prepare(`INSERT OR REPLACE INTO project_milestones (id, project_id, title, status, owner, due_date, description, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`);
for (const m of milestones) {
  milestoneStmt.run(m.id, m.project_id, m.title, m.status, m.owner, m.due_date, m.description, m.created_at, m.updated_at);
}

// Insert demo issues
const issues = [
  { id: "i-001", project_id: "p-demo-001", title: "主角服装细节不一致", severity: "medium", status: "open", owner: "王浩", target_type: "asset", target_id: "", notes: "第三集与第一集服装纹样有差异", created_at: yesterday, updated_at: yesterday },
  { id: "i-002", project_id: "p-demo-001", title: "第二集视频闪烁", severity: "high", status: "doing", owner: "陈静", target_type: "video", target_id: "", notes: "夜间场景有轻微闪烁", created_at: yesterday, updated_at: yesterday },
  { id: "i-003", project_id: "p-demo-001", title: "背景音乐版权", severity: "low", status: "resolved", owner: "李明", target_type: "", target_id: "", notes: "已购买商用授权", created_at: lastWeek, updated_at: yesterday },
  { id: "i-004", project_id: "p-demo-003", title: "应龙模型面数过高", severity: "medium", status: "open", owner: "王浩", target_type: "asset", target_id: "", notes: "需要优化模型", created_at: yesterday, updated_at: yesterday },
  { id: "i-005", project_id: "p-demo-004", title: "恐怖氛围不够", severity: "low", status: "doing", owner: "陈静", target_type: "storyboard", target_id: "", notes: "需要调整光影", created_at: yesterday, updated_at: yesterday },
];

const issueStmt = db.prepare(`INSERT OR REPLACE INTO project_issues (id, project_id, title, severity, status, owner, target_type, target_id, notes, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
for (const i of issues) {
  issueStmt.run(i.id, i.project_id, i.title, i.severity, i.status, i.owner, i.target_type, i.target_id, i.notes, i.created_at, i.updated_at);
}

// Insert demo scripts
const scripts = [
  { id: "s-001", project_id: "p-demo-001", episode: 1, title: "长安夜雨", content: "【场景：长安城，夜，雨】\n狄仁杰（独白）：长安的夜，总是藏着太多秘密...\n【画面：雨中的长安街道，灯笼摇曳】\n狄仁杰：这桩案子，恐怕没那么简单。\n【转场】\n...", status: "ready", notes: "", created_at: lastWeek, updated_at: yesterday },
  { id: "s-002", project_id: "p-demo-001", episode: 2, title: "鬼市迷踪", content: "【场景：地下鬼市，昏暗】\n狄仁杰：这里的气息...不对劲。\n【画面：鬼市摊位，各种奇珍异宝】\n...", status: "ready", notes: "", created_at: lastWeek, updated_at: yesterday },
  { id: "s-003", project_id: "p-demo-001", episode: 3, title: "镜中妖", content: "【场景：古宅，内室】\n狄仁杰：这面镜子...有古怪。\n【画面：古镜中浮现诡异影像】\n...", status: "draft", notes: "", created_at: lastWeek, updated_at: lastWeek },
  { id: "s-004", project_id: "p-demo-003", episode: 1, title: "青丘之狐", content: "【场景：青丘，晨雾】\n旁白：青丘之山有兽，其状如狐而九尾...\n【画面：九尾狐在云雾中现身】\n...", status: "storyboarded", notes: "", created_at: yesterday, updated_at: yesterday },
  { id: "s-005", project_id: "p-demo-003", episode: 2, title: "应龙之怒", content: "【场景：天空，乌云密布】\n旁白：应龙处南极，杀蚩尤与夸父...\n【画面：应龙展翅，雷电交加】\n...", status: "ready", notes: "", created_at: yesterday, updated_at: yesterday },
  { id: "s-006", project_id: "p-demo-004", episode: 1, title: "电梯里的哭声", content: "【场景：老旧公寓，电梯内】\n小美：你...有没有听到什么声音？\n【画面：电梯灯光闪烁】\n...", status: "ready", notes: "", created_at: yesterday, updated_at: yesterday },
  { id: "s-007", project_id: "p-demo-005", episode: 1, title: "启程", content: "【场景：发射基地，黎明】\n船长：全体就位，准备发射。\n【画面：星际飞船点火升空】\n...", status: "storyboarded", notes: "", created_at: lastWeek, updated_at: now },
];

const scriptStmt = db.prepare(`INSERT OR REPLACE INTO project_scripts (id, project_id, episode, title, content, status, notes, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`);
for (const s of scripts) {
  scriptStmt.run(s.id, s.project_id, s.episode, s.title, s.content, s.status, s.notes, s.created_at, s.updated_at);
}

// Insert demo storyboards
const storyboards = [
  { id: "sb-001", project_id: "p-demo-001", episode: 1, scene: "1", shot: "1", title: "开场-雨夜长安", description: "雨夜中的长安城全景，灯笼摇曳", dialogue: "", characters: "[]", character_asset_ids: "[]", location: "长安城街道", scene_asset_id: "", shot_size: "全景", camera_move: "建立镜头", duration: 5, prompt: "雨夜长安城全景，灯笼摇曳，电影感构图，画面清晰，光影自然", image_task_id: "", image_url: "", video_task_id: "", video_url: "", status: "video", notes: "", created_at: lastWeek, updated_at: yesterday },
  { id: "sb-002", project_id: "p-demo-001", episode: 1, scene: "2", shot: "1", title: "狄仁杰登场", description: "狄仁杰在雨中行走，思考案情", dialogue: "狄仁杰：长安的夜，总是藏着太多秘密", characters: "[]", character_asset_ids: "[]", location: "长安城街道", scene_asset_id: "", shot_size: "中景", camera_move: "平稳推进", duration: 5, prompt: "狄仁杰在雨中行走，古装男子，电影感构图，画面清晰", image_task_id: "", image_url: "", video_task_id: "", video_url: "", status: "video", notes: "", created_at: lastWeek, updated_at: yesterday },
  { id: "sb-003", project_id: "p-demo-001", episode: 2, scene: "1", shot: "1", title: "鬼市入口", description: "地下鬼市的入口，昏暗神秘", dialogue: "", characters: "[]", character_asset_ids: "[]", location: "鬼市入口", scene_asset_id: "", shot_size: "全景", camera_move: "建立镜头", duration: 5, prompt: "地下鬼市入口，昏暗神秘，灯笼照明，电影感构图", image_task_id: "", image_url: "", video_task_id: "", video_url: "", status: "image", notes: "", created_at: lastWeek, updated_at: yesterday },
  { id: "sb-004", project_id: "p-demo-001", episode: 3, scene: "1", shot: "1", title: "古镜", description: "古宅中的镜子，诡异氛围", dialogue: "狄仁杰：这面镜子...有古怪", characters: "[]", character_asset_ids: "[]", location: "古宅内室", scene_asset_id: "", shot_size: "特写", camera_move: "缓慢推进", duration: 3, prompt: "古宅中的镜子，诡异氛围，倒影模糊，电影感构图", image_task_id: "", image_url: "", video_task_id: "", video_url: "", status: "scripted", notes: "", created_at: lastWeek, updated_at: lastWeek },
  { id: "sb-005", project_id: "p-demo-003", episode: 1, scene: "1", shot: "1", title: "青丘晨雾", description: "青丘山的晨雾中，九尾狐现身", dialogue: "旁白：青丘之山有兽，其状如狐而九尾", characters: "[]", character_asset_ids: "[]", location: "青丘山", scene_asset_id: "", shot_size: "全景", camera_move: "建立镜头", duration: 5, prompt: "青丘山晨雾，九尾狐现身，神话氛围，画面唯美", image_task_id: "", image_url: "", video_task_id: "", video_url: "", status: "video", notes: "", created_at: yesterday, updated_at: yesterday },
  { id: "sb-006", project_id: "p-demo-003", episode: 2, scene: "1", shot: "1", title: "应龙觉醒", description: "应龙在雷电中展翅", dialogue: "旁白：应龙处南极，杀蚩尤与夸父", characters: "[]", character_asset_ids: "[]", location: "天空", scene_asset_id: "", shot_size: "全景", camera_move: "仰拍拉升", duration: 5, prompt: "应龙展翅，雷电交加，神话氛围，画面震撼", image_task_id: "", image_url: "", video_task_id: "", video_url: "", status: "image", notes: "", created_at: yesterday, updated_at: yesterday },
  { id: "sb-007", project_id: "p-demo-004", episode: 1, scene: "1", shot: "1", title: "电梯内", description: "老旧电梯内，灯光闪烁", dialogue: "小美：你...有没有听到什么声音？", characters: "[]", character_asset_ids: "[]", location: "电梯", scene_asset_id: "", shot_size: "中景", camera_move: "手持晃动", duration: 4, prompt: "老旧电梯内，灯光闪烁，恐怖氛围，电影感构图", image_task_id: "", image_url: "", video_task_id: "", video_url: "", status: "scripted", notes: "", created_at: yesterday, updated_at: yesterday },
  { id: "sb-008", project_id: "p-demo-005", episode: 1, scene: "1", shot: "1", title: "发射基地", description: "星际飞船点火升空的壮观场面", dialogue: "船长：全体就位，准备发射", characters: "[]", character_asset_ids: "[]", location: "发射基地", scene_asset_id: "", shot_size: "全景", camera_move: "仰拍拉升", duration: 5, prompt: "星际飞船点火升空，壮观场面，科幻氛围，画面震撼", image_task_id: "", image_url: "", video_task_id: "", video_url: "", status: "video", notes: "", created_at: lastWeek, updated_at: now },
];

const storyboardStmt = db.prepare(`INSERT OR REPLACE INTO project_storyboards (id, project_id, episode, scene, shot, title, description, dialogue, characters, character_asset_ids, location, scene_asset_id, shot_size, camera_move, duration, prompt, image_task_id, image_url, video_task_id, video_url, status, notes, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
for (const sb of storyboards) {
  storyboardStmt.run(sb.id, sb.project_id, sb.episode, sb.scene, sb.shot, sb.title, sb.description, sb.dialogue, sb.characters, sb.character_asset_ids, sb.location, sb.scene_asset_id, sb.shot_size, sb.camera_move, sb.duration, sb.prompt, sb.image_task_id, sb.image_url, sb.video_task_id, sb.video_url, sb.status, sb.notes, sb.created_at, sb.updated_at);
}

// Insert demo assets
const assets = [
  { id: "a-001", project_id: "p-demo-001", kind: "character", name: "狄仁杰", prompt: "唐朝侦探，中年男子，面容刚毅，身着官服", image_url: "", video_url: "", folder: "角色", tags: "[\"主角\",\"侦探\"]", is_favorite: 1, resolution: "", duration: "", role_images: "[]", role_traits: "[\"智慧\",\"正义\",\"冷静\"]", style_keywords: "[]", notes: "", created_at: lastWeek, updated_at: yesterday },
  { id: "a-002", project_id: "p-demo-001", kind: "character", name: "李元芳", prompt: "狄仁杰助手，年轻武将，身手敏捷", image_url: "", video_url: "", folder: "角色", tags: "[\"配角\",\"武将\"]", is_favorite: 0, resolution: "", duration: "", role_images: "[]", role_traits: "[\"勇敢\",\"忠诚\"]", style_keywords: "[]", notes: "", created_at: lastWeek, updated_at: yesterday },
  { id: "a-003", project_id: "p-demo-001", kind: "scene", name: "长安城街道", prompt: "唐朝长安城街道，夜晚，灯笼，雨景", image_url: "", video_url: "", folder: "场景", tags: "[\"主场景\"]", is_favorite: 1, resolution: "", duration: "", role_images: "[]", role_traits: "[]", style_keywords: "[\"古风\",\"夜景\",\"雨景\"]", notes: "", created_at: lastWeek, updated_at: yesterday },
  { id: "a-004", project_id: "p-demo-001", kind: "style", name: "古风悬疑风格", prompt: "古风悬疑风格，暗色调，电影感构图", image_url: "", video_url: "", folder: "风格", tags: "[\"主风格\"]", is_favorite: 0, resolution: "", duration: "", role_images: "[]", role_traits: "[]", style_keywords: "[\"古风\",\"悬疑\",\"电影感\"]", notes: "", created_at: lastWeek, updated_at: lastWeek },
  { id: "a-005", project_id: "p-demo-002", kind: "character", name: "V", prompt: "赛博朋克主角，义体改造，夜之城风格", image_url: "", video_url: "", folder: "角色", tags: "[\"主角\"]", is_favorite: 1, resolution: "", duration: "", role_images: "[]", role_traits: "[\"反叛\",\"坚韧\"]", style_keywords: "[]", notes: "", created_at: lastWeek, updated_at: lastWeek },
  { id: "a-006", project_id: "p-demo-003", kind: "character", name: "九尾狐", prompt: "九尾狐，神话生物，白色毛发，九条尾巴，仙气飘飘", image_url: "", video_url: "", folder: "角色", tags: "[\"主角\",\"神话\"]", is_favorite: 1, resolution: "", duration: "", role_images: "[]", role_traits: "[\"神秘\",\"智慧\",\"美丽\"]", style_keywords: "[]", notes: "", created_at: yesterday, updated_at: yesterday },
  { id: "a-007", project_id: "p-demo-003", kind: "character", name: "应龙", prompt: "应龙，神话龙族，金色鳞片，展翅飞翔", image_url: "", video_url: "", folder: "角色", tags: "[\"配角\",\"神话\"]", is_favorite: 0, resolution: "", duration: "", role_images: "[]", role_traits: "[\"威严\",\"力量\"]", style_keywords: "[]", notes: "", created_at: yesterday, updated_at: yesterday },
  { id: "a-008", project_id: "p-demo-003", kind: "scene", name: "青丘山", prompt: "青丘山，晨雾缭绕，仙境氛围，花草繁茂", image_url: "", video_url: "", folder: "场景", tags: "[\"主场景\"]", is_favorite: 1, resolution: "", duration: "", role_images: "[]", role_traits: "[]", style_keywords: "[\"仙境\",\"自然\",\"唯美\"]", notes: "", created_at: yesterday, updated_at: yesterday },
  { id: "a-009", project_id: "p-demo-004", kind: "style", name: "恐怖氛围", prompt: "恐怖氛围，暗色调，阴影，诡异光影", image_url: "", video_url: "", folder: "风格", tags: "[\"主风格\"]", is_favorite: 0, resolution: "", duration: "", role_images: "[]", role_traits: "[]", style_keywords: "[\"恐怖\",\"悬疑\",\"暗色调\"]", notes: "", created_at: yesterday, updated_at: yesterday },
  { id: "a-010", project_id: "p-demo-005", kind: "scene", name: "发射基地", prompt: "星际飞船发射基地，未来科技，黎明时分", image_url: "", video_url: "", folder: "场景", tags: "[\"主场景\"]", is_favorite: 1, resolution: "", duration: "", role_images: "[]", role_traits: "[]", style_keywords: "[\"科幻\",\"未来\",\"壮观\"]", notes: "", created_at: lastWeek, updated_at: now },
];

const assetStmt = db.prepare(`INSERT OR REPLACE INTO project_assets (id, project_id, kind, name, prompt, image_url, video_url, folder, tags, is_favorite, resolution, duration, role_images, role_traits, style_keywords, notes, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
for (const a of assets) {
  assetStmt.run(a.id, a.project_id, a.kind, a.name, a.prompt, a.image_url, a.video_url, a.folder, a.tags, a.is_favorite, a.resolution, a.duration, a.role_images, a.role_traits, a.style_keywords, a.notes, a.created_at, a.updated_at);
}

// Insert demo reviews
const reviews = [
  { id: "r-001", project_id: "p-demo-001", target_type: "storyboard", target_id: "sb-001", reviewer: "李明", status: "resolved", comment: "开场镜头很好，氛围到位", created_at: yesterday, updated_at: yesterday },
  { id: "r-002", project_id: "p-demo-001", target_type: "video", target_id: "", reviewer: "李明", status: "open", comment: "第二集视频有闪烁，需要修复", created_at: yesterday, updated_at: yesterday },
  { id: "r-003", project_id: "p-demo-001", target_type: "image", target_id: "", reviewer: "王浩", status: "resolved", comment: "角色设计通过", created_at: lastWeek, updated_at: yesterday },
  { id: "r-004", project_id: "p-demo-003", target_type: "storyboard", target_id: "sb-005", reviewer: "王浩", status: "resolved", comment: "青丘分镜很美", created_at: yesterday, updated_at: yesterday },
  { id: "r-005", project_id: "p-demo-003", target_type: "asset", target_id: "a-006", reviewer: "刘洋", status: "open", comment: "九尾狐形象可以再优化", created_at: yesterday, updated_at: yesterday },
];

const reviewStmt = db.prepare(`INSERT OR REPLACE INTO project_reviews (id, project_id, target_type, target_id, reviewer, status, comment, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`);
for (const r of reviews) {
  reviewStmt.run(r.id, r.project_id, r.target_type, r.target_id, r.reviewer, r.status, r.comment, r.created_at, r.updated_at);
}

// Insert demo clips
const clips = [
  { id: "c-001", project_id: "p-demo-001", storyboard_id: "sb-001", episode: 1, scene: "1", shot: "1", title: "开场-雨夜长安", source_video_url: "", duration: 5, in_point: "00:00", out_point: "00:05", order_index: 1, status: "done", notes: "", created_at: lastWeek, updated_at: yesterday },
  { id: "c-002", project_id: "p-demo-001", storyboard_id: "sb-002", episode: 1, scene: "2", shot: "1", title: "狄仁杰登场", source_video_url: "", duration: 5, in_point: "00:05", out_point: "00:10", order_index: 2, status: "done", notes: "", created_at: lastWeek, updated_at: yesterday },
  { id: "c-003", project_id: "p-demo-003", storyboard_id: "sb-005", episode: 1, scene: "1", shot: "1", title: "青丘晨雾", source_video_url: "", duration: 5, in_point: "00:00", out_point: "00:05", order_index: 1, status: "done", notes: "", created_at: yesterday, updated_at: yesterday },
  { id: "c-004", project_id: "p-demo-005", storyboard_id: "sb-008", episode: 1, scene: "1", shot: "1", title: "发射基地", source_video_url: "", duration: 5, in_point: "00:00", out_point: "00:05", order_index: 1, status: "done", notes: "", created_at: lastWeek, updated_at: now },
];

const clipStmt = db.prepare(`INSERT OR REPLACE INTO project_clips (id, project_id, storyboard_id, episode, scene, shot, title, source_video_url, duration, in_point, out_point, order_index, status, notes, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
for (const c of clips) {
  clipStmt.run(c.id, c.project_id, c.storyboard_id, c.episode, c.scene, c.shot, c.title, c.source_video_url, c.duration, c.in_point, c.out_point, c.order_index, c.status, c.notes, c.created_at, c.updated_at);
}

// Insert demo conversations for projects
db.exec(`
  CREATE TABLE IF NOT EXISTS conversations (
    id TEXT PRIMARY KEY,
    title TEXT,
    model TEXT,
    is_pinned INTEGER,
    created_at TEXT,
    updated_at TEXT,
    project_id TEXT
  )
`);

const conversations = [
  { id: "conv-001", title: "盛唐异闻录 - 剧本讨论", model: "", is_pinned: 1, created_at: lastWeek, updated_at: yesterday, project_id: "p-demo-001" },
  { id: "conv-002", title: "盛唐异闻录 - 角色设计", model: "", is_pinned: 0, created_at: lastWeek, updated_at: yesterday, project_id: "p-demo-001" },
  { id: "conv-003", title: "赛博朋克 - 世界观设定", model: "", is_pinned: 0, created_at: lastWeek, updated_at: lastWeek, project_id: "p-demo-002" },
  { id: "conv-004", title: "山海经 - 青丘之狐", model: "", is_pinned: 1, created_at: yesterday, updated_at: yesterday, project_id: "p-demo-003" },
  { id: "conv-005", title: "都市怪谈 - 电梯篇", model: "", is_pinned: 0, created_at: yesterday, updated_at: yesterday, project_id: "p-demo-004" },
  { id: "conv-006", title: "星际探险家 - 启程", model: "", is_pinned: 0, created_at: lastWeek, updated_at: now, project_id: "p-demo-005" },
];

const convStmt = db.prepare(`INSERT OR REPLACE INTO conversations (id, title, model, is_pinned, created_at, updated_at, project_id) VALUES (?, ?, ?, ?, ?, ?, ?)`);
for (const c of conversations) {
  convStmt.run(c.id, c.title, c.model, c.is_pinned, c.created_at, c.updated_at, c.project_id);
}

console.log("\nDemo data inserted successfully!");
console.log(`Projects: ${projects.length}`);
console.log(`Members: ${members.length}`);
console.log(`Episodes: ${episodes.length}`);
console.log(`Tasks: ${tasks.length}`);
console.log(`Milestones: ${milestones.length}`);
console.log(`Issues: ${issues.length}`);
console.log(`Scripts: ${scripts.length}`);
console.log(`Storyboards: ${storyboards.length}`);
console.log(`Assets: ${assets.length}`);
console.log(`Reviews: ${reviews.length}`);
console.log(`Clips: ${clips.length}`);
console.log(`Conversations: ${conversations.length}`);
