/**
 * @file migrate-v1-to-v2-storyboard.ts
 * @description V1 → V2 分镜数据迁移脚本
 *
 * 迁移逻辑：
 * 1. 读取现有 storyboards 表（V1：分镜+镜头合并）
 * 2. 每条 V1 记录拆分为：
 *    - 1 条 Storyboard（纯分镜，保留导演台层面字段）
 *    - 1 条 Shot（镜头，保留生产层面字段，storyboard_id 指向新分镜）
 * 3. 状态映射：V1 的 4 状态 → V2 的 8 状态
 *    - draft → draft
 *    - approved → approved
 *    - production → generating
 *    - completed → ready
 * 4. 写入新的 storyboards 表和 shots 表
 * 5. 可选：备份旧数据到 storyboards_v1_backup
 *
 * 使用方法：
 *   npx tsx backend/scripts/migrate-v1-to-v2-storyboard.ts
 */

import { Database } from "bun:sqlite";
import { randomUUID } from "crypto";

// ==================== 配置 ====================

const DB_PATH = process.env.DB_PATH || "./data/app.db";

// V1 → V2 状态映射
const STATUS_MAP: Record<string, string> = {
  draft: "draft",
  approved: "approved",
  production: "generating",
  completed: "ready",
};

// ==================== 类型 ====================

interface V1Storyboard {
  id: string;
  project_id: string;
  scene_id: string;
  shot_number: number;
  title?: string;
  description: string;
  duration: number;
  camera_angle?: string;
  movement?: string;
  dialogue?: string;
  notes?: string;
  status: string;
  order: number;
  episode?: number;
  image_url?: string;
  video_task_id?: string;
  video_url?: string;
  tags?: string;
  character_asset_ids?: string;
  prop_asset_ids?: string;
  created_at: string;
  updated_at: string;
  deleted_at?: string;
}

interface V2Storyboard {
  id: string;
  project_id: string;
  episode_id: string;
  scene_id: string;
  episode: number;
  storyboard_number: string;
  title: string;
  description: string;
  dialogue?: string;
  notes?: string;
  status: string;
  order: number;
  character_asset_ids?: string;
  prop_asset_ids?: string;
  version: number;
  created_at: string;
  updated_at: string;
  deleted_at?: string;
}

interface V2Shot {
  id: string;
  project_id: string;
  storyboard_id: string;
  scene_id: string;
  episode: number;
  shot_number: string;
  title: string;
  description: string;
  duration: number;
  camera_angle?: string;
  camera_movement?: string;
  dialogue?: string;
  notes?: string;
  image_url: string;
  video_task_id: string;
  video_url: string;
  status: string;
  order: number;
  character_asset_ids?: string;
  prop_asset_ids?: string;
  version: number;
  created_at: string;
  updated_at: string;
  deleted_at?: string;
}

// ==================== 迁移逻辑 ====================

function parseJsonField(value: unknown): string | undefined {
  if (!value) return undefined;
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) return JSON.stringify(parsed);
      return undefined;
    } catch {
      return undefined;
    }
  }
  if (Array.isArray(value)) return JSON.stringify(value);
  return undefined;
}

