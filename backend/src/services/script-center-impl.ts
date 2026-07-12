/**
 * 剧本中心服务实现
 *
 * 提供剧本、剧集、场景、对白的CRUD操作，以及剧本解析、资产关联、版本管理、导入导出等功能。
 */

import type { AppContext } from "./app.js";
import type {
  ScriptDocument,
  ScriptEpisode,
  ScriptScene,
  ScriptDialogue,
  ScriptSceneCharacter,
  ScriptSceneLocation,
  ScriptTemplate,
  ScriptTag,
  ScriptQualityAssessment,
  ScriptApproval,
  ScriptBackup,
  AIScriptGenerationRequest,
  AIScriptOptimizationRequest,
  AISceneGenerationRequest,
  AIDialogueGenerationRequest,
  AIStoryboardSplitRequest,
  ChatChunk,
  Character,
  Scene,
  Prop,
} from "../types.js";
import type { ScriptComment } from "../types/script.js";
import { id, nowIso, DEFAULT_MODEL } from "../utils.js";
import { rootLogger } from "../logger.js";
import { executeModelCall, recommendModels } from "./model-center-impl.js";
import { analyzeScriptWithAI, aiResultToAssets } from "./script-analyze-ai.js";
import type { AnalyzedAsset } from "./script-analyze-ai.js";
import { listCharacters } from "./module-domain.js";

/**
 * 辅助函数：从 AsyncIterable<ChatChunk> 中收集完整内容
 */
async function collectChatContent(chunks: AsyncIterable<ChatChunk>): Promise<string> {
  let content = "";
  for await (const chunk of chunks) {
    if (chunk.content) {
      content += chunk.content;
    }
  }
  return content;
}

// ==================== 剧本文档 CRUD ====================

type ScriptDocumentInput = {
  id?: string;
  project_id?: string;
  editor_json?: string;
  version?: number;
};

export async function listScriptDocuments(ctx: AppContext, projectId?: string): Promise<ScriptDocument[]> {
  const filter = projectId ? { project_id: projectId } : {};
  return ctx.scriptDocuments.findMany(filter, { sort: "desc" });
}

export async function getScriptDocument(ctx: AppContext, documentId: string): Promise<ScriptDocument | null> {
  return ctx.scriptDocuments.findById(documentId);
}

export async function createScriptDocument(ctx: AppContext, input: ScriptDocumentInput): Promise<ScriptDocument> {
  const document: ScriptDocument = {
    id: input.id ?? id("sd"),
    project_id: input.project_id ?? "",
    editor_json: input.editor_json ?? "",
    version: input.version ?? 1,
    created_at: nowIso(),
    updated_at: nowIso(),
  };
  await ctx.scriptDocuments.insert(document);
  return document;
}

export async function updateScriptDocument(
  ctx: AppContext,
  documentId: string,
  input: ScriptDocumentInput
): Promise<ScriptDocument> {
  const existing = await ctx.scriptDocuments.findById(documentId);
  if (!existing) throw new Error("剧本文档不存在");

  const patch: Partial<ScriptDocument> = {
    ...input,
    version: existing.version + 1, // 每次更新自动增加版本号
    updated_at: nowIso(),
  };

  await ctx.scriptDocuments.update(documentId, patch);
  return { ...existing, ...patch } as ScriptDocument;
}

export async function deleteScriptDocument(ctx: AppContext, documentId: string): Promise<void> {
  await ctx.scriptDocuments.delete(documentId);
}

// ==================== 剧集 CRUD ====================

type ScriptEpisodeInput = {
  project_id?: string;
  document_id?: string;
  episode_no?: number;
  title?: string;
  synopsis?: string;
  status?: string;
};

export async function listScriptEpisodes(ctx: AppContext, projectId: string): Promise<ScriptEpisode[]> {
  return ctx.scriptEpisodes.findMany({ project_id: projectId }, { sort: "asc" });
}

export async function getScriptEpisode(ctx: AppContext, episodeId: string): Promise<ScriptEpisode | null> {
  return ctx.scriptEpisodes.findById(episodeId);
}

export async function createScriptEpisode(ctx: AppContext, input: ScriptEpisodeInput): Promise<ScriptEpisode> {
  const episode: ScriptEpisode = {
    id: id("se"),
    project_id: input.project_id ?? "",
    document_id: input.document_id ?? "",
    episode_no: input.episode_no ?? 1,
    title: input.title ?? "",
    synopsis: input.synopsis ?? "",
    status: (input.status as ScriptEpisode["status"]) ?? "draft",
    created_at: nowIso(),
    updated_at: nowIso(),
  };
  await ctx.scriptEpisodes.insert(episode);
  return episode;
}

export async function updateScriptEpisode(
  ctx: AppContext,
  episodeId: string,
  input: ScriptEpisodeInput
): Promise<ScriptEpisode> {
  const existing = await ctx.scriptEpisodes.findById(episodeId);
  if (!existing) throw new Error("剧集不存在");

  const patch: Partial<ScriptEpisode> = {
    ...input,
    status: input.status ? (input.status as ScriptEpisode["status"]) : undefined,
    updated_at: nowIso(),
  };

  await ctx.scriptEpisodes.update(episodeId, patch);
  return { ...existing, ...patch } as ScriptEpisode;
}

export async function deleteScriptEpisode(ctx: AppContext, episodeId: string): Promise<void> {
  await ctx.scriptEpisodes.delete(episodeId);
}

// ==================== 场景 CRUD ====================

type ScriptSceneInput = {
  project_id?: string;
  episode_id?: string;
  scene_no?: number;
  location_name?: string;
  time_of_day?: string;
  description?: string;
  notes?: string;
};

export async function listScriptScenes(ctx: AppContext, episodeId?: string, projectId?: string): Promise<ScriptScene[]> {
  const filter: Partial<ScriptScene> = {};
  if (episodeId) filter.episode_id = episodeId;
  if (projectId) filter.project_id = projectId;
  return ctx.scriptScenes.findMany(filter, { sort: "asc" });
}

export async function getScriptScene(ctx: AppContext, sceneId: string): Promise<ScriptScene | null> {
  return ctx.scriptScenes.findById(sceneId);
}

export async function createScriptScene(ctx: AppContext, input: ScriptSceneInput): Promise<ScriptScene> {
  const scene: ScriptScene = {
    id: id("ss"),
    project_id: input.project_id ?? "",
    episode_id: input.episode_id ?? "",
    scene_no: input.scene_no ?? 1,
    location_name: input.location_name ?? "",
    time_of_day: (input.time_of_day as ScriptScene["time_of_day"]) ?? "day",
    description: input.description ?? "",
    notes: input.notes ?? "",
    created_at: nowIso(),
    updated_at: nowIso(),
  };
  await ctx.scriptScenes.insert(scene);
  return scene;
}

export async function updateScriptScene(
  ctx: AppContext,
  sceneId: string,
  input: ScriptSceneInput
): Promise<ScriptScene> {
  const existing = await ctx.scriptScenes.findById(sceneId);
  if (!existing) throw new Error("场景不存在");

  const patch: Partial<ScriptScene> = {
    ...input,
    time_of_day: input.time_of_day ? (input.time_of_day as ScriptScene["time_of_day"]) : undefined,
    updated_at: nowIso(),
  };

  await ctx.scriptScenes.update(sceneId, patch);
  return { ...existing, ...patch } as ScriptScene;
}

export async function deleteScriptScene(ctx: AppContext, sceneId: string): Promise<void> {
  await ctx.scriptScenes.delete(sceneId);
}

// ==================== 对白 CRUD ====================

type ScriptDialogueInput = {
  project_id?: string;
  scene_id?: string;
  character_id?: string;
  dialogue?: string;
  emotion?: string;
  order?: number;
};

