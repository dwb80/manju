import type {
  AssetDraft,
  ChatSettings,
  ImageRatio,
  ImageSize,
  ImageTask,
  Message,
  MessageAttachment,
  Mode,
  ProjectAsset,
  ProjectClipStatus,
  ProjectFormDraft,
  ProjectHealth,
  ProjectIssue,
  ProjectMilestone,
  ProjectReview,
  ProjectScript,
  ProjectStoryboard,
  ProjectStoryboardStatus,
  ProjectSummary,
  ProjectTask,
  Status,
  VideoRatio,
  VideoTask,
  WorkbenchTab,
} from "@/lib/app-types";

/** 项目工作台的制作流程列，前端看板和后端任务状态要保持一致。 */
export const projectTaskColumns = [
  { key: "todo", label: "待办" },
  { key: "script", label: "剧本" },
  { key: "storyboard", label: "分镜" },
  { key: "image", label: "出图" },
  { key: "video", label: "视频" },
  { key: "review", label: "审核" },
  { key: "done", label: "完成" },
] as const;

/** 项目资产库支持的资产分类，页面会根据这里自动生成筛选和录入入口。 */
export const projectAssetKinds = [
  { key: "image", label: "图片资产", placeholder: "图片名，例如：主角定妆图" },
  { key: "video", label: "视频资产", placeholder: "视频名，例如：第一集开场镜头" },
  { key: "character", label: "角色资产", placeholder: "角色名，例如：少年剑客" },
  { key: "scene", label: "场景资产", placeholder: "场景名，例如：雨夜长街" },
  { key: "style", label: "风格资产", placeholder: "风格名，例如：古风电影感" },
  { key: "prompt", label: "提示词资产", placeholder: "提示词模板名" },
  { key: "project", label: "项目资产", placeholder: "项目资料名" },
  { key: "storyboard", label: "分镜底图", placeholder: "分镜底图名，例如：第一集第3镜底图" },
] as const;

/** 资产表单默认值，新增和重置表单时复用同一份结构。 */
export const emptyAssetDraft: AssetDraft = {
  name: "",
  prompt: "",
  image_url: "",
  video_url: "",
  folder: "",
  tags: "",
  resolution: "",
  duration: "",
  role_traits: "",
  style_keywords: "",
  notes: "",
};

/** 项目新增/编辑表单默认值，保持项目弹层初始化一致。 */
export const emptyProjectFormDraft: ProjectFormDraft = {
  name: "",
  category: "",
  status: "策划中",
  description: "",
  episode_count: 12,
  owner: "",
  due_date: "",
  storage_path: "",
};

export const storyboardStatuses: Array<{ key: ProjectStoryboardStatus; label: string }> = [
  { key: "draft", label: "草稿" },
  { key: "scripted", label: "已拆剧本" },
  { key: "image", label: "已出底图" },
  { key: "video", label: "已出视频" },
  { key: "review", label: "审核中" },
  { key: "done", label: "完成" },
];

export const clipStatuses: Array<{ key: ProjectClipStatus; label: string }> = [
  { key: "todo", label: "待剪辑" },
  { key: "editing", label: "剪辑中" },
  { key: "review", label: "送审" },
  { key: "done", label: "完成" },
];

export const workbenchTabs: WorkbenchTab[] = ["overview", "members", "episodes", "issues", "milestones", "scripts", "storyboards", "clips", "reviews", "tasks", "assets", "exports"];

/** 判断 URL 中的 workspace 参数是否是有效的项目工作页。 */
export function isWorkbenchTab(value: string | null): value is WorkbenchTab {
  return Boolean(value && workbenchTabs.includes(value as WorkbenchTab));
}

