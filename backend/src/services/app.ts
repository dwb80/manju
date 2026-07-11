import path from "node:path";
import { createAgnesClient, type AgnesClient } from "../ai/agnes-client.js";
import type { Conversation, Favorite, ImageTask, Message, Project, Settings, VideoTask, ScriptComment, AssetVersion, Script, ProjectScript } from "../types.js";
import type { Character } from "../types/character.js";
import type { Scene } from "../types/scene.js";
import type { Prop } from "../types/prop.js";
import type { Storyboard, ProjectStoryboard } from "../types/storyboard.js";
import type { Audio } from "../types/audio.js";
import type { ModuleVideoTask } from "../types/video.js";
import type { ProjectClip, ProjectTask, ProjectEpisode, ProjectIssue, ProjectMember, ProjectMilestone, PublishPlan, PublishedVideo } from "../types/project.js";
import type { Asset, ProjectAsset } from "../types/asset.js";
import type { Review, ProjectReview } from "../types/review.js";
import type { ScriptDocument, ScriptEpisode, ScriptScene, ScriptDialogue, ScriptSceneCharacter, ScriptSceneLocation, ScriptTemplate, ScriptTag, ScriptQualityAssessment, ScriptApproval, ScriptBackup } from "../types/script.js";
import { CsvRepository, SettingsRepository } from "../storage/csv.js";
import {
  conversationFields, favoriteFields, imageTaskFields, messageFields, projectFields, videoTaskFields, scriptCommentFields, assetVersionFields,
  characterFields, sceneFields, propFields, storyboardFields, audioFields, moduleVideoTaskFields, projectClipFields, projectStoryboardFields,
  scriptFields, assetFields, reviewFields,
  scriptDocumentFields, scriptEpisodeFields, scriptSceneFields, scriptDialogueFields, scriptSceneCharacterFields, scriptSceneLocationFields,
  scriptTemplateFields, scriptTagFields, scriptQualityAssessmentFields, scriptApprovalFields, scriptBackupFields,
} from "../storage/schema.js";

export interface AppContext {
  ai: AgnesClient;
  root: string;
  mediaRoot: string;
  mediaCacheEnabled: boolean;
  conversations: CsvRepository<Conversation>;
  projects: CsvRepository<Project>;
  messages: CsvRepository<Message>;
  images: CsvRepository<ImageTask>;
  videos: CsvRepository<VideoTask>;
  favorites: CsvRepository<Favorite>;
  /** 剧本编辑器内行内批注与回复仓储（任务8：评论持久化）。 */
  scriptComments: CsvRepository<ScriptComment>;
  /** 三厂共性：资产版本历史仓储（任务12：统一版本管理）。 */
  assetVersions: CsvRepository<AssetVersion>;
  settings: SettingsRepository<Settings>;
  aborts: Map<string, AbortController>;
  /** 三大工厂：角色 / 场景 / 道具。 */
  characters: CsvRepository<Character>;
  scenes: CsvRepository<Scene>;
  props: CsvRepository<Prop>;
  /** 独立模块：分镜 / 音频 / 视频任务 / 剪辑。 */
  storyboards: CsvRepository<Storyboard>;
  /** 剧本侧分镜（剧本编辑器中的分镜，独立于工业流水线分镜）。 */
  projectStoryboards: CsvRepository<ProjectStoryboard>;
  audios: CsvRepository<Audio>;
  moduleVideos: CsvRepository<ModuleVideoTask>;
  /** 兼容旧名（module-domain.ts 用 moduleVideoTasks）。 */
  moduleVideoTasks: CsvRepository<ModuleVideoTask>;
  projectClips: CsvRepository<ProjectClip>;
  /** 剧本 / 资产 / 审核 等独立模块仓储。
   * 注：scripts/assets/reviews 与其 ProjectScript/ProjectAsset/ProjectReview 变体在 Path A/B 共用同一张 CSV，
   * 这里使用 any 兼容两套 schema 的差异。 */
  scripts: CsvRepository<Script>;
  projectScripts: any;
  assets: CsvRepository<Asset>;
  projectAssets: any;
  reviews: CsvRepository<Review>;
  projectReviews: any;
  /** 项目管理域（任务/集数/工单/里程碑/成员）。 */
  projectTasks: CsvRepository<ProjectTask>;
  projectEpisodes: CsvRepository<ProjectEpisode>;
  projectIssues: CsvRepository<ProjectIssue>;
  projectMilestones: CsvRepository<ProjectMilestone>;
  projectMembers: CsvRepository<ProjectMember>;
  /** 发布中心。 */
  publishPlans: CsvRepository<any>;
  /** 模型中心。 */
  modelConfigs: CsvRepository<any>;
  modelQuotas: CsvRepository<any>;
  modelCallLogs: CsvRepository<any>;
  /** 剧本中心（Path B）相关：剧本文档 / 剧集 / 场景 / 对白 / 关联 / 模板 / 标签 / 评估 / 审批 / 备份。 */
  scriptDocuments: CsvRepository<ScriptDocument>;
  scriptEpisodes: CsvRepository<ScriptEpisode>;
  scriptScenes: CsvRepository<ScriptScene>;
  scriptDialogues: CsvRepository<ScriptDialogue>;
  scriptSceneCharacters: CsvRepository<ScriptSceneCharacter>;
  scriptSceneLocations: CsvRepository<ScriptSceneLocation>;
  scriptTemplates: CsvRepository<ScriptTemplate>;
  scriptTags: CsvRepository<ScriptTag>;
  scriptQualityAssessments: CsvRepository<ScriptQualityAssessment>;
  scriptApprovals: CsvRepository<ScriptApproval>;
  scriptBackups: CsvRepository<ScriptBackup>;
}

