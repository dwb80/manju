/**
 * @file ddd-review-domain.test.mjs
 * @description V2.1 DDD-REVIEW 领域层单元测试（纯内存，不依赖 DB / HTTP / AppContext）。
 *
 * 覆盖（迭代计划 §6.5 / §6.7）：
 *  - 七状态机：全部状态、8 条迁移、终态保护。
 *  - 聚合行为：submit / start / approve / reject / markNeedsFix / resubmit / close / cancel / assignReviewer。
 *  - 不变量：只有 in_review 可审批/驳回；驳回必须带原因；驳回次数只能由聚合递增；
 *    重新提交只能从 needs_fix 进入；审核历史不能由调用方伪造；终态不可变更。
 *  - 领域错误码：aggregate_not_found / invalid_state_transition / aggregate_invariant_violated /
 *    command_already_processed。
 *  - 领域事件：ReviewSubmitted / ReviewApproved / ReviewRejected / ReviewResubmitted 及 payload。
 */
import assert from "node:assert/strict";
import test from "node:test";
import {
  ReviewAggregate,
} from "../dist/src/domain/review/review.aggregate.js";
import {
  REVIEW_TRANSITIONS,
  REVIEW_STATES,
  REVIEW_TERMINAL_STATES,
  nextReviewStatus,
  canTransition,
  isReviewTerminal,
  assertReviewTransition,
} from "../dist/src/domain/review/review-state-machine.js";
import {
  RejectionReason,
  REJECTION_REASONS,
} from "../dist/src/domain/review/rejection-reason.value-object.js";
import {
  errorCodeOf,
  reviewNotFoundError,
  invalidReviewTransitionError,
  reviewInvariantViolatedError,
  rejectionReasonRequiredError,
  reviewAlreadyProcessedError,
  reviewIsTerminalError,
  reviewVersionConflictError,
} from "../dist/src/domain/review/review-errors.js";
import {
  reviewSubmittedEvent,
  reviewApprovedEvent,
  reviewRejectedEvent,
  reviewResubmittedEvent,
} from "../dist/src/domain/review/review-events.js";
import { DOMAIN_EVENT_TYPES } from "../dist/src/domain/shared/domain-event.js";
import { DOMAIN_ERROR_CODES } from "../dist/src/domain/shared/domain-error.js";

function makeReview(overrides = {}) {
  return ReviewAggregate.submit({
    targetType: "shot",
    targetId: "shot-1",
    projectId: "proj-1",
    submittedBy: "author-1",
    ...overrides,
  });
}

// ===== 状态机 =====

test("review state machine exposes exactly 7 states", () => {
  assert.deepEqual(
    [...REVIEW_STATES].sort(),
    ["approved", "cancelled", "closed", "in_review", "needs_fix", "pending", "rejected"],
  );
});

test("review state machine has 8 frozen transitions", () => {
  assert.equal(REVIEW_TRANSITIONS.length, 8);
});

test("review terminal states are closed and cancelled", () => {
  assert.deepEqual([...REVIEW_TERMINAL_STATES].sort(), ["cancelled", "closed"]);
  assert.equal(isReviewTerminal("closed"), true);
  assert.equal(isReviewTerminal("cancelled"), true);
  assert.equal(isReviewTerminal("pending"), false);
});

test("review transitions only allow approval/rejection from in_review", () => {
  // 冻结契约测试的关键断言：pending 不允许直接 approve/reject。
  assert.equal(canTransition("pending", "approve"), false);
  assert.equal(canTransition("pending", "reject"), false);
  assert.equal(canTransition("in_review", "approve"), true);
  assert.equal(canTransition("in_review", "reject"), true);
});

test("review full happy path: pending -> in_review -> approved -> closed", () => {
  assert.equal(nextReviewStatus("pending", "start"), "in_review");
  assert.equal(nextReviewStatus("in_review", "approve"), "approved");
  assert.equal(nextReviewStatus("approved", "close"), "closed");
  assert.equal(nextReviewStatus("closed", "close"), null);
});