export async function listScriptDialogues(ctx: AppContext, sceneId?: string): Promise<ScriptDialogue[]> {
  const filter = sceneId ? { scene_id: sceneId } : {};
  return ctx.scriptDialogues.findMany(filter, { sort: "asc" });
}

export async function getScriptDialogue(ctx: AppContext, dialogueId: string): Promise<ScriptDialogue | null> {
  return ctx.scriptDialogues.findById(dialogueId);
}

export async function createScriptDialogue(ctx: AppContext, input: ScriptDialogueInput): Promise<ScriptDialogue> {
  const dialogue: ScriptDialogue = {
    id: id("sdlg"),
    project_id: input.project_id ?? "",
    scene_id: input.scene_id ?? "",
    character_id: input.character_id ?? "",
    dialogue: input.dialogue ?? "",
    emotion: input.emotion ?? "",
    order: input.order ?? 0,
    created_at: nowIso(),
  };
  await ctx.scriptDialogues.insert(dialogue);
  return dialogue;
}

export async function updateScriptDialogue(
  ctx: AppContext,
  dialogueId: string,
  input: ScriptDialogueInput
): Promise<ScriptDialogue> {
  const existing = await ctx.scriptDialogues.findById(dialogueId);
  if (!existing) throw new Error("对白不存在");

  const patch: Partial<ScriptDialogue> = {
    ...input,
  };

  await ctx.scriptDialogues.update(dialogueId, patch);
  return { ...existing, ...patch } as ScriptDialogue;
}

export async function deleteScriptDialogue(ctx: AppContext, dialogueId: string): Promise<void> {
  await ctx.scriptDialogues.delete(dialogueId);
}

// ==================== 场景-角色引用 CRUD ====================

type ScriptSceneCharacterInput = {
  project_id?: string;
  scene_id?: string;
  character_asset_id?: string;
  role_type?: string;
  is_speaking?: boolean;
};

export async function listScriptSceneCharacters(ctx: AppContext, sceneId?: string): Promise<ScriptSceneCharacter[]> {
  const filter = sceneId ? { scene_id: sceneId } : {};
  return ctx.scriptSceneCharacters.findMany(filter);
}

export async function createScriptSceneCharacter(
  ctx: AppContext,
  input: ScriptSceneCharacterInput
): Promise<ScriptSceneCharacter> {
  const ref: ScriptSceneCharacter = {
    id: id("sschar"),
    project_id: input.project_id ?? "",
    scene_id: input.scene_id ?? "",
    character_asset_id: input.character_asset_id ?? "",
    role_type: (input.role_type as ScriptSceneCharacter["role_type"]) ?? "support",
    is_speaking: input.is_speaking ?? false,
    created_at: nowIso(),
  };
  await ctx.scriptSceneCharacters.insert(ref);
  return ref;
}

export async function updateScriptSceneCharacter(
  ctx: AppContext,
  refId: string,
  input: ScriptSceneCharacterInput
): Promise<ScriptSceneCharacter> {
  const existing = await ctx.scriptSceneCharacters.findById(refId);
  if (!existing) throw new Error("场景角色引用不存在");

  const patch: Partial<ScriptSceneCharacter> = {
    ...input,
    role_type: input.role_type ? (input.role_type as ScriptSceneCharacter["role_type"]) : undefined,
  };

  await ctx.scriptSceneCharacters.update(refId, patch);
  return { ...existing, ...patch } as ScriptSceneCharacter;
}

export async function deleteScriptSceneCharacter(ctx: AppContext, refId: string): Promise<void> {
  await ctx.scriptSceneCharacters.delete(refId);
}

// ==================== 场景-地点引用 CRUD ====================

type ScriptSceneLocationInput = {
  project_id?: string;
  scene_id?: string;
  location_asset_id?: string;
};

export async function listScriptSceneLocations(ctx: AppContext, sceneId?: string): Promise<ScriptSceneLocation[]> {
  const filter = sceneId ? { scene_id: sceneId } : {};
  return ctx.scriptSceneLocations.findMany(filter);
}

export async function createScriptSceneLocation(
  ctx: AppContext,
  input: ScriptSceneLocationInput
): Promise<ScriptSceneLocation> {
  const ref: ScriptSceneLocation = {
    id: id("ssloc"),
    project_id: input.project_id ?? "",
    scene_id: input.scene_id ?? "",
    location_asset_id: input.location_asset_id ?? "",
    created_at: nowIso(),
  };
  await ctx.scriptSceneLocations.insert(ref);
  return ref;
}

export async function deleteScriptSceneLocation(ctx: AppContext, refId: string): Promise<void> {
  await ctx.scriptSceneLocations.delete(refId);
}

// ==================== 剧本模板 CRUD ====================

type ScriptTemplateInput = {
  name?: string;
  category?: string;
  description?: string;
  world_setting?: string;
  character_templates?: Array<{ name: string; role: string; description: string }>;
  plot_structure?: string;
  usage_count?: number;
  rating?: number;
  author?: string;
  is_public?: boolean;
};

export async function listScriptTemplates(ctx: AppContext, isPublic?: boolean): Promise<ScriptTemplate[]> {
  const filter = isPublic !== undefined ? { is_public: isPublic } : {};
  return ctx.scriptTemplates.findMany(filter, { sort: "desc" });
}

export async function getScriptTemplate(ctx: AppContext, templateId: string): Promise<ScriptTemplate | null> {
  return ctx.scriptTemplates.findById(templateId);
}

export async function createScriptTemplate(ctx: AppContext, input: ScriptTemplateInput): Promise<ScriptTemplate> {
  const template: ScriptTemplate = {
    id: id("stpl"),
    name: input.name ?? "",
    category: input.category ?? "",
    description: input.description ?? "",
    world_setting: input.world_setting ?? "",
    character_templates: input.character_templates ?? [],
    plot_structure: input.plot_structure ?? "",
    usage_count: input.usage_count ?? 0,
    rating: input.rating ?? 0,
    author: input.author ?? "",
    is_public: input.is_public ?? false,
    created_at: nowIso(),
    updated_at: nowIso(),
  };
  await ctx.scriptTemplates.insert(template);
  return template;
}

export async function updateScriptTemplate(
  ctx: AppContext,
  templateId: string,
  input: ScriptTemplateInput
): Promise<ScriptTemplate> {
  const existing = await ctx.scriptTemplates.findById(templateId);
  if (!existing) throw new Error("剧本模板不存在");

  const patch: Partial<ScriptTemplate> = {
    ...input,
    updated_at: nowIso(),
  };

  await ctx.scriptTemplates.update(templateId, patch);
  return { ...existing, ...patch } as ScriptTemplate;
}

export async function deleteScriptTemplate(ctx: AppContext, templateId: string): Promise<void> {
  await ctx.scriptTemplates.delete(templateId);
}

// ==================== 剧本标签 CRUD ====================

type ScriptTagInput = {
  project_id?: string;
  script_id?: string;
  name?: string;
  category?: string;
  color?: string;
  created_by?: string;
};

export async function listScriptTags(ctx: AppContext, scriptId?: string): Promise<ScriptTag[]> {
  const filter = scriptId ? { script_id: scriptId } : {};
  return ctx.scriptTags.findMany(filter);
}

export async function createScriptTag(ctx: AppContext, input: ScriptTagInput): Promise<ScriptTag> {
  const tag: ScriptTag = {
    id: id("stag"),
    project_id: input.project_id ?? "",
    script_id: input.script_id ?? "",
    name: input.name ?? "",
    category: (input.category as ScriptTag["category"]) ?? "custom",
    color: input.color ?? "#3b82f6",
    created_by: input.created_by ?? "",
    created_at: nowIso(),
  };
  await ctx.scriptTags.insert(tag);
  return tag;
}

export async function deleteScriptTag(ctx: AppContext, tagId: string): Promise<void> {
  await ctx.scriptTags.delete(tagId);
}