export const defaultSettings: Settings = {
  theme: "system",
  language: "zh-CN",
  fontSize: "medium",
  defaultChatModel: "agnes-2.0-flash",
  defaultImageSize: "1024x768",
  defaultVideoRatio: "16:9",
};

/** 组装后端运行所需的 AI 客户端、CSV 仓库、媒体目录和运行状态。 */
export function createAppContext(root = process.cwd(), options: { mediaCacheEnabled?: boolean } = {}): AppContext {
  const base = path.join(root, "data", "csv");
  const ctx = {
    ai: createAgnesClient(),
    root,
    mediaRoot: path.join(root, "data", "media"),
    mediaCacheEnabled: options.mediaCacheEnabled ?? true,
    conversations: new CsvRepository(base, "conversations", conversationFields),
    projects: new CsvRepository(base, "projects", projectFields),
    messages: new CsvRepository(base, "messages", messageFields),
    images: new CsvRepository(base, "image_tasks", imageTaskFields),
    videos: new CsvRepository(base, "video_tasks", videoTaskFields),
    favorites: new CsvRepository(base, "favorites", favoriteFields),
    scriptComments: new CsvRepository(base, "script_comments", scriptCommentFields),
    assetVersions: new CsvRepository(base, "asset_versions", assetVersionFields),
    settings: new SettingsRepository(path.join(root, "data", "csv"), defaultSettings),
    aborts: new Map(),
    // 三大工厂
    characters: new CsvRepository(base, "characters", characterFields),
    scenes: new CsvRepository(base, "scenes", sceneFields),
    props: new CsvRepository(base, "props", propFields),
    // 独立模块
    storyboards: new CsvRepository(base, "storyboards", storyboardFields),
    projectStoryboards: new CsvRepository(base, "project_storyboards", projectStoryboardFields),
    audios: new CsvRepository(base, "audios", audioFields),
    moduleVideos: new CsvRepository(base, "module_video_tasks", moduleVideoTaskFields),
    moduleVideoTasks: new CsvRepository(base, "module_video_tasks", moduleVideoTaskFields),
    projectClips: new CsvRepository(base, "project_clips", projectClipFields),
    // 剧本 / 资产 / 审核（Path A/B 共用同一张 CSV，类型由 AppContext 字段用 any 兼容）
    scripts: new CsvRepository(base, "scripts", scriptFields),
    projectScripts: new CsvRepository(base, "scripts", scriptFields),
    assets: new CsvRepository(base, "assets", assetFields),
    projectAssets: new CsvRepository(base, "assets", assetFields),
    reviews: new CsvRepository(base, "reviews", reviewFields),
    projectReviews: new CsvRepository(base, "reviews", reviewFields),
    // 项目管理
    projectTasks: new CsvRepository(base, "project_tasks", []),
    projectEpisodes: new CsvRepository(base, "project_episodes", []),
    projectIssues: new CsvRepository(base, "project_issues", []),
    projectMilestones: new CsvRepository(base, "project_milestones", []),
    projectMembers: new CsvRepository(base, "project_members", []),
    // 发布中心
    publishPlans: new CsvRepository(base, "publish_plans", []),
    // 模型中心
    modelConfigs: new CsvRepository(base, "model_configs", []),
    modelQuotas: new CsvRepository(base, "model_quotas", []),
    modelCallLogs: new CsvRepository(base, "model_call_logs", []),
    // 剧本中心（Path B）
    scriptDocuments: new CsvRepository(base, "script_documents", scriptDocumentFields),
    scriptEpisodes: new CsvRepository(base, "script_episodes", scriptEpisodeFields),
    scriptScenes: new CsvRepository(base, "script_scenes", scriptSceneFields),
    scriptDialogues: new CsvRepository(base, "script_dialogues", scriptDialogueFields),
    scriptSceneCharacters: new CsvRepository(base, "script_scene_characters", scriptSceneCharacterFields),
    scriptSceneLocations: new CsvRepository(base, "script_scene_locations", scriptSceneLocationFields),
    scriptTemplates: new CsvRepository(base, "script_templates", scriptTemplateFields),
    scriptTags: new CsvRepository(base, "script_tags", scriptTagFields),
    scriptQualityAssessments: new CsvRepository(base, "script_quality_assessments", scriptQualityAssessmentFields),
    scriptApprovals: new CsvRepository(base, "script_approvals", scriptApprovalFields),
    scriptBackups: new CsvRepository(base, "script_backups", scriptBackupFields),
  };
  return ctx as unknown as AppContext;
}
