/**
 * @file ddd-review-persistence.test.mjs
 * @description V2.1 DDD-REVIEW 持久化与事务集成测试。
 *
 * 覆盖（迭代计划 §6.7）：
 *  - 乐观锁：两名审核人并发处理，后写者抛 aggregate_version_conflict。
 *  - 事务原子性：状态/历史/快照/Outbox 同事务；回调抛错时全部回滚。
 *  - 幂等：重复 commandId 抛 command_already_processed。
 *  - SLA 隔离：聚合 save 不覆盖 SLA 元数据字段。
 *  - 命令提交后 Outbox 写入对应领域事件。
 *
 * 依赖 createAppContext 提供完整 SQLite schema（review_items / review_histories /
 * review_snapshots / outbox_events），SqliteReviewRepository 共享同一连接。
 */
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { createAppContext } from "../dist/src/services/app.js";
import { FakeAIClient } from "../dist/src/ai/fake-ai-client.js";
import { SqliteReviewRepository } from "../dist/src/infrastructure/persistence/sqlite-review.repository.js";
import { createTransactionServiceUnitOfWork } from "../dist/src/infrastructure/unit-of-work/transaction-service-unit-of-work.js";
import { handleSubmitReview } from "../dist/src/application/review/submit-review.command.js";
import { handleStartReview } from "../dist/src/application/review/start-review.command.js";
import { handleApproveReview } from "../dist/src/application/review/approve-review.command.js";
import { handleRejectReview } from "../dist/src/application/review/reject-review.command.js";
import { handleResubmitReview } from "../dist/src/application/review/resubmit-review.command.js";
import { DOMAIN_ERROR_CODES } from "../dist/src/domain/shared/domain-error.js";
import { errorCodeOf } from "../dist/src/domain/review/review-errors.js";
import { getRawDatabase } from "../dist/src/storage/sqlite.js";

process.env.AUTH_MODE = "disabled";

async function fixture() {
  const root = await mkdtemp(path.join(os.tmpdir(), "manju-ddd-review-"));
  const ctx = await createAppContext(root, { mediaCacheEnabled: false, aiClient: new FakeAIClient() });
  const repo = new SqliteReviewRepository(ctx.databaseFile);
  const uow = createTransactionServiceUnitOfWork(ctx.transactionService);
  const deps = { repo, uow };
  return {
    root,
    ctx,
    deps,
    repo,
    async close() {
      await ctx.close();
      await rm(root, { recursive: true, force: true });
    },
  };
}

function cmdId(label) {
  return `cmd-${label}-${Math.random().toString(36).slice(2, 10)}`;
}

function rawDb(ctx) {
  return getRawDatabase(ctx.databaseFile);
}

test("DDD-REVIEW save + get roundtrips the aggregate", async () => {
  const f = await fixture();
  try {
    const agg = await handleSubmitReview(f.deps, {
      commandId: cmdId("submit"), type: "SubmitReview", issuedAt: new Date().toISOString(),
      targetType: "shot", targetId: "shot-rt-1", projectId: "proj-1", submittedBy: "author-1",
    });
    assert.equal(agg.isNew, false);
    const reloaded = await f.repo.get(agg.id);
    assert.ok(reloaded);
    assert.equal(reloaded.status, "pending");
    assert.equal(reloaded.version, 1);
    assert.equal(reloaded.targetId, "shot-rt-1");
  } finally {
    await f.close();
  }
});

test("DDD-REVIEW findByTarget locates the most recent review", async () => {
  const f = await fixture();
  try {
    const agg = await handleSubmitReview(f.deps, {
      commandId: cmdId("submit"), type: "SubmitReview", issuedAt: new Date().toISOString(),
      targetType: "shot", targetId: "shot-tgt", projectId: "proj-1", submittedBy: "author-1",
    });
    const found = await f.repo.findByTarget("shot", "shot-tgt");
    assert.ok(found);
    assert.equal(found.id, agg.id);
    const miss = await f.repo.findByTarget("shot", "nonexistent");
    assert.equal(miss, null);
  } finally {
    await f.close();
  }
});

test("DDD-REVIEW optimistic lock: second concurrent reviewer gets version conflict", async () => {
  const f = await fixture();
  try {
    const agg = await handleSubmitReview(f.deps, {
      commandId: cmdId("submit"), type: "SubmitReview", issuedAt: new Date().toISOString(),
      targetType: "shot", targetId: "shot-concurrency", projectId: "proj-1", submittedBy: "author-1",
    });
    await handleStartReview(f.deps, {
      commandId: cmdId("start"), type: "StartReview", issuedAt: new Date().toISOString(),
      reviewId: agg.id, reviewerId: "reviewer-A",
    });
    // 两名审核人各自加载同一版本。
    const a = await f.repo.get(agg.id);
    const b = await f.repo.get(agg.id);
    assert.equal(a.version, b.version);
    const expectedVersion = a.version;
    // A 先审批通过，版本递增。
    a.approve("reviewer-A");
    await f.repo.save(a, expectedVersion);
    // B 用过期的 expectedVersion 再审批，必须冲突。
    b.approve("reviewer-B");
    await assert.rejects(
      () => f.repo.save(b, expectedVersion),
      (err) => errorCodeOf(err) === DOMAIN_ERROR_CODES.aggregateVersionConflict,
    );
    // 数据库最终状态以 A 为准。
    const final = await f.repo.get(agg.id);
    assert.equal(final.status, "approved");
    assert.equal(final.reviewedBy, "reviewer-A");
  } finally {
    await f.close();
  }
});

