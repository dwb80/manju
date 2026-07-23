/**
 * @file metrics-dictionary.ts
 * @description V2 W11 DATA-F01~F12 指标字典 + 12 个聚合 SQL 视图(计算口径)
 *
 * 设计要点(SSO 单一事实源):
 *  1) METRIC_DEFINITIONS 12 条,每条定义:
 *     - key/id: 唯一标识
 *     - name/description: 人类可读
 *     - unit: yuan / count / percent / ms / score / shots / minutes
 *     - aggregation: SQL 聚合口径(SUM/AVG/COUNT/UNIQUE)
 *     - source: 数据源表 (cost_records / pipeline_runs / todos / project_clips / publish_records / quality_reports / work_items / model_call_logs / script_documents)
 *     - dimensions: 可下钻维度 (projectId, userId, runId, nodeType, model, capability, month, day, tag)
 *     - formula: 计算公式(可读描述)
 *     - threshold: 健康/告警阈值(可选)
 *  2) 12 个 GETTING-VIEWS(实际查表 SQL 模板) 由 buildMetricsQuery() 渲染:
 *     - 产能量、成功率、一次通过率、返工率、一致性、恢复率、人工时长、复用率、模板复用率、明细钻取、验收报告、派生 KPI
 *  3) 与现有表强绑定: cost_records / pipeline_runs / pipeline_nodes / todos / project_clips /
 *     publish_records / quality_reports / work_items / model_call_logs / script_documents /
 *     review_snapshots / shot_subtitles / timelines / timeline_versions
 *  4) 不新增 DB 业务表,仅作为代码层抽象;运行时通过 metrics-service 调 SqliteRepository 渲染 SQL
 */

export type MetricUnit = "yuan" | "count" | "percent" | "ms" | "score" | "shots" | "minutes" | "ratio";

export type MetricAggregation = "SUM" | "AVG" | "COUNT" | "COUNT_DISTINCT" | "MIN" | "MAX" | "RATIO";

export type MetricDataSource =
  | "cost_records"
  | "pipeline_runs"
  | "pipeline_nodes"
  | "todos"
  | "project_clips"
  | "publish_records"
  | "quality_reports"
  | "work_items"
  | "model_call_logs"
  | "script_documents"
  | "review_snapshots"
  | "shot_subtitles"
  | "timelines"
  | "timeline_versions"
  | "audit_logs";

export type MetricDimension =
  | "projectId"
  | "userId"
  | "runId"
  | "nodeId"
  | "nodeType"
  | "model"
  | "capability"
  | "month"
  | "day"
  | "tag"
  | "status"
  | "category"
  | "reviewerId"
  | "shotId";

export interface MetricDefinition {
  /** 唯一 key,如 data.shot_count */
  key: string;
  /** 业务 ID,如 DATA-F02 */
  featureId: string;
  /** 人类可读名称 */
  name: string;
  /** 描述(含计算口径) */
  description: string;
  unit: MetricUnit;
  aggregation: MetricAggregation;
  source: MetricDataSource;
  dimensions: MetricDimension[];
  /** 公式 (可读,便于审计) */
  formula: string;
  /** 健康/告警阈值(可选) */
  threshold?: { good: number; warn: number; critical: number; direction: "higher" | "lower" };
  /** SQL 模板:用 {{project}} {{month}} 等占位符,运行时由 buildMetricsQuery 替换 */
  sql: string;
  /** 优先级 (P0/P1/P2) */
  priority: "P0" | "P1" | "P2";
  enabled: boolean;
}

/* ==================== 12 条指标定义 ==================== */

