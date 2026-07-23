"use client";

import type { PipelineDependency, PipelineNode } from "@/lib/app-types";

interface Props { nodes: PipelineNode[]; dependencies: PipelineDependency[]; }

export function PipelineDagView({ nodes, dependencies }: Props) {
  const levelById = new Map(nodes.map((node) => [node.id, 0]));
  for (let pass = 0; pass < nodes.length; pass += 1) {
    for (const edge of dependencies) {
      levelById.set(edge.target_node_id, Math.max(levelById.get(edge.target_node_id) ?? 0, (levelById.get(edge.source_node_id) ?? 0) + 1));
    }
  }
  const columns = new Map<number, PipelineNode[]>();
  for (const node of nodes) {
    const level = levelById.get(node.id) ?? 0;
    columns.set(level, [...(columns.get(level) ?? []), node]);
  }
  const positions = new Map<string, { x: number; y: number }>();
  for (const [level, items] of columns) items.forEach((node, row) => positions.set(node.id, { x: 24 + level * 230, y: 30 + row * 110 }));
  const maxLevel = Math.max(0, ...levelById.values());
  const maxRows = Math.max(1, ...[...columns.values()].map((items) => items.length));
  const width = Math.max(620, 220 + maxLevel * 230);
  const height = Math.max(180, 30 + maxRows * 110);

  return (
    <div role="region" aria-label="任务依赖 DAG 图" tabIndex={0} style={{ overflow: "auto", border: "1px solid rgba(255,255,255,.12)", borderRadius: 10 }}>
      <svg width={width} height={height} role="img" aria-labelledby="dag-title dag-desc">
        <title id="dag-title">任务依赖关系图</title>
        <desc id="dag-desc">共 {nodes.length} 个节点、{dependencies.length} 条依赖。箭头从前置任务指向后续任务。</desc>
        <defs><marker id="dag-arrow" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto"><path d="M0,0 L8,4 L0,8 Z" fill="#64748b" /></marker></defs>
        {dependencies.map((edge) => {
          const from = positions.get(edge.source_node_id); const to = positions.get(edge.target_node_id);
          if (!from || !to) return null;
          return <g key={edge.id}>
            <path d={`M ${from.x + 180} ${from.y + 30} C ${from.x + 205} ${from.y + 30}, ${to.x - 25} ${to.y + 30}, ${to.x} ${to.y + 30}`} fill="none" stroke="#64748b" strokeWidth="2" markerEnd="url(#dag-arrow)" />
            {edge.condition_type && edge.condition_type !== "always" ? <text x={(from.x + to.x + 180) / 2} y={(from.y + to.y) / 2 + 20} textAnchor="middle" fill="#cbd5e1" fontSize="10">{edge.condition_type}</text> : null}
          </g>;
        })}
        {nodes.map((node) => {
          const pos = positions.get(node.id)!;
          const statusColor = node.status === "completed" ? "#22c55e" : node.status === "failed" ? "#ef4444" : node.status === "running" ? "#3b82f6" : "#64748b";
          return <g key={node.id} role="listitem" aria-label={`${node.name || node.id}，${node.status}`}>
            <rect x={pos.x} y={pos.y} width="180" height="62" rx="8" fill="#171717" stroke={statusColor} strokeWidth="2" />
            <circle cx={pos.x + 16} cy={pos.y + 18} r="5" fill={statusColor} />
            <text x={pos.x + 28} y={pos.y + 22} fill="white" fontSize="12">{(node.name || node.id).slice(0, 20)}</text>
            <text x={pos.x + 16} y={pos.y + 45} fill="#94a3b8" fontSize="10">{node.type} · {node.status}</text>
          </g>;
        })}
      </svg>
    </div>
  );
}
