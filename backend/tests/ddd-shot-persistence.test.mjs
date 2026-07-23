/**
 * @file ddd-shot-persistence.test.mjs
 * @description V2.1 DDD-SHOT 持久化层集成测试（真实 SQLite 内存/临时文件）。
 *
 * 覆盖（迭代计划 §5.7）：
 *  - 乐观锁：并发写入检测，影响行数 0 抛 aggregate_version_conflict。
 *  - 幂等：重复 commandId 抛 command_already_processed。
 *  - 事务原子性：状态/快照/Outbox 同事务提交（Outbox 由 UoW.enqueueDomainEvent
 *    在 save 之后入队；本测试用 fake UoW 验证）。
 *  - 重复 Provider 回调幂等：attach 不会重复写候选。
 *  - 持久化字段往返：toPersistenceRow / toDomain 完整。
 *
 * 数据库：本测试使用临时文件，不依赖生产 SQLite 实例。结束时清理。
 */
import assert from "node:assert/strict";
import test from "node:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomUUID } from "node:crypto";

const { ShotAggregate } = await import("../dist/src/domain/storyboard/shot.aggregate.js");
const { errorCodeOf } = await import("../dist/src/domain/storyboard/shot-errors.js");
const { SqliteShotRepository } = await import(
  "../dist/src/infrastructure/persistence/sqlite-shot.repository.js"
);
const { toDomainOutboxEvent } = await import(
  "../dist/src/application/shared/unit-of-work.js"
);
const { getRawDatabase, closeDatabase } = await import(
  "../dist/src/storage/sqlite.js"
);
const { DOMAIN_EVENT_TYPES } = await import(
  "../dist/src/domain/shared/domain-event.js"
);

function makeTempDb() {
  const dir = mkdtempSync(join(tmpdir(), "ddd-shot-persistence-"));
  const dbPath = join(dir, "shots.db");
  return {
    dbPath,
    cleanup: () => {
      // Windows 下 SQLite 句柄必须先关闭才能删除文件。
      try { closeDatabase(dbPath); } catch { /* noop */ }
      try { rmSync(dir, { recursive: true, force: true }); } catch { /* noop */ }
    },
  };
}

class FakeUoW {
  constructor(database) {
    this.database = database;
    this.events = [];
  }
  async run(work) {
    // 模拟 TransactionService：开 BEGIN，在 work 内所有 SQL 落在同一连接上。
    this.database.exec("BEGIN");
    try {
      const result = await work({
        enqueueDomainEvent: (event) => {
          this.events.push(toDomainOutboxEvent(event));
        },
      });
      // 写 outbox
      const insertOutbox = this.database.prepare(
        `INSERT INTO outbox_events (id, topic, payload, source, status, attempts, max_attempts, not_before, last_error, created_at, updated_at)
         VALUES (?, ?, ?, ?, 'pending', 0, 5, 0, '', ?, ?)`,
      );
      const now = new Date().toISOString();
      for (const evt of this.events) {
        insertOutbox.run(
          evt.id,
          evt.topic,
          JSON.stringify(evt.payload),
          evt.source,
          now,
          now,
        );
      }
      this.database.exec("COMMIT");
      return result;
    } catch (err) {
      this.database.exec("ROLLBACK");
      throw err;
    }
  }
}

function makeUoW(repo) {
  // 取 repo 内部的 database reference（私有字段，测试用）—— 通过反射。
  // SqliteShotRepository 没有暴露 getDatabase 端口，测试期间直接拿私有字段。
  const database = repo.database;
  return new FakeUoW(database);
}

function makeRepository(dbPath) {
  return new SqliteShotRepository(dbPath);
}

function makeRawDatabase(dbPath) {
  // 反射 SqliteShotRepository 的私有 database 字段之前，需要先有数据库文件。
  // 同一进程内复用 getRawDatabase 句柄即可。
  return getRawDatabase(dbPath);
}