export const METRIC_DEFINITIONS: MetricDefinition[] = [
  // DATA-F01 指标字典管理 (元数据,自身不算业务指标)
  {
    key: "_dictionary",
    featureId: "DATA-F01",
    name: "指标字典",
    description: "本表 12 条指标定义的总览,自身为元数据",
    unit: "count",
    aggregation: "COUNT",
    source: "pipeline_runs",
    dimensions: [],
    formula: "METRIC_DEFINITIONS.length",
    sql: "SELECT 1",
    priority: "P1",
    enabled: true,
  },
  // DATA-F02 镜头产能统计
  {
    key: "data.shot_count",
    featureId: "DATA-F02",
    name: "镜头产能",
    description: "指定时间窗内成功生成 (pipeline_nodes.status='success') 的镜头节点数",
    unit: "shots",
    aggregation: "COUNT",
    source: "pipeline_nodes",
    dimensions: ["projectId", "nodeType", "model", "day", "month"],
    formula: "COUNT(*) WHERE node_type='image'|'video' AND status='success'",
    sql: `SELECT
            substr(created_at, 1, 10) AS day,
            node_type,
            COUNT(*) AS value
          FROM pipeline_nodes
          WHERE status = 'success'
            {{projectFilter}}
            {{dayFilter}}
          GROUP BY substr(created_at, 1, 10), node_type`,
    threshold: { good: 100, warn: 50, critical: 10, direction: "higher" },
    priority: "P1",
    enabled: true,
  },
  // DATA-F03 生成成功率统计
  {
    key: "data.success_rate",
    featureId: "DATA-F03",
    name: "生成成功率",
    description: "pipeline_nodes 终态(success / failed)的成功率",
    unit: "percent",
    aggregation: "RATIO",
    source: "pipeline_nodes",
    dimensions: ["projectId", "nodeType", "model", "month"],
    formula: "success / (success + failed) * 100",
    sql: `SELECT
            node_type,
            SUM(CASE WHEN status='success' THEN 1 ELSE 0 END) AS success,
            SUM(CASE WHEN status='failed' THEN 1 ELSE 0 END) AS failed,
            CAST(SUM(CASE WHEN status='success' THEN 1 ELSE 0 END) AS REAL) * 100.0 /
              NULLIF(SUM(CASE WHEN status IN ('success','failed') THEN 1 ELSE 0 END), 0) AS value
          FROM pipeline_nodes
          {{projectFilter}}
          {{dayFilter}}
          GROUP BY node_type`,
    threshold: { good: 95, warn: 85, critical: 70, direction: "higher" },
    priority: "P1",
    enabled: true,
  },
  // DATA-F04 一次通过率
  {
    key: "data.first_pass_rate",
    featureId: "DATA-F04",
    name: "一次通过率",
    description: "pipeline_nodes.retry_count=0 且 status='success' 的节点占比",
    unit: "percent",
    aggregation: "RATIO",
    source: "pipeline_nodes",
    dimensions: ["projectId", "nodeType", "model"],
    formula: "first_try_success / total * 100",
    sql: `SELECT
            node_type,
            SUM(CASE WHEN status='success' AND (retry_count=0 OR retry_count IS NULL) THEN 1 ELSE 0 END) AS first_try_success,
            COUNT(*) AS total,
            CAST(SUM(CASE WHEN status='success' AND (retry_count=0 OR retry_count IS NULL) THEN 1 ELSE 0 END) AS REAL) * 100.0 /
              NULLIF(COUNT(*), 0) AS value
          FROM pipeline_nodes
          {{projectFilter}}
          GROUP BY node_type`,
    threshold: { good: 85, warn: 70, critical: 50, direction: "higher" },
    priority: "P1",
    enabled: true,
  },
  // DATA-F05 返工次数统计
  {
    key: "data.rework_count",
    featureId: "DATA-F05",
    name: "返工次数",
    description: "通过 todos(link_type=pipeline_node) 统计返工工单数",
    unit: "count",
    aggregation: "COUNT",
    source: "todos",
    dimensions: ["projectId", "category", "month"],
    formula: "COUNT(todos) WHERE link_type='pipeline_node' AND status IN ('done','closed')",
    sql: `SELECT
            substr(created_at, 1, 7) AS month,
            COUNT(*) AS value
          FROM todos
          WHERE link_type = 'pipeline_node'
            {{projectFilter}}
            {{monthFilter}}
          GROUP BY substr(created_at, 1, 7)`,
    threshold: { good: 0, warn: 5, critical: 20, direction: "lower" },
    priority: "P1",
    enabled: true,
  },
  // DATA-F06 一致性问题统计
  {
    key: "data.consistency_issue_rate",
    featureId: "DATA-F06",
    name: "一致性问题率",
    description: "quality_reports check_type IN ('character_consistency','scene_consistency') 的失败率",
    unit: "percent",
    aggregation: "RATIO",
    source: "quality_reports",
    dimensions: ["projectId", "nodeType"],
    formula: "consistency_failed / consistency_total * 100",
    sql: `SELECT
            substr(created_at, 1, 7) AS month,
            SUM(CASE WHEN passed=0 THEN 1 ELSE 0 END) AS failed,
            COUNT(*) AS total,
            CAST(SUM(CASE WHEN passed=0 THEN 1 ELSE 0 END) AS REAL) * 100.0 /
              NULLIF(COUNT(*), 0) AS value
          FROM quality_reports
          WHERE check_type IN ('character_consistency','scene_consistency')
            {{projectFilter}}
          GROUP BY substr(created_at, 1, 7)`,
    threshold: { good: 5, warn: 15, critical: 30, direction: "lower" },
    priority: "P1",
    enabled: true,
  },
  // DATA-F07 任务恢复率
  {
    key: "data.task_recovery_rate",
    featureId: "DATA-F07",
    name: "任务恢复率",
    description: "pipeline_nodes 失败后通过 retry / fallback 恢复为 success 的比例",
    unit: "percent",
    aggregation: "RATIO",
    source: "pipeline_nodes",
    dimensions: ["projectId", "nodeType"],
    formula: "(failed_then_recovered) / (failed_total) * 100",
    sql: `SELECT
            node_type,
            COUNT(*) AS value,
            SUM(CASE WHEN retry_count > 0 AND status='success' THEN 1 ELSE 0 END) AS recovered
          FROM pipeline_nodes
          {{projectFilter}}
          GROUP BY node_type`,
    threshold: { good: 90, warn: 70, critical: 50, direction: "higher" },
    priority: "P1",
    enabled: true,
  },
  // DATA-F08 人工作业时长(P2)
  {
    key: "data.human_work_minutes",
    featureId: "DATA-F08",
    name: "人工作业时长",
    description: "todos 从 created_at 到 completed_at 的差值(分钟)",
    unit: "minutes",
    aggregation: "SUM",
    source: "todos",
    dimensions: ["projectId", "userId", "category", "month"],
    formula: "SUM((julianday(completed_at) - julianday(created_at)) * 24 * 60)",
    sql: `SELECT
            assignee_id AS userId,
            SUM((julianday(completed_at) - julianday(created_at)) * 24 * 60) AS value
          FROM todos
          WHERE status = 'done' AND completed_at IS NOT NULL
            {{projectFilter}}
            {{monthFilter}}
          GROUP BY assignee_id`,
    priority: "P2",
    enabled: true,
  },
  // DATA-F09 资产复用率(P2)
  {
    key: "data.asset_reuse_rate",
    featureId: "DATA-F09",
    name: "资产复用率",
    description: "project_clips 中 shot_id 被引用次数 > 1 的占比",
    unit: "percent",
    aggregation: "RATIO",
    source: "project_clips",
    dimensions: ["projectId"],
    formula: "reused_clips / total_clips * 100",
    sql: `SELECT
            project_id AS projectId,
            COUNT(DISTINCT shot_id) AS total,
            SUM(CASE WHEN usage_count > 1 THEN 1 ELSE 0 END) AS reused,
            CAST(SUM(CASE WHEN usage_count > 1 THEN 1 ELSE 0 END) AS REAL) * 100.0 /
              NULLIF(COUNT(DISTINCT shot_id), 0) AS value
          FROM project_clips
          GROUP BY project_id`,
    priority: "P2",
    enabled: true,
  },
  // DATA-F10 模板复用率(P2)
  {
    key: "data.template_reuse_rate",
    featureId: "DATA-F10",
    name: "模板复用率",
    description: "script_documents 中 source_template_id 非空的占比",
    unit: "percent",
    aggregation: "RATIO",
    source: "script_documents",
    dimensions: ["projectId", "month"],
    formula: "templated / total * 100",
    sql: `SELECT
            substr(created_at, 1, 7) AS month,
            COUNT(*) AS total,
            SUM(CASE WHEN source_template_id IS NOT NULL AND source_template_id <> '' THEN 1 ELSE 0 END) AS templated,
            CAST(SUM(CASE WHEN source_template_id IS NOT NULL AND source_template_id <> '' THEN 1 ELSE 0 END) AS REAL) * 100.0 /
              NULLIF(COUNT(*), 0) AS value
          FROM script_documents
          GROUP BY substr(created_at, 1, 7)`,
    priority: "P2",
    enabled: true,
  },
  // DATA-F11 指标明细钻取
  {
    key: "data.detail_drill",
    featureId: "DATA-F11",
    name: "指标明细钻取",
    description: "按 metricKey + dimension 渲染明细列表",
    unit: "count",
    aggregation: "COUNT",
    source: "model_call_logs",
    dimensions: ["projectId", "userId", "runId", "nodeId", "model", "capability", "day", "month"],
    formula: "返回 limit 条明细,按 created_at DESC",
    sql: `SELECT * FROM {{source}}
          {{projectFilter}}
          {{dayFilter}}
          {{extraFilter}}
          ORDER BY created_at DESC
          LIMIT {{limit}}`,
    priority: "P1",
    enabled: true,
  },
  // DATA-F12 项目验收报告
  {
    key: "data.project_acceptance_report",
    featureId: "DATA-F12",
    name: "项目验收报告",
    description: "项目级汇总:总成本 / 镜头数 / 成功率 / 一次通过率 / 质量分均值 / 返工次数 / 发布数",
    unit: "ratio",
    aggregation: "RATIO",
    source: "cost_records",
    dimensions: ["projectId"],
    formula: "聚合 7 个子指标形成项目级报告",
    sql: `SELECT
            p.id AS projectId,
            p.name AS projectName,
            COALESCE(c.total_cost, 0) AS totalCost,
            COALESCE(n.total_nodes, 0) AS totalNodes,
            COALESCE(n.success_rate, 0) AS successRate,
            COALESCE(n.first_pass_rate, 0) AS firstPassRate,
            COALESCE(q.avg_quality, 0) AS avgQualityScore,
            COALESCE(r.rework_count, 0) AS reworkCount,
            COALESCE(pb.published, 0) AS published
          FROM projects p
          LEFT JOIN (
            SELECT project_id, SUM(amount) AS total_cost FROM cost_records GROUP BY project_id
          ) c ON c.project_id = p.id
          LEFT JOIN (
            SELECT run_id,
              COUNT(*) AS total_nodes,
              CAST(SUM(CASE WHEN status='success' THEN 1 ELSE 0 END) AS REAL) * 100.0 / NULLIF(COUNT(*), 0) AS success_rate,
              CAST(SUM(CASE WHEN status='success' AND (retry_count=0 OR retry_count IS NULL) THEN 1 ELSE 0 END) AS REAL) * 100.0 / NULLIF(COUNT(*), 0) AS first_pass_rate
            FROM pipeline_nodes GROUP BY run_id
          ) n ON n.run_id IN (SELECT id FROM pipeline_runs WHERE project_id = p.id)
          LEFT JOIN (
            SELECT run_id, AVG(quality_score) AS avg_quality FROM quality_reports GROUP BY run_id
          ) q ON q.run_id IN (SELECT id FROM pipeline_runs WHERE project_id = p.id)
          LEFT JOIN (
            SELECT project_id, COUNT(*) AS rework_count FROM todos WHERE link_type='pipeline_node' AND status='done' GROUP BY project_id
          ) r ON r.project_id = p.id
          LEFT JOIN (
            SELECT project_id, COUNT(*) AS published FROM publish_records WHERE status='published' GROUP BY project_id
          ) pb ON pb.project_id = p.id
          WHERE p.id = {{projectId}}`,
    priority: "P1",
    enabled: true,
  },
];

