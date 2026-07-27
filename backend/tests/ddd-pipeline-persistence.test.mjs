import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import {
  CompleteNodeHandler,
  CreateRunHandler,
  PauseRunHandler,
  StartNodeHandler,
  StartRunHandler,
} from "../dist/src/application/pipeline/pipeline-command-handler.js";
import { PipelineRunAggregate } from "../dist/src/domain/pipeline/pipeline-run.aggregate.js";
import { DomainError } from "../dist/src/domain/shared/domain-error.js";
import { SqlitePipelineRunRepository } from "../dist/src/infrastructure/persistence/sqlite-pipeline-run.repository.js";
import { createTransactionServiceUnitOfWork } from "../dist/src/infrastructure/unit-of-work/transaction-service-unit-of-work.js";
import { createTransactionService } from "../dist/src/services/horizontal/transaction-service.js";
import {
  closeDatabase,
  getRawDatabase,
} from "../dist/src/storage/sqlite.js";

function fixture() {
  const directory = mkdtempSync(join(tmpdir(), "ddd-pipeline-"));
  const databaseFile = join(directory, "pipeline.sqlite");
  const repository = new SqlitePipelineRunRepository(databaseFile);
  const transactionService = createTransactionService({ databaseFile });
  const uow = createTransactionServiceUnitOfWork(transactionService);
  const deps = { repo: repository, uow };
  return {
    directory,
    databaseFile,
    repository,
    deps,
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
  await new StartRunHandler(f.deps).execute({
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
  await new StartRunHandler(f.deps).execute({
    commandId: "start-run",
    type: "StartPipelineRun",
    issuedAt: "2026-07-23T00:00:01.000Z",
    runId: "run-race",
  });
  await new StartNodeHandler(f.deps).execute({
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

  await new CompleteNodeHandler(f.deps).execute({
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
  await new StartRunHandler(f.deps).execute({
    commandId: "start-run",
    type: "StartPipelineRun",
    issuedAt: "2026-07-23T00:00:01.000Z",
    runId: "run-idempotent",
  });
  await new StartNodeHandler(f.deps).execute({
    commandId: "start-node",
    type: "StartPipelineNode",
    issuedAt: "2026-07-23T00:00:02.000Z",
    runId: "run-idempotent",
    nodeId: "run-idempotent-node",
  });
  const handler = new CompleteNodeHandler(f.deps);
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
    new StartRunHandler(f.deps).execute({
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

test("M1: recordCommand throws commandAlreadyProcessed on PK collision and rolls back run save", async (t) => {
  const f = fixture();
  t.after(() => f.close());
  await seed(f.repository, "run-pk-collision");
  // 预写一条幂等键，然后用 monkey-patch 让 isCommandProcessed 看不到它，
  // 强制走 recordCommand 路径，验证 PK 冲突时抛 command_already_processed。
  const database = getRawDatabase(f.databaseFile);
  database
    .prepare(
      `INSERT INTO pipeline_command_log (id, run_id, command_type, created_at)
       VALUES (?, ?, ?, ?)`,
    )
    .run("collide-cmd", "run-pk-collision", "StartPipelineRun", "2026-07-23T00:00:00.000Z");
  const patchedRepo = Object.create(f.repository);
  patchedRepo.isCommandProcessed = async () => false; // 强制走 recordCommand 路径
  const patchedDeps = { repo: patchedRepo, uow: f.deps.uow };
  await assert.rejects(
    () =>
      new StartRunHandler(patchedDeps).execute({
        commandId: "collide-cmd",
        type: "StartPipelineRun",
        issuedAt: "2026-07-23T00:00:01.000Z",
        runId: "run-pk-collision",
      }),
    (err) =>
      err instanceof DomainError &&
      err.code === "command_already_processed" &&
      /Pipeline 命令已处理：collide-cmd/.test(err.message),
  );
  // 即便 StartRun 失败，run 状态也不应被推进：仍是 pending / version=1。
  const after = await f.repository.get("run-pk-collision");
  assert.equal(after.status, "pending");
  assert.equal(after.version, 1);
});

test("M9 (B2): after transaction rollback the same commandId can be retried successfully", async (t) => {
  const f = fixture();
  t.after(() => f.close());
  await seed(f.repository, "run-retry-after-rollback");

  // 关键观察：B2 的本质是"幂等键是事务的一部分，回滚必须把它也带走"。
  // 在基线实现里，recordCommand 在 save 之后、commit 之前；只要 commit 失败，
  // 整条记录（含 pipeline_command_log 这一行）都会消失，从而允许同 commandId 重试。
  // 这里我们用最直接的方式制造回滚：先在事务里把 run 推到一个状态，再让后续步骤抛错。
  // 简化做法 —— 直接用 transactionService.run 在 handler 之前手工触发回滚来对比：
  // 1) 单独跑一次会让 commit 失败的 handler（构造一个会把 commit 弄崩的副作用）。
  // 实际场景：例如 outbox event 写入阶段抛错。我们用包装 uow 来精确复现：
  // 第一次：在 uow.run 的 commit 前抛错，让整个事务回滚，验证幂等键被带走。
  const transactionService = createTransactionService({ databaseFile: f.databaseFile });
  const failingUow = {
    run(work) {
      // 用与正常 UoW 相同的 BEGIN/COMMIT 模式，但在 commit 前抛错。
      return transactionService
        .run(async (ctx) => {
          const result = await work({
            enqueueDomainEvent: (e) => ctx.enqueueOutboxEvent(e),
          });
          // 模拟"commit 阶段出错"——抛错让外层 catch 走 ROLLBACK 分支。
          throw new Error("simulated_commit_failure");
        })
        .catch((err) => {
          throw err;
        });
    },
  };
  const failingDeps = { repo: f.repository, uow: failingUow };
  await assert.rejects(
    () =>
      new StartRunHandler(failingDeps).execute({
        commandId: "retry-after-rollback",
        type: "StartPipelineRun",
        issuedAt: "2026-07-23T00:00:01.000Z",
        runId: "run-retry-after-rollback",
      }),
    (err) => /simulated_commit_failure/.test(err.message),
  );
  // 关键断言 1：commandId 不应残留为"已处理"。
  const database = getRawDatabase(f.databaseFile);
  const logRow = database
    .prepare("SELECT id FROM pipeline_command_log WHERE id = ?")
    .get("retry-after-rollback");
  assert.equal(logRow, undefined, "回滚后幂等键必须消失（与业务写入同生死）");

  // 关键断言 2：run 状态必须回滚到 pending / version=1，不能被提交。
  const afterRollback = await f.repository.get("run-retry-after-rollback");
  assert.equal(afterRollback.status, "pending");
  assert.equal(afterRollback.version, 1);

  // 关键断言 3：用同一个 commandId 第二次提交（用正常 UoW）应能成功。
  await new StartRunHandler(f.deps).execute({
    commandId: "retry-after-rollback",
    type: "StartPipelineRun",
    issuedAt: "2026-07-23T00:00:02.000Z",
    runId: "run-retry-after-rollback",
  });
  const after = await f.repository.get("run-retry-after-rollback");
  assert.equal(after.status, "running");
  assert.equal(after.version, 2);
  const logAfter = database
    .prepare("SELECT id FROM pipeline_command_log WHERE id = ?")
    .get("retry-after-rollback");
  assert.ok(logAfter, "重试成功后幂等键必须落库");
});

test("M8: Empty commandId is rejected at Pipeline handler entry with a clear DomainError", async (t) => {
  const f = fixture();
  t.after(() => f.close());
  await seed(f.repository, "run-empty-cmdid");

  // ExistingRunHandler: 14 个 handler 共用基类，统一只测一个有代表性的即可。
  await assert.rejects(
    () =>
      new StartRunHandler(f.deps).execute({
        commandId: "",
        type: "StartPipelineRun",
        issuedAt: "2026-07-23T00:00:01.000Z",
        runId: "run-empty-cmdid",
      }),
    (err) =>
      err instanceof DomainError &&
      err.code === "aggregate_invariant_violated" &&
      /缺少 commandId/.test(err.message),
  );

  // CreateRunHandler: 单独成路径，必须也守门。
  await assert.rejects(
    () =>
      new CreateRunHandler(f.deps).execute({
        commandId: "",
        type: "CreatePipelineRun",
        issuedAt: "2026-07-23T00:00:01.000Z",
        runId: "run-empty-cmdid-2",
        run: {
          id: "run-empty-cmdid-2",
          projectId: "project-1",
          name: "Empty CommandId",
          nodes: [],
          dependencies: [],
        },
      }),
    (err) =>
      err instanceof DomainError &&
      err.code === "aggregate_invariant_violated" &&
      /CreatePipelineRun 缺少 commandId/.test(err.message),
  );

  // 守门必须在事务外：commandId 缺失时不写幂等键，不写 Run。
  const database = getRawDatabase(f.databaseFile);
  const logCount = database
    .prepare("SELECT COUNT(*) AS c FROM pipeline_command_log")
    .get();
  assert.equal(Number(logCount.c), 0, "空 commandId 守门禁止落幂等键");
  const runCount = database
    .prepare("SELECT COUNT(*) AS c FROM pipeline_runs WHERE id = ?")
    .get("run-empty-cmdid-2");
  assert.equal(Number(runCount.c), 0, "空 commandId 守门禁止建 Run");
});
