/**
 * @file project-member-service.ts
 * @description 项目成员 + 邀请服务。负责 5 种角色 owner/editor/reviewer/commenter/viewer 的成员管理 + 邀请流程。
 *
 * ## 设计要点
 *  - 5 个角色对应 PROJECT_PERMISSIONS 矩阵，hasPermission 集中判断。
 *  - 邀请 TTL = 7 天，过期自动转 expired（purgeExpiredInvitations 兜底）。
 *  - transferOwnership 是"原子"操作：旧 owner → editor + 新 owner → owner，不允许同项目多 owner。
 *
 * ## 表结构
 *  - project_members(id, project_id, name, role, contact, notes, ...)
 *  - project_invitations(id, project_id, email, role, token, status, invited_by, expires_at, ...)
 */
import { id, nowIso } from "../../utils.js";
import type { AppContext } from "../app.js";
import type {
  ProjectMember,
  ProjectInvitation,
  ProjectMemberRole,
  ProjectInvitationStatus,
} from "../../types/project.js";

/** 5 种项目角色白名单。 */
export const PROJECT_MEMBER_ROLES: ProjectMemberRole[] = [
  "owner",
  "editor",
  "reviewer",
  "commenter",
  "viewer",
];

/** 角色 → 中文标签（前端展示用）。 */
export const PROJECT_MEMBER_ROLE_LABELS: Record<ProjectMemberRole, string> = {
  owner: "所有者",
  editor: "编辑",
  reviewer: "审核",
  commenter: "评论",
  viewer: "只读",
};

/** 细粒度权限码。 */
export type ProjectPermission =
  | "project.view"
  | "project.edit"
  | "project.delete"
  | "project.archive"
  | "member.invite"
  | "member.remove"
  | "member.change_role"
  | "member.transfer_ownership"
  | "script.edit"
  | "shot.edit"
  | "asset.edit"
  | "task.assign"
  | "task.update_status"
  | "review.submit"
  | "review.approve"
  | "review.reject"
  | "comment.write";

/** 角色 → 权限矩阵。 */
export const PROJECT_PERMISSIONS: Record<ProjectMemberRole, ProjectPermission[]> = {
  owner: [
    "project.view", "project.edit", "project.delete", "project.archive",
    "member.invite", "member.remove", "member.change_role", "member.transfer_ownership",
    "script.edit", "shot.edit", "asset.edit", "task.assign", "task.update_status",
    "review.submit", "review.approve", "review.reject", "comment.write",
  ],
  editor: [
    "project.view", "project.edit",
    "script.edit", "shot.edit", "asset.edit", "task.assign", "task.update_status",
    "review.submit", "comment.write",
  ],
  reviewer: [
    "project.view",
    "review.submit", "review.approve", "review.reject",
    "comment.write",
  ],
  commenter: [
    "project.view",
    "comment.write",
  ],
  viewer: [
    "project.view",
  ],
};

export function isValidProjectMemberRole(value: unknown): value is ProjectMemberRole {
  return typeof value === "string" && PROJECT_MEMBER_ROLES.includes(value as ProjectMemberRole);
}

export function hasPermission(member: Pick<ProjectMember, "role">, permission: ProjectPermission): boolean {
  const role = member.role;
  if (!isValidProjectMemberRole(role)) return false;
  return PROJECT_PERMISSIONS[role].includes(permission);
}