/** 按当前工作台页签给筛选栏提供相关状态，避免把所有状态混在一个下拉框里。 */
export function workbenchStatusOptions(tab: WorkbenchTab): Array<{ key: string; label: string }> {
  if (tab === "episodes") return ["策划中", "剧本中", "分镜中", "出图中", "视频中", "剪辑中", "审核中", "已完成"].map((status) => ({ key: status, label: status }));
  if (tab === "issues") return [
    { key: "open", label: "待处理" },
    { key: "doing", label: "处理中" },
    { key: "resolved", label: "已解决" },
    { key: "closed", label: "已关闭" },
  ];
  if (tab === "milestones") return [
    { key: "planned", label: "计划中" },
    { key: "doing", label: "进行中" },
    { key: "done", label: "已完成" },
    { key: "delayed", label: "延期" },
  ];
  if (tab === "scripts") return [
    { key: "draft", label: "草稿" },
    { key: "ready", label: "可拆分镜" },
    { key: "storyboarded", label: "已生成分镜" },
    { key: "archived", label: "已归档" },
  ];
  if (tab === "storyboards") return storyboardStatuses;
  if (tab === "clips") return clipStatuses;
  if (tab === "reviews") return [
    { key: "open", label: "待处理" },
    { key: "resolved", label: "已解决" },
    { key: "rejected", label: "已驳回" },
  ];
  if (tab === "tasks") return projectTaskColumns.map((column) => ({ key: column.key, label: column.label }));
  return [];
}

/** 支持的图片尺寸选项。 */
export const imageSizeOptions: { value: ImageSize; label: string; ratio: ImageRatio }[] = [
  { value: "1024x1024", label: "1024 × 1024", ratio: "1:1" },
  { value: "1024x768", label: "1024 × 768", ratio: "4:3" },
  { value: "768x1024", label: "768 × 1024", ratio: "3:4" },
  { value: "1152x768", label: "1152 × 768", ratio: "3:2" },
  { value: "768x1152", label: "768 × 1152", ratio: "2:3" },
];

/** 根据图片尺寸返回对应画幅比例。 */
export function imageRatioFromSize(size: ImageSize): ImageRatio {
  return imageSizeOptions.find((option) => option.value === size)?.ratio ?? "1:1";
}

/** 根据视频画幅返回默认宽高。 */
export function defaultVideoSize(ratio: VideoRatio): { width: number; height: number } {
  if (ratio === "9:16") return { width: 768, height: 1152 };
  if (ratio === "1:1") return { width: 1024, height: 1024 };
  if (ratio === "4:3") return { width: 1024, height: 768 };
  if (ratio === "3:4") return { width: 768, height: 1024 };
  return { width: 1152, height: 768 };
}

/** 判断视频帧数是否符合 Agnes Video V2.0 的 8n+1 规则。 */
export function validVideoFrames(frames: number): boolean {
  return Number.isInteger(frames) && frames > 0 && frames <= 441 && (frames - 1) % 8 === 0;
}

/** 根据帧数和帧率估算时长，真实展示以 API 返回 seconds 为准。 */
export function estimateVideoSeconds(frames: number, frameRate: number): string {
  if (!frameRate) return "-";
  return (frames / frameRate).toFixed(1);
}

/** 把任务状态转换成中文文案。 */
export function statusText(status: Status) {
  return ({ pending: "排队中", processing: "生成中", success: "已完成", failed: "失败" } as const)[status] ?? status;
}

/** 把项目剧本状态转换成列表里展示的中文文案。 */
export function scriptStatusText(status: ProjectScript["status"]) {
  return ({ draft: "草稿", ready: "可拆分镜", storyboarded: "已生成分镜", archived: "已归档" } as const)[status] ?? status;
}

/** 把项目分镜状态转换成列表里展示的中文文案。 */
export function storyboardStatusText(status: ProjectStoryboardStatus) {
  return storyboardStatuses.find((item) => item.key === status)?.label ?? status;
}

/** 把剪辑状态转换成列表里展示的中文文案。 */
export function clipStatusText(status: ProjectClipStatus) {
  return clipStatuses.find((item) => item.key === status)?.label ?? status;
}

