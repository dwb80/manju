/**
 * @file pipeline-dag.ts
 * @description Pipeline DAG 校验 + 拓扑排序
 *
 * ## 职责
 *  - 校验节点 / 依赖关系合法性（无环、无自依赖、无重复、节点类型合法、有起点）
 *  - 计算拓扑顺序
 *  - 提供查询辅助：起点节点、上游依赖、下游依赖
 *
 * ## 不负责
 *  - DAG 执行（pipeline-run-service.ts）
 *  - 节点实际运行（executeNode）
 */
import { rootLogger } from "../../logger.js";
import type {
  PipelineNode,
  PipelineDependency,
  PipelineNodeType,
  PipelineDependencyCondition,
} from "../../types/pipeline.js";

const log = rootLogger.child({ module: "pipeline-dag" });

/** DAG 校验失败的类型枚举。 */
export type DagValidationErrorType =
  | "CYCLE_DETECTED"
  | "INVALID_NODE_TYPE"
  | "MISSING_SOURCE_NODE"
  | "MISSING_TARGET_NODE"
  | "SELF_DEPENDENCY"
  | "DUPLICATE_DEPENDENCY"
  | "NO_START_NODE"
  | "EMPTY_NODES"
  | "INVALID_CONDITION_TYPE";

export interface DagValidationError {
  type: DagValidationErrorType;
  message: string;
  details?: Record<string, unknown>;
}

export interface DagValidationResult {
  valid: boolean;
  errors: DagValidationError[];
  /** 拓扑顺序（仅 valid=true 时返回）。 */
  topologicalOrder?: string[];
}

/** 合法的节点类型白名单。 */
export const VALID_NODE_TYPES: PipelineNodeType[] = [
  "image_generation",
  "video_generation",
  "tts",
  "composition",
  "render",
  "review",
  "quality_check",
  "notification",
  "wait",
  "webhook",
];

/** 合法的边条件类型（V2 W6 REQ-PIPE-005-02）：
 *  - "always"：默认，无条件
 *  - "expression"：基于 $.output.x 等路径表达式的条件（详见 pipeline-run-service.ts）
 */
export const VALID_CONDITION_TYPES: ReadonlyArray<"always" | "expression"> = ["always", "expression"];

export function isValidNodeType(type: string): type is PipelineNodeType {
  return VALID_NODE_TYPES.includes(type as PipelineNodeType);
}

export function isValidConditionType(type: string): type is "always" | "expression" {
  return (VALID_CONDITION_TYPES as readonly string[]).includes(type);
}

/**
 * 检测 DAG 中是否存在循环。返回 cycle 路径（如 `["A","B","C","A"]`）或 null。
 * 实现：DFS + 递归栈，检测 back edge。
 */
export function detectCycle(
  nodes: PipelineNode[],
  dependencies: PipelineDependency[],
): string[] | null {
  const nodeMap = new Map<string, PipelineNode>();
  for (const node of nodes) nodeMap.set(node.id, node);

  const adjacency = new Map<string, string[]>();
  for (const node of nodes) adjacency.set(node.id, []);
  for (const dep of dependencies) {
    const targets = adjacency.get(dep.source_node_id) || [];
    targets.push(dep.target_node_id);
    adjacency.set(dep.source_node_id, targets);
  }

  const visited = new Set<string>();
  const recursionStack = new Set<string>();
  const cyclePath: string[] = [];

  function dfs(nodeId: string): boolean {
    if (!visited.has(nodeId)) {
      visited.add(nodeId);
      recursionStack.add(nodeId);
      const neighbors = adjacency.get(nodeId) || [];
      for (const neighbor of neighbors) {
        if (!visited.has(neighbor) && dfs(neighbor)) {
          cyclePath.unshift(nodeId);
          return true;
        } else if (recursionStack.has(neighbor)) {
          // 后向边：找到环
          cyclePath.unshift(neighbor);
          cyclePath.unshift(nodeId);
          return true;
        }
      }
    }
    recursionStack.delete(nodeId);
    return false;
  }

  for (const nodeId of nodeMap.keys()) {
    if (!visited.has(nodeId) && dfs(nodeId)) {
      return cyclePath;
    }
  }
  return null;
}

/**
 * 拓扑排序（Kahn 算法）。若存在环则返回 null。
 * 输出：保证所有上游节点排在前面的 nodeId 数组。
 */
export function topologicalSort(
  nodes: PipelineNode[],
  dependencies: PipelineDependency[],
): string[] | null {
  const nodeMap = new Map<string, PipelineNode>();
  for (const node of nodes) nodeMap.set(node.id, node);

  const inDegree = new Map<string, number>();
  const adjacency = new Map<string, string[]>();
  for (const node of nodes) {
    inDegree.set(node.id, 0);
    adjacency.set(node.id, []);
  }
  for (const dep of dependencies) {
    const targets = adjacency.get(dep.source_node_id) || [];
    targets.push(dep.target_node_id);
    adjacency.set(dep.source_node_id, targets);
    inDegree.set(dep.target_node_id, (inDegree.get(dep.target_node_id) || 0) + 1);
  }

  const queue: string[] = [];
  for (const [nodeId, degree] of inDegree) {
    if (degree === 0) queue.push(nodeId);
  }

  const result: string[] = [];
  while (queue.length > 0) {
    const nodeId = queue.shift()!;
    result.push(nodeId);
    const neighbors = adjacency.get(nodeId) || [];
    for (const neighbor of neighbors) {
      const newDegree = (inDegree.get(neighbor) || 0) - 1;
      inDegree.set(neighbor, newDegree);
      if (newDegree === 0) queue.push(neighbor);
    }
  }

  if (result.length !== nodes.length) return null;
  return result;
}

