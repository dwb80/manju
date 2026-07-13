import path from "node:path";
import { createAgnesClient, type AgnesClient } from "../ai/agnes-client.js";
import type { Conversation, Favorite, ImageTask, Message, Project, Settings, VideoTask, ScriptComment, AssetVersion, CharacterImageHistory, Todo, Script, AppLog, WorkItem } from "../types.js";
import type { Character } from "../types/character.js";
import type { Scene } from "../types/scene.js";
import type { Prop } from "../types/prop.js";
import type { Storyboard, ProjectStoryboard } from "../types/storyboard.js";
import type { Audio } from "../types/audio.js";
import type { ModuleVideoTask } from "../types/video.js";
import type { ProjectClip, ProjectTask, ProjectEpisode, ProjectIssue, ProjectMember, ProjectMilestone, PublishPlan } from "../types/project.js";
import type { Asset, ProjectAsset } from "../types/asset.js";
import type { Review, ProjectReview } from "../types/review.js";
import type { ModelConfig, ModelQuota, ModelCallLog } from "../types/model.js";
import type { ScriptDocument, ScriptEpisode, ScriptScene, ScriptDialogue, ScriptSceneCharacter, ScriptSceneLocation, ScriptTemplate, ScriptTag, ScriptQualityAssessment, ScriptApproval, ScriptBackup, ProjectScript } from "../types/script.js";
import { SqliteRepository, SqliteSettingsRepository, closeDatabase } from "../storage/sqlite.js";
import { Repository, KeyValueRepository } from "../storage/repository.js";
import {
  conversationFields, favoriteFields, imageTaskFields, messageFields, projectFields, videoTaskFields, scriptCommentFields, assetVersionFields, characterImageHistoryFields, todoFields, appLogFields, workItemFields,
  characterFields, sceneFields, propFields, storyboardFields, audioFields, moduleVideoTaskFields, projectClipFields, projectStoryboardFields,
  scriptFields, assetFields, reviewFields, projectScriptFields, projectAssetFields, projectReviewFields,
  scriptDocumentFields, scriptEpisodeFields, scriptSceneFields, scriptDialogueFields, scriptSceneCharacterFields, scriptSceneLocationFields,
  scriptTemplateFields, scriptTagFields, scriptQualityAssessmentFields, scriptApprovalFields, scriptBackupFields,
} from "../storage/schema.js";

