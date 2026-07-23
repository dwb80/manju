"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import {
  Home,
  FolderOpen,
  FileText,
  Users,
  Image,
  Film,
  Video,
  Music,
  Package,
  CheckCircle,
  Database,
  Settings,
  Rocket,
  ChevronDown,
  ChevronRight,
  Scissors,
  ListChecks,
  Cpu,
  LayoutGrid,
  Wallet,
  BarChart3,
  Inbox,
  CheckSquare,
  Bot,
  ShieldCheck,
} from "lucide-react";
import { api } from "@/lib/api-client";

/**
 * 主应用侧边栏导航组件
 *
 * 功能：
 * - 显示主要功能模块导航
 * - 支持路由跳转
 * - 高亮当前激活菜单
 * - 响应式设计
 */

type MenuItem = {
  id: string;
  name: string;
  icon: React.ComponentType<{ className?: string }>;
  href?: string;
  badge?: string;
};

type MenuGroup = {
  id: string;
  name: string;
  icon?: React.ComponentType<{ className?: string }>;
  items: MenuItem[];
};

// 菜单配置（移到组件外部，避免每次渲染重新创建）
//
// 评审优化记录：
// - v2 (P0)：将"模型中心"从"管理中心"归位到"AI生产中心"（按业务语义，模型属于生产链路）
// - v2 (P0)：在"AI生产中心"补"AI任务队列"入口（此前仅在首页跳转）
// - v2 (P1)：侧边栏三大分组重组：
//     · 生产创作：直接产生内容的链路（剧本 → 工厂 → 后期）
//     · 资产与数据：沉淀的资产与监控数据
//     · 运营与管控：流程闭环（项目、审核、发布）
const MENU_GROUPS: MenuGroup[] = [
  // 第一组：生产创作（按内容生产链路）
  {
    id: "production",
    name: "生产创作",
    icon: LayoutGrid,
    items: [
      { id: "ai-tasks", name: "AI 任务队列", icon: ListChecks, href: "/ai-tasks" },
      { id: "script", name: "剧本中心", icon: FileText, href: "/scripts" },
      { id: "character", name: "角色工厂", icon: Users, href: "/characters" },
      { id: "scene", name: "场景工厂", icon: Image, href: "/scenes" },
      { id: "prop", name: "道具工厂", icon: Package, href: "/props" },
      { id: "storyboard", name: "分镜导演台", icon: Film, href: "/storyboards" },
      { id: "video-production", name: "视频生产线", icon: Video, href: "/video-production" },
      { id: "audio", name: "音频中心", icon: Music, href: "/audio" },
      { id: "clip", name: "剪辑中心", icon: Scissors, href: "/clips" },
      { id: "models", name: "模型中心", icon: Cpu, href: "/models" },
    ],
  },
  // 第二组：资产与数据（沉淀层）
  {
    id: "assets",
    name: "资产与数据",
    icon: Wallet,
    items: [
      { id: "assets", name: "资产中心", icon: Database, href: "/assets" },
      { id: "data", name: "数据中心", icon: BarChart3, href: "/data" },
    ],
  },
  // 第三组：运营与管控（流程闭环）
  {
    id: "operations",
    name: "运营与管控",
    icon: Inbox,
    items: [
      { id: "projects", name: "项目中心", icon: FolderOpen, href: "/projects" },
      { id: "review", name: "审核中心", icon: CheckCircle, href: "/review" },
      { id: "quality", name: "质检中心", icon: ShieldCheck, href: "/quality" },
      { id: "publish", name: "发布准备", icon: Rocket, href: "/publish" },
    ],
  },
];

interface AppSidebarProps {
  currentPath?: string;
}

/**
 * AppSidebar - 主应用侧边栏导航
 * @param {AppSidebarProps} props - 组件属性
 * @returns {JSX.Element} 渲染的侧边栏元素
 */
