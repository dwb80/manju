import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  DOMAIN_ERROR_CODES,
  DomainError,
} from "../dist/src/domain/shared/domain-error.js";
import {
  DOMAIN_EVENT_TYPES,
} from "../dist/src/domain/shared/domain-event.js";
import {
  toDomainOutboxEvent,
} from "../dist/src/application/shared/unit-of-work.js";
import {
  domainErrorHttpStatus,
} from "../dist/src/http/http-utils.js";

test("V2.1 shared domain error codes and HTTP mapping are stable", () => {
  const expected = {
    aggregate_not_found: 404,
    invalid_state_transition: 409,
    aggregate_version_conflict: 409,
    aggregate_invariant_violated: 422,
    command_already_processed: 409,
  };
  assert.deepEqual(
    Object.values(DOMAIN_ERROR_CODES).sort(),
    Object.keys(expected).sort(),
  );
  for (const [code, status] of Object.entries(expected)) {
    assert.equal(domainErrorHttpStatus(new DomainError(code)), status);
  }
});

test("V2.1 event names are frozen and unique", () => {
  const expected = [
    "ShotVideoCandidateAttached",
    "ShotSubmittedForReview",
    "ShotApproved",
    "ShotRejected",
    "ReviewSubmitted",
    "ReviewApproved",
    "ReviewRejected",
    "ReviewResubmitted",
    "PipelineRunStarted",
    "PipelineNodeCompleted",
    "PipelineNodeFailed",
    "PipelineRunCompleted",
    "PipelineRunFailed",
  ];
  const actual = Object.values(DOMAIN_EVENT_TYPES);
  assert.deepEqual(actual, expected);
  assert.equal(new Set(actual).size, actual.length);
});

test("V2.1 domain event maps losslessly to the existing Outbox envelope", () => {
  const event = {
    id: "evt-1",
    type: DOMAIN_EVENT_TYPES.reviewApproved,
    aggregateId: "review-1",
    aggregateType: "Review",
    occurredAt: "2026-07-23T00:00:00.000Z",
    payload: {
      reviewId: "review-1",
      targetType: "shot",
      targetId: "shot-1",
      projectId: "project-1",
      reviewVersion: 2,
      reviewedBy: "user-1",
    },
  };
  assert.deepEqual(toDomainOutboxEvent(event), {
    id: "evt-1",
    topic: "ReviewApproved",
    source: "Review",
    payload: {
      aggregateId: "review-1",
      aggregateType: "Review",
      occurredAt: "2026-07-23T00:00:00.000Z",
      eventVersion: 1,
      payload: event.payload,
    },
  });
});

test("V2.1 frozen state machines are executable task-line test input", async () => {
  const contracts = JSON.parse(
    await readFile(
      new URL("../../docs/iterations/v2.1-ddd-state-machines.json", import.meta.url),
      "utf8",
    ),
  );
  assert.deepEqual(
    Object.keys(contracts),
    ["shot", "review", "pipelineRun", "pipelineNode"],
  );
  for (const [name, machine] of Object.entries(contracts)) {
    const states = new Set(machine.states);
    assert.equal(states.size, machine.states.length, `${name} states must be unique`);
    for (const [from, command, to] of machine.transitions) {
      assert.ok(states.has(from), `${name}.${command} has an unknown source`);
      assert.ok(states.has(to), `${name}.${command} has an unknown target`);
    }
  }
  assert.equal(
    contracts.review.transitions.some(([from, command]) =>
      from === "pending" && (command === "approve" || command === "reject")),
    false,
    "Review approval/rejection is only legal from in_review",
  );
  assert.equal(
    contracts.pipelineRun.transitions.some(([from]) => from === "completed"),
    false,
    "completed PipelineRun is terminal",
  );
});
