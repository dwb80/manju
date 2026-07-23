import type { PipelineNode } from "./pipeline-node.entity.js";
import { isNodeTerminal } from "./pipeline-node-state-machine.js";
import { pipelineInvariant } from "./pipeline-errors.js";

export type DagCondition = "always" | "on_approve" | "on_reject" | "on_skip";

export interface PipelineDependency {
  readonly sourceNodeId: string;
  readonly targetNodeId: string;
  readonly condition: DagCondition;
}

export type DagNodeDecision = "ready" | "blocked" | "unreachable";

const CONDITIONS = new Set<DagCondition>([
  "always",
  "on_approve",
  "on_reject",
  "on_skip",
]);

function edgeMatches(source: PipelineNode, condition: DagCondition): boolean {
  if (condition === "always") return true;
  if (condition === "on_skip") return source.status === "skipped";
  const decision = source.output.decision;
  if (condition === "on_approve") {
    return decision === "approved" || source.output.approved === true;
  }
  return decision === "rejected" || source.output.approved === false;
}

export class DagPolicy {
  static validate(
    nodeIds: readonly string[],
    dependencies: readonly PipelineDependency[],
  ): void {
    const ids = new Set(nodeIds);
    if (ids.size !== nodeIds.length) {
      throw pipelineInvariant("DAG contains duplicate node ids");
    }
    const outgoing = new Map<string, string[]>();
    for (const dependency of dependencies) {
      if (
        !ids.has(dependency.sourceNodeId) ||
        !ids.has(dependency.targetNodeId)
      ) {
        throw pipelineInvariant("DAG dependency references an unknown node", {
          dependency,
        });
      }
      if (dependency.sourceNodeId === dependency.targetNodeId) {
        throw pipelineInvariant("DAG dependency cannot reference itself", {
          nodeId: dependency.sourceNodeId,
        });
      }
      if (!CONDITIONS.has(dependency.condition)) {
        throw pipelineInvariant("Unsupported DAG condition", {
          condition: dependency.condition,
        });
      }
      const targets = outgoing.get(dependency.sourceNodeId) ?? [];
      targets.push(dependency.targetNodeId);
      outgoing.set(dependency.sourceNodeId, targets);
    }

    const visiting = new Set<string>();
    const visited = new Set<string>();
    const visit = (nodeId: string): void => {
      if (visiting.has(nodeId)) throw pipelineInvariant("DAG contains a cycle");
      if (visited.has(nodeId)) return;
      visiting.add(nodeId);
      for (const target of outgoing.get(nodeId) ?? []) visit(target);
      visiting.delete(nodeId);
      visited.add(nodeId);
    };
    for (const nodeId of nodeIds) visit(nodeId);
  }

  static decisionFor(
    nodeId: string,
    nodes: ReadonlyMap<string, PipelineNode>,
    dependencies: readonly PipelineDependency[],
  ): DagNodeDecision {
    const incoming = dependencies.filter((edge) => edge.targetNodeId === nodeId);
    if (incoming.length === 0) return "ready";

    let active = false;
    for (const edge of incoming) {
      const source = nodes.get(edge.sourceNodeId);
      if (!source || !isNodeTerminal(source.status)) return "blocked";
      if (edgeMatches(source, edge.condition)) active = true;
    }
    return active ? "ready" : "unreachable";
  }
}