/* ==================== 工具:query 渲染 ==================== */

export interface QueryParams {
  projectId?: string;
  userId?: string;
  month?: string; // YYYY-MM
  day?: string;   // YYYY-MM-DD
  startDate?: string;
  endDate?: string;
  limit?: number;
  extraFilter?: string;
}

/**
 * 把 {{xxx}} 占位符渲染为安全 SQL 片段。值通过单引号包裹,做最小转义。
 */
export function buildMetricsQuery(def: MetricDefinition, params: QueryParams = {}): string {
  let sql = def.sql;
  // projectFilter
  if (sql.includes("{{projectFilter}}")) {
    if (params.projectId) {
      sql = sql.replace(/\{\{projectFilter\}\}/g, `AND project_id = '${escapeSql(params.projectId)}'`);
    } else {
      sql = sql.replace(/\{\{projectFilter\}\}/g, "");
    }
  }
  // dayFilter
  if (sql.includes("{{dayFilter}}")) {
    if (params.day) {
      sql = sql.replace(/\{\{dayFilter\}\}/g, `AND substr(created_at, 1, 10) = '${escapeSql(params.day)}'`);
    } else if (params.startDate && params.endDate) {
      sql = sql.replace(/\{\{dayFilter\}\}/g, `AND substr(created_at, 1, 10) BETWEEN '${escapeSql(params.startDate)}' AND '${escapeSql(params.endDate)}'`);
    } else {
      sql = sql.replace(/\{\{dayFilter\}\}/g, "");
    }
  }
  // monthFilter
  if (sql.includes("{{monthFilter}}")) {
    if (params.month) {
      sql = sql.replace(/\{\{monthFilter\}\}/g, `AND substr(created_at, 1, 7) = '${escapeSql(params.month)}'`);
    } else {
      sql = sql.replace(/\{\{monthFilter\}\}/g, "");
    }
  }
  // limit
  if (sql.includes("{{limit}}")) {
    const lim = params.limit && params.limit > 0 ? Math.min(params.limit, 1000) : 100;
    sql = sql.replace(/\{\{limit\}\}/g, String(lim));
  }
  // source
  if (sql.includes("{{source}}")) {
    sql = sql.replace(/\{\{source\}\}/g, def.source);
  }
  // projectId (用于验收报告)
  if (sql.includes("{{projectId}}")) {
    sql = sql.replace(/\{\{projectId\}\}/g, `'${escapeSql(params.projectId ?? "")}'`);
  }
  // extraFilter
  if (sql.includes("{{extraFilter}}")) {
    sql = sql.replace(/\{\{extraFilter\}\}/g, params.extraFilter ?? "");
  }
  return sql;
}