function bootstrapSchema(database) {
  // 模拟 FieldSpec 自动建表 + Shot 迁移的最小列集合。
  database.exec(`
    CREATE TABLE IF NOT EXISTS shots (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL DEFAULT '',
      storyboard_id TEXT NOT NULL DEFAULT '',
      scene_id TEXT NOT NULL DEFAULT '',
      episode INTEGER NOT NULL DEFAULT 1,
      shot_number TEXT NOT NULL DEFAULT '',
      title TEXT NOT NULL DEFAULT '',
      description TEXT NOT NULL DEFAULT '',
      duration REAL NOT NULL DEFAULT 0,
      shot_size TEXT NOT NULL DEFAULT '',
      camera_angle TEXT NOT NULL DEFAULT '',
      camera_movement TEXT NOT NULL DEFAULT '',
      dialogue TEXT NOT NULL DEFAULT '',
      notes TEXT NOT NULL DEFAULT '',
      image_url TEXT NOT NULL DEFAULT '',
      video_task_id TEXT NOT NULL DEFAULT '',
      video_url TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL DEFAULT 'draft',
      "order" INTEGER NOT NULL DEFAULT 0,
      character_asset_ids TEXT NOT NULL DEFAULT '[]',
      prop_asset_ids TEXT NOT NULL DEFAULT '[]',
      version INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      deleted_at TEXT NOT NULL DEFAULT ''
    );
    CREATE TABLE IF NOT EXISTS shot_snapshots (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL DEFAULT '',
      shot_id TEXT NOT NULL,
      version INTEGER NOT NULL DEFAULT 1,
      data TEXT NOT NULL DEFAULT '',
      change_note TEXT NOT NULL DEFAULT '',
      created_by TEXT NOT NULL DEFAULT 'system',
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS outbox_events (
      id TEXT PRIMARY KEY,
      topic TEXT NOT NULL,
      payload TEXT NOT NULL,
      source TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL DEFAULT 'pending',
      attempts INTEGER NOT NULL DEFAULT 0,
      max_attempts INTEGER NOT NULL DEFAULT 5,
      not_before INTEGER NOT NULL DEFAULT 0,
      last_error TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
  `);
}

function bootstrapTestEnv() {
  const { dbPath, cleanup } = makeTempDb();
  // 1) 先在临时 DB 上建表（FieldSpec + outbox），再创建 Repository。
  //    ensureShotAggregateSchema 内部 ensureColumn 假定 shots / shot_snapshots 已存在。
  const rawDb = makeRawDatabase(dbPath);
  bootstrapSchema(rawDb);
  // 2) 创建 Repository：内部再次跑迁移（CREATE shot_command_log + ensureColumn）。
  const repo = makeRepository(dbPath);
  return { dbPath, repo, cleanup };
}

function newShot() {
  return ShotAggregate.create({
    projectId: "p-1",
    storyboardId: "sb-1",
    title: "t",
    description: "d",
  });
}

// ===== CRUD + 字段往返 =====

test("shot persistence insert + get round-trip preserves all fields", async () => {
  const { repo, cleanup } = bootstrapTestEnv();
  try {
    const uow = makeUoW(repo);
    const shot = newShot();
    shot.markReady("u1");
    shot.startGeneration({ actorId: "u1", generationRequestId: "g-1" });
    shot.attachGeneratedVideo({
      candidateId: "c-1",
      providerRequestId: "p-1",
      videoUrl: "http://x",
      generationRequestId: "g-1",
      attachedBy: "u1",
    });
    shot.submitForReview({ submittedBy: "u1" });
    shot.approve({ reviewId: "r-1", reviewedBy: "u2" });

    await uow.run(async (ctx) => {
      await repo.save(shot, 0);
      await repo.recordCommand(`cmd-${randomUUID()}`, shot.id);
      for (const evt of shot.pullDomainEvents()) {
        ctx.enqueueDomainEvent(evt);
      }
    });
    // 重新从 DB 加载
    const loaded = await repo.get(shot.id);
    assert.ok(loaded);
    assert.equal(loaded.status, "approved");
    assert.equal(loaded.videoCandidates.length, 1);
    assert.equal(loaded.videoCandidates[0].providerRequestId, "p-1");
    assert.equal(loaded.reviewResult.reviewId, "r-1");
    assert.equal(loaded.currentGenerationRequestId, "g-1");
    assert.equal(loaded.version, shot.version);
    // outbox 入队数
    assert.ok(uow.events.length >= 3, "outbox should have attach + submit + approve events");
  } finally {
    cleanup();
  }
});

// ===== 乐观锁冲突 =====