export interface AppContext {
  ai: AgnesClient;
  root: string;
  mediaRoot: string;
  mediaCacheEnabled: boolean;
  /** SQLite 数据库文件路径，单一文件承载所有业务表。 */
  databaseFile: string;
  conversations: Repository<Conversation>;
  projects: Repository<Project>;
  messages: Repository<Message>;
  images: Repository<ImageTask>;
  videos: Repository<VideoTask>;
  favorites: Repository<Favorite>;
  /** 剧本编辑器内行内批注与回复仓储（任务8：评论持久化）。 */
  scriptComments: Repository<ScriptComment>;
  /** 三厂共性：资产版本历史仓储（任务12：统一版本管理）。 */
  assetVersions: Repository<AssetVersion>;
  /** 角色图片生成历史仓储：每次 AI 生成图、设为角色资产、删除都走这里（跨设备持久化）。 */
  characterImageHistory: Repository<CharacterImageHistory>;
  settings: KeyValueRepository<Settings>;
  aborts: Map<string, AbortController>;
  /** 三大工厂：角色 / 场景 / 道具。 */
  characters: Repository<Character>;
  scenes: Repository<Scene>;
  props: Repository<Prop>;
  /** 独立模块：分镜 / 音频 / 视频任务 / 剪辑。 */
  storyboards: Repository<Storyboard>;
  /** 剧本侧分镜（剧本编辑器中的分镜，独立于工业流水线分镜）。 */
  projectStoryboards: Repository<ProjectStoryboard>;
  audios: Repository<Audio>;
  moduleVideos: Repository<ModuleVideoTask>;
  /** 兼容旧名（module-domain.ts 用 moduleVideoTasks）。 */
  moduleVideoTasks: Repository<ModuleVideoTask>;
  projectClips: Repository<ProjectClip>;
  /** 剧本 / 资产 / 审核 等独立模块仓储（评审 P1-H10 修复：补齐 Path A/B 变体类型） */
  scripts: Repository<Script>;
  projectScripts: Repository<ProjectScript>;
  assets: Repository<Asset>;
  projectAssets: Repository<ProjectAsset>;
  reviews: Repository<Review>;
  projectReviews: Repository<ProjectReview>;
  /** 项目管理域（任务/集数/工单/里程碑/成员）。 */
  projectTasks: Repository<ProjectTask>;
  projectEpisodes: Repository<ProjectEpisode>;
  projectIssues: Repository<ProjectIssue>;
  projectMilestones: Repository<ProjectMilestone>;
  projectMembers: Repository<ProjectMember>;
  /** 统一工作项（评审 P2：合并 task/issue/review/milestone 到单表，下个迭代会删除旧 4 表）。 */
  workItems: Repository<WorkItem>;
  /** 发布中心。 */
  publishPlans: Repository<PublishPlan>;
  /** 模型中心。 */
  modelConfigs: Repository<ModelConfig>;
  modelQuotas: Repository<ModelQuota>;
  modelCallLogs: Repository<ModelCallLog>;
  /** 剧本中心（Path B）相关：剧本文档 / 剧集 / 场景 / 对白 / 关联 / 模板 / 标签 / 评估 / 审批 / 备份。 */
  scriptDocuments: Repository<ScriptDocument>;
  scriptEpisodes: Repository<ScriptEpisode>;
  scriptScenes: Repository<ScriptScene>;
  scriptDialogues: Repository<ScriptDialogue>;
  scriptSceneCharacters: Repository<ScriptSceneCharacter>;
  scriptSceneLocations: Repository<ScriptSceneLocation>;
  scriptTemplates: Repository<ScriptTemplate>;
  scriptTags: Repository<ScriptTag>;
  scriptQualityAssessments: Repository<ScriptQualityAssessment>;
  scriptApprovals: Repository<ScriptApproval>;
  scriptBackups: Repository<ScriptBackup>;
  /** 我的待办（评审优化 P1）。 */
  todos: Repository<Todo>;
  /** 应用审计日志（评审增量 P1-1 / P1-2：状态机变更 + 跨项目复制 + 软删除 / 恢复）。 */
  appLogs: Repository<AppLog>;
}

export const defaultSettings: Settings = {
  theme: "system",
  language: "zh-CN",
  fontSize: "medium",
  defaultChatModel: "agnes-2.0-flash",
  defaultImageSize: "1024x768",
  defaultVideoRatio: "16:9",
};

