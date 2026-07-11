import type { AppContext } from "../app.js";
import type { Conversation, Project, ProjectAsset, ProjectClip, ProjectEpisode, ProjectIssue, ProjectIssueSeverity, ProjectIssueStatus, ProjectMember, ProjectMilestone, ProjectMilestoneStatus, ProjectReview, ProjectScript, ProjectStoryboard, ProjectTask, ProjectTaskStatus, Settings } from "../../types.js";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { spawn } from "node:child_process";
import { clampNumber, id, nowIso } from "../../utils.js";
import { listProjectEpisodes, listProjectScripts, exportProjectScriptsText } from "./script.js";
import { listProjectStoryboards, listProjectClips, exportProjectStoryboardsCsv, exportProjectEditListCsv } from "./storyboard.js";
import { listProjectAssets } from "./asset.js";
import { listProjectReviews } from "./review.js";

type CreateProjectInput = {
  name?: string;
  category?: string;
  status?: string;
  description?: string;
  episode_count?: number;
  owner?: string;
  due_date?: string;
  is_default?: boolean;
  storage_path?: string;
  storage_mode?: string;
};

export type ProjectSummary = {
  project: Project;
  conversations: number;
  members: number;
  episodes: number;
  issues: number;
  open_issues: number;
  milestones: number;
  open_milestones: number;
  tasks: number;
  completed_tasks: number;
  images: number;
  videos: number;
  completed_images: number;
  completed_videos: number;
  latest_activity_at: string;
};

const projectTaskStatuses: ProjectTaskStatus[] = ["todo", "script", "storyboard", "image", "video", "review", "done"];
const projectIssueStatuses: ProjectIssueStatus[] = ["open", "doing", "resolved", "closed"];
const projectIssueSeverities: ProjectIssueSeverity[] = ["low", "medium", "high", "critical"];
const projectMilestoneStatuses: ProjectMilestoneStatus[] = ["planned", "doing", "done", "delayed"];

type ProjectTaskInput = {
  title?: string;
  status?: string;
  owner?: string;
  due_date?: string;
  notes?: string;
};

type ProjectMemberInput = {
  name?: string;
  role?: string;
  contact?: string;
  notes?: string;
};

type ProjectIssueInput = {
  title?: string;
  severity?: string;
  status?: string;
  owner?: string;
  target_type?: string;
  target_id?: string;
  notes?: string;
};

type ProjectMilestoneInput = {
  title?: string;
  status?: string;
  owner?: string;
  due_date?: string;
  description?: string;
};

/** 把外部传入的任务状态规整到固定看板列。 */
function normalizeProjectTaskStatus(status: unknown): ProjectTaskStatus {
  return projectTaskStatuses.includes(status as ProjectTaskStatus) ? status as ProjectTaskStatus : "todo";
}

/** 把项目问题状态规整到允许集合。 */
function normalizeProjectIssueStatus(status: unknown): ProjectIssueStatus {
  return projectIssueStatuses.includes(status as ProjectIssueStatus) ? status as ProjectIssueStatus : "open";
}

/** 把项目问题严重级别规整到允许集合。 */
function normalizeProjectIssueSeverity(severity: unknown): ProjectIssueSeverity {
  return projectIssueSeverities.includes(severity as ProjectIssueSeverity) ? severity as ProjectIssueSeverity : "medium";
}

/** 把项目里程碑状态规整到允许集合。 */
function normalizeProjectMilestoneStatus(status: unknown): ProjectMilestoneStatus {
  return projectMilestoneStatuses.includes(status as ProjectMilestoneStatus) ? status as ProjectMilestoneStatus : "planned";
}

