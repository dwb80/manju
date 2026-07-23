import assert from "node:assert/strict";
import test from "node:test";

import { PipelineRunAggregate } from "../dist/src/domain/pipeline/pipeline-run.aggregate.js";
import { DomainError } from "../dist/src/domain/shared/domain-error.js";

function createRun(overrides = {}) {
  return PipelineRunAggregate.create({
    id: "run-domain",
    projectId: "project-1",
    name: "DDD pipeline",
    createdAt: "2026-07-23T00:00:00.000Z",
    nodes: [
      { id: "source", type: "review", name: "Source", maxRetries: 2 },
      { id: "approved", type: "wait", name: "Approved branch" },
      { id: "rejected", type: "wait", name: "Rejected branch" },
    ],
    dependencies: [
      {
        sourceNodeId: "source",
        targetNodeId: "approved",
        condition: "on_approve",
      },
      {
        sourceNodeId: "source",
        targetNodeId: "rejected",
        condition: "on_reject",
      },
    ],
    ...overrides,
  });
}

test("Run/Node state machines and DAG policy own legal transitions", () => {
  const run = createRun();
  assert.throws(
    () => run.startNode("start-before-run", "source", "2026-07-23T00:00:01.000Z"),
    DomainError,
  );

  run.start("start-run", "2026-07-23T00:00:01.000Z");
  assert.deepEqual(
    run.runnableNodes().map((node) => node.id),
    ["source"],
  );
  run.startNode("start-source", "source", "2026-07-23T00:00:02.000Z");
  run.completeNode(
    "complete-source",
    "source",
    { decision: "approved" },
    "2026-07-23T00:00:03.000Z",
  );

  assert.deepEqual(
    run.runnableNodes().map((node) => node.id),
    ["approved"],
  );
  assert.deepEqual(
    run.unreachableNodes().map((node) => node.id),
    ["rejected"],
  );
  assert.throws(
    () =>
      run.startNode(
        "start-rejected",
        "rejected",
        "2026-07-23T00:00:04.000Z",
      ),
    DomainError,
  );
});

test("duplicate execution result command is idempotent", () => {
  const run = createRun({
    nodes: [{ id: "only", type: "wait", name: "Only" }],
    dependencies: [],
  });
  run.start("start-run", "2026-07-23T00:00:01.000Z");
  run.startNode("start-only", "only", "2026-07-23T00:00:02.000Z");
  assert.equal(
    run.completeNode(
      "provider-callback-1",
      "only",
      { value: 1 },
      "2026-07-23T00:00:03.000Z",
    ),
    true,
  );
  const version = run.version;
  assert.equal(
    run.completeNode(
      "provider-callback-1",
      "only",
      { value: 2 },
      "2026-07-23T00:00:04.000Z",
    ),
    false,
  );
  assert.equal(run.version, version);
  assert.deepEqual(run.getNode("only").output, { value: 1 });
});

test("non-retryable failure can be explicitly recovered without resetting attempts", () => {
  const run = createRun({
    nodes: [{ id: "only", type: "wait", name: "Only", maxRetries: 2 }],
    dependencies: [],
  });
  run.start("start-run", "2026-07-23T00:00:01.000Z");
  run.startNode("start-only", "only", "2026-07-23T00:00:02.000Z");
  run.failNode(
    "failure-only",
    "only",
    { message: "validation failed", category: "validation_error", retryable: false },
    "2026-07-23T00:00:03.000Z",
  );
  run.finalize("finalize-failed", "2026-07-23T00:00:04.000Z");
  assert.equal(run.status, "failed");
  assert.equal(run.getNode("only").retryCount, 1);

  run.retryNode("manual-retry", "only", "2026-07-23T00:00:05.000Z");
  assert.equal(run.status, "running");
  assert.equal(run.getNode("only").status, "pending");
  assert.equal(run.getNode("only").retryCount, 1);
});

test("DAG rejects cycles and unsupported expression conditions", () => {
  assert.throws(
    () =>
      createRun({
        nodes: [
          { id: "a", type: "wait", name: "A" },
          { id: "b", type: "wait", name: "B" },
        ],
        dependencies: [
          { sourceNodeId: "a", targetNodeId: "b", condition: "always" },
          { sourceNodeId: "b", targetNodeId: "a", condition: "always" },
        ],
      }),
    DomainError,
  );
  assert.throws(
    () =>
      createRun({
        nodes: [
          { id: "a", type: "wait", name: "A" },
          { id: "b", type: "wait", name: "B" },
        ],
        dependencies: [
          { sourceNodeId: "a", targetNodeId: "b", condition: "expression" },
        ],
      }),
    DomainError,
  );
});
