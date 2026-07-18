/**
 * @file conversation-sidebar.tsx
 * @description 对话侧边栏组件，显示对话列表和管理功能
 */

"use client";

import {
  Archive,
  Box,
  Check,
  Database,
  Folder,
  FolderOpen,
  ListTodo,
  MoreHorizontal,
  Pencil,
  Pin,
  Plus,
  Rocket,
  Share2,
  Star,
  Trash2,
  X,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { Conversation, Mode, Project, WorkbenchTab } from "@/lib/app-types";

type ConversationGroup = {
  id: string;
  name: string;
  items: Conversation[];
};

type ConversationSidebarProps = {
  projectScopeLabel: string;
  projectScope: string;
  projectMenuOpen: boolean;
  projectCreateMenuOpen: boolean;
  projects: Project[];
  projectById: Map<string, Project>;
  conversationGroups: ConversationGroup[];
  projectActionMenuId: string;
  conversationMenuId: string;
  mode: Mode;
  conversationId: string;
  selectedProject?: Project | null;
  onCreateConversation: () => void;
  onToggleProjectMenu: () => void;
  onToggleProjectCreateMenu: () => void;
  onSelectScope: (scope: string) => void;
  onSelectProject: (project: Project) => void;
  onCreateProject: (storageMode: "managed" | "existing") => void;
  onToggleProjectActionMenu: (projectId: string) => void;
  onCreateConversationInProject: (project: Project) => void;
  onTogglePinProject: (project: Project) => void;
  onOpenProjectFolder: (project: Project) => void;
  onRenameProject: (project: Project) => void;
  onArchiveProject: (project: Project) => void;
  onRemoveProject: (project: Project) => void;
  onSelectConversation: (conversation: Conversation) => void;
  onToggleConversationMenu: (conversationId: string) => void;
  onTogglePinConversation: (conversation: Conversation) => void;
  onShareConversation: (conversation: Conversation) => void;
  onRenameConversation: (conversation: Conversation) => void;
  onDeleteConversation: (conversation: Conversation) => void;
  onOpenProjectWorkbench: (tab: WorkbenchTab, project: Project) => void;
  onOpenFavorites: () => void;
};

/**
 * Renders the left navigation for project switching, project actions, conversations, and favorites.
 */
export function ConversationSidebar({
  projectScopeLabel,
  projectScope,
  projectMenuOpen,
  projectCreateMenuOpen,
  projects,
  projectById,
  conversationGroups,
  projectActionMenuId,
  conversationMenuId,
  mode,
  conversationId,
  selectedProject,
  onCreateConversation,
  onToggleProjectMenu,
  onToggleProjectCreateMenu,
  onSelectScope,
  onSelectProject,
  onCreateProject,
  onToggleProjectActionMenu,
  onCreateConversationInProject,
  onTogglePinProject,
  onOpenProjectFolder,
  onRenameProject,
  onArchiveProject,
  onRemoveProject,
  onSelectConversation,
  onToggleConversationMenu,
  onTogglePinConversation,
  onShareConversation,
  onRenameConversation,
  onDeleteConversation,
  onOpenProjectWorkbench,
  onOpenFavorites,
}: ConversationSidebarProps) {
  // 初始化路由用于页面跳转
  const router = useRouter();

  return (
    <aside className="agnes-sidebar flex min-h-0 flex-col border-r border-white/10 p-4 max-md:hidden w-[280px]">
      <div className="mb-4 flex items-center justify-between">
        <div className="text-sm font-semibold">Agnes AI Studio</div>
        <Button size="icon" variant="ghost" onClick={onCreateConversation} className="transition-all duration-200 hover:scale-105 hover:bg-white/10">
          <Plus className="h-4 w-4" />
        </Button>
      </div>
      <div className="relative mb-4">
        <button
          className="flex w-full items-center justify-between gap-2 rounded-lg border border-white/10 bg-[#202020] px-4 py-2.5 text-left text-sm transition-all duration-200 hover:bg-white/5 hover:border-white/20"
          onClick={onToggleProjectMenu}
        >
          <span className="flex min-w-0 items-center gap-2">
            <Folder className="h-4 w-4 shrink-0 text-[#d8d8d8]" />
            <span className="truncate">{projectScopeLabel}</span>
          </span>
          <MoreHorizontal className="h-4 w-4 text-[#d8d8d8]" />
        </button>
        {projectMenuOpen && (
          <div className="absolute left-0 right-0 top-12 z-50 rounded-xl border border-white/10 bg-[#2f2f2f] p-2 text-sm shadow-lg transition-all duration-200">
            {[
              { id: "all", name: "全部项目" },
              { id: "", name: "不使用项目" },
            ].map((item) => (
              <button
                key={item.name}
                className="flex w-full items-center justify-between gap-2 rounded-lg px-4 py-2.5 text-left transition-all duration-200 hover:bg-white/10"
                onClick={() => onSelectScope(item.id)}
              >
                <span className="truncate">{item.name}</span>
                {projectScope === item.id && <Check className="h-4 w-4 text-emerald-400" />}
              </button>
            ))}
            <div className="my-1.5 h-px bg-white/10" />
            {projects.map((project) => (
              <button
                key={project.id}
                className="flex w-full items-center justify-between gap-2 rounded-lg px-4 py-2.5 text-left transition-all duration-200 hover:bg-white/10"
                onClick={() => onSelectProject(project)}
              >
                <span className="min-w-0">
                  <span className="block truncate">{project.name}</span>
                  {project.storage_path && <span className="block truncate text-[11px] font-medium text-[#d0d0d0]">{project.storage_path}</span>}
                </span>
                {projectScope === project.id && <Check className="h-4 w-4 text-emerald-400" />}
              </button>
            ))}
            <div className="my-1.5 h-px bg-white/10" />
            <div className="relative">
              <button
                className="flex w-full items-center justify-between gap-2 rounded-lg px-4 py-2.5 text-left transition-all duration-200 hover:bg-white/10"
                onClick={onToggleProjectCreateMenu}
              >
                <span className="flex items-center gap-2">
                  <Plus className="h-4 w-4" />新建项目
                </span>
                <span className="text-[#d8d8d8]">›</span>
              </button>
              {projectCreateMenuOpen && (
                <div className="absolute bottom-0 left-full z-50 ml-2 w-56 rounded-xl border border-white/10 bg-[#2f2f2f] p-2 shadow-lg transition-all duration-200">
                  <button
                    className="flex w-full items-center gap-2 rounded-lg px-4 py-2.5 text-left transition-all duration-200 hover:bg-white/10"
                    onClick={() => onCreateProject("managed")}
                  >
                    <Plus className="h-4 w-4" />新建空白项目
                  </button>
                  <button
                    className="flex w-full items-center gap-2 rounded-lg px-4 py-2.5 text-left transition-all duration-200 hover:bg-white/10"
                    onClick={() => onCreateProject("existing")}
                  >
                    <Folder className="h-4 w-4" />使用现有文件夹
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
      <ScrollArea className="min-h-0 flex-1 pr-2">
        <div className="space-y-4 pr-1">
          {conversationGroups.map((group) => (
            <div key={group.id || "unassigned"} className="space-y-2">
              <div className="group/project relative flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-medium text-[#dddddd] transition-all duration-200 hover:bg-white/5">
                <Folder className="h-3.5 w-3.5 shrink-0" />
                <span className="truncate">{projectById.get(group.id)?.is_pinned ? "★ " : ""}{group.name}</span>
                {group.id && projectById.has(group.id) && (
                  <button
                    aria-label="打开项目操作菜单"
                    className={`ml-auto grid h-6 w-6 shrink-0 place-items-center rounded-md transition-all duration-200 hover:bg-white/10 hover:text-white ${projectActionMenuId === group.id ? "opacity-100" : "opacity-0 group-hover/project:opacity-100"}`}
                    onClick={(event) => {
                      event.stopPropagation();
                      onToggleProjectActionMenu(group.id);
                    }}
                  >
                    <MoreHorizontal className="h-4 w-4" />
                  </button>
                )}
                {group.id && projectActionMenuId === group.id && projectById.get(group.id) && (
                  <div className="absolute right-1 top-9 z-50 w-52 rounded-xl border border-white/10 bg-[#2f2f2f] p-2 text-sm text-[#ececec] shadow-lg transition-all duration-200">
                    <button className="flex w-full items-center gap-2 rounded-lg px-4 py-2.5 text-left transition-all duration-200 hover:bg-white/10" onClick={() => onCreateConversationInProject(projectById.get(group.id) as Project)}>
                      <Plus className="h-4 w-4" />创建新会话
                    </button>
                    <button className="flex w-full items-center gap-2 rounded-lg px-4 py-2.5 text-left transition-all duration-200 hover:bg-white/10" onClick={() => onTogglePinProject(projectById.get(group.id) as Project)}>
                      <Pin className="h-4 w-4" />{projectById.get(group.id)?.is_pinned ? "取消置顶项目" : "置顶项目"}
                    </button>
                    <button className="flex w-full items-center gap-2 rounded-lg px-4 py-2.5 text-left transition-all duration-200 hover:bg-white/10" onClick={() => onOpenProjectFolder(projectById.get(group.id) as Project)}>
                      <FolderOpen className="h-4 w-4" />在资源管理器中打开
                    </button>
                    <button className="flex w-full items-center gap-2 rounded-lg px-4 py-2.5 text-left transition-all duration-200 hover:bg-white/10" onClick={() => onRenameProject(projectById.get(group.id) as Project)}>
                      <Pencil className="h-4 w-4" />重命名项目
                    </button>
                    <button className="flex w-full items-center gap-2 rounded-lg px-4 py-2.5 text-left transition-all duration-200 hover:bg-white/10" onClick={() => onArchiveProject(projectById.get(group.id) as Project)}>
                      <Archive className="h-4 w-4" />归档对话
                    </button>
                    <button className="flex w-full items-center gap-2 rounded-lg px-4 py-2.5 text-left text-red-300 transition-all duration-200 hover:bg-red-500/10" onClick={() => onRemoveProject(projectById.get(group.id) as Project)}>
                      <X className="h-4 w-4" />移除
                    </button>
                  </div>
                )}
              </div>
              {group.items.length === 0 ? (
                <div className="px-4 py-2.5 text-xs text-[#777]">暂无会话</div>
              ) : group.items.map((conversation) => (
                <div key={conversation.id} className="group relative">
                  <button
                    className={`w-full truncate rounded-lg py-2.5 pl-4 pr-10 text-left text-sm transition-all duration-200 ${mode !== "favorites" && conversation.id === conversationId ? "bg-white/10" : "hover:bg-white/5"}`}
                    onClick={() => onSelectConversation(conversation)}
                  >
                    {conversation.is_pinned ? "★ " : ""}{conversation.title}
                  </button>
                  <button
                    aria-label="打开会话操作菜单"
                    className={`absolute right-2 top-1/2 grid h-7 w-7 -translate-y-1/2 place-items-center rounded-md text-[#d8d8d8] transition-all duration-200 hover:bg-white/10 hover:text-white ${conversationMenuId === conversation.id ? "opacity-100" : "opacity-0 group-hover:opacity-100"}`}
                    onClick={(event) => {
                      event.stopPropagation();
                      onToggleConversationMenu(conversation.id);
                    }}
                  >
                    <MoreHorizontal className="h-4 w-4" />
                  </button>
                  {conversationMenuId === conversation.id && (
                    <div className="absolute right-2 top-10 z-50 w-40 rounded-xl border border-white/10 bg-[#2f2f2f] p-2 text-sm shadow-lg transition-all duration-200">
                      <button className="flex w-full items-center gap-2 rounded-lg px-4 py-2.5 text-left transition-all duration-200 hover:bg-white/10" onClick={() => onTogglePinConversation(conversation)}>
                        <Pin className="h-4 w-4" />{conversation.is_pinned ? "取消置顶" : "置顶"}
                      </button>
                      <button className="flex w-full items-center gap-2 rounded-lg px-4 py-2.5 text-left transition-all duration-200 hover:bg-white/10" onClick={() => onShareConversation(conversation)}>
                        <Share2 className="h-4 w-4" />分享
                      </button>
                      <button className="flex w-full items-center gap-2 rounded-lg px-4 py-2.5 text-left transition-all duration-200 hover:bg-white/10" onClick={() => onRenameConversation(conversation)}>
                        <Pencil className="h-4 w-4" />重命名
                      </button>
                      <button className="flex w-full items-center gap-2 rounded-lg px-4 py-2.5 text-left text-red-300 transition-all duration-200 hover:bg-red-500/10" onClick={() => onDeleteConversation(conversation)}>
                        <Trash2 className="h-4 w-4" />删除
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          ))}
        </div>

        {/* 管理中心区域 - 提供系统管理相关功能入口 */}
        <div className="mt-4 border-t border-white/10 pt-4">
          <div className="mb-2 px-3 text-xs font-medium text-[#999]">管理中心</div>
          <div className="space-y-1">
            {/* AI任务队列入口 */}
            <button
              className="flex w-full items-center gap-2 rounded-lg px-4 py-2.5 text-left text-sm transition-all duration-200 hover:bg-white/5"
              onClick={() => router.push('/ai-tasks')}
            >
              <ListTodo className="h-4 w-4 shrink-0 text-[#d8d8d8]" />
              <span>AI任务队列</span>
            </button>

            {/* 数据中心入口 */}
            <button
              className="flex w-full items-center gap-2 rounded-lg px-4 py-2.5 text-left text-sm transition-all duration-200 hover:bg-white/5"
              onClick={() => router.push('/data')}
            >
              <Database className="h-4 w-4 shrink-0 text-[#d8d8d8]" />
              <span>数据中心</span>
            </button>

            {/* 模型中心入口 */}
            <button
              className="flex w-full items-center gap-2 rounded-lg px-4 py-2.5 text-left text-sm transition-all duration-200 hover:bg-white/5"
              onClick={() => router.push('/models')}
            >
              <Box className="h-4 w-4 shrink-0 text-[#d8d8d8]" />
              <span>模型中心</span>
            </button>

            {/* 发布中心入口 */}
            <button
              className="flex w-full items-center gap-2 rounded-lg px-4 py-2.5 text-left text-sm transition-all duration-200 hover:bg-white/5"
              onClick={() => router.push('/publish')}
            >
              <Rocket className="h-4 w-4 shrink-0 text-[#d8d8d8]" />
              <span>发布准备</span>
            </button>
          </div>
        </div>

        {/* 底部功能区域 */}
        <div className="mt-4 border-t border-white/10 pt-4">
          {selectedProject && (
            <button
              className={`mb-2 flex w-full items-center gap-2 rounded-lg px-4 py-2.5 text-left text-sm transition-all duration-200 ${mode === "project" ? "bg-white/10" : "hover:bg-white/5"}`}
              onClick={() => onOpenProjectWorkbench("overview", selectedProject)}
            >
              <FolderOpen className="h-4 w-4" />项目工作台
            </button>
          )}
          <button
            className={`flex w-full items-center gap-2 rounded-lg px-4 py-2.5 text-left text-sm transition-all duration-200 ${mode === "favorites" ? "bg-white/10" : "hover:bg-white/5"}`}
            onClick={onOpenFavorites}
          >
            <Star className="h-4 w-4" />收藏
          </button>
        </div>
      </ScrollArea>
    </aside>
  );
}