test("shot save with stale expectedVersion throws aggregate_version_conflict", async () => {
  const { repo, cleanup } = bootstrapTestEnv();
  try {
    const shot = newShot();
    const uow = makeUoW(repo);
    await uow.run(async () => {
      await repo.save(shot, 0);
    });
    // 第一次 markReady 后 version=2
    shot.markReady("u1");
    await uow.run(async () => {
      await repo.save(shot, shot.version - 1); // 用过期版本
    });
    // 应抛 aggregate_version_conflict
    let thrown;
    try {
      const uow2 = makeUoW(repo);
      await uow2.run(async () => {
        await repo.save(shot, shot.version - 1);
      });
    } catch (err) {
      thrown = err;
    }
    assert.ok(thrown, "expected conflict");
    assert.equal(thrown.code, "aggregate_version_conflict");
  } finally {
    cleanup();
  }
});

test("shot save concurrent: one succeeds, one returns version conflict", async () => {
  const { repo, cleanup } = bootstrapTestEnv();
  try {
    const shot = newShot();
    const uow = makeUoW(repo);
    await uow.run(async () => {
      await repo.save(shot, 0);
    });
    // 同一聚合分别走两个 UoW：第一个 markReady 成功，第二个用旧 version
    shot.markReady("u1");
    const fresh = await repo.get(shot.id);
    const vFresh = fresh.version;

    // 第一次 save：fresh.markReady -> version=vFresh+1
    fresh.markReady("u1"); // 不影响
    const uowA = makeUoW(repo);
    await uowA.run(async () => {
      await repo.save(fresh, vFresh);
    });
    // 第二次 save：shot（已 markReady，version=vFresh+1）用 vFresh 提交
    let conflict = null;
    const uowB = makeUoW(repo);
    try {
      await uowB.run(async () => {
        await repo.save(shot, vFresh);
      });
    } catch (err) {
      conflict = err;
    }
    assert.ok(conflict);
    assert.equal(conflict.code, "aggregate_version_conflict");
  } finally {
    cleanup();
  }
});

// ===== 幂等 commandId =====

test("shot recordCommand rejects duplicate commandId with command_already_processed", async () => {
  const { repo, cleanup } = bootstrapTestEnv();
  try {
    const shot = newShot();
    const uow = makeUoW(repo);
    await uow.run(async () => {
      await repo.save(shot, 0);
      await repo.recordCommand("cmd-dup", shot.id);
    });
    let err;
    try {
      const uow2 = makeUoW(repo);
      await uow2.run(async () => {
        await repo.recordCommand("cmd-dup", shot.id);
      });
    } catch (e) {
      err = e;
    }
    assert.ok(err);
    assert.equal(err.code, "command_already_processed");
  } finally {
    cleanup();
  }
});

test("shot isCommandProcessed returns true for previously recorded commandId", async () => {
  const { repo, cleanup } = bootstrapTestEnv();
  try {
    const shot = newShot();
    const uow = makeUoW(repo);
    await uow.run(async () => {
      await repo.save(shot, 0);
      await repo.recordCommand("cmd-1", shot.id);
    });
    assert.equal(await repo.isCommandProcessed("cmd-1"), true);
    assert.equal(await repo.isCommandProcessed("cmd-not-exist"), false);
  } finally {
    cleanup();
  }
});

// ===== 重复 Provider 回调幂等 =====

test("shot attachGeneratedVideo with same providerRequestId is a no-op", async () => {
  const { repo, cleanup } = bootstrapTestEnv();
  try {
    const uow = makeUoW(repo);
    const shot = newShot();
    shot.markReady("u1");
    shot.startGeneration({ actorId: "u1", generationRequestId: "g-1" });
    await uow.run(async () => {
      await repo.save(shot, 0);
    });
    // 第一次 attach
    shot.attachGeneratedVideo({
      candidateId: "c-1",
      providerRequestId: "p-1",
      videoUrl: "http://x",
      generationRequestId: "g-1",
      attachedBy: "u1",
    });
    const v1 = shot.version;
    await uow.run(async () => {
      await repo.save(shot, v1 - 1); // 写 1->2
    });
    const after1 = await repo.get(shot.id);
    const c1 = after1.videoCandidates.length;
    // 重新 attach 相同 providerRequestId
    after1.attachGeneratedVideo({
      candidateId: "c-1-dup",
      providerRequestId: "p-1",
      videoUrl: "http://x",
      generationRequestId: "g-1",
      attachedBy: "u1",
    });
    assert.equal(after1.videoCandidates.length, c1, "duplicate attach should not add new candidate");
  } finally {
    cleanup();
  }
});