/** 组装后端运行所需的 AI 客户端、SQLite 仓库、媒体目录和运行状态。 */
export function createAppContext(root = process.cwd(), options: { mediaCacheEnabled?: boolean } = {}): AppContext {
  const databaseFile = path.join(root, "data", "sqlite.db");
  const ctx = {
    ai: createAgnesClient(),
    root,
    mediaRoot: path.join(root, "data", "media"),
    mediaCacheEnabled: options.mediaCacheEnabled ?? true,
    databaseFile,
    conversations: new SqliteRepository<Conversation>(databaseFile, "conversations", conversationFields),
    projects: new SqliteRepository<Project>(databaseFile, "projects", projectFields),
    messages: new SqliteRepository<Message>(databaseFile, "messages", messageFields),
    images: new SqliteRepository<ImageTask>(databaseFile, "image_tasks", imageTaskFields),
    videos: new SqliteRepository<VideoTask>(databaseFile, "video_tasks", videoTaskFields),
    favorites: new SqliteRepository<Favorite>(databaseFile, "favorites", favoriteFields),
    scriptComments: new SqliteRepository<ScriptComment>(databaseFile, "script_comments", scriptCommentFields),
    assetVersions: new SqliteRepository<AssetVersion>(databaseFile, "asset_versions", assetVersionFields),
    characterImageHistory: new SqliteRepository<CharacterImageHistory>(databaseFile, "character_image_history", characterImageHistoryFields),
    settings: new SqliteSettingsRepository<Settings>(databaseFile, defaultSettings),
    aborts: new Map(),
    // 三大工厂
    characters: new SqliteRepository<Character>(databaseFile, "characters", characterFields),
    scenes: new SqliteRepository<Scene>(databaseFile, "scenes", sceneFields),
    props: new SqliteRepository<Prop>(databaseFile, "props", propFields),
    // 独立模块
    storyboards: new SqliteRepository<Storyboard>(databaseFile, "storyboards", storyboardFields),
    projectStoryboards: new SqliteRepository<ProjectStoryboard>(databaseFile, "project_storyboards", projectStoryboardFields),
    audios: new SqliteRepository<Audio>(databaseFile, "audios", audioFields),
    moduleVideos: new SqliteRepository<ModuleVideoTask>(databaseFile, "module_video_tasks", moduleVideoTaskFields),
    moduleVideoTasks: new SqliteRepository<ModuleVideoTask>(databaseFile, "module_video_tasks", moduleVideoTaskFields),
    projectClips: new SqliteRepository<ProjectClip>(databaseFile, "project_clips", projectClipFields),
    // 剧本 / 资产 / 审核（Path A/B 共用同一张 SQLite 表，类型由 AppContext 字段用 any 兼容）
    scripts: new SqliteRepository<Script>(databaseFile, "scripts", scriptFields),
    projectScripts: new SqliteRepository<ProjectScript>(databaseFile, "scripts", projectScriptFields),
    assets: new SqliteRepository<Asset>(databaseFile, "assets", assetFields),
    projectAssets: new SqliteRepository<ProjectAsset>(databaseFile, "assets", projectAssetFields),
    reviews: new SqliteRepository<Review>(databaseFile, "reviews", reviewFields),
    projectReviews: new SqliteRepository<ProjectReview>(databaseFile, "reviews", projectReviewFields),
    // 项目管理
    projectTasks: new SqliteRepository<ProjectTask>(databaseFile, "project_tasks", []),
    projectEpisodes: new SqliteRepository<ProjectEpisode>(databaseFile, "project_episodes", []),
    projectIssues: new SqliteRepository<ProjectIssue>(databaseFile, "project_issues", []),
    projectMilestones: new SqliteRepository<ProjectMilestone>(databaseFile, "project_milestones", []),
    projectMembers: new SqliteRepository<ProjectMember>(databaseFile, "project_members", []),
    // 统一工作项（评审 P2：合并 4 表）
    workItems: new SqliteRepository<WorkItem>(databaseFile, "work_items", workItemFields),
    // 发布中心
    publishPlans: new SqliteRepository<PublishPlan>(databaseFile, "publish_plans", []),
    // 模型中心
    modelConfigs: new SqliteRepository<ModelConfig>(databaseFile, "model_configs", []),
    modelQuotas: new SqliteRepository<ModelQuota>(databaseFile, "model_quotas", []),
    modelCallLogs: new SqliteRepository<ModelCallLog>(databaseFile, "model_call_logs", []),
    // 剧本中心（Path B）
    scriptDocuments: new SqliteRepository<ScriptDocument>(databaseFile, "script_documents", scriptDocumentFields),
    scriptEpisodes: new SqliteRepository<ScriptEpisode>(databaseFile, "script_episodes", scriptEpisodeFields),
    scriptScenes: new SqliteRepository<ScriptScene>(databaseFile, "script_scenes", scriptSceneFields),
    scriptDialogues: new SqliteRepository<ScriptDialogue>(databaseFile, "script_dialogues", scriptDialogueFields),
    scriptSceneCharacters: new SqliteRepository<ScriptSceneCharacter>(databaseFile, "script_scene_characters", scriptSceneCharacterFields),
    scriptSceneLocations: new SqliteRepository<ScriptSceneLocation>(databaseFile, "script_scene_locations", scriptSceneLocationFields),
    scriptTemplates: new SqliteRepository<ScriptTemplate>(databaseFile, "script_templates", scriptTemplateFields),
    scriptTags: new SqliteRepository<ScriptTag>(databaseFile, "script_tags", scriptTagFields),
    scriptQualityAssessments: new SqliteRepository<ScriptQualityAssessment>(databaseFile, "script_quality_assessments", scriptQualityAssessmentFields),
    scriptApprovals: new SqliteRepository<ScriptApproval>(databaseFile, "script_approvals", scriptApprovalFields),
    scriptBackups: new SqliteRepository<ScriptBackup>(databaseFile, "script_backups", scriptBackupFields),
    // 我的待办
    todos: new SqliteRepository<Todo>(databaseFile, "todos", todoFields),
    // 应用审计日志
    appLogs: new SqliteRepository<AppLog>(databaseFile, "app_logs", appLogFields),
  };
  (ctx as unknown as { close: () => void }).close = () => closeDatabase(databaseFile);
  return ctx as unknown as AppContext;
}
