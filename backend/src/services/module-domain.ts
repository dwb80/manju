/** 独立模块 CRUD 服务
 *
 * 提供剧本、角色、场景、分镜、音频、资产、审核、视频任务等独立模块的增删查改功能。
 * 本文件为聚合入口，所有实现已拆分到 module-domain/ 子目录中。
 */

// ==================== 资产版本管理 ====================
export { recordVersion, listVersions, getVersion, restoreVersion } from "./module-domain/asset-version.js";

// ==================== 剧本模块 ====================
// 已废弃：所有剧本操作统一走 script-center-impl.js（script_documents 表）
// export { ... } from "./module-domain/script-module.js";

// ==================== 角色模块 ====================
export { listCharacters, getCharacter, createCharacter, updateCharacter, deleteCharacter, restoreCharacter, listDeletedCharacters, permanentDeleteCharacters, batchDeleteCharacters, batchUpdateCharacters } from "./module-domain/character-module.js";
export type { CharacterInput } from "./module-domain/character-module.js";

// ==================== 场景模块 ====================
export { listScenes, createScene, updateScene, deleteScene, restoreScene, listDeletedScenes, permanentDeleteScenes, batchDeleteScenes, batchUpdateScenes } from "./module-domain/scene-module.js";
export type { SceneInput } from "./module-domain/scene-module.js";

// ==================== 道具模块 ====================
export { listProps, createProp, updateProp, deleteProp, restoreProp, listDeletedProps, permanentDeleteProps, batchDeleteProps, batchUpdateProps } from "./module-domain/prop-module.js";
export type { PropInput } from "./module-domain/prop-module.js";

// ==================== 跨项目资产复制 ====================
export { copyCharactersToProjects, copyScenesToProjects, copyPropsToProjects } from "./module-domain/cross-project-copy.js";

// ==================== 资产引用关系查询 ====================
export { getCharacterUsage, getSceneUsage, getPropUsage } from "./module-domain/asset-usage.js";
export type { UsageReferenceItem, AssetUsage } from "./module-domain/asset-usage.js";

// ==================== 分镜模块 ====================
export { listStoryboards, createStoryboard, updateStoryboard, deleteStoryboard, listShots, createShot, updateShot, deleteShot, autoSplitShots, batchDeleteStoryboards, batchUpdateStoryboards } from "./module-domain/storyboard-module.js";
export type { StoryboardInput, ShotInput } from "./module-domain/storyboard-module.js";

// ==================== 音频模块 ====================
export { listAudios, createAudio, updateAudio, deleteAudio } from "./module-domain/audio-module.js";
export type { AudioInput } from "./module-domain/audio-module.js";

// ==================== 资产模块 ====================
export { listAssets, createAsset, updateAsset, deleteAsset } from "./module-domain/asset-module.js";
export type { AssetInput } from "./module-domain/asset-module.js";

// ==================== 审核模块 ====================
export { listReviews, createReview, updateReview, deleteReview } from "./module-domain/review-module.js";
export type { ReviewInput } from "./module-domain/review-module.js";

// ==================== 视频任务模块 ====================
export { listModuleVideoTasks, createModuleVideoTask, updateModuleVideoTask, deleteModuleVideoTask, syncVideoTaskStatus, retryVideoTask, regenerateVideo } from "./module-domain/video-task-module.js";
export type { ModuleVideoTaskInput } from "./module-domain/video-task-module.js";

// ==================== 软删除 / 回收站 / 跨项目复制 ====================
export {
  softDeleteStoryboard, restoreStoryboard, listDeletedStoryboards, permanentDeleteStoryboard, copyStoryboardToProject,
  softDeleteAudio, restoreAudio, listDeletedAudios, permanentDeleteAudio, copyAudioToProject,
  softDeleteVideo, restoreVideo, listDeletedVideos, permanentDeleteVideo, copyVideoToProject,
  softDeleteClip, restoreClip, listDeletedClips, permanentDeleteClip, copyClipToProject,
} from "./module-domain/soft-delete-ops.js";

// ==================== 视频生成 / TTS / 出现次数聚合 / 模板预设 ====================
export { generateVideoFromStoryboard, generateVideoFromShot, generateTTS, batchGenerateTTS, getCharacterAppearances, getSceneAppearances, getPropAppearances, listCharacterTemplatePresets, listSceneTemplatePresets, listPropTemplatePresets } from "./module-domain/video-generation.js";
