import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import {
  CompleteNodeHandler,
  PauseRunHandler,
  StartNodeHandler,
  StartRunHandler,
} from "../dist/src/application/pipeline/pipeline-command-handler.js";
import { PipelineRunAggregate } from "../dist/src/domain/pipeline/pipeline-run.aggregate.js";
import { DomainError } from "../dist/src/domain/shared/domain-error.js";
import { SqlitePipelineRunRepository } from "../dist/src/infrastructure/persistence/sqlite-pipeline-run.repository.js";
import {
  closeDatabase,
  getRawDatabase,
} from "../dist/src/storage/sqlite.js";

function fixture() {
  const directory = mkdtempSync(join(tmpdir(), "ddd-pipeline-"));
  const databaseFile = join(directory, "pipeline.sqlite");
  const repository = new SqlitePipelineRunRepository(databaseFile);
  return {
    directory,
    databaseFile,
    repository,
    close() {
      closeDatabase(databaseFile);
      rmSync(directory, { recursive: true, force: true });
    },
  };
}

async function seed(repository, id = "run-persistence") {
  const aggregate = PipelineRunAggregate.create({
    id,
    projectId: "project-1",
    name: "Persistence",
    createdAt: "2026-07-23T00:00:00.000Z",
    nodes: [{ id: `${id}-node`, type: "wait", name: "Node" }],
    dependencies: [],
  });
  await repository.create(aggregate);
  return aggregate;
}

test("optimistic lock rejects concurrent aggregate writers", async (t) => {
  const f = fixture();
  t.after(() => f.close());
  await seed(f.repository);
  await new StartRunHandler(f.repository).execute({
    commandId: "start",
    type: "StartPipelineRun",
    issuedAt: "2026-07-23T00:00:01.000Z",
    runId: "run-persistence",
  });

  const first = await f.repository.get("run-persistence");
  const second = await f.repository.get("run-persistence");
  first.pause("pause-first", "2026-07-23T00:00:02.000Z");
  await f.repository.save(first, first.persistedVersion);
  second.startNode(
    "start-second",
    "run-persistence-node",
    "2026-07-23T00:00:02.000Z",
  );
  await assert.rejects(
    () => f.repository.save(second, second.persistedVersion),
    (error) =>
      error instanceof DomainError &&
      error.code === "aggregate_version_conflict",
  );
});

test("pause/callback race conflicts then safely completes against paused run", async (t) => {
  const f = fixture();
  t.after(() => f.close());
  await seed(f.repository, "run-race");
  await new StartRunHandler(f.repository).execute({
    commandId: "start-run",
    type: "StartPipelineRun",
    issuedAt: "2026-07-23T00:00:01.000Z",
    runId: "run-race",
  });
  await new StartNodeHandler(f.repository).execute({
    commandId: "start-node",
    type: "StartPipelineNode",
    issuedAt: "2026-07-23T00:00:02.000Z",
    runId: "run-race",
    nodeId: "run-race-node",
  });

  const pauseCopy = await f.repository.get("run-race");
  const callbackCopy = await f.repository.get("run-race");
  pauseCopy.pause("pause-race", "2026-07-23T00:00:03.000Z");
  callbackCopy.completeNode(
    "callback-race",
    "run-race-node",
    { ok: true },
    "2026-07-23T00:00:03.000Z",
  );
  await f.repository.save(pauseCopy, pauseCopy.persistedVersion);
  await assert.rejects(() =>
    f.repository.save(callbackCopy, callbackCopy.persistedVersion),
  );

  await new CompleteNodeHandler(f.repository).execute({
    commandId: "callback-race",
    type: "CompletePipelineNode",
    issuedAt: "2026-07-23T00:00:04.000Z",
    runId: "run-race",
    nodeId: "run-race-node",
    output: { ok: true },
  });
  const final = await f.repository.get("run-race");
  assert.equal(final.status, "paused");
  assert.equal(final.getNode("run-race-node").status, "completed");
});

test("duplicate callback persists one version increment and one outbox event", async (t) => {
  const f = fixture();
  t.after(() => f.close());
  await seed(f.repository, "run-idempotent");
  await new StartRunHandler(f.repository).execute({
    commandId: "start-run",
    type: "StartPipelineRun",
    issuedAt: "2026-07-23T00:00:01.000Z",
    runId: "run-idempotent",
  });
  await new StartNodeHandler(f.repository).execute({
    commandId: "start-node",
    type: "StartPipelineNode",
    issuedAt: "2026-07-23T00:00:02.000Z",
    runId: "run-idempotent",
    nodeId: "run-idempotent-node",
  });
  const handler = new CompleteNodeHandler(f.repository);
  const callback = {
    commandId: "same-provider-callback",
    type: "CompletePipelineNode",
    issuedAt: "2026-07-23T00:00:03.000Z",
    runId: "run-idempotent",
    nodeId: "run-idempotent-node",
    output: { value: 1 },
  };
  await handler.execute(callback);
  const version = (await f.repository.get("run-idempotent")).version;
  await handler.execute(callback);
  assert.equal((await f.repository.get("run-idempotent")).version, version);
  const database = getRawDatabase(f.databaseFile);
  const row = database
    .prepare(
      "SELECT COUNT(*) AS count FROM outbox_events WHERE topic = 'PipelineNodeCompleted'",
    )
    .get();
  assert.equal(Number(row.count), 1);
});

test("outbox insertion failure rolls back Run state and version", async (t) => {
  const f = fixture();
  t.after(() => f.close());
  await seed(f.repository, "run-rollback");
  const database = getRawDatabase(f.databaseFile);
  database
    .prepare(
      `INSERT INTO outbox_events
       (id, topic, payload, source, status, attempts, max_attempts,
        not_before, last_error, created_at, updated_at)
       VALUES (?, 'collision', '{}', 'test', 'pending', 0, 5, 0, '', ?, ?)`,
    )
    .run(
      "PipelineRunStarted:collision-command",
      "2026-07-23T00:00:00.000Z",
      "2026-07-23T00:00:00.000Z",
    );

  await assert.rejects(() =>
    new StartRunHandler(f.repository).execute({
      commandId: "collision-command",
      type: "StartPipelineRun",
      issuedAt: "2026-07-23T00:00:01.000Z",
      runId: "run-rollback",
    }),
  );
  const aggregate = await f.repository.get("run-rollback");
  assert.equal(aggregate.status, "pending");
  assert.equal(aggregate.version, 1);
});
