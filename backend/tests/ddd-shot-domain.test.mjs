/**
 * @file ddd-shot-domain.test.mjs
 * @description V2.1 DDD-SHOT 领域层单元测试（纯内存，不依赖 DB / HTTP / AppContext）。
 *
 * 覆盖（迭代计划 §5.5 / §5.7）：
 *  - 状态机：8 状态、17 迁移、终态保护。
 *  - 聚合行为：create / editMetadata / markReady / startGeneration /
 *    attachGeneratedVideo / submitForReview / approve / reject / requestFix /
 *    archive / restore / softDelete / restoreFromSoftDelete。
 *  - 不变量：editMetadata 不改 status / version / 审核结果；
 *    送审需有生成结果；已审核镜头（in_review/approved）禁止普通删除；
 *    重复 Provider 回调幂等；candidate/generationRequestId 不匹配拒绝覆盖；
 *    每次成功业务变更只递增一次版本。
 *  - 领域错误码：aggregate_not_found / invalid_state_transition /
 *    aggregate_invariant_violated / command_already_processed /
 *    aggregate_version_conflict。
 *  - 领域事件：ShotVideoCandidateAttached / ShotSubmittedForReview /
 *    ShotApproved / ShotRejected。
 */
import assert from "node:assert/strict";
import test from "node:test";
import { ShotAggregate } from "../dist/src/domain/storyboard/shot.aggregate.js";
import {
  SHOT_TRANSITIONS,
  SHOT_STATES,
  SHOT_TERMINAL_STATES,
  SHOT_PROTECTED_FIELDS,
  nextShotStatus,
  canTransition,
  isShotTerminal,
  assertShotTransition,
} from "../dist/src/domain/storyboard/shot-state-machine.js";
import {
  errorCodeOf,
  shotNotFoundError,
  invalidShotTransitionError,
  shotInvariantViolatedError,
  shotMissingVideoResultError,
  shotRejectionReasonRequiredError,
  shotAlreadyProcessedError,
  shotIsTerminalError,
  shotVersionConflictError,
  shotProtectedFromDeleteError,
  shotCandidateMismatchError,
} from "../dist/src/domain/storyboard/shot-errors.js";
import {
  shotVideoCandidateAttachedEvent,
  shotSubmittedForReviewEvent,
  shotApprovedEvent,
  shotRejectedEvent,
} from "../dist/src/domain/storyboard/shot-events.js";
import { DOMAIN_EVENT_TYPES } from "../dist/src/domain/shared/domain-event.js";
import { DOMAIN_ERROR_CODES } from "../dist/src/domain/shared/domain-error.js";

function makeShot(overrides = {}) {
  return ShotAggregate.create({
    projectId: "proj-1",
    storyboardId: "sb-1",
    title: "test",
    description: "test",
    ...overrides,
  });
}

// ===== 状态机 =====

test("shot state machine exposes exactly 8 states", () => {
  assert.deepEqual(
    [...SHOT_STATES].sort(),
    [
      "approved", "archived", "draft", "generating", "in_review",
      "needs_fix", "ready", "rejected",
    ],
  );
});

test("shot state machine has 18 frozen transitions", () => {
  assert.equal(SHOT_TRANSITIONS.length, 18);
});

test("shot terminal state is archived (only one out edge: restore)", () => {
  assert.deepEqual([...SHOT_TERMINAL_STATES], ["archived"]);
  assert.equal(isShotTerminal("archived"), true);
  assert.equal(isShotTerminal("draft"), false);
  assert.equal(isShotTerminal("ready"), false);
});

test("shot state machine enforces happy path", () => {
  assert.equal(nextShotStatus("draft", "markReady"), "ready");
  assert.equal(nextShotStatus("ready", "startGeneration"), "generating");
  assert.equal(nextShotStatus("generating", "attachGeneratedVideo"), "ready");
  assert.equal(nextShotStatus("ready", "submitForReview"), "in_review");
  assert.equal(nextShotStatus("in_review", "approve"), "approved");
  // archived 终态唯一出边是 restore
  assert.equal(nextShotStatus("archived", "restore"), "draft");
  assert.equal(nextShotStatus("archived", "approve"), null);
});

