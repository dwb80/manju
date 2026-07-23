import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { createAppContext } from "../dist/src/services/app.js";
import { FakeAIClient } from "../dist/src/ai/fake-ai-client.js";
import {
  runAttachVideoCandidate,
  runCreateShot,
  runStartGeneration,
  runSubmitReview,
} from "../dist/src/services/module-domain/shot-command-runner.js";

process.env.AUTH_MODE = "disabled";
process.env.NODE_ENV = "test";
process.env.MANJU_DISABLE_OUTBOX_DISPATCHER = "1";

async function fixture() {
  const root = await mkdtemp(path.join(os.tmpdir(), "manju-ddd-integration-"));
  const ctx = await createAppContext(root, {
    mediaCacheEnabled: false,
    aiClient: new FakeAIClient(),
  });
  return {
    root,
    ctx,
    async close() {
      await ctx.close();
      await rm(root, { recursive: true, force: true });
    },
  };
}

async function drain(ctx, observed = []) {
  return ctx.transactionService.dispatchPendingOutbox({
    batchSize: 100,
    publish: async (event) => {
      observed.push(event);
      await ctx.aggregateEventDispatcher.publish(event);
    },
  });
}

test("Review -> Shot -> Pipeline approval chain is idempotent", async () => {
  const f = await fixture();
  try {
    const {
      CreateRunHandler,
      StartRunHandler,
      StartNodeHandler,
    } = await import("../dist/src/application/pipeline/pipeline-command-handler.js");
    const { SqlitePipelineRunRepository } = await import(
      "../dist/src/infrastructure/persistence/sqlite-pipeline-run.repository.js"
    );
    const pipelineRepository = new SqlitePipelineRunRepository(f.ctx.databaseFile);
    const runId = "run-review-chain";
    await new CreateRunHandler(pipelineRepository).execute({
      commandId: "integration:create-run",
      type: "CreatePipelineRun",
      issuedAt: new Date().toISOString(),
      run: {
        id: runId,
        projectId: "project-1",
        name: "review-chain",
        nodes: [{ id: "review-node-1", type: "review", name: "review" }],
        dependencies: [],
      },
    });
    await new StartRunHandler(pipelineRepository).execute({
      commandId: "integration:start-run",
      type: "StartPipelineRun",
      issuedAt: new Date().toISOString(),
      runId,
    });
    await new StartNodeHandler(pipelineRepository).execute({
      commandId: "integration:start-review-node",
      type: "StartPipelineNode",
      issuedAt: new Date().toISOString(),
      runId,
      nodeId: "review-node-1",
    });

    const shot = await runCreateShot(f.ctx, {
      projectId: "project-1",
      storyboardId: "storyboard-1",
      actorId: "author-1",
    });
    await runStartGeneration(f.ctx, {
      shotId: shot.id,
      actorId: "author-1",
      generationRequestId: "generation-1",
    });
    await runAttachVideoCandidate(f.ctx, {
      shotId: shot.id,
      candidateId: "candidate-1",
      providerRequestId: "provider-1",
      videoUrl: "/media/video-1.mp4",
      generationRequestId: "generation-1",
      attachedBy: "author-1",
    });
    await runSubmitReview(f.ctx, {
      shotId: shot.id,
      submittedBy: "author-1",
      pipelineRunId: runId,
      pipelineNodeId: "review-node-1",
    });

    await drain(f.ctx);
    const reviews = await f.ctx.reviewItems.findMany({
      target_type: "shot",
      target_id: shot.id,
    });
    assert.equal(reviews.length, 1);
    const review = reviews[0];

    await f.ctx.reviewService.startReview(review.id, "reviewer-1");
    await f.ctx.reviewService.approve(review.id, "reviewer-1");

    const observed = [];
    await drain(f.ctx, observed);
    await drain(f.ctx, observed);

    const savedShot = await f.ctx.shots.findById(shot.id);
    assert.equal(savedShot.status, "approved");
    const nodes = await f.ctx.pipelineRunService.getRunNodes(runId);
    assert.equal(
      nodes.find((node) => node.id === "review-node-1")?.status,
      "completed",
    );

    const reviewApproved = observed.find((event) => event.topic === "ReviewApproved");
    assert.ok(reviewApproved);
    await f.ctx.aggregateEventDispatcher.publish(reviewApproved);
    const shotsAfterReplay = await f.ctx.shots.findById(shot.id);
    assert.equal(shotsAfterReplay.version, savedShot.version);
  } finally {
    await f.close();
  }
});