// ==================== 剧本质量评估 CRUD ====================

type ScriptQualityAssessmentInput = {
  project_id?: string;
  script_id?: string;
  story_structure?: number;
  character_development?: number;
  dialogue_quality?: number;
  pacing?: number;
  consistency?: number;
  originality?: number;
  total_score?: number;
  source?: string;
  suggestions?: string[];
  assessed_by?: string;
};

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

// ==================== 剧本审批 CRUD ====================

type ScriptApprovalInput = {
  project_id?: string;
  script_id?: string;
  status?: string;
  current_step?: number;
  total_steps?: number;
  applicants?: string[];
  reviewers?: string[];
  comments?: Array<{
    step: number;
    reviewer: string;
    action: "approve" | "reject" | "comment";
    comment: string;
    timestamp: string;
  }>;
  created_by?: string;
};

export async function getApprovalByScript(ctx: AppContext, scriptId: string): Promise<ScriptApproval | null> {
  const approvals = await ctx.scriptApprovals.findMany({ script_id: scriptId }, { sort: "desc", limit: 1 });
  return approvals[0] ?? null;
}

export async function createApproval(ctx: AppContext, input: ScriptApprovalInput): Promise<ScriptApproval> {
  const approval: ScriptApproval = {
    id: id("sapr"),
    project_id: input.project_id ?? "",
    script_id: input.script_id ?? "",
    status: (input.status as ScriptApproval["status"]) ?? "pending",
    current_step: input.current_step ?? 1,
    total_steps: input.total_steps ?? 3,
    applicants: input.applicants ?? [],
    reviewers: input.reviewers ?? [],
    comments: input.comments ?? [],
    created_by: input.created_by ?? "",
    created_at: nowIso(),
    updated_at: nowIso(),
  };
  await ctx.scriptApprovals.insert(approval);
  return approval;
}

export async function updateApproval(
  ctx: AppContext,
  approvalId: string,
  input: ScriptApprovalInput
): Promise<ScriptApproval> {
  const existing = await ctx.scriptApprovals.findById(approvalId);
  if (!existing) throw new Error("审批记录不存在");

  const patch: Partial<ScriptApproval> = {
    ...input,
    status: input.status ? (input.status as ScriptApproval["status"]) : undefined,
    updated_at: nowIso(),
  };

  await ctx.scriptApprovals.update(approvalId, patch);
  return { ...existing, ...patch } as ScriptApproval;
}

// ==================== 剧本备份服务 ====================

export async function createBackup(
  ctx: AppContext,
  projectId: string,
  documentId: string,
  type: "auto" | "manual" | "scheduled",
  createdBy: string
): Promise<ScriptBackup> {
  // 获取剧本文档和相关数据
  const document = await ctx.scriptDocuments.findById(documentId);
  if (!document) throw new Error("剧本文档不存在");

  const episodes = await ctx.scriptEpisodes.findMany({ project_id: projectId, document_id: documentId });
  const scenes = await ctx.scriptScenes.findMany({ project_id: projectId });
  const dialogues = await ctx.scriptDialogues.findMany({ project_id: projectId });

  const backup: ScriptBackup = {
    id: id("sbkp"),
    project_id: projectId,
    type,
    size: JSON.stringify({ document, episodes, scenes, dialogues }).length,
    content: {
      script_document: document.editor_json,
      script_episodes: episodes,
      script_scenes: scenes,
      script_dialogues: dialogues,
      version: document.version,
    },
    status: "completed",
    created_by: createdBy,
    created_at: nowIso(),
    expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), // 30天后过期
  };

  await ctx.scriptBackups.insert(backup);
  return backup;
}

export async function listBackups(ctx: AppContext, projectId: string): Promise<ScriptBackup[]> {
  return ctx.scriptBackups.findMany({ project_id: projectId }, { sort: "desc" });
}

// 剧本版本（薄封装，与 Backup 同表；前端走 /api/script-versions 直接操作）
export async function listScriptVersions(
  ctx: AppContext,
  documentId: string
): Promise<ScriptBackup[]> {
  return ctx.scriptBackups.findMany({ document_id: documentId }, { sort: "desc" });
}

export async function createScriptVersion(
  ctx: AppContext,
  input: {
    documentId: string;
    editorJson: string;
    version: number;
    changes?: string;
    type?: "auto" | "manual" | "scheduled";
    createdBy?: string;
  }
): Promise<ScriptBackup> {
  const document = await ctx.scriptDocuments.findById(input.documentId);
  if (!document) throw new Error("剧本文档不存在");
  const backup: ScriptBackup = {
    id: id("sbkp"),
    project_id: document.project_id,
    type: input.type ?? "manual",
    size: (input.editorJson || "").length,
    content: {
      script_document: input.editorJson,
      version: input.version,
      changes: input.changes,
    },
    status: "completed",
    created_by: input.createdBy ?? "system",
    created_at: nowIso(),
    expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
  };
  await ctx.scriptBackups.insert(backup);
  return backup;
}

export async function deleteScriptVersion(ctx: AppContext, versionId: string): Promise<void> {
  await ctx.scriptBackups.delete(versionId);
}

export async function restoreBackup(ctx: AppContext, backupId: string): Promise<void> {
  const backup = await ctx.scriptBackups.findById(backupId);
  if (!backup || backup.status !== "completed") throw new Error("备份不存在或不可用");

  // 恢复操作需要根据实际业务逻辑实现
  // 这里简化为直接返回备份内容
  rootLogger.info({ event: "script.backup.restore", backupId: backup.id }, `恢复备份: ${backup.id}`);
}

// ==================== 剧本评论 CRUD ====================

type ScriptCommentInput = {
  script_id?: string;
  episode_id?: string;
  user_name?: string;
  content?: string;
  selected_text?: string;
  position_from?: number;
  position_to?: number;
  parent_id?: string;
  resolved?: boolean;
};

/** 按剧本文档 ID 列出全部评论（含回复），按创建时间升序。 */
export async function listScriptComments(ctx: AppContext, scriptId: string): Promise<ScriptComment[]> {
  if (!scriptId) return [];
  return ctx.scriptComments.findMany({ script_id: scriptId }, { sort: "asc" });
}

/** 创建评论或回复（通过 parent_id 区分）。 */
export async function createScriptComment(ctx: AppContext, input: ScriptCommentInput): Promise<ScriptComment> {
  if (!input.script_id) throw new Error("script_id 不能为空");
  if (!input.content || !input.content.trim()) throw new Error("评论内容不能为空");
  const now = nowIso();
  const comment: ScriptComment = {
    id: id("scmt"),
    script_id: input.script_id,
    episode_id: input.episode_id ?? "",
    user_name: input.user_name ?? "匿名用户",
    content: input.content,
    selected_text: input.selected_text ?? "",
    position_from: input.position_from ?? 0,
    position_to: input.position_to ?? 0,
    parent_id: input.parent_id ?? "",
    resolved: input.resolved ?? false,
    created_at: now,
    updated_at: now,
  };
  await ctx.scriptComments.insert(comment);
  return comment;
}

/** 局部更新评论（如内容、是否解决等）。 */
export async function updateScriptComment(
  ctx: AppContext,
  commentId: string,
  input: Partial<ScriptCommentInput>
): Promise<ScriptComment> {
  const existing = await ctx.scriptComments.findById(commentId);
  if (!existing) throw new Error("评论不存在");

  const patch: Partial<ScriptComment> = {
    ...input,
    updated_at: nowIso(),
  };

  await ctx.scriptComments.update(commentId, patch);
  return { ...existing, ...patch } as ScriptComment;
}

/** 删除评论（不级联，前端按需处理回复的清理）。 */
export async function deleteScriptComment(ctx: AppContext, commentId: string): Promise<void> {
  await ctx.scriptComments.delete(commentId);
}