test("shot state machine enforces rework path", () => {
  assert.equal(nextShotStatus("in_review", "reject"), "rejected");
  assert.equal(nextShotStatus("approved", "requestFix"), "needs_fix");
  assert.equal(nextShotStatus("needs_fix", "submitForReview"), "in_review");
});

test("shot state machine rejects illegal transitions", () => {
  // 已审核不能再 startGeneration
  assert.equal(nextShotStatus("approved", "startGeneration"), null);
  // 已删除终态不能再 approve
  assert.equal(nextShotStatus("archived", "approve"), null);
  // draft 不能直接 approve（必须先 in_review）
  assert.equal(nextShotStatus("draft", "approve"), null);
});

test("assertShotTransition returns ok/to or ok:false", () => {
  assert.deepEqual(assertShotTransition("draft", "markReady"), { ok: true, to: "ready" });
  assert.deepEqual(assertShotTransition("draft", "approve"), { ok: false });
  assert.equal(canTransition("draft", "markReady"), true);
  assert.equal(canTransition("draft", "approve"), false);
});

test("shot protected fields list contains all forbidden update keys", () => {
  for (const key of [
    "status", "version", "reviewId", "reviewResult", "approvedAt",
    "rejectedAt", "reviewerId", "submittedAt", "submittedBy",
    "lastGenerationRequestId",
  ]) {
    assert.ok(SHOT_PROTECTED_FIELDS.includes(key), `missing protected key: ${key}`);
  }
});

// ===== 聚合行为 =====

test("shot create produces a draft aggregate with version 1", () => {
  const shot = makeShot({ description: "abc" });
  assert.equal(shot.status, "draft");
  assert.equal(shot.version, 1);
  assert.equal(shot.description, "abc");
  assert.equal(shot.lastAction, "create");
  assert.ok(shot.isNew);
});

test("shot markReady transitions draft -> ready and bumps version once", () => {
  const shot = makeShot();
  shot.markReady("u1");
  assert.equal(shot.status, "ready");
  assert.equal(shot.version, 2);
  assert.equal(shot.lastAction, "markReady");
});

test("shot markReady rejects from generating", () => {
  const shot = makeShot();
  shot.startGeneration({ actorId: "u1", generationRequestId: "g-1" });
  assert.throws(
    () => shot.markReady("u1"),
    (err) => errorCodeOf(err) === "invalid_state_transition",
  );
});

test("shot editMetadata changes fields but not status or version input", () => {
  const shot = makeShot();
  const v0 = shot.version;
  const s0 = shot.status;
  shot.editMetadata("u1", { title: "new", duration: 5 });
  assert.equal(shot.title, "new");
  assert.equal(shot.duration, 5);
  assert.equal(shot.status, s0);
  assert.equal(shot.version, v0 + 1);
});

test("shot editMetadata does not touch reviewResult", () => {
  const shot = makeShot();
  shot.markReady("u1");
  shot.startGeneration({ actorId: "u1", generationRequestId: "g-1" });
  shot.attachGeneratedVideo({
    candidateId: "c1",
    providerRequestId: "p1",
    videoUrl: "u1",
    generationRequestId: "g-1",
    attachedBy: "u1",
  });
  shot.submitForReview({ submittedBy: "u1" });
  shot.approve({ reviewId: "r1", reviewedBy: "u2" });
  // 记录 approve 之后的 reviewResult
  const reviewBefore = shot.reviewResult;
  shot.editMetadata("u1", { title: "after-approve" });
  assert.deepEqual(shot.reviewResult, reviewBefore);
});

test("shot editMetadata rejects empty actorId", () => {
  const shot = makeShot();
  assert.throws(
    () => shot.editMetadata("", { title: "x" }),
    (err) => errorCodeOf(err) === "aggregate_invariant_violated",
  );
});

test("shot startGeneration sets currentGenerationRequestId", () => {
  const shot = makeShot();
  shot.startGeneration({ actorId: "u1", generationRequestId: "g-9" });
  assert.equal(shot.status, "generating");
  assert.equal(shot.currentGenerationRequestId, "g-9");
  assert.equal(shot.version, 2);
});