test("DDD-REVIEW transaction atomicity: throw after save rolls back state, history, snapshot, outbox", async () => {
  const f = await fixture();
  try {
    const agg = await handleSubmitReview(f.deps, {
      commandId: cmdId("submit"), type: "SubmitReview", issuedAt: new Date().toISOString(),
      targetType: "shot", targetId: "shot-rollback", projectId: "proj-1", submittedBy: "author-1",
    });
    await handleStartReview(f.deps, {
      commandId: cmdId("start"), type: "StartReview", issuedAt: new Date().toISOString(),
      reviewId: agg.id, reviewerId: "reviewer-A",
    });
    const before = await f.repo.get(agg.id);
    const expectedVersion = before.version;
    // 在 UoW 内 save + enqueue 事件后抛错，验证全部回滚。
    await assert.rejects(
      () => f.deps.uow.run(async (ctx) => {
        const loaded = await f.repo.get(agg.id);
        loaded.approve("reviewer-A");
        await f.repo.save(loaded, expectedVersion);
        for (const evt of loaded.pullDomainEvents()) ctx.enqueueDomainEvent(evt);
        throw new Error("simulated downstream failure");
      }),
      /simulated downstream failure/,
    );
    // 状态未变（仍在 in_review，版本未递增）。
    const after = await f.repo.get(agg.id);
    assert.equal(after.status, "in_review");
    assert.equal(after.version, expectedVersion);
    // 没有新增历史 / 快照 / outbox 事件。
    const history = await f.repo.listHistory(agg.id);
    const snapshotCount = rawDb(f.ctx)
      .prepare("SELECT COUNT(*) AS n FROM review_snapshots WHERE review_id = ?")
      .get(agg.id);
    // 只检查被回滚的 approve 产生的 ReviewApproved 事件；
    // submit 已提交的 ReviewSubmitted 不应被计入（它属于另一个已提交事务）。
    const approvedOutboxCount = rawDb(f.ctx)
      .prepare("SELECT COUNT(*) AS n FROM outbox_events WHERE topic = ?")
      .get("ReviewApproved");
    // 历史只含 submit + start（rollback 的 approve 未留存）。
    const approveHistory = history.filter((h) => h.action === "approve");
    assert.equal(approveHistory.length, 0, "rolled-back approve must not persist history");
    assert.equal(Number(snapshotCount.n), 0, "rolled-back snapshot must not persist");
    assert.equal(Number(approvedOutboxCount.n), 0, "rolled-back ReviewApproved outbox event must not persist");
  } finally {
    await f.close();
  }
});

test("DDD-REVIEW idempotency: duplicate commandId throws command_already_processed", async () => {
  const f = await fixture();
  try {
    const dupId = cmdId("dup");
    const agg = await handleSubmitReview(f.deps, {
      commandId: dupId, type: "SubmitReview", issuedAt: new Date().toISOString(),
      targetType: "shot", targetId: "shot-idem", projectId: "proj-1", submittedBy: "author-1",
    });
    // 重复同一 commandId 再次提交 → 抛 command_already_processed。
    await assert.rejects(
      () => handleSubmitReview(f.deps, {
        commandId: dupId, type: "SubmitReview", issuedAt: new Date().toISOString(),
        targetType: "shot", targetId: "shot-idem-2", projectId: "proj-1", submittedBy: "author-1",
      }),
      (err) => errorCodeOf(err) === DOMAIN_ERROR_CODES.commandAlreadyProcessed,
    );
    // 原审核仍在，未受重复命令影响。
    const stillThere = await f.repo.get(agg.id);
    assert.ok(stillThere);
  } finally {
    await f.close();
  }
});

test("DDD-REVIEW SLA isolation: aggregate save does not overwrite SLA metadata", async () => {
  const f = await fixture();
  try {
    const agg = await handleSubmitReview(f.deps, {
      commandId: cmdId("submit"), type: "SubmitReview", issuedAt: new Date().toISOString(),
      targetType: "shot", targetId: "shot-sla", projectId: "proj-1", submittedBy: "author-1",
    });
    // 模拟 SLA 服务写入 sla_due_at / escalation_level。
    await f.ctx.reviewItems.update(agg.id, {
      sla_due_at: "2026-12-31T23:59:59.000Z",
      escalation_level: 2,
      escalated_at: "2026-07-23T00:00:00.000Z",
    });
    // 走聚合命令改状态（start → approve）。
    await handleStartReview(f.deps, {
      commandId: cmdId("start"), type: "StartReview", issuedAt: new Date().toISOString(),
      reviewId: agg.id, reviewerId: "reviewer-A",
    });
    await handleApproveReview(f.deps, {
      commandId: cmdId("approve"), type: "ApproveReview", issuedAt: new Date().toISOString(),
      reviewId: agg.id, reviewerId: "reviewer-A",
    });
    // SLA 字段必须原样保留，聚合 save 未触碰。
    const row = await f.ctx.reviewItems.findById(agg.id);
    assert.equal(row.sla_due_at, "2026-12-31T23:59:59.000Z");
    assert.equal(row.escalation_level, 2);
    assert.equal(row.escalated_at, "2026-07-23T00:00:00.000Z");
    // 聚合状态已变为 approved。
    assert.equal(row.status, "approved");
  } finally {
    await f.close();
  }
});