// ==================== 剧本解析服务 ====================

/**
 * 解析剧本文档，提取场景、对白等结构化信息
 */
export async function parseScriptDocument(ctx: AppContext, documentId: string): Promise<{
  scenes: ScriptScene[];
  dialogues: ScriptDialogue[];
}> {
  const document = await ctx.scriptDocuments.findById(documentId);
  if (!document) throw new Error("剧本文档不存在");

  // 这里需要根据实际编辑器JSON格式实现解析逻辑
  // 简化实现：直接返回空数组
  return {
    scenes: [],
    dialogues: [],
  };
}

// ==================== 剧本统计服务 ====================

export async function getScriptStatistics(ctx: AppContext, documentId: string): Promise<{
  totalWords: number;
  totalScenes: number;
  totalCharacters: number;
  totalDialogues: number;
  characterFrequency: Array<{ name: string; count: number }>;
  sceneDistribution: Array<{ location: string; count: number }>;
  pacingData: Array<{ position: number; intensity: number }>;
}> {
  const document = await ctx.scriptDocuments.findById(documentId);
  if (!document) throw new Error("剧本文档不存在");

  const scenes = await ctx.scriptScenes.findMany({ project_id: document.project_id });
  const dialogues = await ctx.scriptDialogues.findMany({ project_id: document.project_id });
  const sceneCharacters = await ctx.scriptSceneCharacters.findMany({});

  // 计算字数
  const editorContent = document.editor_json ? JSON.parse(document.editor_json).content ?? "" : "";
  const totalWords = typeof editorContent === "string" ? editorContent.length : JSON.stringify(editorContent).length;

  // 角色频率统计
  const charCountMap = new Map<string, number>();
  for (const sc of sceneCharacters) {
    const key = sc.character_asset_id || "未知";
    charCountMap.set(key, (charCountMap.get(key) ?? 0) + 1);
  }

  // 场景分布统计
  const sceneDistMap = new Map<string, number>();
  for (const scene of scenes) {
    const loc = scene.location_name || "未知";
    sceneDistMap.set(loc, (sceneDistMap.get(loc) ?? 0) + 1);
  }

  // 节奏数据（简化实现）
  const pacingData = scenes.slice(0, 20).map((_, i) => ({
    position: i + 1,
    intensity: Math.round(Math.random() * 100),
  }));

  return {
    totalWords,
    totalScenes: scenes.length,
    totalCharacters: sceneCharacters.length,
    totalDialogues: dialogues.length,
    characterFrequency: Array.from(charCountMap.entries()).map(([name, count]) => ({ name, count })),
    sceneDistribution: Array.from(sceneDistMap.entries()).map(([location, count]) => ({ location, count })),
    pacingData,
  };
}

// ==================== 连续性检查服务 ====================

export async function checkScriptContinuity(ctx: AppContext, documentId: string): Promise<{
  issues: Array<{
    type: "character" | "scene" | "timeline" | "prop";
    severity: "error" | "warning";
    message: string;
    location: string;
    suggestion?: string;
  }>;
}> {
  const document = await ctx.scriptDocuments.findById(documentId);
  if (!document) throw new Error("剧本文档不存在");

  const scenes = await ctx.scriptScenes.findMany({ project_id: document.project_id });
  const dialogues = await ctx.scriptDialogues.findMany({ project_id: document.project_id });
  const issues: Array<{
    type: "character" | "scene" | "timeline" | "prop";
    severity: "error" | "warning";
    message: string;
    location: string;
    suggestion?: string;
  }> = [];

  // 检查场景编号连续性
  const sortedScenes = [...scenes].sort((a, b) => a.scene_no - b.scene_no);
  for (let i = 1; i < sortedScenes.length; i++) {
    if (sortedScenes[i].scene_no !== sortedScenes[i - 1].scene_no + 1) {
      issues.push({
        type: "scene",
        severity: "warning",
        message: `场景编号不连续：从 ${sortedScenes[i - 1].scene_no} 跳到 ${sortedScenes[i].scene_no}`,
        location: `场景 ${sortedScenes[i].scene_no}`,
        suggestion: "建议重新编号场景以保持连续性",
      });
    }
  }

  // 检查对白中是否有未关联角色的条目
  for (const dialogue of dialogues) {
    if (!dialogue.character_id) {
      issues.push({
        type: "character",
        severity: "warning",
        message: "对白未关联角色",
        location: `对白ID: ${dialogue.id}`,
        suggestion: "建议为该对白关联一个角色",
      });
    }
  }

  // 检查场景是否缺少描述
  for (const scene of scenes) {
    if (!scene.description || scene.description.trim().length === 0) {
      issues.push({
        type: "scene",
        severity: "warning",
        message: `场景 ${scene.scene_no} 缺少描述`,
        location: `场景 ${scene.scene_no}: ${scene.location_name}`,
        suggestion: "建议补充场景描述以提升剧本完整性",
      });
    }
  }

  return { issues };
}

// ==================== 版本管理服务 ====================

export async function getDocumentVersions(ctx: AppContext, documentId: string): Promise<{
  current: ScriptDocument | null;
  history: ScriptBackup[];
}> {
  const current = await ctx.scriptDocuments.findById(documentId);
  const history = await ctx.scriptBackups.findMany(
    { project_id: current?.project_id ?? "" },
    { sort: "desc" }
  );

  return { current, history };
}

// ==================== 导入导出服务 ====================

export async function exportScriptAsJson(ctx: AppContext, documentId: string): Promise<string> {
  const document = await ctx.scriptDocuments.findById(documentId);
  if (!document) throw new Error("剧本文档不存在");

  const episodes = await ctx.scriptEpisodes.findMany({ document_id: documentId });
  const scenes = await ctx.scriptScenes.findMany({ project_id: document.project_id });
  const dialogues = await ctx.scriptDialogues.findMany({ project_id: document.project_id });

  const exportData = {
    document,
    episodes,
    scenes,
    dialogues,
    exported_at: nowIso(),
  };

  return JSON.stringify(exportData, null, 2);
}

