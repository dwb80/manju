/**
 * 剧本中心服务 - Barrel Export
 *
 * 该模块将原 `script-center-impl.ts` 拆分为多个职责清晰的子模块：
 * - document-service:       剧本文档 CRUD
 * - episode-service:        剧集 CRUD
 * - scene-service:          场景 CRUD
 * - dialogue-service:       对白 CRUD
 * - scene-character-service: 场景-角色引用 CRUD
 * - scene-location-service:  场景-地点引用 CRUD
 * - template-service:       剧本模板 CRUD
 * - tag-service:            剧本标签 CRUD
 * - assessment-service:     剧本质量评估 CRUD
 * - approval-service:       剧本审批 CRUD
 * - backup-service:         剧本备份/版本服务
 * - comment-service:        剧本评论 CRUD
 * - analysis-service:       解析/统计/连续性检查/版本快照查询
 * - import-service:         剧本导入导出
 * - ai-service:             AI 剧本生成/优化/场景/对白/分镜
 * - parser:                 剧本文本解析
 * - utils:                  工具函数（collectChatContent/normalizeTimeOfDay/extractPlainText/parseSceneHeader）
 * - types:                  子模块共享类型
 */

// 剧本文档 CRUD
export {
  listScriptDocuments,
  getScriptDocument,
  createScriptDocument,
  updateScriptDocument,
  deleteScriptDocument,
  listDeletedScriptDocuments,
  restoreScriptDocument,
  purgeScriptDocument,
} from "./document-service.js";

// 剧集 CRUD
export {
  listScriptEpisodes,
  getScriptEpisode,
  createScriptEpisode,
  updateScriptEpisode,
  deleteScriptEpisode,
} from "./episode-service.js";

// 场景 CRUD
export {
  listScriptScenes,
  getScriptScene,
  createScriptScene,
  updateScriptScene,
  deleteScriptScene,
} from "./scene-service.js";

// 对白 CRUD
export {
  listScriptDialogues,
  getScriptDialogue,
  createScriptDialogue,
  updateScriptDialogue,
  deleteScriptDialogue,
} from "./dialogue-service.js";

// 场景-角色引用 CRUD
export {
  listScriptSceneCharacters,
  createScriptSceneCharacter,
  updateScriptSceneCharacter,
  deleteScriptSceneCharacter,
} from "./scene-character-service.js";

// 场景-地点引用 CRUD
export {
  listScriptSceneLocations,
  createScriptSceneLocation,
  deleteScriptSceneLocation,
} from "./scene-location-service.js";

// 剧本模板 CRUD
export {
  listScriptTemplates,
  getScriptTemplate,
  createScriptTemplate,
  updateScriptTemplate,
  deleteScriptTemplate,
} from "./template-service.js";

// 剧本标签 CRUD
export {
  listScriptTags,
  createScriptTag,
  deleteScriptTag,
} from "./tag-service.js";

// 剧本质量评估 CRUD
export {
  getLatestAssessment,
  createAssessment,
} from "./assessment-service.js";

// 剧本审批 CRUD
export {
  getApprovalByScript,
  createApproval,
  updateApproval,
} from "./approval-service.js";

// 剧本备份/版本服务
export {
  createBackup,
  listBackups,
  listScriptVersions,
  createScriptVersion,
  deleteScriptVersion,
  restoreBackup,
} from "./backup-service.js";

// 剧本评论 CRUD
export {
  listScriptComments,
  createScriptComment,
  updateScriptComment,
  deleteScriptComment,
} from "./comment-service.js";

// 剧本分析提取资产 CRUD
export {
  listScriptAnalyzedCharacters,
  createScriptAnalyzedCharacter,
  updateScriptAnalyzedCharacter,
  deleteScriptAnalyzedCharacter,
  replaceScriptAnalyzedCharacters,
  listScriptAnalyzedScenes,
  createScriptAnalyzedScene,
  updateScriptAnalyzedScene,
  deleteScriptAnalyzedScene,
  replaceScriptAnalyzedScenes,
  listScriptAnalyzedProps,
  createScriptAnalyzedProp,
  updateScriptAnalyzedProp,
  deleteScriptAnalyzedProp,
  replaceScriptAnalyzedProps,
  listScriptAnalyzedAssets,
  replaceScriptAnalyzedAssets,
  deleteScriptAnalyzedAssetsByDocument,
} from "./analyzed-asset-service.js";

// 解析/统计/连续性检查/版本
export {
  parseScriptDocument,
  getScriptStatistics,
  checkScriptContinuity,
  getDocumentVersions,
} from "./analysis-service.js";

// 导入导出
export {
  exportScriptAsJson,
  importScriptFromJson,
} from "./import-service.js";

// AI 剧本生成/优化/场景/对白/分镜
export {
  generateScriptWithAI,
  optimizeScriptWithAI,
  generateSceneWithAI,
  generateDialogueWithAI,
  splitStoryboardWithAI,
} from "./ai-service.js";

// 剧本解析器（仅工具方法，便于扩展）
export {
  splitTextIntoEpisodes,
  parseEpisodeFromMarkdown,
  parseSceneFromMarkdown,
  parseDialoguesFromText,
  parseScenesFromParagraphs,
} from "./parser.js";

// 工具函数
export {
  collectChatContent,
  normalizeTimeOfDay,
  extractPlainText,
  parseSceneHeader,
} from "./utils.js";

// 子模块类型
export type {
  ScriptDocumentInput,
  ScriptEpisodeInput,
  ScriptSceneInput,
  ScriptDialogueInput,
  ScriptSceneCharacterInput,
  ScriptSceneLocationInput,
  ScriptTemplateInput,
  ScriptTagInput,
  ScriptQualityAssessmentInput,
  ScriptApprovalInput,
  ScriptCommentInput,
  ParsedEpisode,
  ParsedScene,
  ParsedDialogue,
} from "./types.js";