test("shot attachGeneratedVideo transitions generating -> ready and emits event", () => {
  const shot = makeShot();
  shot.startGeneration({ actorId: "u1", generationRequestId: "g-1" });
  shot.attachGeneratedVideo({
    candidateId: "c1",
    providerRequestId: "p1",
    videoUrl: "http://x",
    generationRequestId: "g-1",
    attachedBy: "u1",
  });
  assert.equal(shot.status, "ready");
  assert.equal(shot.videoUrl, "http://x");
  assert.equal(shot.videoCandidates.length, 1);
  const events = shot.pullDomainEvents();
  assert.equal(events.length, 1);
  assert.equal(events[0].type, DOMAIN_EVENT_TYPES.shotVideoCandidateAttached);
  assert.equal(events[0].aggregateType, "Shot");
  assert.equal(events[0].payload.candidateId, "c1");
  assert.equal(events[0].payload.providerRequestId, "p1");
});

test("shot attachGeneratedVideo is idempotent on duplicate providerRequestId", () => {
  const shot = makeShot();
  shot.startGeneration({ actorId: "u1", generationRequestId: "g-1" });
  shot.attachGeneratedVideo({
    candidateId: "c1",
    providerRequestId: "p1",
    videoUrl: "http://x",
    generationRequestId: "g-1",
    attachedBy: "u1",
  });
  const initialEvents = shot.pullDomainEvents();
  assert.equal(initialEvents.length, 1);
  const v0 = shot.version;
  const candidates0 = shot.videoCandidates.length;
  // 重复回调
  shot.attachGeneratedVideo({
    candidateId: "c1-dup",
    providerRequestId: "p1",
    videoUrl: "http://x",
    generationRequestId: "g-1",
    attachedBy: "u1",
  });
  assert.equal(shot.version, v0);
  assert.equal(shot.videoCandidates.length, candidates0);
  assert.equal(shot.hasPendingEvents(), false);
});

test("shot attachGeneratedVideo rejects when generationRequestId mismatched (rework after manual retry)", () => {
  const shot = makeShot();
  shot.startGeneration({ actorId: "u1", generationRequestId: "g-1" });
  shot.attachGeneratedVideo({
    candidateId: "c0",
    providerRequestId: "p0",
    videoUrl: "http://old",
    generationRequestId: "g-1",
    attachedBy: "u1",
  });
  shot.submitForReview({ submittedBy: "u1" });
  // 人工返工：从审核中退回并触发新生成 g-2
  shot.requestFix("u1", "manual rework");
  shot.startGeneration({ actorId: "u1", generationRequestId: "g-2" });
  // 旧回调到达（g-1），不能覆盖人工返工后的状态
  assert.throws(
    () => shot.attachGeneratedVideo({
      candidateId: "c1",
      providerRequestId: "p1",
      videoUrl: "http://x",
      generationRequestId: "g-1",
      attachedBy: "u1",
    }),
    (err) => errorCodeOf(err) === "aggregate_invariant_violated",
  );
});

test("shot submitForReview requires video result", () => {
  const shot = makeShot();
  shot.markReady("u1");
  assert.throws(
    () => shot.submitForReview({ submittedBy: "u1" }),
    (err) => err.code === "aggregate_invariant_violated",
  );
});

test("shot submitForReview transitions ready -> in_review and emits event", () => {
  const shot = makeShot();
  shot.markReady("u1");
  shot.startGeneration({ actorId: "u1", generationRequestId: "g-1" });
  shot.attachGeneratedVideo({
    candidateId: "c1",
    providerRequestId: "p1",
    videoUrl: "http://x",
    generationRequestId: "g-1",
    attachedBy: "u1",
  });
  shot.submitForReview({ submittedBy: "u1" });
  assert.equal(shot.status, "in_review");
  const events = shot.pullDomainEvents();
  // 包含 attach + submit 两个事件
  const types = events.map((e) => e.type);
  assert.ok(types.includes(DOMAIN_EVENT_TYPES.shotVideoCandidateAttached));
  assert.ok(types.includes(DOMAIN_EVENT_TYPES.shotSubmittedForReview));
});

test("shot approve transitions in_review -> approved and emits event", () => {
  const shot = makeShot();
  shot.markReady("u1");
  shot.startGeneration({ actorId: "u1", generationRequestId: "g-1" });
  shot.attachGeneratedVideo({
    candidateId: "c1",
    providerRequestId: "p1",
    videoUrl: "http://x",
    generationRequestId: "g-1",
    attachedBy: "u1",
  });
  shot.submitForReview({ submittedBy: "u1" });
  shot.approve({ reviewId: "r1", reviewedBy: "u2" });
  assert.equal(shot.status, "approved");
  assert.equal(shot.reviewResult?.reviewId, "r1");
  const events = shot.pullDomainEvents();
  assert.ok(events.some((e) => e.type === DOMAIN_EVENT_TYPES.shotApproved));
});