test("review rework path: in_review -> rejected -> needs_fix -> pending", () => {
  assert.equal(nextReviewStatus("in_review", "reject"), "rejected");
  assert.equal(nextReviewStatus("rejected", "markNeedsFix"), "needs_fix");
  assert.equal(nextReviewStatus("needs_fix", "resubmit"), "pending");
});

test("assertReviewTransition returns ok/to or {ok:false}", () => {
  assert.deepEqual(assertReviewTransition("pending", "start"), { ok: true, to: "in_review" });
  assert.deepEqual(assertReviewTransition("pending", "approve"), { ok: false });
});

test("terminal states have no outgoing transitions", () => {
  for (const terminal of REVIEW_TERMINAL_STATES) {
    for (const [, command] of REVIEW_TRANSITIONS) {
      assert.equal(nextReviewStatus(terminal, command), null);
    }
  }
});

// ===== 聚合行为 =====

test("submit creates a pending review with version 1 and ReviewSubmitted event", () => {
  const agg = makeReview();
  assert.equal(agg.status, "pending");
  assert.equal(agg.version, 1);
  assert.equal(agg.rejectedCount, 0);
  assert.equal(agg.reSubmitCount, 0);
  assert.equal(agg.isNew, true);
  assert.equal(agg.chainId.startsWith("rc-"), true);
  const events = agg.pullDomainEvents();
  assert.equal(events.length, 1);
  assert.equal(events[0].type, DOMAIN_EVENT_TYPES.reviewSubmitted);
  assert.equal(events[0].aggregateType, "Review");
  assert.equal(events[0].payload.reviewId, agg.id);
  assert.equal(events[0].payload.targetId, "shot-1");
});

test("submit rejects empty required fields", () => {
  assert.throws(
    () => ReviewAggregate.submit({ targetType: "shot", targetId: "", projectId: "p", submittedBy: "u" }),
    (err) => errorCodeOf(err) === DOMAIN_ERROR_CODES.aggregateInvariantViolated,
  );
});

test("start moves pending -> in_review and assigns reviewer", () => {
  const agg = makeReview();
  agg.start("reviewer-1");
  assert.equal(agg.status, "in_review");
  assert.equal(agg.reviewedBy, "reviewer-1");
  assert.equal(agg.version, 2);
  assert.equal(agg.isNew, true); // start doesn't persist; isNew only flipped by repo.save
});

test("approve moves in_review -> approved and emits ReviewApproved", () => {
  const agg = makeReview().start("reviewer-1");
  agg.approve("reviewer-1");
  assert.equal(agg.status, "approved");
  assert.ok(agg.approvedAt.length > 0);
  const events = agg.pullDomainEvents();
  const approved = events.find((e) => e.type === DOMAIN_EVENT_TYPES.reviewApproved);
  assert.ok(approved, "ReviewApproved event must be emitted");
  assert.equal(approved.payload.reviewedBy, "reviewer-1");
});

test("reject moves in_review -> rejected, increments rejectedCount, requires reason", () => {
  const agg = makeReview().start("reviewer-1");
  agg.reject("reviewer-1", "visual_error");
  assert.equal(agg.status, "rejected");
  assert.equal(agg.rejectedCount, 1);
  assert.equal(agg.rejectionReasonCode.code, "visual_error");
  const events = agg.pullDomainEvents();
  const rejected = events.find((e) => e.type === DOMAIN_EVENT_TYPES.reviewRejected);
  assert.ok(rejected, "ReviewRejected event must be emitted");
  assert.equal(rejected.payload.reason, "visual_error");
});

test("reject without reason throws invariant_violated", () => {
  const agg = makeReview().start("reviewer-1");
  assert.throws(
    () => agg.reject("reviewer-1", ""),
    (err) => errorCodeOf(err) === DOMAIN_ERROR_CODES.aggregateInvariantViolated,
  );
  assert.throws(
    () => agg.reject("reviewer-1", "not_a_real_code"),
    (err) => err instanceof TypeError,
  );
});

