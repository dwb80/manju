/**
 * @file metrics-service.ts
 * @description V2 W11 DATA-F01~F12 指标服务:字典查询 + 渲染 SQL + 真实查询 + 健康评估
 *
 * 设计要点:
 *  - 字典查询: listMetrics / getMetric(key) / getMetricsByFeature(featureId)
 *  - 指标计算: queryMetric(key, params) 渲染 SQL 后走 getRawDatabase 查
 *  - 健康评估: assessMetric(key, value) 走 metrics-dictionary 的 threshold
 *  - 项目验收报告: queryAcceptanceReport(projectId) 一次性查 7 个子指标
 */

import { getRawDatabase } from "../../storage/sqlite.js";
import {
  assessMetricHealth,
  buildMetricsQuery,
  getMetricDefinition,
  listMetricDefinitions,
  type MetricDefinition,
  type MetricHealth,
  type QueryParams,
} from "../../types/metrics-dictionary.js";

export interface MetricResult {
  metric: MetricDefinition;
  rows: Record<string, unknown>[];
  /** 主指标值(取第一行 'value' 字段) */
  value: number | null;
  health: MetricHealth;
  sql: string;
  /** 渲染 + 查询耗时 ms */
  durationMs: number;
  queriedAt: string;
}

export interface MetricsService {
  // 字典
  listMetrics(filter?: { featureId?: string; priority?: "P0" | "P1" | "P2"; enabled?: boolean }): MetricDefinition[];
  getMetric(key: string): MetricDefinition | null;
  getMetricsByFeature(featureId: string): MetricDefinition | null;
  // 查询
  queryMetric(key: string, params?: QueryParams): MetricResult;
  queryAcceptanceReport(projectId: string): Record<string, unknown> | null;
  assess(key: string, value: number | null): MetricHealth;
  // 健康
  healthCheck(): { ok: boolean; metricCount: number };
}

export function createMetricsService(databaseFile: string): MetricsService {
  function queryRows(sql: string): Record<string, unknown>[] {
    try {
      const db = getRawDatabase(databaseFile);
      return db.prepare(sql).all();
    } catch {
      return [];
    }
  }

  function listMetrics(filter?: { featureId?: string; priority?: "P0" | "P1" | "P2"; enabled?: boolean }): MetricDefinition[] {
    return listMetricDefinitions(filter);
  }

  function getMetric(key: string): MetricDefinition | null {
    return getMetricDefinition(key);
  }

  function getMetricsByFeature(featureId: string): MetricDefinition | null {
    return listMetricDefinitions({ featureId })[0] ?? null;
  }

  function queryMetric(key: string, params: QueryParams = {}): MetricResult {
    const t0 = Date.now();
    const def = getMetricDefinition(key);
    const queriedAt = new Date().toISOString();
    if (!def) {
      return {
        metric: {
          key,
          featureId: "",
          name: "unknown",
          description: "",
          unit: "count",
          aggregation: "COUNT",
          source: "pipeline_runs",
          dimensions: [],
          formula: "",
          sql: "",
          priority: "P2",
          enabled: false,
        },
        rows: [],
        value: null,
        health: { level: "unknown", value: null, message: "metric_not_found" },
        sql: "",
        durationMs: 0,
        queriedAt,
      };
    }
    if (!def.enabled) {
      return {
        metric: def,
        rows: [],
        value: null,
        health: { level: "unknown", value: null, message: "metric_disabled" },
        sql: "",
        durationMs: 0,
        queriedAt,
      };
    }
    const sql = buildMetricsQuery(def, params);
    const rows = queryRows(sql);
    const first = rows[0];
    const raw = first && (first.value as number | string | undefined);
    const value = typeof raw === "number" ? raw : raw != null ? Number(raw) : null;
    const health = assessMetricHealth(def, value);
    return {
      metric: def,
      rows,
      value: Number.isFinite(value) ? value : null,
      health,
      sql,
      durationMs: Date.now() - t0,
      queriedAt,
    };
  }

  function queryAcceptanceReport(projectId: string): Record<string, unknown> | null {
    const def = getMetricDefinition("data.project_acceptance_report");
    if (!def) return null;
    const sql = buildMetricsQuery(def, { projectId });
    const rows = queryRows(sql);
    return rows[0] ?? null;
  }

  function assess(key: string, value: number | null): MetricHealth {
    const def = getMetricDefinition(key);
    if (!def) return { level: "unknown", value, message: "metric_not_found" };
    return assessMetricHealth(def, value);
  }

  function healthCheck(): { ok: boolean; metricCount: number } {
    return { ok: true, metricCount: METRIC_DEFINITIONS_COUNT };
  }

  return {
    listMetrics,
    getMetric,
    getMetricsByFeature,
    queryMetric,
    queryAcceptanceReport,
    assess,
    healthCheck,
  };
}

let _singleton: MetricsService | null = null;
export function getMetricsService(databaseFile?: string): MetricsService {
  if (!_singleton) {
    if (!databaseFile) throw new Error("metrics_service_database_file_required");
    _singleton = createMetricsService(databaseFile);
  }
  return _singleton;
}

export function _resetMetricsService(): void {
  _singleton = null;
}

const METRIC_DEFINITIONS_COUNT = listMetricDefinitions().length;
