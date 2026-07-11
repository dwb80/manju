/**
 * 独立模块 API 服务（barrel 入口）
 *
 * 设计原则：
 * - 此文件保持历史 import 路径兼容：调用方继续 `import { listCharacters } from "@/services/module.service"` 不会报错。
 * - 真正的实现已按业务域拆分到独立文件（character/scene/prop/storyboard/audio/module-video/version）。
 * - 新代码请直接 import 各自域的 service 文件。
 *
 * 这样做的好处：
 * 1. 模块边界清晰：每个 service 文件只关心自己的接口。
 * 2. 测试容易：可以单独 mock 某个 service。
 * 3. 删除/重构安全：删一个模块只影响一个文件。
 */

// ==================== 角色 ====================
export {
  listCharacters,
  createCharacter,
  updateCharacter,
  deleteCharacter,
  restoreCharacter,
  listDeletedCharacters,
  permanentDeleteCharacters,
  getCharacterUsage,
  batchCharacters,
  copyCharactersToProjects,
  listCharacterTemplates,
  type UsageReferenceItem,
  type AssetUsage,
  type CopyToProjectsResult,
} from "./character.service";

// ==================== 场景 ====================
export {
  listScenes,
  createScene,
  updateScene,
  deleteScene,
  restoreScene,
  listDeletedScenes,
  permanentDeleteScenes,
  getSceneUsage,
  batchScenes,
  copyScenesToProjects,
  listSceneTemplates,
  getScenesByIds,
} from "./scene.service";

// ==================== 道具 ====================
export {
  listProps,
  createProp,
  updateProp,
  deleteProp,
  restoreProp,
  listDeletedProps,
  permanentDeleteProps,
  getPropUsage,
  batchProps,
  copyPropsToProjects,
  listPropTemplates,
} from "./prop.service";

// ==================== 分镜 ====================
export {
  listStoryboards,
  createStoryboard,
  updateStoryboard,
  deleteStoryboard,
} from "./storyboard.service";

// ==================== 音频 ====================
export {
  listAudios,
  createAudio,
  updateAudio,
  deleteAudio,
} from "./audio.service";

// ==================== 视频任务 ====================
export {
  listModuleVideoTasks,
  createModuleVideoTask,
  updateModuleVideoTask,
  deleteModuleVideoTask,
} from "./module-video.service";

// ==================== 版本管理 ====================
export {
  listVersions,
  getVersion,
  restoreVersion,
} from "./version.service";

// ==================== 剧本 ====================
export {
  listScripts,
  createScript,
  updateScript,
  deleteScript,
} from "./script.service";

// ==================== 剧本富文本结构（剧集/场景/对白） ====================
export {
  createScriptDocumentApi,
  createScriptEpisodeApi,
  createScriptSceneApi,
  createScriptDialogueApi,
  type ScriptDocumentPayload,
  type ScriptEpisodePayload,
  type ScriptScenePayload,
  type ScriptDialoguePayload,
} from "./script-structure.service";

// ==================== 资产（已存在） ====================
export {
  listAssets,
  createAsset,
  updateAsset,
  deleteAsset,
} from "./asset.service";

// ==================== 审核（已存在） ====================
export {
  listReviews,
  createReview,
  updateReview,
  deleteReview,
} from "./review.service";