function migrateRecord(v1: V1Storyboard): { storyboard: V2Storyboard; shot: V2Shot } {
  const storyboardId = v1.id; // 复用原 ID 作为分镜 ID
  const shotId = randomUUID();
  const now = new Date().toISOString();
  const v2Status = STATUS_MAP[v1.status] || "draft";

  const storyboard: V2Storyboard = {
    id: storyboardId,
    project_id: v1.project_id || "",
    episode_id: "", // V1 无 episode_id，迁移后需手动补充
    scene_id: v1.scene_id || "",
    episode: v1.episode || 1,
    storyboard_number: v1.shot_number ? `SB-${String(v1.shot_number).padStart(3, "0")}` : `SB-${storyboardId.slice(0, 6)}`,
    title: v1.title || `分镜 ${v1.shot_number || ""}`,
    description: v1.description || "",
    dialogue: v1.dialogue,
    notes: v1.notes,
    status: v2Status,
    order: v1.order || 0,
    character_asset_ids: parseJsonField(v1.character_asset_ids),
    prop_asset_ids: parseJsonField(v1.prop_asset_ids),
    version: 1,
    created_at: v1.created_at || now,
    updated_at: now,
    deleted_at: v1.deleted_at,
  };

  const shot: V2Shot = {
    id: shotId,
    project_id: v1.project_id || "",
    storyboard_id: storyboardId,
    scene_id: v1.scene_id || "",
    episode: v1.episode || 1,
    shot_number: v1.shot_number ? `shot_${String(v1.shot_number).padStart(3, "0")}` : `shot_${shotId.slice(0, 6)}`,
    title: v1.title || `镜头 ${v1.shot_number || ""}`,
    description: v1.description || "",
    duration: v1.duration || 5,
    camera_angle: v1.camera_angle,
    camera_movement: v1.movement,
    dialogue: v1.dialogue,
    notes: v1.notes,
    image_url: v1.image_url || "",
    video_task_id: v1.video_task_id || "",
    video_url: v1.video_url || "",
    status: v2Status,
    order: 1,
    character_asset_ids: parseJsonField(v1.character_asset_ids),
    prop_asset_ids: parseJsonField(v1.prop_asset_ids),
    version: 1,
    created_at: v1.created_at || now,
    updated_at: now,
    deleted_at: v1.deleted_at,
  };

  return { storyboard, shot };
}