test("approve/reject only allowed from in_review", () => {
  const pending = makeReview();
  assert.throws(
    () => pending.approve("r"),
    (err) => errorCodeOf(err) === DOMAIN_ERROR_CODES.invalidStateTransition,
  );
  assert.throws(
    () => pending.reject("r", "other"),
    (err) => errorCodeOf(err) === DOMAIN_ERROR_CODES.invalidStateTransition,
  );
});

test("markNeedsFix moves rejected -> needs_fix", () => {
  const agg = makeReview().start("r").reject("r", "other").markNeedsFix("r");
  assert.equal(agg.status, "needs_fix");
  // 驳回原因保留，供前端展示。
  assert.equal(agg.rejectionReasonCode.code, "other");
});

test("resubmit moves needs_fix -> pending, increments reSubmitCount, emits ReviewResubmitted", () => {
  const agg = makeReview().start("r").reject("r", "other").markNeedsFix("r");
  const previousId = agg.id;
  agg.resubmit("author-1");
  assert.equal(agg.status, "pending");
  assert.equal(agg.reSubmitCount, 1);
  assert.equal(agg.previousReviewId, previousId);
  const events = agg.pullDomainEvents();
  const resub = events.find((e) => e.type === DOMAIN_EVENT_TYPES.reviewResubmitted);
  assert.ok(resub, "ReviewResubmitted event must be emitted");
  assert.equal(resub.payload.previousReviewId, previousId);
});

test("resubmit only allowed from needs_fix", () => {
  const rejected = makeReview().start("r").reject("r", "other");
  assert.throws(
    () => rejected.resubmit("author"),
    (err) => errorCodeOf(err) === DOMAIN_ERROR_CODES.invalidStateTransition,
  );
});

test("close moves approved -> closed and rejected -> closed", () => {
  const approved = makeReview().start("r").approve("r");
  approved.close("r");
  assert.equal(approved.status, "closed");

  const rejected = makeReview().start("r").reject("r", "other");
  rejected.close("r");
  assert.equal(rejected.status, "closed");
});

test("cancel moves pending -> cancelled", () => {
  const agg = makeReview();
  agg.cancel("author-1");
  assert.equal(agg.status, "cancelled");
});

test("terminal states reject any further transition", () => {
  const closed = makeReview().start("r").approve("r").close("r");
  assert.throws(
    () => closed.approve("r"),
    (err) => errorCodeOf(err) === DOMAIN_ERROR_CODES.invalidStateTransition,
  );
  const cancelled = makeReview().cancel("author");
  assert.throws(
    () => cancelled.start("r"),
    (err) => errorCodeOf(err) === DOMAIN_ERROR_CODES.invalidStateTransition,
  );
});

test("assignReviewer assigns on pending without changing status", () => {
  const agg = makeReview();
  agg.assignReviewer("reviewer-2");
  assert.equal(agg.status, "pending");
  assert.equal(agg.reviewedBy, "reviewer-2");
  // reassign records a transfer action in history.
  agg.assignReviewer("reviewer-3");
  const history = agg.pullPendingHistory();
  assert.equal(history[history.length - 1].action, "transfer");
});

test("assignReviewer rejected on non-pending state", () => {
  const agg = makeReview().start("r");
  assert.throws(
    () => agg.assignReviewer("r2"),
    (err) => errorCodeOf(err) === DOMAIN_ERROR_CODES.invalidStateTransition,
  );
});

// ===== 不变量：审核历史不能由调用方伪造 =====

test("history is produced only by aggregate transitions and pullable once", () => {
  const agg = makeReview().start("r");
  const h1 = agg.pullPendingHistory();
  assert.ok(h1.length >= 2, "submit + start each record history");
  const h2 = agg.pullPendingHistory();
  assert.equal(h2.length, 0, "history must be drained after pull");
  // 历史条目携带聚合 id 与动作。
  assert.equal(h1[0].review_id, agg.id);
  assert.equal(h1[0].action, "submit");
});