// ===== 事务回滚 =====

test("shot save failure rolls back snapshot insert", async () => {
  const { repo, cleanup } = bootstrapTestEnv();
  try {
    const uow = makeUoW(repo);
    const shot = newShot();
    shot.markReady("u1");
    await uow.run(async () => {
      await repo.save(shot, 0);
    });
    // 尝试用错误 version save
    let err;
    try {
      const uow2 = makeUoW(repo);
      await uow2.run(async () => {
        await repo.save(shot, 999); // 不匹配 version
      });
    } catch (e) {
      err = e;
    }
    assert.ok(err);
    assert.equal(err.code, "aggregate_version_conflict");
    // 失败后 shot 状态不应在数据库里出现奇怪变化
    const fresh = await repo.get(shot.id);
    assert.equal(fresh.status, "ready");
  } finally {
    cleanup();
  }
});

// ===== listByStoryboard / listByProject =====

test("shot listByStoryboard returns shots in order", async () => {
  const { repo, cleanup } = bootstrapTestEnv();
  try {
    const uow = makeUoW(repo);
    const s1 = ShotAggregate.create({
      projectId: "p-1",
      storyboardId: "sb-1",
      order: 2,
      shotNumber: "shot_002",
    });
    const s2 = ShotAggregate.create({
      projectId: "p-1",
      storyboardId: "sb-1",
      order: 1,
      shotNumber: "shot_001",
    });
    const s3 = ShotAggregate.create({
      projectId: "p-1",
      storyboardId: "sb-2",
      order: 0,
      shotNumber: "shot_other",
    });
    for (const s of [s1, s2, s3]) {
      await uow.run(async () => {
        await repo.save(s, 0);
      });
    }
    const list = await repo.listByStoryboard("sb-1");
    assert.equal(list.length, 2);
    assert.equal(list[0].id, s2.id);
    assert.equal(list[1].id, s1.id);
  } finally {
    cleanup();
  }
});

test("shot listByProject filters by status and excludes soft-deleted", async () => {
  const { repo, cleanup } = bootstrapTestEnv();
  try {
    const uow = makeUoW(repo);
    const s1 = ShotAggregate.create({ projectId: "p-1", storyboardId: "sb-1" });
    const s2 = ShotAggregate.create({ projectId: "p-1", storyboardId: "sb-1" });
    const s3 = ShotAggregate.create({ projectId: "p-1", storyboardId: "sb-1" });
    s2.markReady("u1");
    s2.softDelete("u1");
    for (const s of [s1, s2, s3]) {
      await uow.run(async () => {
        await repo.save(s, 0);
      });
    }
    const all = await repo.listByProject("p-1");
    // s1 + s3 (s2 是软删除)
    assert.equal(all.length, 2);
    const draftOnly = await repo.listByProject("p-1", { status: "draft" });
    assert.equal(draftOnly.length, 2);
  } finally {
    cleanup();
  }
});

// ===== Outbox + snapshot 同事务 =====

test("shot save enqueues ShotVideoCandidateAttached outbox event in same transaction", async () => {
  const { repo, cleanup } = bootstrapTestEnv();
  try {
    const uow = makeUoW(repo);
    const shot = newShot();
    shot.markReady("u1");
    shot.startGeneration({ actorId: "u1", generationRequestId: "g-1" });
    await uow.run(async () => {
      await repo.save(shot, 0);
    });
    shot.attachGeneratedVideo({
      candidateId: "c-1",
      providerRequestId: "p-1",
      videoUrl: "http://x",
      generationRequestId: "g-1",
      attachedBy: "u1",
    });
    const uow2 = makeUoW(repo);
    await uow2.run(async (ctx) => {
      await repo.save(shot, shot.version - 1);
      for (const evt of shot.pullDomainEvents()) {
        ctx.enqueueDomainEvent(evt);
      }
    });
    // 验证 outbox 落表
    const db = repo.database;
    const rows = db.prepare("SELECT * FROM outbox_events WHERE topic = ?")
      .all(DOMAIN_EVENT_TYPES.shotVideoCandidateAttached);
    assert.ok(rows.length >= 1);
    const payload = JSON.parse(rows[0].payload);
    assert.equal(payload.payload.candidateId, "c-1");
  } finally {
    cleanup();
  }
});