export function AppSidebar({ currentPath }: AppSidebarProps) {
  const router = useRouter();
  const [isAdmin, setIsAdmin] = useState(false);
  // 内部使用 usePathname 获取真实当前路径，避免 layout 传入空字符串导致菜单不高亮
  const pathname = usePathname();

  useEffect(() => {
    let active = true;
    api<{ user: { role: string } }>("/api/auth/me", { cache: "no-store" })
      .then((result) => { if (active) setIsAdmin(result.user.role === "admin"); })
      .catch(() => { if (active) setIsAdmin(false); });
    return () => { active = false; };
  }, []);
  const activePath = currentPath || pathname || "";
  // 默认展开所有分组
  const [expandedGroups, setExpandedGroups] = useState<string[]>([
    "production",
    "assets",
    "operations",
  ]);

  const handleToggleGroup = (groupId: string) => {
    setExpandedGroups((prev) =>
      prev.includes(groupId)
        ? prev.filter((id) => id !== groupId)
        : [...prev, groupId]
    );
  };

  const handleItemClick = (item: MenuItem) => {
    if (item.href) {
      router.push(item.href);
    }
  };

  return (
    <aside className="flex h-screen w-64 flex-col border-r border-white/10 bg-[#181818]">
      {/* Logo区域 */}
      <div className="flex h-16 shrink-0 items-center gap-3 border-b border-white/10 px-6">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-600">
          <Film className="h-6 w-6 text-white" />
        </div>
        <div>
          <div className="text-base font-bold text-white leading-tight">AI漫剧工业化</div>
          <div className="text-base font-bold text-white leading-tight">生产平台</div>
        </div>
      </div>

      {/* 菜单列表 */}
      <nav className="flex-1 overflow-y-auto px-3 py-4">
        {/* 驾驶舱一级菜单 */}
        <div className="mb-4">
          <button
            onClick={() => router.push("/")}
            className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-all ${activePath === "/"
                ? "bg-emerald-500/10 text-emerald-400 border-l-2 border-emerald-500"
                : "text-[#ccc] hover:bg-white/5 hover:text-white"
              }`}
            aria-current={activePath === "/" ? "page" : "false"}
          >
            <Home className={`h-4 w-4 ${activePath === "/" ? "text-emerald-400" : "text-[#888]"}`} />
            <span className="flex-1 text-left">驾驶舱</span>
          </button>

          {/* 我的待办：个人维度的一级菜单（评审优化 P1） */}
          <button
            onClick={() => router.push("/todos")}
            className={`mt-1 flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-all ${activePath.startsWith("/todos")
                ? "bg-emerald-500/10 text-emerald-400 border-l-2 border-emerald-500"
                : "text-[#ccc] hover:bg-white/5 hover:text-white"
              }`}
            aria-current={activePath.startsWith("/todos") ? "page" : "false"}
          >
            <CheckSquare className={`h-4 w-4 ${activePath.startsWith("/todos") ? "text-emerald-400" : "text-[#888]"}`} />
            <span className="flex-1 text-left">我的待办</span>
          </button>

          {/* 智能助手：AI 交互中心 */}
          <button
            onClick={() => router.push("/assistant")}
            className={`mt-1 flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-all ${activePath.startsWith("/assistant")
                ? "bg-emerald-500/10 text-emerald-400 border-l-2 border-emerald-500"
                : "text-[#ccc] hover:bg-white/5 hover:text-white"
              }`}
            aria-current={activePath.startsWith("/assistant") ? "page" : "false"}
          >
            <Bot className={`h-4 w-4 ${activePath.startsWith("/assistant") ? "text-emerald-400" : "text-[#888]"}`} />
            <span className="flex-1 text-left">智能助手</span>
          </button>
        </div>

        {/* 其他分组菜单 */}
        {MENU_GROUPS.map((group) => {
          const isExpanded = expandedGroups.includes(group.id);
          const GroupIcon = group.icon;

          return (
            <div key={group.id} className="mb-4">
              {/* 组标题 */}
              {group.name && (
                <button
                  onClick={() => handleToggleGroup(group.id)}
                  className="flex w-full items-center justify-between px-3 py-2 text-xs font-medium text-[#888] hover:text-white transition-colors"
                  aria-expanded={isExpanded}
                  aria-label={group.name}
                >
                  <span className="flex items-center gap-2">
                    {GroupIcon && <GroupIcon className="h-4 w-4" />}
                    {group.name}
                  </span>
                  {isExpanded ? (
                    <ChevronDown className="h-4 w-4" />
                  ) : (
                    <ChevronRight className="h-4 w-4" />
                  )}
                </button>
              )}

              {/* 组内菜单项 */}
              {isExpanded && (
                <div className="mt-1 space-y-1">
                  {group.items.map((item) => {
                    const ItemIcon = item.icon;
                    const isActive = activePath === item.href;

                    return (
                      <button
                        key={item.id}
                        onClick={() => handleItemClick(item)}
                        className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-all ${isActive
                          ? "bg-emerald-500/10 text-emerald-400 border-l-2 border-emerald-500"
                          : "text-[#ccc] hover:bg-white/5 hover:text-white"
                          }`}
                        aria-current={isActive ? "page" : "false"}
                      >
                        <ItemIcon className={`h-4 w-4 ${isActive ? "text-emerald-400" : "text-[#888]"}`} />
                        <span className="flex-1 text-left">{item.name}</span>
                        {item.badge && (
                          <span className="rounded bg-emerald-500/20 px-1.5 py-0.5 text-xs text-emerald-400">
                            {item.badge}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </nav>

      {/* 底部状态栏 */}
      <div className="border-t border-white/10 px-4 py-3">
        <div className="flex items-center justify-between text-xs text-[#888]">
          <div className="flex items-center gap-2">
            <div className="h-2 w-2 rounded-full bg-emerald-500" />
            <span>系统正常</span>
          </div>
          {isAdmin && <>
            <button
              onClick={() => router.push("/settings")}
              className={`inline-flex items-center gap-1.5 rounded-lg px-2 py-1 transition-colors ${
                activePath.startsWith("/settings")
                  ? "bg-emerald-500/10 text-emerald-400"
                  : "hover:bg-white/10"
              }`}
              aria-label="系统管理"
            >
              <Settings className="h-4 w-4" />
              <span>系统管理</span>
            </button>
            <button
              onClick={() => router.push("/logs")}
              className={`inline-flex items-center gap-1.5 rounded-lg px-2 py-1 transition-colors ${
                activePath.startsWith("/logs")
                  ? "bg-emerald-500/10 text-emerald-400"
                  : "hover:bg-white/10"
              }`}
              aria-label="审计日志"
            >
              <span>审计日志</span>
            </button>
          </>}
        </div>
      </div>
    </aside>
  );
}