/** 根据项目生产数据计算健康度，并给概览页生成下一步风险提醒。 */
export function buildProjectHealth(input: {
  summary: ProjectSummary;
  issues: ProjectIssue[];
  milestones: ProjectMilestone[];
  tasks: ProjectTask[];
  storyboards: ProjectStoryboard[];
  assets: ProjectAsset[];
  reviews: ProjectReview[];
}): ProjectHealth {
  const items: string[] = [];
  let score = 100;
  const openIssues = input.issues.filter((issue) => issue.status !== "resolved" && issue.status !== "closed");
  const criticalIssues = openIssues.filter((issue) => issue.severity === "critical" || issue.severity === "high");
  const delayedMilestones = input.milestones.filter((milestone) => milestone.status === "delayed");
  const undoneTasks = input.tasks.filter((task) => task.status !== "done");
  const pendingReviews = input.reviews.filter((review) => review.status === "open" || review.status === "rejected");
  const hasCharacters = input.assets.some((asset) => asset.kind === "character");
  const hasScenes = input.assets.some((asset) => asset.kind === "scene");

  if (criticalIssues.length > 0) {
    score -= 22;
    items.push(`有 ${criticalIssues.length} 个高优先级问题需要先处理`);
  }
  if (openIssues.length > criticalIssues.length) {
    score -= Math.min(12, openIssues.length * 3);
    items.push(`还有 ${openIssues.length} 个未关闭问题`);
  }
  if (delayedMilestones.length > 0) {
    score -= 18;
    items.push(`有 ${delayedMilestones.length} 个里程碑延期`);
  }
  if (input.summary.episodes > 0 && input.storyboards.length === 0) {
    score -= 15;
    items.push("已有剧集规划，但还没有分镜");
  }
  if (!hasCharacters) {
    score -= 8;
    items.push("角色资产库还没有角色卡");
  }
  if (!hasScenes) {
    score -= 6;
    items.push("场景资产库还没有可复用场景");
  }
  if (pendingReviews.length > 0) {
    score -= Math.min(12, pendingReviews.length * 4);
    items.push(`有 ${pendingReviews.length} 条审核意见待处理`);
  }
  if (undoneTasks.length > 0 && input.summary.completed_tasks === 0) {
    score -= 8;
    items.push("任务看板还没有完成项");
  }
  if (input.summary.conversations === 0) {
    score -= 6;
    items.push("项目下还没有创作会话");
  }
  if (items.length === 0) items.push("当前项目节奏正常，可以继续推进下一批分镜或生成任务");

  const safeScore = Math.max(0, Math.min(100, score));
  if (safeScore >= 85) return { score: safeScore, label: "健康", tone: "border-emerald-500/30 bg-emerald-500/10 text-emerald-200", items };
  if (safeScore >= 65) return { score: safeScore, label: "需关注", tone: "border-yellow-500/30 bg-yellow-500/10 text-yellow-100", items };
  return { score: safeScore, label: "有风险", tone: "border-red-500/30 bg-red-500/10 text-red-100", items };
}

/** 从一组任务或消息中找出最新创建时间。 */
export function newestTime(items: Array<{ created_at?: string }>): number {
  return items.reduce((latest, item) => {
    const time = Date.parse(item.created_at ?? "");
    return Number.isNaN(time) ? latest : Math.max(latest, time);
  }, 0);
}

/** 根据会话里最新的内容类型，自动切换聊天、图片或视频标签。 */
export function modeFromConversationContent(messages: Message[], images: ImageTask[], videos: VideoTask[]): Mode {
  const contentTimes: Array<{ mode: Mode; time: number }> = [
    { mode: "chat", time: newestTime(messages) },
    { mode: "image", time: newestTime(images) },
    { mode: "video", time: newestTime(videos) },
  ];
  const candidates = contentTimes.filter((item) => item.time > 0);
  candidates.sort((a, b) => b.time - a.time);
  return candidates[0]?.mode ?? (videos.length ? "video" : images.length ? "image" : "chat");
}

/** 默认聊天参数配置。 */
export const defaultChatSettings: ChatSettings = {
  model: "agnes-2.0-flash",
  temperature: 0.7,
  top_p: 1,
  enableThinking: false,
};

/** 从消息 meta 中取出图片附件，过滤掉不完整数据。 */
export function messageAttachments(message: Message): MessageAttachment[] {
  const items = Array.isArray(message.meta?.attachments) ? message.meta.attachments : [];
  return items.filter((item): item is MessageAttachment => Boolean(item?.url && item?.name));
}