test("rejectedCount only increments inside reject (not via external mutation)", () => {
  const agg = makeReview().start("r");
  assert.equal(agg.rejectedCount, 0);
  agg.reject("r", "other");
  assert.equal(agg.rejectedCount, 1);
  agg.markNeedsFix("r").resubmit("a").start("r").reject("r", "other");
  assert.equal(agg.rejectedCount, 2);
});

test("each transition bumps version exactly once", () => {
  const agg = makeReview(); // v1
  agg.start("r"); // v2
  agg.approve("r"); // v3
  assert.equal(agg.version, 3);
});

// ===== 领域错误构造器 =====

test("review errors carry stable codes and details", () => {
  assert.equal(errorCodeOf(reviewNotFoundError("rev-1")), DOMAIN_ERROR_CODES.aggregateNotFound);
  assert.equal(errorCodeOf(invalidReviewTransitionError("pending", "approve")), DOMAIN_ERROR_CODES.invalidStateTransition);
  assert.equal(errorCodeOf(reviewInvariantViolatedError("rule")), DOMAIN_ERROR_CODES.aggregateInvariantViolated);
  assert.equal(errorCodeOf(rejectionReasonRequiredError()), DOMAIN_ERROR_CODES.aggregateInvariantViolated);
  assert.equal(errorCodeOf(reviewAlreadyProcessedError("rev-1", "approve")), DOMAIN_ERROR_CODES.commandAlreadyProcessed);
  assert.equal(errorCodeOf(reviewIsTerminalError("closed")), DOMAIN_ERROR_CODES.invalidStateTransition);
  assert.equal(errorCodeOf(reviewVersionConflictError("rev-1", 3)), DOMAIN_ERROR_CODES.aggregateVersionConflict);
});

// ===== 值对象 =====

test("RejectionReason validates against the 11 frozen codes", () => {
  assert.equal(REJECTION_REASONS.length, 11);
  for (const { code } of REJECTION_REASONS) {
    const r = RejectionReason.create(code);
    assert.equal(r.code, code);
    assert.equal(r.equals(code), true);
  }
  assert.throws(() => RejectionReason.create("bogus"), TypeError);
});

// ===== 事件工厂 =====

test("reviewRejectedEvent refuses empty reason", () => {
  assert.throws(
    () => reviewRejectedEvent({
      reviewId: "r", targetType: "shot", targetId: "s", projectId: "p",
      reviewVersion: 2, reviewedBy: "u", reason: "",
    }),
    TypeError,
  );
});

test("reviewSubmittedEvent carries stable envelope", () => {
  const evt = reviewSubmittedEvent({
    reviewId: "r1", targetType: "shot", targetId: "s1", projectId: "p1", reviewVersion: 1,
  });
  assert.equal(evt.type, "ReviewSubmitted");
  assert.equal(evt.aggregateType, "Review");
  assert.equal(evt.aggregateId, "r1");
  assert.equal(evt.payload.reviewVersion, 1);
});

// ===== rehydrate 不产生事件/历史 =====

test("rehydrate restores aggregate without producing events or history", () => {
  const agg = ReviewAggregate.rehydrate({
    id: "rev-x", targetType: "shot", targetId: "s", projectId: "p",
    status: "in_review", rejectedCount: 2, rejectionReasonCode: "",
    reSubmitCount: 1, approvedAt: "", submittedBy: "a", reviewedBy: "r",
    previousReviewId: "rev-y", chainId: "rc-1",
    createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-02T00:00:00.000Z",
    version: 5,
  });
  assert.equal(agg.version, 5);
  assert.equal(agg.isNew, false);
  assert.equal(agg.hasPendingEvents(), false);
  assert.equal(agg.pullPendingHistory().length, 0);
  // rehydrated aggregate can continue transitioning.
  agg.approve("r");
  assert.equal(agg.status, "approved");
  assert.equal(agg.version, 6);
});