async function main() {
  console.log(`[迁移] 打开数据库: ${DB_PATH}`);
  const db = new Database(DB_PATH);

  try {
    // 1. 检查 storyboards 表是否存在
    const tableCheck = db.query(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='storyboards'"
    ).get() as { name: string } | null;

    if (!tableCheck) {
      console.log("[迁移] storyboards 表不存在，无需迁移");
      return;
    }

    // 2. 检查是否已有 V2 字段（storyboard_number）
    const columns = db.query("PRAGMA table_info(storyboards)").all() as Array<{ name: string }>;
    const hasV2Field = columns.some((c) => c.name === "storyboard_number");

    if (hasV2Field) {
      console.log("[迁移] storyboards 表已是 V2 结构，检查是否需要数据迁移...");
    }

    // 3. 读取 V1 数据
    const v1Records = db.query("SELECT * FROM storyboards WHERE deleted_at IS NULL OR deleted_at = ''").all() as V1Storyboard[];
    console.log(`[迁移] 发现 ${v1Records.length} 条 V1 分镜记录`);

    if (v1Records.length === 0) {
      console.log("[迁移] 无数据需要迁移");
      return;
    }

    // 4. 创建备份表
    console.log("[迁移] 创建备份表 storyboards_v1_backup...");
    db.run("DROP TABLE IF EXISTS storyboards_v1_backup");
    db.run("CREATE TABLE storyboards_v1_backup AS SELECT * FROM storyboards");

    // 5. 创建 shots 表（如果不存在）
    console.log("[迁移] 确保 shots 表存在...");
    db.run(`
      CREATE TABLE IF NOT EXISTS shots (
        id TEXT PRIMARY KEY,
        project_id TEXT,
        storyboard_id TEXT,
        scene_id TEXT,
        episode INTEGER,
        shot_number TEXT,
        title TEXT,
        description TEXT,
        duration REAL,
        shot_size TEXT,
        camera_angle TEXT,
        camera_movement TEXT,
        dialogue TEXT,
        notes TEXT,
        image_url TEXT,
        video_task_id TEXT,
        video_url TEXT,
        status TEXT,
        order INTEGER,
        character_asset_ids TEXT,
        prop_asset_ids TEXT,
        version INTEGER,
        created_at TEXT,
        updated_at TEXT,
        deleted_at TEXT
      )
    `);

    // 6. 清空并重建 storyboards 表为 V2 结构
    console.log("[迁移] 重建 storyboards 表为 V2 结构...");
    db.run("DROP TABLE IF EXISTS storyboards_new");
    db.run(`
      CREATE TABLE storyboards_new (
        id TEXT PRIMARY KEY,
        project_id TEXT,
        episode_id TEXT,
        scene_id TEXT,
        episode INTEGER,
        storyboard_number TEXT,
        title TEXT,
        description TEXT,
        dialogue TEXT,
        notes TEXT,
        status TEXT,
        order INTEGER,
        character_asset_ids TEXT,
        prop_asset_ids TEXT,
        version INTEGER,
        created_at TEXT,
        updated_at TEXT,
        deleted_at TEXT
      )
    `);

    // 7. 执行迁移
    console.log("[迁移] 开始数据迁移...");
    let migratedCount = 0;
    let errorCount = 0;

    const insertStoryboard = db.prepare(`
      INSERT INTO storyboards_new (
        id, project_id, episode_id, scene_id, episode, storyboard_number,
        title, description, dialogue, notes, status, order,
        character_asset_ids, prop_asset_ids, version, created_at, updated_at, deleted_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const insertShot = db.prepare(`
      INSERT INTO shots (
        id, project_id, storyboard_id, scene_id, episode, shot_number,
        title, description, duration, camera_angle, camera_movement,
        dialogue, notes, image_url, video_task_id, video_url, status, order,
        character_asset_ids, prop_asset_ids, version, created_at, updated_at, deleted_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    for (const v1 of v1Records) {
      try {
        const { storyboard, shot } = migrateRecord(v1);

        insertStoryboard.run(
          storyboard.id, storyboard.project_id, storyboard.episode_id, storyboard.scene_id,
          storyboard.episode, storyboard.storyboard_number, storyboard.title,
          storyboard.description, storyboard.dialogue, storyboard.notes,
          storyboard.status, storyboard.order, storyboard.character_asset_ids,
          storyboard.prop_asset_ids, storyboard.version, storyboard.created_at,
          storyboard.updated_at, storyboard.deleted_at
        );

        insertShot.run(
          shot.id, shot.project_id, shot.storyboard_id, shot.scene_id,
          shot.episode, shot.shot_number, shot.title, shot.description,
          shot.duration, shot.camera_angle, shot.camera_movement,
          shot.dialogue, shot.notes, shot.image_url, shot.video_task_id,
          shot.video_url, shot.status, shot.order, shot.character_asset_ids,
          shot.prop_asset_ids, shot.version, shot.created_at, shot.updated_at, shot.deleted_at
        );

        migratedCount++;
      } catch (err) {
        errorCount++;
        console.error(`[迁移] 记录 ${v1.id} 迁移失败:`, err);
      }
    }

    // 8. 替换表
    console.log("[迁移] 替换 storyboards 表...");
    db.run("DROP TABLE IF EXISTS storyboards");
    db.run("ALTER TABLE storyboards_new RENAME TO storyboards");

    // 9. 创建索引
    console.log("[迁移] 创建索引...");
    db.run("CREATE INDEX IF NOT EXISTS idx_shots_storyboard_id ON shots(storyboard_id)");
    db.run("CREATE INDEX IF NOT EXISTS idx_shots_project_id ON shots(project_id)");
    db.run("CREATE INDEX IF NOT EXISTS idx_storyboards_project_id ON storyboards(project_id)");
    db.run("CREATE INDEX IF NOT EXISTS idx_storyboards_scene_id ON storyboards(scene_id)");

    console.log("\n[迁移完成]");
    console.log(`  - 成功迁移: ${migratedCount} 条分镜`);
    console.log(`  - 生成镜头: ${migratedCount} 条`);
    console.log(`  - 失败: ${errorCount} 条`);
    console.log(`  - 备份表: storyboards_v1_backup`);
    console.log("\n[注意]");
    console.log("  1. episode_id 字段已留空，需手动关联到 script_episodes 表");
    console.log("  2. 建议运行后验证数据完整性");
    console.log("  3. 如需回滚，可从 storyboards_v1_backup 恢复");

  } finally {
    db.close();
  }
}

main().catch((err) => {
  console.error("[迁移失败]", err);
  process.exit(1);
});