/**
 * 校验 DAG 全量合法性。返回 valid + errors + topologicalOrder。
 * 校验项：节点数 / 节点类型 / 依赖源目标存在 / 无自依赖 / 无重复 / 无环。
 */
export function validateDag(
  nodes: PipelineNode[],
  dependencies: PipelineDependency[],
): DagValidationResult {
  const errors: DagValidationError[] = [];
  const nodeIds = new Set<string>();
  const nodeMap = new Map<string, PipelineNode>();

  if (nodes.length === 0) {
    errors.push({
      type: "EMPTY_NODES",
      message: "Pipeline 必须包含至少一个节点",
    });
    return { valid: false, errors };
  }

  for (const node of nodes) {
    nodeIds.add(node.id);
    nodeMap.set(node.id, node);
    if (!isValidNodeType(node.type)) {
      errors.push({
        type: "INVALID_NODE_TYPE",
        message: `无效的节点类型: ${node.type}`,
        details: { nodeId: node.id, nodeName: node.name, validTypes: VALID_NODE_TYPES },
      });
    }
  }

  const depSet = new Set<string>();
  for (const dep of dependencies) {
    const depKey = `${dep.source_node_id}->${dep.target_node_id}`;
    if (!nodeIds.has(dep.source_node_id)) {
      errors.push({
        type: "MISSING_SOURCE_NODE",
        message: `依赖源节点不存在: ${dep.source_node_id}`,
        details: { dependencyId: dep.id, targetNodeId: dep.target_node_id },
      });
    }
    if (!nodeIds.has(dep.target_node_id)) {
      errors.push({
        type: "MISSING_TARGET_NODE",
        message: `依赖目标节点不存在: ${dep.target_node_id}`,
        details: { dependencyId: dep.id, sourceNodeId: dep.source_node_id },
      });
    }
    if (dep.source_node_id === dep.target_node_id) {
      errors.push({
        type: "SELF_DEPENDENCY",
        message: `节点不能依赖自身: ${dep.source_node_id}`,
        details: { dependencyId: dep.id },
      });
    }
    if (depSet.has(depKey)) {
      errors.push({
        type: "DUPLICATE_DEPENDENCY",
        message: `重复的依赖关系: ${dep.source_node_id} -> ${dep.target_node_id}`,
        details: { dependencyId: dep.id },
      });
    }
    // V2 W6 REQ-PIPE-005-02：校验边条件类型合法（缺省视作 always）
    if (dep.condition_type && !isValidConditionType(dep.condition_type)) {
      errors.push({
        type: "INVALID_CONDITION_TYPE",
        message: `无效的边条件类型: ${dep.condition_type}`,
        details: {
          dependencyId: dep.id,
          conditionType: dep.condition_type,
          validTypes: VALID_CONDITION_TYPES,
        },
      });
    }
    depSet.add(depKey);
  }

  const cyclePath = detectCycle(nodes, dependencies);
  if (cyclePath) {
    errors.push({
      type: "CYCLE_DETECTED",
      message: `检测到循环依赖: ${cyclePath.join(" -> ")}`,
      details: { cyclePath },
    });
  }

  const topoOrder = topologicalSort(nodes, dependencies);
  if (!topoOrder && !errors.find((e) => e.type === "CYCLE_DETECTED")) {
    errors.push({
      type: "CYCLE_DETECTED",
      message: "检测到循环依赖（拓扑排序失败）",
    });
  }

  const valid = errors.length === 0;
  if (valid && log.level === "debug") {
    log.debug(
      {
        event: "pipeline.dag.validated",
        nodeCount: nodes.length,
        dependencyCount: dependencies.length,
        topologicalOrder: topoOrder,
      },
      `DAG 校验通过：${nodes.length} 节点，${dependencies.length} 依赖`,
    );
  }
  return { valid, errors, topologicalOrder: valid ? topoOrder ?? undefined : undefined };
}

/** 找出所有入度为 0 的节点（即"起点"节点，可立即执行）。 */
export function getStartNodes(nodes: PipelineNode[], dependencies: PipelineDependency[]): string[] {
  const inDegree = new Map<string, number>();
  for (const node of nodes) inDegree.set(node.id, 0);
  for (const dep of dependencies) {
    inDegree.set(dep.target_node_id, (inDegree.get(dep.target_node_id) || 0) + 1);
  }
  const startNodes: string[] = [];
  for (const [nodeId, degree] of inDegree) {
    if (degree === 0) startNodes.push(nodeId);
  }
  return startNodes;
}

/** 获取某节点的所有上游节点 ID 列表。 */
export function getDependenciesForNode(nodeId: string, dependencies: PipelineDependency[]): string[] {
  return dependencies
    .filter((dep) => dep.target_node_id === nodeId)
    .map((dep) => dep.source_node_id);
}

/** 获取某节点的所有下游节点 ID 列表。 */
export function getDependentsForNode(nodeId: string, dependencies: PipelineDependency[]): string[] {
  return dependencies
    .filter((dep) => dep.source_node_id === nodeId)
    .map((dep) => dep.target_node_id);
}