function generateInvitationToken(): string {
  return `${id("inv")}-${crypto.randomUUID().replace(/-/g, "")}`;
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

const INVITATION_TTL_MS = 7 * 24 * 3600 * 1000;

export async function listMembers(
  ctx: AppContext,
  projectId: string,
  options?: { includeDeleted?: boolean },
): Promise<ProjectMember[]> {
  const all = await ctx.projectMembers.findMany({ project_id: projectId });
  return all.filter((m) => options?.includeDeleted || !m.deleted_at);
}

export async function inviteMember(
  ctx: AppContext,
  projectId: string,
  input: { email: string; role: ProjectMemberRole; invitedBy: string },
): Promise<ProjectInvitation> {
  const email = input.email.trim().toLowerCase();
  if (!isValidEmail(email)) {
    throw new Error("INVALID_EMAIL: 邮箱格式不正确");
  }
  if (!isValidProjectMemberRole(input.role)) {
    throw new Error(`INVALID_ROLE: ${input.role}`);
  }
  const existing = await ctx.projectInvitations.findOne({
    project_id: projectId,
    email,
    status: "pending",
  });
  if (existing) {
    throw new Error("INVITATION_ALREADY_EXISTS: 该邮箱已有待接受的邀请");
  }
  const members = await ctx.projectMembers.findMany({ project_id: projectId });
  const alreadyMember = members.some(
    (m) => !m.deleted_at && (m as { contact?: string }).contact?.toLowerCase() === email,
  );
  if (alreadyMember) {
    throw new Error("ALREADY_MEMBER: 该用户已是项目成员");
  }
  const now = nowIso();
  const invitation: ProjectInvitation = {
    id: id("pinv"),
    project_id: projectId,
    email,
    role: input.role,
    token: generateInvitationToken(),
    status: "pending",
    invited_by: input.invitedBy,
    expires_at: new Date(Date.now() + INVITATION_TTL_MS).toISOString(),
    created_at: now,
    responded_at: "",
  };
  await ctx.projectInvitations.insert(invitation);
  return invitation;
}

export async function listInvitations(
  ctx: AppContext,
  projectId: string,
  options?: { status?: ProjectInvitationStatus },
): Promise<ProjectInvitation[]> {
  const filter: { project_id: string; status?: ProjectInvitationStatus } = { project_id: projectId };
  if (options?.status) filter.status = options.status;
  return ctx.projectInvitations.findMany(filter);
}

export async function cancelInvitation(
  ctx: AppContext,
  invitationId: string,
): Promise<{ id: string; status: ProjectInvitationStatus }> {
  const inv = await ctx.projectInvitations.findById(invitationId);
  if (!inv) throw new Error("INVITATION_NOT_FOUND: 邀请不存在");
  if (inv.status !== "pending") {
    throw new Error(`INVITATION_NOT_PENDING: 当前状态 ${inv.status}`);
  }
  const now = nowIso();
  await ctx.projectInvitations.update(invitationId, { status: "cancelled", responded_at: now });
  return { id: invitationId, status: "cancelled" };
}

export async function acceptInvitation(
  ctx: AppContext,
  input: { token: string; userId: string; name?: string },
): Promise<ProjectMember> {
  const inv = await ctx.projectInvitations.findOne({ token: input.token });
  if (!inv) throw new Error("INVITATION_NOT_FOUND: 邀请不存在或已撤销");
  if (inv.status !== "pending") {
    throw new Error(`INVITATION_ALREADY_${inv.status.toUpperCase()}: 邀请已处理`);
  }
  if (Date.parse(inv.expires_at) < Date.now()) {
    await ctx.projectInvitations.update(inv.id, { status: "expired", responded_at: nowIso() });
    throw new Error("INVITATION_EXPIRED: 邀请已过期");
  }
  const existing = await ctx.projectMembers.findOne({ project_id: inv.project_id, user_id: input.userId });
  if (existing && !existing.deleted_at) {
    await ctx.projectInvitations.update(inv.id, { status: "accepted", responded_at: nowIso() });
    return existing;
  }
  const now = nowIso();
  const member: ProjectMember = {
    id: id("pm"),
    project_id: inv.project_id,
    name: input.name?.trim() || inv.email.split("@")[0],
    role: inv.role,
    contact: inv.email,
    notes: `通过邀请加入 ${now}`,
    created_at: now,
    updated_at: now,
    user_id: input.userId,
    joined_at: now,
    last_active_at: now,
    deleted_at: "",
  };
  await ctx.projectMembers.insert(member);
  await ctx.projectInvitations.update(inv.id, { status: "accepted", responded_at: now });
  return member;
}

export async function rejectInvitation(
  ctx: AppContext,
  input: { token: string },
): Promise<{ id: string; status: ProjectInvitationStatus }> {
  const inv = await ctx.projectInvitations.findOne({ token: input.token });
  if (!inv) throw new Error("INVITATION_NOT_FOUND: 邀请不存在");
  if (inv.status !== "pending") {
    throw new Error(`INVITATION_ALREADY_${inv.status.toUpperCase()}`);
  }
  await ctx.projectInvitations.update(inv.id, { status: "rejected", responded_at: nowIso() });
  return { id: inv.id, status: "rejected" };
}

export async function changeMemberRole(
  ctx: AppContext,
  projectId: string,
  memberId: string,
  newRole: ProjectMemberRole,
): Promise<ProjectMember> {
  if (!isValidProjectMemberRole(newRole)) {
    throw new Error(`INVALID_ROLE: ${newRole}`);
  }
  if (newRole === "owner") {
    throw new Error("CANNOT_CHANGE_TO_OWNER: 请使用 transferOwnership 转移所有权");
  }
  const member = await ctx.projectMembers.findById(memberId);
  if (!member || member.project_id !== projectId) {
    throw new Error("MEMBER_NOT_FOUND: 成员不存在");
  }
  if (member.deleted_at) {
    throw new Error("MEMBER_DELETED: 成员已移除");
  }
  if (member.role === "owner") {
    throw new Error("CANNOT_CHANGE_OWNER_ROLE: 所有者角色不可变更，请使用转移所有权");
  }
  await ctx.projectMembers.update(memberId, {
    role: newRole,
    updated_at: nowIso(),
  });
  return (await ctx.projectMembers.findById(memberId))!;
}

export async function removeMember(
  ctx: AppContext,
  projectId: string,
  memberId: string,
): Promise<{ id: string; deleted_at: string }> {
  const member = await ctx.projectMembers.findById(memberId);
  if (!member || member.project_id !== projectId) {
    throw new Error("MEMBER_NOT_FOUND: 成员不存在");
  }
  if (member.deleted_at) {
    throw new Error("MEMBER_ALREADY_DELETED: 成员已移除");
  }
  if (member.role === "owner") {
    throw new Error("CANNOT_REMOVE_OWNER: 所有者不可移除，请先转移所有权");
  }
  const now = nowIso();
  await ctx.projectMembers.update(memberId, {
    deleted_at: now,
    updated_at: now,
  });
  return { id: memberId, deleted_at: now };
}

export async function transferOwnership(
  ctx: AppContext,
  projectId: string,
  currentOwnerId: string,
  newOwnerId: string,
): Promise<{ oldOwner: ProjectMember; newOwner: ProjectMember }> {
  if (currentOwnerId === newOwnerId) {
    throw new Error("CANNOT_TRANSFER_TO_SELF: 不能转移给自己");
  }
  const members = await ctx.projectMembers.findMany({ project_id: projectId });
  const oldOwner = members.find((m) => m.id === currentOwnerId && !m.deleted_at);
  if (!oldOwner) {
    throw new Error("OLD_OWNER_NOT_FOUND: 原 owner 不存在或已移除");
  }
  if (oldOwner.role !== "owner") {
    throw new Error("NOT_OWNER: 操作者不是项目所有者");
  }
  const newOwner = members.find((m) => m.id === newOwnerId && !m.deleted_at);
  if (!newOwner) {
    throw new Error("NEW_OWNER_NOT_FOUND: 目标成员不存在或已移除");
  }
  const now = nowIso();
  await ctx.projectMembers.update(currentOwnerId, { role: "editor", updated_at: now });
  await ctx.projectMembers.update(newOwnerId, { role: "owner", updated_at: now });
  return {
    oldOwner: { ...oldOwner, role: "editor", updated_at: now },
    newOwner: { ...newOwner, role: "owner", updated_at: now },
  };
}

export async function getMemberByUserId(
  ctx: AppContext,
  projectId: string,
  userId: string,
): Promise<ProjectMember | null> {
  const member = await ctx.projectMembers.findOne({ project_id: projectId, user_id: userId });
  if (!member || member.deleted_at) return null;
  return member;
}

export async function purgeExpiredInvitations(ctx: AppContext): Promise<number> {
  const pending = await ctx.projectInvitations.findMany({ status: "pending" });
  const now = Date.now();
  let purged = 0;
  for (const inv of pending) {
    if (Date.parse(inv.expires_at) < now) {
      await ctx.projectInvitations.update(inv.id, { status: "expired", responded_at: nowIso() });
      purged++;
    }
  }
  return purged;
}