export async function importScriptFromJson(
  ctx: AppContext,
  projectId: string,
  jsonData: string
): Promise<ScriptDocument> {
  const data = JSON.parse(jsonData);

  // 1. 创建剧本文档
  const document = await createScriptDocument(ctx, {
    project_id: projectId,
    editor_json: data.document?.editor_json ?? jsonData,
    version: 1,
  });

  // 2. 从 editor_json 提取纯文本（用于 AI 分析与剧集拆分）
  const plainText = extractPlainText(data.document?.editor_json);

  // 3. 调用 AI 分析剧本内容，提取角色/场景/道具
  //    阈值：1000 字（Feature 3.3 前置条件）
  //    AI 失败时不影响主流程（脚本-analyze-ai 内部已自动回退到 localFallback）
  try {
    if (plainText && plainText.length >= 1000) {
      // 使用规范版本 analyzeScriptWithAI(ctx, {content, format, useLocal?})；
      // 再通过 aiResultToAssets 转为扁平 AnalyzedAsset[] 给 persistAnalyzedAssets。
      const aiResult = await analyzeScriptWithAI(ctx, {
        content: plainText,
        format: "txt",
        useLocal: false,
      });
      if (aiResult.success && aiResult.data) {
        const assets = aiResultToAssets(aiResult.data);
        if (assets.length > 0) {
          await persistAnalyzedAssets(ctx, projectId, assets);
        }
      }
    }
  } catch (err) {
    rootLogger.warn({ event: "script.import.aiAnalyzeFailed", err }, "[importScriptFromJson] AI 资产分析失败");
  }

  // 4. 拆分剧集 + 场景 + 对白
  //    优先使用调用方显式传入的 episodes 数组（结构需包含 scenes）
  //    否则按文本中的 heading/章节自动拆分
  let episodes: ParsedEpisode[];
  if (data.episodes && Array.isArray(data.episodes) && data.episodes.length > 0) {
    episodes = data.episodes.map((ep: any, idx: number) => ({
      episode_no: ep.episode_no ?? idx + 1,
      title: ep.title || `第${idx + 1}集`,
      synopsis: ep.synopsis || "",
      status: ep.status || "draft",
      scenes: Array.isArray(ep.scenes) ? ep.scenes.map((s: any, sIdx: number) => ({
        scene_no: s.scene_no ?? sIdx + 1,
        location_name: s.location_name || s.location || "",
        time_of_day: normalizeTimeOfDay(s.time_of_day || s.time || "day"),
        description: s.description || "",
        dialogues: Array.isArray(s.dialogues) ? s.dialogues.map((d: any, dIdx: number) => ({
          character: d.character || "",
          text: d.text || "",
          emotion: d.emotion || "",
          order: d.order ?? dIdx,
        })) : [],
      })) : [],
    }));
  } else {
    episodes = splitTextIntoEpisodes(plainText);
  }

  // 5. 写入数据库：剧集 → 场景 → 对白
  //    评审 P1-H4 修复：用补偿式回滚保证半成品不污染数据库：
  //    任何一步失败 → 逆序删除已写入的 document/episode/scene/dialogue。
  const createdDocumentIds: string[] = [document.id];
  const createdEpisodeIds: string[] = [];
  const createdSceneIds: string[] = [];
  const createdDialogueIds: string[] = [];
  const rollback = async (reason: unknown) => {
    rootLogger.warn(
      {
        event: "script.import.rollback",
        reason: String(reason),
        createdCount: {
          documents: createdDocumentIds.length,
          episodes: createdEpisodeIds.length,
          scenes: createdSceneIds.length,
          dialogues: createdDialogueIds.length,
        },
      },
      `[importScriptFromJson] 回滚已写入记录: ${reason}`,
    );
    for (const idToDel of createdDialogueIds.reverse()) {
      try { await deleteScriptDialogue(ctx, idToDel); } catch {}
    }
    for (const idToDel of createdSceneIds.reverse()) {
      try { await deleteScriptScene(ctx, idToDel); } catch {}
    }
    for (const idToDel of createdEpisodeIds.reverse()) {
      try { await deleteScriptEpisode(ctx, idToDel); } catch {}
    }
    for (const idToDel of createdDocumentIds.reverse()) {
      try { await deleteScriptDocument(ctx, idToDel); } catch {}
    }
  };
  try {
    for (const episode of episodes) {
      const createdEpisode = await createScriptEpisode(ctx, {
        project_id: projectId,
        document_id: document.id,
        episode_no: episode.episode_no,
        title: episode.title,
        synopsis: episode.synopsis,
        status: episode.status || "draft",
      });
      createdEpisodeIds.push(createdEpisode.id);

      for (const scene of episode.scenes || []) {
        const createdScene = await createScriptScene(ctx, {
          project_id: projectId,
          episode_id: createdEpisode.id,
          scene_no: scene.scene_no,
          location_name: scene.location_name,
          time_of_day: scene.time_of_day,
          description: scene.description,
          notes: scene.notes || "",
        });
        createdSceneIds.push(createdScene.id);

        // 写入对白（按 character 名称查表获取 character_id）。
        // 评审 P1-H3 修复：用 listCharacters 走已过滤 deleted_at 的服务，
        // 避免直接查 Repository 漏掉软删角色被"复活"绑定到对白。
        for (const dialogue of scene.dialogues || []) {
          if (!dialogue.text || !dialogue.character) continue;
          const charRecord = await listCharacters(ctx, projectId, dialogue.character);
          if (charRecord.length > 0) {
            const inserted = await createScriptDialogue(ctx, {
              project_id: projectId,
              scene_id: createdScene.id,
              character_id: charRecord[0].id,
              dialogue: dialogue.text,
              emotion: dialogue.emotion || "",
              order: dialogue.order,
            });
            createdDialogueIds.push(inserted.id);
          }
        }
      }
    }
  } catch (err) {
    await rollback(err);
    throw err;
  }

  // 6. 导入后自动生成版本快照（Feature 4.5 业务规则）
  try {
    await createBackup(ctx, projectId, document.id, "manual", "system");
  } catch (err) {
    rootLogger.warn(
      { event: "script.import.versionFailed", documentId: document.id, err },
      "[importScriptFromJson] 版本快照创建失败",
    );
  }

  // 7. 写入导入日志（Feature 4.5 业务规则：导入时间、文件名、格式、解析结果、操作者）
  try {
    const sceneCount = episodes.reduce((sum, ep) => sum + (ep.scenes?.length || 0), 0);
    const dialogueCount = episodes.reduce(
      (sum, ep) =>
        sum +
        (ep.scenes || []).reduce(
          (sSum, sc) => sSum + (sc.dialogues?.length || 0),
          0
        ),
      0
    );
    rootLogger.info(
      {
        event: "script.import.completed",
        projectId,
        documentId: document.id,
        fileName: data.file_name || "导入剧本",
        format: data.format || "json",
        episodes: episodes.length,
        scenes: sceneCount,
        dialogues: dialogueCount,
        operator: "system",
        at: nowIso(),
      },
      `[importScriptFromJson] project=${projectId} document=${document.id} file=${data.file_name || "导入剧本"} format=${data.format || "json"} episodes=${episodes.length} scenes=${sceneCount} dialogues=${dialogueCount} operator=system at=${nowIso()}`,
    );
  } catch {
    // 日志失败不影响导入
  }

  return document;
}

/** 规范化时间段枚举 */
function normalizeTimeOfDay(value: string): "day" | "night" | "dawn" | "dusk" {
  const v = (value || "").toLowerCase();
  if (v.includes("夜") || v.includes("night")) return "night";
  if (v.includes("黄昏") || v.includes("傍晚") || v.includes("dusk")) return "dusk";
  if (v.includes("晨") || v.includes("黎明") || v.includes("dawn")) return "dawn";
  return "day";
}

/** 解析后的剧集结构（含场景和对白） */
interface ParsedEpisode {
  episode_no: number;
  title: string;
  synopsis: string;
  status: string;
  scenes: ParsedScene[];
}

interface ParsedScene {
  scene_no: number;
  location_name: string;
  time_of_day: "day" | "night" | "dawn" | "dusk";
  description: string;
  notes: string;
  dialogues: ParsedDialogue[];
}

interface ParsedDialogue {
  character: string;
  text: string;
  emotion: string;
  order: number;
}

/**
 * 将 AI 分析得到的资产写入对应的工厂表。
 * - 按 (project_id, name) 查重，已存在则跳过，避免重复
 * - 失败的资产不阻塞其他资产入库
 */
