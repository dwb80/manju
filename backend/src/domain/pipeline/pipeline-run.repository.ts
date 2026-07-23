import type { AggregateRepository } from "../shared/aggregate-root.js";
import type { PipelineRunAggregate } from "./pipeline-run.aggregate.js";

export interface PipelineRunRepository
  extends AggregateRepository<PipelineRunAggregate> {
  create(aggregate: PipelineRunAggregate): Promise<void>;
  findCompletedOutputByIdempotencyKey(
    projectId: string,
    idempotencyKey: string,
    excludingNodeId: string,
  ): Promise<Readonly<Record<string, unknown>> | null>;
}