/** 把项目目录片段清理成适合 Windows 和 URL 使用的安全名称。 */
function safeStorageSegment(value: string): string {
  return value.trim().replace(/[<>:"|?*\x00-\x1F]/g, "").replace(/[\\/]+/g, "_").replace(/\s+/g, "_").slice(0, 80);
}

/** 规范化项目存储目录，确保最终路径只由安全片段组成并落在 data/projects 下。 */
function normalizeProjectStoragePath(projectId: string, projectName: string, requestedPath?: string): string {
  const fallback = `${safeStorageSegment(projectName) || "project"}-${projectId}`;
  const source = requestedPath?.trim() || fallback;
  const segments = source
    .replace(/\\/g, "/")
    .split("/")
    .map(safeStorageSegment)
    .filter(Boolean);
  return (segments.length ? segments : [fallback]).join("/");
}

/** 计算项目存储目录的绝对路径，并阻止越权写入项目外目录。 */
function projectStorageTarget(ctx: AppContext, storagePath: string): string {
  const root = path.resolve(ctx.root, "data", "projects");
  const target = path.resolve(root, ...storagePath.split("/"));
  if (target !== root && !target.startsWith(`${root}${path.sep}`)) {
    throw new Error("invalid project storage path");
  }
  return target;
}

/** 创建项目约定目录，包括导出文件、图片、视频和上传目录。 */
async function ensureProjectStorage(ctx: AppContext, storagePath: string): Promise<void> {
  const target = projectStorageTarget(ctx, storagePath);
  // 主数据统一写入 SQLite；项目目录只保存媒体文件、用户上传和交付导出物。
  await Promise.all([
    mkdir(path.join(target, "exports"), { recursive: true }),
    mkdir(path.join(target, "media", "images"), { recursive: true }),
    mkdir(path.join(target, "media", "videos"), { recursive: true }),
    mkdir(path.join(target, "uploads"), { recursive: true }),
  ]);
}

/** 创建项目记录，并绑定它的本地存储目录。 */
export async function createProject(ctx: AppContext, input: CreateProjectInput): Promise<Project> {
  const now = nowIso();
  const projectId = id("p");
  const name = input.name?.trim() || "新项目";
  const storagePath = normalizeProjectStoragePath(projectId, name, input.storage_path);
  await ensureProjectStorage(ctx, storagePath);
  const project: Project = {
    id: projectId,
    name,
    category: input.category?.trim() || "AI漫剧",
    status: input.status?.trim() || "策划中",
    description: input.description?.trim() || "",
    episode_count: clampNumber(input.episode_count, 0, 0, 999),
    owner: input.owner?.trim() || "",
    due_date: input.due_date?.trim() || "",
    is_default: Boolean(input.is_default),
    is_pinned: false,
    created_at: now,
    updated_at: now,
    storage_path: storagePath,
    storage_mode: input.storage_mode === "existing" ? "existing" : "managed",
    archived_at: "",
  };
  await ctx.projects.insert(project);
  return project;
}

/** 确保存在默认项目，用于第一次打开项目列表时展示。 */
export async function ensureDefaultProject(ctx: AppContext): Promise<Project> {
  const existing = await ctx.projects.findMany({}, { sort: "asc", limit: 1 });
  if (existing[0]) return existing[0];
  return createProject(ctx, { name: "manju", is_default: true });
}

/** 获取所有项目，首次调用时会自动补默认项目。 */
export async function listProjects(ctx: AppContext): Promise<Project[]> {
  await ensureDefaultProject(ctx);
  const projects = await ctx.projects.findMany({}, { sort: "asc" });
  return projects
    .filter((project) => !project.archived_at)
    .sort((left, right) => Number(right.is_pinned) - Number(left.is_pinned) || left.name.localeCompare(right.name, "zh-Hans"));
}

/** 更新项目基础信息和漫剧制作规划字段。 */
export async function updateProject(ctx: AppContext, projectId: string, patch: Partial<Pick<Project, "name" | "category" | "status" | "description" | "episode_count" | "owner" | "due_date" | "is_default" | "is_pinned" | "archived_at">>): Promise<Project> {
  const existing = await ctx.projects.findById(projectId);
  if (!existing) throw new Error("project not found");
  const next: Partial<Project> = { ...patch, updated_at: nowIso() };
  if (typeof patch.name === "string") next.name = patch.name.trim() || existing.name;
  if (typeof patch.category === "string") next.category = patch.category.trim();
  if (typeof patch.status === "string") next.status = patch.status.trim() || "策划中";
  if (typeof patch.description === "string") next.description = patch.description.trim();
  if (typeof patch.episode_count === "number") next.episode_count = clampNumber(patch.episode_count, 0, 0, 999);
  if (typeof patch.owner === "string") next.owner = patch.owner.trim();
  if (typeof patch.due_date === "string") next.due_date = patch.due_date.trim();
  await ctx.projects.update(projectId, next);
  return (await ctx.projects.findById(projectId)) as Project;
}

/** 汇总一个项目下的会话、图片、视频数量和最近活动时间。 */
export async function summarizeProject(ctx: AppContext, projectId: string): Promise<ProjectSummary> {
  const project = await ctx.projects.findById(projectId);
  if (!project) throw new Error("project not found");
  const conversations = await ctx.conversations.findMany({ project_id: projectId } as Partial<Conversation>);
  const members = await ctx.projectMembers.findMany({ project_id: projectId } as Partial<ProjectMember>);
  const episodes = await ctx.projectEpisodes.findMany({ project_id: projectId } as Partial<ProjectEpisode>);
  const issues = await ctx.projectIssues.findMany({ project_id: projectId } as Partial<ProjectIssue>);
  const milestones = await ctx.projectMilestones.findMany({ project_id: projectId } as Partial<ProjectMilestone>);
  const tasks = await ctx.projectTasks.findMany({ project_id: projectId } as Partial<ProjectTask>);
  const conversationIds = new Set(conversations.map((conversation) => conversation.id));
  const images = (await ctx.images.findMany()).filter((task) => conversationIds.has(task.conversation_id));
  const videos = (await ctx.videos.findMany()).filter((task) => conversationIds.has(task.conversation_id));
  const activityTimes = [
    project.updated_at,
    ...conversations.map((conversation) => conversation.updated_at),
    ...tasks.map((task) => task.updated_at),
    ...images.map((task) => task.created_at),
    ...videos.map((task) => task.created_at),
  ].filter(Boolean).sort();
  return {
    project,
    conversations: conversations.length,
    members: members.length,
    episodes: episodes.length,
    issues: issues.length,
    open_issues: issues.filter((issue) => issue.status !== "resolved" && issue.status !== "closed").length,
    milestones: milestones.length,
    open_milestones: milestones.filter((milestone) => milestone.status !== "done").length,
    tasks: tasks.length,
    completed_tasks: tasks.filter((task) => task.status === "done").length,
    images: images.length,
    videos: videos.length,
    completed_images: images.filter((task) => task.status === "success").length,
    completed_videos: videos.filter((task) => task.status === "success").length,
    latest_activity_at: activityTimes.at(-1) ?? project.updated_at,
  };
}

/** 列出项目任务，按创建时间升序组成看板数据。 */
export async function listProjectTasks(ctx: AppContext, projectId: string): Promise<ProjectTask[]> {
  if (!await ctx.projects.findById(projectId)) throw new Error("project not found");
  return ctx.projectTasks.findMany({ project_id: projectId } as Partial<ProjectTask>, { sort: "asc" });
}

/** 列出项目成员，用于任务负责人、审核人和小团队职责分工。 */
export async function listProjectMembers(ctx: AppContext, projectId: string): Promise<ProjectMember[]> {
  if (!(await ctx.projects.findById(projectId))) throw new Error("project not found");
  return ctx.projectMembers.findMany({ project_id: projectId } as Partial<ProjectMember>, { sort: "asc" });
}

/** 新增项目成员。 */
export async function createProjectMember(ctx: AppContext, projectId: string, input: ProjectMemberInput): Promise<ProjectMember> {
  if (!(await ctx.projects.findById(projectId))) throw new Error("project not found");
  const now = nowIso();
  const member: ProjectMember = {
    id: id("pm"),
    project_id: projectId,
    name: input.name?.trim() || "新成员",
    role: input.role?.trim() || "成员",
    contact: input.contact?.trim() || "",
    notes: input.notes?.trim() || "",
    created_at: now,
    updated_at: now,
  };
  await ctx.projectMembers.insert(member);
  return member;
}

/** 更新项目成员姓名、角色、联系方式和备注。 */
export async function updateProjectMember(ctx: AppContext, projectId: string, memberId: string, patch: ProjectMemberInput): Promise<ProjectMember> {
  const existing = await ctx.projectMembers.findById(memberId);
  if (!existing || existing.project_id !== projectId) throw new Error("project member not found");
  const next: Partial<ProjectMember> = { updated_at: nowIso() };
  if (typeof patch.name === "string") next.name = patch.name.trim() || existing.name;
  if (typeof patch.role === "string") next.role = patch.role.trim();
  if (typeof patch.contact === "string") next.contact = patch.contact.trim();
  if (typeof patch.notes === "string") next.notes = patch.notes.trim();
  await ctx.projectMembers.update(memberId, next);
  return (await ctx.projectMembers.findById(memberId)) as ProjectMember;
}

/** 删除项目成员，不会删除其名下历史任务，只保留任务上的负责人文本。 */
export async function deleteProjectMember(ctx: AppContext, projectId: string, memberId: string): Promise<void> {
  const existing = await ctx.projectMembers.findById(memberId);
  if (!existing || existing.project_id !== projectId) throw new Error("project member not found");
  await ctx.projectMembers.delete(memberId);
}

/** 列出项目风险和问题，默认按创建时间排序。 */
export async function listProjectIssues(ctx: AppContext, projectId: string): Promise<ProjectIssue[]> {
  if (!(await ctx.projects.findById(projectId))) throw new Error("project not found");
  return ctx.projectIssues.findMany({ project_id: projectId } as Partial<ProjectIssue>, { sort: "asc" });
}

/** 新增项目风险或问题。 */
export async function createProjectIssue(ctx: AppContext, projectId: string, input: ProjectIssueInput): Promise<ProjectIssue> {
  if (!(await ctx.projects.findById(projectId))) throw new Error("project not found");
  const now = nowIso();
  const issue: ProjectIssue = {
    id: id("pi"),
    project_id: projectId,
    title: input.title?.trim() || "新的项目问题",
    severity: normalizeProjectIssueSeverity(input.severity),
    status: normalizeProjectIssueStatus(input.status),
    owner: input.owner?.trim() || "",
    target_type: input.target_type?.trim() || "",
    target_id: input.target_id?.trim() || "",
    notes: input.notes?.trim() || "",
    created_at: now,
    updated_at: now,
  };
  await ctx.projectIssues.insert(issue);
  return issue;
}

/** 更新项目风险或问题。 */
export async function updateProjectIssue(ctx: AppContext, projectId: string, issueId: string, patch: ProjectIssueInput): Promise<ProjectIssue> {
  const existing = await ctx.projectIssues.findById(issueId);
  if (!existing || existing.project_id !== projectId) throw new Error("project issue not found");
  const next: Partial<ProjectIssue> = { updated_at: nowIso() };
  if (typeof patch.title === "string") next.title = patch.title.trim() || existing.title;
  if (typeof patch.severity === "string") next.severity = normalizeProjectIssueSeverity(patch.severity);
  if (typeof patch.status === "string") next.status = normalizeProjectIssueStatus(patch.status);
  if (typeof patch.owner === "string") next.owner = patch.owner.trim();
  if (typeof patch.target_type === "string") next.target_type = patch.target_type.trim();
  if (typeof patch.target_id === "string") next.target_id = patch.target_id.trim();
  if (typeof patch.notes === "string") next.notes = patch.notes.trim();
  await ctx.projectIssues.update(issueId, next);
  return (await ctx.projectIssues.findById(issueId)) as ProjectIssue;
}

/** 删除项目风险或问题。 */
export async function deleteProjectIssue(ctx: AppContext, projectId: string, issueId: string): Promise<void> {
  const existing = await ctx.projectIssues.findById(issueId);
  if (!existing || existing.project_id !== projectId) throw new Error("project issue not found");
  await ctx.projectIssues.delete(issueId);
}

/** 列出项目里程碑，按截止日期和创建时间排序。 */
export async function listProjectMilestones(ctx: AppContext, projectId: string): Promise<ProjectMilestone[]> {
  if (!(await ctx.projects.findById(projectId))) throw new Error("project not found");
  const milestones = await ctx.projectMilestones.findMany({ project_id: projectId } as Partial<ProjectMilestone>, { sort: "asc" });
  return milestones.sort((left, right) => (left.due_date || "9999").localeCompare(right.due_date || "9999") || left.created_at.localeCompare(right.created_at));
}

/** 新增项目里程碑或交付节点。 */
export async function createProjectMilestone(ctx: AppContext, projectId: string, input: ProjectMilestoneInput): Promise<ProjectMilestone> {
  if (!(await ctx.projects.findById(projectId))) throw new Error("project not found");
  const now = nowIso();
  const milestone: ProjectMilestone = {
    id: id("pms"),
    project_id: projectId,
    title: input.title?.trim() || "新的里程碑",
    status: normalizeProjectMilestoneStatus(input.status),
    owner: input.owner?.trim() || "",
    due_date: input.due_date?.trim() || "",
    description: input.description?.trim() || "",
    created_at: now,
    updated_at: now,
  };
  await ctx.projectMilestones.insert(milestone);
  return milestone;
}

/** 更新项目里程碑。 */
export async function updateProjectMilestone(ctx: AppContext, projectId: string, milestoneId: string, patch: ProjectMilestoneInput): Promise<ProjectMilestone> {
  const existing = await ctx.projectMilestones.findById(milestoneId);
  if (!existing || existing.project_id !== projectId) throw new Error("project milestone not found");
  const next: Partial<ProjectMilestone> = { updated_at: nowIso() };
  if (typeof patch.title === "string") next.title = patch.title.trim() || existing.title;
  if (typeof patch.status === "string") next.status = normalizeProjectMilestoneStatus(patch.status);
  if (typeof patch.owner === "string") next.owner = patch.owner.trim();
  if (typeof patch.due_date === "string") next.due_date = patch.due_date.trim();
  if (typeof patch.description === "string") next.description = patch.description.trim();
  await ctx.projectMilestones.update(milestoneId, next);
  return (await ctx.projectMilestones.findById(milestoneId)) as ProjectMilestone;
}

/** 删除项目里程碑。 */
export async function deleteProjectMilestone(ctx: AppContext, projectId: string, milestoneId: string): Promise<void> {
  const existing = await ctx.projectMilestones.findById(milestoneId);
  if (!existing || existing.project_id !== projectId) throw new Error("project milestone not found");
  await ctx.projectMilestones.delete(milestoneId);
}

/** 在项目下创建一条制作任务。 */
export async function createProjectTask(ctx: AppContext, projectId: string, input: ProjectTaskInput): Promise<ProjectTask> {
  if (!await ctx.projects.findById(projectId)) throw new Error("project not found");
  const now = nowIso();
  const task: ProjectTask = {
    id: id("pt"),
    project_id: projectId,
    title: input.title?.trim() || "新的制作任务",
    status: normalizeProjectTaskStatus(input.status),
    owner: input.owner?.trim() || "",
    due_date: input.due_date?.trim() || "",
    notes: input.notes?.trim() || "",
    created_at: now,
    updated_at: now,
  };
  await ctx.projectTasks.insert(task);
  return task;
}

/** 更新项目制作任务标题、状态、负责人、截止日期和备注。 */
export async function updateProjectTask(ctx: AppContext, projectId: string, taskId: string, patch: ProjectTaskInput): Promise<ProjectTask> {
  const existing = await ctx.projectTasks.findById(taskId);
  if (!existing || existing.project_id !== projectId) throw new Error("project task not found");
  const next: Partial<ProjectTask> = { updated_at: nowIso() };
  if (typeof patch.title === "string") next.title = patch.title.trim() || existing.title;
  if (typeof patch.status === "string") next.status = normalizeProjectTaskStatus(patch.status);
  if (typeof patch.owner === "string") next.owner = patch.owner.trim();
  if (typeof patch.due_date === "string") next.due_date = patch.due_date.trim();
  if (typeof patch.notes === "string") next.notes = patch.notes.trim();
  await ctx.projectTasks.update(taskId, next);
  return (await ctx.projectTasks.findById(taskId)) as ProjectTask;
}

/** 删除指定项目制作任务。 */
export async function deleteProjectTask(ctx: AppContext, projectId: string, taskId: string): Promise<void> {
  const existing = await ctx.projectTasks.findById(taskId);
  if (!existing || existing.project_id !== projectId) throw new Error("project task not found");
  await ctx.projectTasks.delete(taskId);
}

/** 导出项目素材包清单 JSON，先给打包和归档提供稳定索引。 */
export async function exportProjectManifest(ctx: AppContext, projectId: string): Promise<Record<string, unknown>> {
  const project = await ctx.projects.findById(projectId);
  if (!project) throw new Error("project not found");
  const episodes = await listProjectEpisodes(ctx, projectId);
  const issues = await listProjectIssues(ctx, projectId);
  const milestones = await listProjectMilestones(ctx, projectId);
  const scripts = await listProjectScripts(ctx, projectId);
  const members = await listProjectMembers(ctx, projectId);
  const storyboards = await listProjectStoryboards(ctx, projectId);
  const assets = await listProjectAssets(ctx, projectId);
  const reviews = await listProjectReviews(ctx, projectId);
  const clips = await listProjectClips(ctx, projectId);
  return {
    exported_at: nowIso(),
    project,
    counts: {
      episodes: episodes.length,
      issues: issues.length,
      open_issues: issues.filter((issue) => issue.status !== "resolved" && issue.status !== "closed").length,
      milestones: milestones.length,
      open_milestones: milestones.filter((milestone) => milestone.status !== "done").length,
      scripts: scripts.length,
      members: members.length,
      storyboards: storyboards.length,
      assets: assets.length,
      reviews: reviews.length,
      clips: clips.length,
      open_reviews: reviews.filter((item) => item.status === "open").length,
      images: storyboards.filter((item) => item.image_url).length,
      videos: storyboards.filter((item) => item.video_url).length,
    },
    members,
    episodes,
    issues,
    milestones,
    scripts,
    storyboards,
    clips,
    reviews,
    assets,
  };
}

/** 在项目存储目录生成一组交付索引文件，方便剪辑、归档和人工查阅。 */
export async function exportProjectPackageIndex(ctx: AppContext, projectId: string): Promise<{ path: string; files: string[] }> {
  const project = await ctx.projects.findById(projectId);
  if (!project) throw new Error("project not found");
  const exportDir = path.join(projectStorageTarget(ctx, project.storage_path), "exports");
  await mkdir(exportDir, { recursive: true });
  const manifest = await exportProjectManifest(ctx, projectId);
  const files = [
    { name: "scripts.txt", content: await exportProjectScriptsText(ctx, projectId) },
    { name: "storyboards.csv", content: `\uFEFF${await exportProjectStoryboardsCsv(ctx, projectId)}` },
    { name: "edit-list.csv", content: `\uFEFF${await exportProjectEditListCsv(ctx, projectId)}` },
    { name: "manifest.json", content: JSON.stringify(manifest, null, 2) },
    {
      name: "README.md",
      content: [
        `# ${project.name} 交付包索引`,
        "",
        `生成时间：${nowIso()}`,
        "",
        "- `scripts.txt`：剧本文档。",
        "- `storyboards.csv`：分镜表，可用 Excel 打开。",
        "- `edit-list.csv`：剪辑清单。",
        "- `manifest.json`：项目、成员、剧集、分镜、剪辑、审核、资产的完整索引。",
        "",
        "图片和视频文件以 manifest 中的本地媒体地址或项目资产地址为准。",
      ].join("\n"),
    },
  ];
  await Promise.all(files.map((file) => writeFile(path.join(exportDir, file.name), file.content, "utf8")));
  return { path: exportDir, files: files.map((file) => file.name) };
}

/** 在服务器所在机器的资源管理器中打开项目存储目录。 */
export async function openProjectFolder(ctx: AppContext, projectId: string): Promise<{ path: string }> {
  const project = await ctx.projects.findById(projectId);
  if (!project?.storage_path) throw new Error("project not found");
  const target = projectStorageTarget(ctx, project.storage_path);
  await mkdir(target, { recursive: true });
  if (process.platform === "win32") {
    spawn("explorer.exe", [target], { detached: true, stdio: "ignore" }).unref();
  } else if (process.platform === "darwin") {
    spawn("open", [target], { detached: true, stdio: "ignore" }).unref();
  } else {
    spawn("xdg-open", [target], { detached: true, stdio: "ignore" }).unref();
  }
  return { path: target };
}

/** 删除项目记录，并把原本归属该项目的会话改为未归属。 */
export async function deleteProject(ctx: AppContext, projectId: string): Promise<void> {
  const conversations = await ctx.conversations.findMany({ project_id: projectId } as Partial<Conversation>);
  for (const conversation of conversations) {
    await ctx.conversations.update(conversation.id, { project_id: "", updated_at: nowIso() } as Partial<Conversation>);
  }
  const tasks = await ctx.projectTasks.findMany({ project_id: projectId } as Partial<ProjectTask>);
  for (const task of tasks) await ctx.projectTasks.delete(task.id);
  const members = await ctx.projectMembers.findMany({ project_id: projectId } as Partial<ProjectMember>);
  for (const member of members) await ctx.projectMembers.delete(member.id);
  const episodes = await ctx.projectEpisodes.findMany({ project_id: projectId } as Partial<ProjectEpisode>);
  for (const episode of episodes) await ctx.projectEpisodes.delete(episode.id);
  const issues = await ctx.projectIssues.findMany({ project_id: projectId } as Partial<ProjectIssue>);
  for (const issue of issues) await ctx.projectIssues.delete(issue.id);
  const milestones = await ctx.projectMilestones.findMany({ project_id: projectId } as Partial<ProjectMilestone>);
  for (const milestone of milestones) await ctx.projectMilestones.delete(milestone.id);
  const scripts = await ctx.projectScripts.findMany({ project_id: projectId } as Partial<ProjectScript>);
  for (const script of scripts) await ctx.projectScripts.delete(script.id);
  const reviews = await ctx.projectReviews.findMany({ project_id: projectId } as Partial<ProjectReview>);
  for (const review of reviews) await ctx.projectReviews.delete(review.id);
  const clips = await ctx.projectClips.findMany({ project_id: projectId } as Partial<ProjectClip>);
  for (const clip of clips) await ctx.projectClips.delete(clip.id);
  const storyboards = await ctx.projectStoryboards.findMany({ project_id: projectId } as Partial<ProjectStoryboard>);
  for (const storyboard of storyboards) await ctx.projectStoryboards.delete(storyboard.id);
  const assets = await ctx.projectAssets.findMany({ project_id: projectId } as Partial<ProjectAsset>);
  for (const asset of assets) await ctx.projectAssets.delete(asset.id);
  await ctx.projects.delete(projectId);
}

/** 合并并保存用户设置。 */
export async function updateSettings(ctx: AppContext, body: Partial<Settings>): Promise<Settings> {
  const current = await ctx.settings.get();
  return ctx.settings.set({ ...current, ...body });
}