async function persistAnalyzedAssets(
  ctx: AppContext,
  projectId: string,
  assets: AnalyzedAsset[] // 从 ./script-analyze-ai.js 导入的类型
): Promise<void> {
  for (const asset of assets) {
    if (!asset || !asset.name) continue;
    try {
      if (asset.type === "character") {
        const existing = await ctx.characters.findMany({ project_id: projectId, name: asset.name });
        if (existing.length === 0) {
          await ctx.characters.insert({
            id: id("char"),
            project_id: projectId,
            name: asset.name,
            role: (asset.role as Character["role"]) || "supporting",
            gender: (asset.gender as Character["gender"]) || "other",
            age: 0,
            traits: asset.traits || [],
            description: asset.description || "",
            tags: ["剧本导入提取"],
            created_at: nowIso(),
            updated_at: nowIso(),
          });
        }
      } else if (asset.type === "scene") {
        const existing = await ctx.scenes.findMany({ project_id: projectId, name: asset.name });
        if (existing.length === 0) {
          await ctx.scenes.insert({
            id: id("scene"),
            project_id: projectId,
            name: asset.name,
            type: ((asset.sceneType as Scene["type"]) || "indoor"),
            description: asset.description || "",
            lighting: asset.lighting || "",
            time_of_day: asset.timeOfDay || "",
            weather: asset.weather || "",
            tags: ["剧本导入提取"],
            created_at: nowIso(),
            updated_at: nowIso(),
          });
        }
      } else if (asset.type === "prop") {
        const existing = await ctx.props.findMany({ project_id: projectId, name: asset.name });
        if (existing.length === 0) {
          await ctx.props.insert({
            id: id("prop"),
            project_id: projectId,
            name: asset.name,
            category: ((asset.category as Prop["category"]) || "other"),
            description: asset.description || "",
            material: asset.material || "",
            color: asset.color || "",
            tags: ["剧本导入提取"],
            created_at: nowIso(),
            updated_at: nowIso(),
          });
        }
      }
    } catch (err) {
      rootLogger.warn({ event: "script.import.assetInsertFailed", assetName: asset.name, err }, `[importScriptFromJson] 资产 ${asset.name} 入库失败`);
    }
  }
}

/**
 * 从 Tiptap editor_json 中递归提取纯文本。
 * 支持 string/对象两种格式；处理 doc 根节点和 heading/paragraph 等 block。
 */
function extractPlainText(editorJson: any): string {
  if (!editorJson) return "";
  let json = editorJson;
  if (typeof json === "string") {
    try {
      json = JSON.parse(json);
    } catch {
      return json; // 纯文本直接返回
    }
  }
  const parts: string[] = [];
  const walk = (node: any) => {
    if (!node) return;
    if (typeof node.text === "string") {
      parts.push(node.text);
      return;
    }
    if (Array.isArray(node.content)) {
      // heading 节点后追加换行，便于后续按标题切分
      const isBlock = ["heading", "paragraph", "blockquote"].includes(node.type);
      node.content.forEach((c: any) => walk(c));
      if (isBlock) parts.push("\n");
    }
  };
  walk(json);
  return parts.join("").trim();
}

/**
 * 将剧本纯文本按章节（heading）拆分为剧集，剧集下进一步拆分为场景和对白。
 *
 * 支持的格式：
 * - # 剧集标题  → 拆分为一集
 *   - ## Scene XX - 地点 - 时间  → 拆分为场景（location/time 解析自标题）
 *     - 段落正文：场景描述
 *     - **角色名** 台词（emotion）  → 拆分为对白
 *     - **角色名**: 台词  → 拆分为对白
 * - 没有标题时：按段落/字数自动分集
 *
 * 返回 ParsedEpisode[]，含嵌套的 scenes 和 dialogues。
 */