test("DDD-REVIEW outbox: committed command writes the domain event to outbox_events", async () => {
  const f = await fixture();
  try {
    const agg = await handleSubmitReview(f.deps, {
      commandId: cmdId("submit"), type: "SubmitReview", issuedAt: new Date().toISOString(),
      targetType: "shot", targetId: "shot-outbox", projectId: "proj-1", submittedBy: "author-1",
    });
    await handleStartReview(f.deps, {
      commandId: cmdId("start"), type: "StartReview", issuedAt: new Date().toISOString(),
      reviewId: agg.id, reviewerId: "reviewer-A",
    });
    await handleApproveReview(f.deps, {
      commandId: cmdId("approve"), type: "ApproveReview", issuedAt: new Date().toISOString(),
      reviewId: agg.id, reviewerId: "reviewer-A",
    });
    const rows = rawDb(f.ctx)
      .prepare("SELECT topic, payload FROM outbox_events WHERE topic = ? ORDER BY created_at")
      .all("ReviewApproved");
    assert.ok(rows.length >= 1, "ReviewApproved outbox event must be persisted on commit");
    const payload = JSON.parse(rows[rows.length - 1].payload);
    assert.equal(payload.aggregateId, agg.id);
    assert.equal(payload.aggregateType, "Review");
    assert.equal(payload.payload.reviewedBy, "reviewer-A");
  } finally {
    await f.close();
  }
});

test("DDD-REVIEW history + snapshot persisted atomically with state on approve", async () => {
  const f = await fixture();
  try {
    const agg = await handleSubmitReview(f.deps, {
      commandId: cmdId("submit"), type: "SubmitReview", issuedAt: new Date().toISOString(),
      targetType: "shot", targetId: "shot-hist", projectId: "proj-1", submittedBy: "author-1",
    });
    await handleStartReview(f.deps, {
      commandId: cmdId("start"), type: "StartReview", issuedAt: new Date().toISOString(),
      reviewId: agg.id, reviewerId: "reviewer-A",
    });
    await handleApproveReview(f.deps, {
      commandId: cmdId("approve"), type: "ApproveReview", issuedAt: new Date().toISOString(),
      reviewId: agg.id, reviewerId: "reviewer-A",
    });
    const history = await f.repo.listHistory(agg.id);
    const actions = history.map((h) => h.action);
    assert.deepEqual(actions, ["submit", "start_review", "approve"]);
    const snapshots = rawDb(f.ctx)
      .prepare("SELECT action, snapshot_data FROM review_snapshots WHERE review_id = ? ORDER BY created_at")
      .all(agg.id);
    assert.ok(snapshots.length >= 1);
    const lastSnapshot = JSON.parse(snapshots[snapshots.length - 1].snapshot_data);
    assert.equal(lastSnapshot.status, "approved");
  } finally {
    await f.close();
  }
});

test("DDD-REVIEW rework loop persists rejectedCount and reSubmitCount", async () => {
  const f = await fixture();
  try {
    const agg = await handleSubmitReview(f.deps, {
      commandId: cmdId("submit"), type: "SubmitReview", issuedAt: new Date().toISOString(),
      targetType: "shot", targetId: "shot-rework", projectId: "proj-1", submittedBy: "author-1",
    });
    // 第一轮：start → reject → markNeedsFix → resubmit
    await handleStartReview(f.deps, {
      commandId: cmdId("start1"), type: "StartReview", issuedAt: new Date().toISOString(),
      reviewId: agg.id, reviewerId: "reviewer-A",
    });
    const rejected = await f.deps.uow.run(async (ctx) => {
      const loaded = await f.repo.get(agg.id);
      const v = loaded.version;
      loaded.reject("reviewer-A", "visual_error");
      loaded.markNeedsFix("reviewer-A");
      await f.repo.save(loaded, v);
      await f.repo.recordCommand(cmdId("reject1"), loaded.id);
      for (const evt of loaded.pullDomainEvents()) ctx.enqueueDomainEvent(evt);
      return loaded;
    });
    await handleResubmitReview(f.deps, {
      commandId: cmdId("resubmit1"), type: "ResubmitReview", issuedAt: new Date().toISOString(),
      reviewId: agg.id, submittedBy: "author-1",
    });
    const after = await f.repo.get(agg.id);
    assert.equal(after.rejectedCount, 1);
    assert.equal(after.reSubmitCount, 1);
    assert.equal(after.status, "pending");
    assert.equal(after.previousReviewId, agg.id);
  } finally {
    await f.close();
  }
});