test("shot approve is idempotent on same reviewId", () => {
  const shot = makeShot();
  shot.markReady("u1");
  shot.startGeneration({ actorId: "u1", generationRequestId: "g-1" });
  shot.attachGeneratedVideo({
    candidateId: "c1",
    providerRequestId: "p1",
    videoUrl: "http://x",
    generationRequestId: "g-1",
    attachedBy: "u1",
  });
  shot.submitForReview({ submittedBy: "u1" });
  shot.approve({ reviewId: "r1", reviewedBy: "u2" });
  const v0 = shot.version;
  shot.approve({ reviewId: "r1", reviewedBy: "u2" });
  assert.equal(shot.version, v0);
});

test("shot reject requires reason", () => {
  const shot = makeShot();
  shot.markReady("u1");
  shot.startGeneration({ actorId: "u1", generationRequestId: "g-1" });
  shot.attachGeneratedVideo({
    candidateId: "c1",
    providerRequestId: "p1",
    videoUrl: "http://x",
    generationRequestId: "g-1",
    attachedBy: "u1",
  });
  shot.submitForReview({ submittedBy: "u1" });
  assert.throws(
    () => shot.reject({
      reviewId: "r1",
      reviewedBy: "u2",
      reasonCode: "",
    }),
    (err) => err.code === "aggregate_invariant_violated",
  );
});

test("shot reject transitions in_review -> rejected with reason", () => {
  const shot = makeShot();
  shot.markReady("u1");
  shot.startGeneration({ actorId: "u1", generationRequestId: "g-1" });
  shot.attachGeneratedVideo({
    candidateId: "c1",
    providerRequestId: "p1",
    videoUrl: "http://x",
    generationRequestId: "g-1",
    attachedBy: "u1",
  });
  shot.submitForReview({ submittedBy: "u1" });
  shot.reject({ reviewId: "r1", reviewedBy: "u2", reasonCode: "shot_issue" });
  assert.equal(shot.status, "rejected");
  assert.equal(shot.reviewResult?.reasonCode, "shot_issue");
});

test("shot reject emits ShotRejected event with reason", () => {
  const shot = makeShot();
  shot.markReady("u1");
  shot.startGeneration({ actorId: "u1", generationRequestId: "g-1" });
  shot.attachGeneratedVideo({
    candidateId: "c1",
    providerRequestId: "p1",
    videoUrl: "http://x",
    generationRequestId: "g-1",
    attachedBy: "u1",
  });
  shot.submitForReview({ submittedBy: "u1" });
  shot.reject({ reviewId: "r1", reviewedBy: "u2", reasonCode: "shot_issue" });
  const events = shot.pullDomainEvents();
  const rejected = events.find((e) => e.type === DOMAIN_EVENT_TYPES.shotRejected);
  assert.ok(rejected);
  assert.equal(rejected.payload.reason, "shot_issue");
  assert.equal(rejected.payload.reviewId, "r1");
});

test("shot requestFix transitions in_review -> needs_fix", () => {
  const shot = makeShot();
  shot.markReady("u1");
  shot.startGeneration({ actorId: "u1", generationRequestId: "g-1" });
  shot.attachGeneratedVideo({
    candidateId: "c1",
    providerRequestId: "p1",
    videoUrl: "http://x",
    generationRequestId: "g-1",
    attachedBy: "u1",
  });
  shot.submitForReview({ submittedBy: "u1" });
  shot.requestFix("u2", "color off");
  assert.equal(shot.status, "needs_fix");
});

test("shot archive then restore returns to draft", () => {
  const shot = makeShot();
  shot.markReady("u1");
  shot.archive("u1");
  assert.equal(shot.status, "archived");
  shot.restore("u1");
  assert.equal(shot.status, "draft");
});

