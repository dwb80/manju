/**
 * 剧本质量评估 CRUD 服务
 */

import type { AppContext } from "../app.js";
import type { ScriptQualityAssessment } from "../../types.js";
import { id, nowIso } from "../../utils.js";
import type { ScriptQualityAssessmentInput } from "./types.js";

export async function getLatestAssessment(ctx: AppContext, scriptId: string): Promise<ScriptQualityAssessment | null> {
  const assessments = await ctx.scriptQualityAssessments.findMany(
    { script_id: scriptId },
    { sort: "desc", limit: 1 }
  );
  return assessments[0] ?? null;
}

export async function createAssessment(
  ctx: AppContext,
  input: ScriptQualityAssessmentInput
): Promise<ScriptQualityAssessment> {
  const assessment: ScriptQualityAssessment = {
    id: id("sqa"),
    project_id: input.project_id ?? "",
    script_id: input.script_id ?? "",
    story_structure: input.story_structure ?? 0,
    character_development: input.character_development ?? 0,
    dialogue_quality: input.dialogue_quality ?? 0,
    pacing: input.pacing ?? 0,
    consistency: input.consistency ?? 0,
    originality: input.originality ?? 0,
    total_score: input.total_score ?? 0,
    source: (input.source as ScriptQualityAssessment["source"]) ?? "manual",
    suggestions: input.suggestions ?? [],
    assessed_by: input.assessed_by ?? "",
    assessed_at: nowIso(),
    created_at: nowIso(),
  };
  await ctx.scriptQualityAssessments.insert(assessment);
  return assessment;
}
