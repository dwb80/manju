/**
 * 种子数据：把项目工作台演示用的工作项写入 SQLite 的 work_items 表。
 * 用于在没有真实数据时让前端能看到示例条目。
 *
 * 状态映射（与 migrate-to-work-items 一致）：
 *   todo → pending；script/storyboard/image/video/review → doing；done → done
 */

import path from "node:path";
import { SqliteRepository } from "../storage/sqlite.js";
import { workItemFields } from "../storage/schema.js";
import type { WorkItem } from "../types.js";
import { id, nowIso } from "../utils.js";

const root = path.resolve(process.argv[2] ?? process.cwd());
const databaseFile = path.join(root, "data", "sqlite.db");

interface DemoTask {
  id: string;
  project_id: string;
  title: string;
  status: string;
  owner: string;
  due_date: string;
  notes: string;
  created_at: string;
  updated_at: string;
}

/** 与 seed-demo-data.mjs 中 t-001..t-020 一致。 */
const TASKS: DemoTask[] = [
  { id: "t-001", project_id: "p-demo-001", title: "完成第一集剧本", status: "done", owner: "张薇", due_date: "2026-07-05", notes: "", created_at: "2026-07-01T00:00:00.000Z", updated_at: "2026-07-10T00:00:00.000Z" },
  { id: "t-007", project_id: "p-demo-001", title: "第二集分镜制作", status: "storyboard", owner: "李明", due_date: "2026-07-25", notes: "", created_at: "2026-07-01T00:00:00.000Z", updated_at: "2026-07-10T00:00:00.000Z" },
  { id: "t-009", project_id: "p-demo-001", title: "第三集剧本", status: "script", owner: "张薇", due_date: "2026-07-25", notes: "", created_at: "2026-07-01T00:00:00.000Z", updated_at: "2026-07-01T00:00:00.000Z" },
  { id: "t-010", project_id: "p-demo-001", title: "第三集角色设计", status: "todo", owner: "王浩", due_date: "2026-07-30", notes: "", created_at: "2026-07-01T00:00:00.000Z", updated_at: "2026-07-01T00:00:00.000Z" },
];

function mapTask(t: DemoTask): WorkItem {
  let status: WorkItem["status"];
  switch (t.status) {
    case "done":
      status = "done";
      break;
    case "todo":
      status = "pending";
      break;
    case "script":
    case "storyboard":
    case "image":
    case "video":
    case "review":
      status = "doing";
      break;
    default:
      status = "pending";
  }
  return {
    id: t.id,
    project_id: t.project_id,
    kind: "task",
    title: t.title,
    status,
    owner: t.owner,
    due_date: t.due_date,
    description: t.notes,
    tags: [],
    created_at: t.created_at,
    updated_at: t.updated_at,
  };
}

async function main(): Promise<void> {
  const repo = new SqliteRepository<WorkItem>(databaseFile, "work_items", workItemFields);
  const existing = await repo.findMany({}, { sort: "asc" });
  const existingIds = new Set(existing.map((w) => w.id));
  let inserted = 0;
  for (const t of TASKS) {
    if (existingIds.has(t.id)) continue;
    await repo.insert(mapTask(t));
    inserted += 1;
  }
  // 占位：等 UI 改造时把 issue / milestone / review 也写进来
  const now = nowIso();
  const placeholderId = id("wi");
  if (!existingIds.has(placeholderId)) {
    await repo.insert({
      id: placeholderId,
      project_id: "p-demo-001",
      kind: "issue",
      title: "示例：第二集视频闪烁",
      status: "pending",
      owner: "陈静",
      due_date: "2026-07-20",
      severity: "high",
      description: "夜间场景有轻微闪烁，需要修复后再交付",
      tags: ["video", "night-scene"],
      created_at: now,
      updated_at: now,
    });
    inserted += 1;
  }
  console.log(`[seed-work-items] inserted ${inserted} work items (existing: ${existing.length})`);
}

main().catch((err) => {
  console.error("[seed-work-items] failed:", err);
  process.exitCode = 1;
});