test("shot archive rejected from in_review and generating", () => {
  const s1 = makeShot();
  s1.markReady("u1");
  s1.startGeneration({ actorId: "u1", generationRequestId: "g-1" });
  assert.throws(
    () => s1.archive("u1"),
    (err) => err.code === "invalid_state_transition",
  );

  const s2 = makeShot();
  s2.markReady("u1");
  s2.startGeneration({ actorId: "u1", generationRequestId: "g-1" });
  s2.attachGeneratedVideo({
    candidateId: "c1",
    providerRequestId: "p1",
    videoUrl: "http://x",
    generationRequestId: "g-1",
    attachedBy: "u1",
  });
  s2.submitForReview({ submittedBy: "u1" });
  assert.throws(
    () => s2.archive("u1"),
    (err) => err.code === "invalid_state_transition",
  );
});

test("shot softDelete blocks in_review and approved", () => {
  const s1 = makeShot();
  s1.markReady("u1");
  s1.startGeneration({ actorId: "u1", generationRequestId: "g-1" });
  s1.attachGeneratedVideo({
    candidateId: "c1",
    providerRequestId: "p1",
    videoUrl: "http://x",
    generationRequestId: "g-1",
    attachedBy: "u1",
  });
  s1.submitForReview({ submittedBy: "u1" });
  assert.throws(
    () => s1.softDelete("u1"),
    (err) => err.code === "aggregate_invariant_violated",
  );

  const s2 = makeShot();
  s2.markReady("u1");
  s2.startGeneration({ actorId: "u1", generationRequestId: "g-1" });
  s2.attachGeneratedVideo({
    candidateId: "c1",
    providerRequestId: "p1",
    videoUrl: "http://x",
    generationRequestId: "g-1",
    attachedBy: "u1",
  });
  s2.submitForReview({ submittedBy: "u1" });
  s2.approve({ reviewId: "r1", reviewedBy: "u2" });
  assert.throws(
    () => s2.softDelete("u1"),
    (err) => err.code === "aggregate_invariant_violated",
  );
});

test("shot softDelete is allowed from draft and idempotent", () => {
  const s = makeShot();
  s.softDelete("u1");
  assert.equal(s.deletedAt.length > 0, true);
  const v0 = s.version;
  s.softDelete("u1");
  assert.equal(s.version, v0);
  s.restoreFromSoftDelete("u1");
  assert.equal(s.deletedAt, "");
});

test("shot version increments exactly once per command", () => {
  const s = makeShot();
  assert.equal(s.version, 1);
  s.markReady("u1");
  assert.equal(s.version, 2);
  s.startGeneration({ actorId: "u1", generationRequestId: "g-1" });
  assert.equal(s.version, 3);
  s.attachGeneratedVideo({
    candidateId: "c1",
    providerRequestId: "p1",
    videoUrl: "http://x",
    generationRequestId: "g-1",
    attachedBy: "u1",
  });
  assert.equal(s.version, 4);
});

test("shot editMetadata on archived is blocked by terminal check", () => {
  const s = makeShot();
  s.markReady("u1");
  s.archive("u1");
  assert.throws(
    () => s.editMetadata("u1", { title: "x" }),
    (err) => err.code === "invalid_state_transition",
  );
});

test("shot rehydrate round-trip preserves all fields", () => {
  const s = makeShot({ description: "orig", title: "t" });
  s.markReady("u1");
  s.startGeneration({ actorId: "u1", generationRequestId: "g-1" });
  s.attachGeneratedVideo({
    candidateId: "c1",
    providerRequestId: "p1",
    videoUrl: "http://x",
    generationRequestId: "g-1",
    attachedBy: "u1",
  });
  s.submitForReview({ submittedBy: "u1" });
  s.approve({ reviewId: "r1", reviewedBy: "u2" });
  const row = s.toPersistenceRow();
  // 通过 rehydrate 还原
  const rehydrated = ShotAggregate.rehydrate({
    id: row.id,
    projectId: row.project_id,
    storyboardId: row.storyboard_id,
    sceneId: row.scene_id,
    episode: row.episode,
    shotNumber: row.shot_number,
    title: row.title,
    description: row.description,
    duration: row.duration,
    shotSize: row.shot_size,
    cameraAngle: row.camera_angle,
    cameraMovement: row.camera_movement,
    dialogue: row.dialogue,
    notes: row.notes,
    imageUrl: row.image_url,
    videoTaskId: row.video_task_id,
    videoUrl: row.video_url,
    status: row.status,
    order: row.order,
    characterAssetIds: JSON.parse(row.character_asset_ids),
    propAssetIds: JSON.parse(row.prop_asset_ids),
    currentGenerationRequestId: row.current_generation_request_id,
    videoCandidates: JSON.parse(row.video_candidates),
    reviewResult: row.review_result ? JSON.parse(row.review_result) : null,
    submittedBy: row.submitted_by,
    deletedAt: row.deleted_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    version: row.version,
  });
  assert.equal(rehydrated.status, "approved");
  assert.equal(rehydrated.reviewResult?.reviewId, "r1");
  assert.equal(rehydrated.videoCandidates[0].providerRequestId, "p1");
  assert.equal(rehydrated.currentGenerationRequestId, "g-1");
});