function escapeSql(s: string): string {
  return s.replace(/'/g, "''");
}

/* ==================== 工具:health assessment ==================== */

export interface MetricHealth {
  level: "good" | "warn" | "critical" | "unknown";
  value: number | null;
  message: string;
}

export function assessMetricHealth(def: MetricDefinition, value: number | null): MetricHealth {
  if (value === null || Number.isNaN(value)) {
    return { level: "unknown", value, message: "无数据" };
  }
  if (!def.threshold) {
    return { level: "unknown", value, message: "无阈值" };
  }
  const t = def.threshold;
  const direction = t.direction;
  if (direction === "higher") {
    if (value >= t.good) return { level: "good", value, message: `≥ ${t.good}` };
    if (value >= t.critical) return { level: "warn", value, message: `${t.critical} ≤ v < ${t.good}` };
    return { level: "critical", value, message: `v < ${t.critical}` };
  } else {
    if (value <= t.good) return { level: "good", value, message: `≤ ${t.good}` };
    if (value <= t.critical) return { level: "warn", value, message: `${t.good} < v ≤ ${t.critical}` };
    return { level: "critical", value, message: `v > ${t.critical}` };
  }
}

/* ==================== 工具:字典查询 ==================== */

export function getMetricDefinition(key: string): MetricDefinition | null {
  return METRIC_DEFINITIONS.find((m) => m.key === key) ?? null;
}

export function listMetricDefinitions(filter?: { featureId?: string; priority?: "P0" | "P1" | "P2"; enabled?: boolean }): MetricDefinition[] {
  let list = METRIC_DEFINITIONS;
  if (filter?.featureId) list = list.filter((m) => m.featureId === filter.featureId);
  if (filter?.priority) list = list.filter((m) => m.priority === filter.priority);
  if (filter?.enabled !== undefined) list = list.filter((m) => m.enabled === filter.enabled);
  return list;
}