function splitTextIntoEpisodes(text: string): ParsedEpisode[] {
  if (!text || text.trim().length === 0) {
    return [
      {
        episode_no: 1,
        title: "导入剧集",
        synopsis: "",
        status: "draft",
        scenes: [],
      },
    ];
  }

  // 策略 1：按 H1（# xxx）拆分为剧集
  const h1Chunks = text.split(/\n(?=#\s+)/);
  if (h1Chunks.length > 1) {
    return h1Chunks
      .map((chunk, idx) => parseEpisodeFromMarkdown(idx + 1, chunk))
      .filter((ep) => ep.title);
  }

  // 策略 2：按 H2（## xxx）拆分为剧集（兼容直接用 ## 当集标题的剧本）
  const h2Chunks = text.split(/\n(?=##\s+)/);
  if (h2Chunks.length > 1) {
    return h2Chunks
      .map((chunk, idx) => {
        const lines = chunk.split("\n");
        const title = lines[0].replace(/^##\s+/, "").trim();
        return parseEpisodeFromMarkdown(
          idx + 1,
          `# ${title}\n${lines.slice(1).join("\n")}`
        );
      })
      .filter((ep) => ep.title);
  }

  // 策略 3：按段落/字数自动分集（每 30 段或 2000 字一集）
  const paragraphs = text.split(/\n+/).filter((p) => p.trim());
  if (paragraphs.length === 0) {
    return [
      {
        episode_no: 1,
        title: "导入剧集",
        synopsis: "",
        status: "draft",
        scenes: [],
      },
    ];
  }
  const CHARS_PER_EP = 2000;
  const PARAS_PER_EP = 30;
  const episodes: ParsedEpisode[] = [];
  let buffer: string[] = [];
  let charCount = 0;
  let epNo = 1;
  for (const p of paragraphs) {
    buffer.push(p);
    charCount += p.length;
    if (buffer.length >= PARAS_PER_EP || charCount >= CHARS_PER_EP) {
      const synopsis = buffer.join(" ").slice(0, 300);
      episodes.push({
        episode_no: epNo++,
        title: `第${episodes.length + 1}集`,
        synopsis,
        status: "draft",
        scenes: parseScenesFromParagraphs(buffer),
      });
      buffer = [];
      charCount = 0;
    }
  }
  if (buffer.length > 0) {
    const synopsis = buffer.join(" ").slice(0, 300);
    episodes.push({
      episode_no: epNo++,
      title: `第${episodes.length + 1}集`,
      synopsis,
      status: "draft",
      scenes: parseScenesFromParagraphs(buffer),
    });
  }
  return episodes;
}

/** 从 Markdown 块中解析一集（已包含 H1 标题行） */
function parseEpisodeFromMarkdown(episodeNo: number, block: string): ParsedEpisode {
  const lines = block.split("\n");
  const titleLine = lines[0] || "";
  const title = titleLine.replace(/^#\s+/, "").trim();
  const rest = lines.slice(1).join("\n").trim();

  // 抽取本集简介（第一个 scene 之前的纯描述段落）
  const sceneChunks = rest.split(/\n(?=##\s+)/);
  const synopsisBeforeFirstScene = sceneChunks[0] || "";
  const synopsis = synopsisBeforeFirstScene
    .split("\n")
    .filter((l) => !/^##\s+/.test(l))
    .join(" ")
    .trim()
    .slice(0, 300);

  // 解析场景
  const sceneBlocks = sceneChunks.filter((c) => /^##\s+/.test(c));
  const scenes: ParsedScene[] = sceneBlocks.map((sb, idx) =>
    parseSceneFromMarkdown(idx + 1, sb)
  );

  return {
    episode_no: episodeNo,
    title: title || `第${episodeNo}集`,
    synopsis,
    status: "draft",
    scenes,
  };
}

/**
 * 解析单个场景（## Scene XX - 地点 - 时间）
 * 标题格式：
 *   ## Scene 01 - 茶信馆门口 - 白天
 *   ## Scene 2 / 茶信馆门口 / 白天
 *   ## 场景01 茶信馆门口 白天
 */
function parseSceneFromMarkdown(sceneNo: number, block: string): ParsedScene {
  const lines = block.split("\n");
  const headerLine = lines[0] || "";
  const header = headerLine.replace(/^##\s+/, "").trim();

  const { location, time, description: headerDesc } = parseSceneHeader(header);
  const body = lines.slice(1).join("\n").trim();

  // 合并 header 描述与 body
  const fullDescription = [headerDesc, body].filter((s) => s).join("\n").trim();

  // 解析对白
  const dialogues = parseDialoguesFromText(fullDescription);

  return {
    scene_no: sceneNo,
    location_name: location,
    time_of_day: normalizeTimeOfDay(time),
    description: fullDescription,
    notes: "",
    dialogues,
  };
}

/**
 * 解析场景标题，支持多种分隔符
 * 输入示例：
 *   "Scene 01 - 茶信馆门口 - 白天"
 *   "Scene 2 / 茶信馆门口 / 白天"
 *   "场景01 茶信馆门口 白天"
 *   "茶信馆门口 - 白天"
 */
function parseSceneHeader(header: string): {
  location: string;
  time: string;
  description: string;
} {
  // 去掉 "Scene XX" / "场景XX" 前缀
  const cleaned = header
    .replace(/^Scene\s*\d+\s*/i, "")
    .replace(/^场景\s*\d+\s*/i, "")
    .trim();
  // 按 - / ｜ 分隔
  const parts = cleaned.split(/\s*[-/｜|]\s*/).filter((p) => p);
  if (parts.length >= 2) {
    // 第一段是地点，最后一段是时间，中间是描述
    const location = parts[0] || "";
    const time = parts[parts.length - 1] || "day";
    const description = parts.length > 2 ? parts.slice(1, -1).join(" ") : "";
    return { location, time, description };
  }
  if (parts.length === 1) {
    return { location: parts[0] || "", time: "day", description: "" };
  }
  return { location: "", time: "day", description: "" };
}

/**
 * 解析对白：
 * - `**林逸**推门走出。` → action
 * - `> **萧晓**（冷笑）：终于舍得出来了？` → dialogue (emotion: 冷笑)
 * - `**林逸**: 与你无关。` → dialogue
 * - `林逸：与你无关。` → dialogue
 */
function parseDialoguesFromText(text: string): ParsedDialogue[] {
  if (!text) return [];
  const dialogues: ParsedDialogue[] = [];
  const lines = text.split(/\n+/);

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;

    // 跳过 Markdown 标题/列表/引用符号
    const cleanLine = line
      .replace(/^>\s*/, "")
      .replace(/^[-*]\s+/, "");

    // 匹配 **角色名**（情绪）：台词  或  **角色名**: 台词  或  **角色名** 台词
    const m1 = cleanLine.match(/^\*\*([^*]+)\*\*[（(]([^）)]+)[）)]\s*[：:]\s*(.+)$/);
    if (m1) {
      dialogues.push({
        character: m1[1].trim(),
        emotion: m1[2].trim(),
        text: m1[3].trim(),
        order: dialogues.length,
      });
      continue;
    }

    // 匹配 **角色名**：台词  或  **角色名**: 台词
    const m2 = cleanLine.match(/^\*\*([^*]+)\*\*\s*[：:]\s*(.+)$/);
    if (m2) {
      dialogues.push({
        character: m2[1].trim(),
        emotion: "",
        text: m2[2].trim(),
        order: dialogues.length,
      });
      continue;
    }

    // 匹配 角色名：台词  或  角色名: 台词  （中文/英文冒号）
    const m3 = cleanLine.match(/^([^：:\n]{1,20})\s*[：:]\s*(.+)$/);
    if (m3 && !/^[\s*>-]/.test(line)) {
      const name = m3[1].trim();
      // 排除明显是叙述的"X：X"格式（如"地点：xxx"）
      if (
        !["地点", "时间", "场景", "集", "scene", "location", "time"].includes(
          name.toLowerCase()
        )
      ) {
        dialogues.push({
          character: name,
          emotion: "",
          text: m3[2].trim(),
          order: dialogues.length,
        });
        continue;
      }
    }
  }
  return dialogues;
}

/** 当无 scene 标题时，从段落生成单场景（含对白） */
function parseScenesFromParagraphs(paragraphs: string[]): ParsedScene[] {
  if (paragraphs.length === 0) return [];
  const text = paragraphs.join("\n");
  return [
    {
      scene_no: 1,
      location_name: "",
      time_of_day: "day",
      description: text,
      notes: "",
      dialogues: parseDialoguesFromText(text),
    },
  ];
}

// ==================== AI剧本生成服务 ====================

export async function generateScriptWithAI(
  ctx: AppContext,
  userId: string,
  request: AIScriptGenerationRequest
): Promise<{ content: string }> {
  // 推荐最适合的模型
  const recommendations = await recommendModels(ctx, {
    task_type: "script_generation",
    quality_requirement: "high",
  });

  const selectedModel = recommendations[0]?.model.id ?? "agnes-2.0-flash";

  // 执行AI生成
  const result = await executeModelCall(
    ctx,
    userId,
    selectedModel,
    "script_generation",
    async () => {
      // 这里调用实际的AI生成接口
      const prompt = buildScriptGenerationPrompt(request);
      const chunks = await ctx.ai.chat({
        conversationId: "script-gen",
        message: prompt,
        model: selectedModel,
      });

      return collectChatContent(chunks);
    }
  );

  // 文档模式：创建剧本文档；纯文本模式：仅返回内容
  if (request.project_id) {
    await createScriptDocument(ctx, {
      project_id: request.project_id,
      editor_json: JSON.stringify({ content: result }),
      version: 1,
    });
  }

  return { content: result };
}

function buildScriptGenerationPrompt(request: AIScriptGenerationRequest): string {
  let prompt = `请根据以下要求生成一个剧本大纲：\n\n`;
  prompt += `提示词：${request.prompt}\n`;

  if (request.style) prompt += `风格：${request.style}\n`;
  if (request.genre) prompt += `类型：${request.genre}\n`;
  if (request.length) prompt += `长度：约${request.length}字\n`;
  if (request.characters && request.characters.length > 0) {
    prompt += `角色：${request.characters.join("、")}\n`;
  }
  if (request.settings && request.settings.length > 0) {
    prompt += `设定：${request.settings.join("、")}\n`;
  }

  prompt += `\n请以结构化的方式输出剧本，包括场景描述、角色对白和情节发展。`;

  return prompt;
}

// ==================== AI剧本优化服务 ====================

export async function optimizeScriptWithAI(
  ctx: AppContext,
  userId: string,
  request: AIScriptOptimizationRequest
): Promise<{ optimizedContent: string }> {
  // 推荐模型
  const recommendations = await recommendModels(ctx, {
    task_type: "script_optimization",
    quality_requirement: "standard",
  });

  const selectedModel = recommendations[0]?.model.id ?? "agnes-2.0-flash";

  // 纯文本模式：直接使用 request.content 作为原文
  const isTextMode = !request.script_id && !!request.content;
  let originalText = request.content || "";

  if (!isTextMode) {
    // 文档模式：从数据库读取原文
    const document = await ctx.scriptDocuments.findById(request.script_id!);
    if (!document) throw new Error("剧本不存在");
    originalText = typeof document.editor_json === "string"
      ? document.editor_json
      : JSON.stringify(document.editor_json);
  }

  // 执行AI优化
  const result = await executeModelCall(
    ctx,
    userId,
    selectedModel,
    "script_optimization",
    async () => {
      const prompt = buildScriptOptimizationPrompt(originalText, request);
      const chunks = await ctx.ai.chat({
        conversationId: "script-opt",
        message: prompt,
        model: selectedModel,
      });

      return collectChatContent(chunks);
    }
  );

  // 文档模式：更新剧本文档并创建备份
  if (!isTextMode && request.script_id) {
    await updateScriptDocument(ctx, request.script_id, {
      editor_json: JSON.stringify({ content: result }),
    });
    if (request.project_id) {
      await createBackup(ctx, request.project_id, request.script_id, "auto", userId);
    }
  }

  return { optimizedContent: result };
}

function buildScriptOptimizationPrompt(
  originalText: string,
  request: AIScriptOptimizationRequest
): string {
  let prompt = `你是一个剧本润色/扩写助手。请对用户给出的剧本片段进行改写。\n\n`;
  prompt += `【严格规则】\n`;
  prompt += `1. 只输出改写/扩写后的内容本身，不要复述、引用或重复原文\n`;
  prompt += `2. 不要输出任何解释、前言、元说明、标题、Markdown 标题（如"剧本大纲""核心冲突"等）\n`;
  prompt += `3. 不要输出 JSON 格式或代码块\n`;
  prompt += `4. 输出长度要明显大于或等于原文，如果是扩写则至少为原文的 1.5 倍\n`;
  prompt += `5. 保持原文的人物、情节和叙事视角，只在表达上做丰富\n\n`;
  prompt += `【优化类型】${request.optimization_type || "style"}（扩写=更详细具体的场景描写、心理活动、环境渲染；优化=更精炼有力的表达）\n\n`;

  if (request.custom_instructions) {
    prompt += `【特别要求】${request.custom_instructions}\n\n`;
  }

  prompt += `【原文】\n${originalText}\n\n`;
  prompt += `【改写后内容】\n`;

  return prompt;
}

// ==================== AI场景生成服务 ====================

export async function generateSceneWithAI(
  ctx: AppContext,
  userId: string,
  request: AISceneGenerationRequest
): Promise<ScriptScene> {
  // 推荐模型
  const recommendations = await recommendModels(ctx, {
    task_type: "scene_generation",
    quality_requirement: "standard",
  });

  const selectedModel = recommendations[0]?.model.id ?? "agnes-2.0-flash";

  // 执行AI生成
  const result = await executeModelCall(
    ctx,
    userId,
    selectedModel,
    "scene_generation",
    async () => {
      const prompt = buildSceneGenerationPrompt(request);
      const chunks = await ctx.ai.chat({
        conversationId: "scene-gen",
        message: prompt,
        model: selectedModel,
      });

      const content = await collectChatContent(chunks);
      return JSON.parse(content);
    }
  );

  // 创建场景记录
  const scene = await createScriptScene(ctx, {
    project_id: request.project_id,
    episode_id: request.episode_id,
    scene_no: result.scene_no ?? 1,
    location_name: result.location_name ?? request.location ?? "",
    time_of_day: result.time_of_day ?? "day",
    description: result.description ?? request.scene_description,
    notes: result.notes ?? "",
  });

  return scene;
}

function buildSceneGenerationPrompt(request: AISceneGenerationRequest): string {
  let prompt = `请根据以下要求生成一个场景描述：\n\n`;
  prompt += `场景描述：${request.scene_description}\n`;

  if (request.characters && request.characters.length > 0) {
    prompt += `出场角色：${request.characters.join("、")}\n`;
  }
  if (request.location) prompt += `地点：${request.location}\n`;
  if (request.mood) prompt += `氛围：${request.mood}\n`;

  prompt += `\n请以JSON格式输出，包含以下字段：scene_no, location_name, time_of_day, description, notes`;

  return prompt;
}

// ==================== AI对白生成服务 ====================

export async function generateDialogueWithAI(
  ctx: AppContext,
  userId: string,
  request: AIDialogueGenerationRequest
): Promise<ScriptDialogue> {
  // 推荐模型
  const recommendations = await recommendModels(ctx, {
    task_type: "dialogue_generation",
    quality_requirement: "standard",
  });

  const selectedModel = recommendations[0]?.model.id ?? "agnes-2.0-flash";

  // 执行AI生成
  const result = await executeModelCall(
    ctx,
    userId,
    selectedModel,
    "dialogue_generation",
    async () => {
      const prompt = buildDialogueGenerationPrompt(request);
      const chunks = await ctx.ai.chat({
        conversationId: "dialogue-gen",
        message: prompt,
        model: selectedModel,
      });

      return collectChatContent(chunks);
    }
  );

  // 创建对白记录
  const dialogue = await createScriptDialogue(ctx, {
    project_id: request.project_id,
    scene_id: request.scene_id,
    character_id: request.character_id,
    dialogue: result,
    emotion: request.emotion ?? "",
    order: 0,
  });

  return dialogue;
}

function buildDialogueGenerationPrompt(request: AIDialogueGenerationRequest): string {
  let prompt = `请为角色生成一段对白：\n\n`;
  prompt += `角色ID：${request.character_id}\n`;

  if (request.context) prompt += `上下文：${request.context}\n`;
  if (request.emotion) prompt += `情感：${request.emotion}\n`;
  if (request.style) prompt += `风格：${request.style}\n`;

  prompt += `\n请直接输出对白内容，不要包含其他说明文字。`;

  return prompt;
}

// ==================== AI分镜拆分服务 ====================

export async function splitStoryboardWithAI(
  ctx: AppContext,
  userId: string,
  request: AIStoryboardSplitRequest
): Promise<{ storyboards: string[] }> {
  // 推荐模型
  const recommendations = await recommendModels(ctx, {
    task_type: "storyboard_split",
    quality_requirement: "high",
  });

  const selectedModel = recommendations[0]?.model.id ?? "agnes-2.0-flash";

  // 纯文本模式：直接使用 request.content；文档模式：从数据库读取
  const isTextMode = !request.script_id && !!request.content;
  let originalText = request.content || "";

  if (!isTextMode) {
    const document = await ctx.scriptDocuments.findById(request.script_id!);
    if (!document) throw new Error("剧本不存在");
    originalText = typeof document.editor_json === "string"
      ? document.editor_json
      : JSON.stringify(document.editor_json);
  }

  // 执行AI拆分
  const result = await executeModelCall(
    ctx,
    userId,
    selectedModel,
    "storyboard_split",
    async () => {
      const prompt = buildStoryboardSplitPrompt(originalText, request);
      const chunks = await ctx.ai.chat({
        conversationId: "storyboard-split",
        message: prompt,
        model: selectedModel,
      });

      const content = await collectChatContent(chunks);
      // 尝试解析JSON，失败则按行拆分
      try {
        const parsed = JSON.parse(content);
        if (Array.isArray(parsed.scenes)) return parsed;
        if (Array.isArray(parsed.storyboards)) return { storyboards: parsed.storyboards };
        return { storyboards: [content] };
      } catch {
        return { storyboards: content.split(/\n+/).filter((l: string) => l.trim()) };
      }
    }
  );

  // 文档模式：创建场景记录
  const storyboards: string[] = [];
  if (Array.isArray(result.scenes)) {
    for (const sceneData of result.scenes) {
      const desc = sceneData.description || sceneData.location_name || `场景${sceneData.scene_no || ""}`;
      storyboards.push(desc);
      if (request.project_id) {
        await createScriptScene(ctx, {
          project_id: request.project_id,
          scene_no: sceneData.scene_no,
          location_name: sceneData.location_name,
          time_of_day: sceneData.time_of_day,
          description: sceneData.description,
          notes: sceneData.notes ?? "",
        });
      }
    }
  } else if (Array.isArray(result.storyboards)) {
    storyboards.push(...result.storyboards);
  }

  return { storyboards };
}

function buildStoryboardSplitPrompt(
  originalText: string,
  request: AIStoryboardSplitRequest
): string {
  let prompt = `请将以下剧本拆分为分镜场景：\n\n`;
  prompt += `剧本内容：\n${originalText}\n\n`;
  prompt += `拆分策略：${request.split_strategy || "scene"}\n`;
  prompt += `详细程度：${request.detail_level || "standard"}\n`;

  prompt += `\n请以JSON格式输出，格式为：{ "scenes": [{ scene_no, location_name, time_of_day, description, notes }] }`;

  return prompt;
}

// ==================== AI剧本分析服务已迁移到 ./script-analyze-ai.js ====================
// 旧版 analyzeScriptWithAI(ctx, title, content) → AnalyzedAsset[] / extractJsonObject / AnalyzedAsset 接口
// 已废弃。importScriptFromJson 现在调用规范版本 analyzeScriptWithAI(ctx, {content, format, useLocal?})
// 并通过 aiResultToAssets() 转为 AnalyzedAsset[] 给 persistAnalyzedAssets。

// 旧版接口与函数已废弃，统一从 ./script-analyze-ai.js 引入 analyzeScriptWithAI / AnalyzedAsset / aiResultToAssets。