// ===== 错误工厂 =====

test("shot-errors factories produce the frozen codes", () => {
  assert.equal(shotNotFoundError("x").code, "aggregate_not_found");
  assert.equal(invalidShotTransitionError("draft", "approve").code, "invalid_state_transition");
  assert.equal(shotInvariantViolatedError("r").code, "aggregate_invariant_violated");
  assert.equal(shotMissingVideoResultError("x").code, "aggregate_invariant_violated");
  assert.equal(shotRejectionReasonRequiredError().code, "aggregate_invariant_violated");
  assert.equal(shotAlreadyProcessedError("x", "approve").code, "command_already_processed");
  assert.equal(shotIsTerminalError("archived").code, "invalid_state_transition");
  assert.equal(shotVersionConflictError("x", 1).code, "aggregate_version_conflict");
  assert.equal(shotProtectedFromDeleteError("x", "in_review").code, "aggregate_invariant_violated");
  assert.equal(shotCandidateMismatchError("x", "g-1", "g-2").code, "aggregate_invariant_violated");
  assert.equal(errorCodeOf(shotNotFoundError("x")), DOMAIN_ERROR_CODES.aggregateNotFound);
  assert.equal(errorCodeOf(new Error("plain")), undefined);
});

// ===== 事件工厂 =====

test("shot event factories produce correct envelopes", () => {
  const e1 = shotVideoCandidateAttachedEvent({
    shotId: "sh-1",
    projectId: "p-1",
    shotVersion: 3,
    candidateId: "c-1",
    providerRequestId: "p-1",
  });
  assert.equal(e1.type, DOMAIN_EVENT_TYPES.shotVideoCandidateAttached);
  assert.equal(e1.aggregateId, "sh-1");
  assert.equal(e1.aggregateType, "Shot");
  assert.equal(e1.payload.candidateId, "c-1");

  const e2 = shotSubmittedForReviewEvent({
    shotId: "sh-1",
    projectId: "p-1",
    shotVersion: 4,
    submittedBy: "u1",
  });
  assert.equal(e2.type, DOMAIN_EVENT_TYPES.shotSubmittedForReview);
  assert.equal(e2.payload.submittedBy, "u1");

  const e3 = shotApprovedEvent({
    shotId: "sh-1",
    projectId: "p-1",
    reviewId: "r-1",
    shotVersion: 5,
    reviewedBy: "u2",
  });
  assert.equal(e3.type, DOMAIN_EVENT_TYPES.shotApproved);
  assert.equal(e3.payload.reviewId, "r-1");

  const e4 = shotRejectedEvent({
    shotId: "sh-1",
    projectId: "p-1",
    reviewId: "r-1",
    shotVersion: 5,
    reviewedBy: "u2",
    reason: "shot_issue",
  });
  assert.equal(e4.type, DOMAIN_EVENT_TYPES.shotRejected);
  assert.equal(e4.payload.reason, "shot_issue");

  // 防御性断言
  assert.throws(
    () => shotApprovedEvent({
      shotId: "sh-1",
      projectId: "p-1",
      reviewId: "",
      shotVersion: 1,
      reviewedBy: "u2",
    }),
    TypeError,
  );
  assert.throws(
    () => shotRejectedEvent({
      shotId: "sh-1",
      projectId: "p-1",
      reviewId: "r-1",
      shotVersion: 1,
      reviewedBy: "u2",
      reason: "",
    }),
    TypeError,
  );
});
