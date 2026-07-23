import type { AppContext } from "../app.js";
import type {
  QualityAutoConfig,
  QualityOnFailure,
  QualityReport,
  QualityTargetType,
} from "../../types/pipeline.js";
import { id, nowIso } from "../../utils.js";

export async function saveQualityAutoConfig(
  ctx: AppContext,
  input: {
    projectId: string;
    enabled: boolean;
    targetTypes: QualityTargetType[];
    threshold: number;
    onFailure: QualityOnFailure;
  },
): Promise<QualityAutoConfig> {
  const existing = await ctx.qualityAutoConfigs.findOne({ project_id: input.projectId });
  const now = nowIso();
  const values = {
    enabled: input.enabled,
    target_types: input.targetTypes,
    threshold: input.threshold,
    on_failure: input.onFailure,
    updated_at: now,
  };
  if (existing) {
    await ctx.qualityAutoConfigs.update(existing.id, values);
    return { ...existing, ...values };
  }
  const config: QualityAutoConfig = {
    id: id("qcfg"),
    project_id: input.projectId,
    ...values,
    created_at: now,
  };
  await ctx.qualityAutoConfigs.insert(config);
  return config;
}

export async function removeQualityAutoConfig(
  ctx: AppContext,
  projectId: string,
): Promise<boolean> {
  const existing = await ctx.qualityAutoConfigs.findOne({ project_id: projectId });
  if (!existing) return false;
  await ctx.qualityAutoConfigs.delete(existing.id);
  return true;
}

export async function reviewQualityReport(
  ctx: AppContext,
  reportId: string,
  patch: Partial<QualityReport>,
): Promise<QualityReport> {
  const existing = await ctx.qualityReports.findById(reportId);
  if (!existing) throw new Error("QUALITY_REPORT_NOT_FOUND");
  await ctx.qualityReports.update(reportId, patch);
  return { ...existing, ...patch };
}
