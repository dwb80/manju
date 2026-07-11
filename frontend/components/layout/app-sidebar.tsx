"use client";

import { useState } from "react";
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
} from "lucide-react";

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

// 将菜单配置移到组件外部，避免每次渲染重新创建
const MENU_GROUPS: MenuGroup[] = [
  {
    id: "production",
    name: "AI生产中心",
    items: [
      { id: "script", name: "剧本中心", icon: FileText, href: "/scripts" },
      { id: "character", name: "角色工厂", icon: Users, href: "/characters" },
      { id: "scene", name: "场景工厂", icon: Image, href: "/scenes" },
      { id: "prop", name: "道具工厂", icon: Package, href: "/props" },
      { id: "storyboard", name: "分镜导演台", icon: Film, href: "/storyboards" },
      { id: "video-production", name: "视频生产线", icon: Video, href: "/video-production" },
      { id: "audio", name: "音频中心", icon: Music, href: "/audio" },
      { id: "clip", name: "剪辑中心", icon: Scissors, href: "/clips" },
    ],
  },
  {
    id: "management",
    name: "管理中心",
    items: [
      { id: "projects", name: "项目中心", icon: FolderOpen, href: "/projects" },
      { id: "review", name: "审核中心", icon: CheckCircle, href: "/review" },
      { id: "assets", name: "资产中心", icon: Database, href: "/assets" },
      { id: "models", name: "模型中心", icon: Settings, href: "/models" },
      { id: "publish", name: "发布中心", icon: Rocket, href: "/publish" },
    ],
  },
];

interface AppSidebarProps {
  currentPath?: string;
}

export function AppSidebar({ currentPath }: AppSidebarProps) {
  const router = useRouter();
  // 内部使用 usePathname 获取真实当前路径，避免 layout 传入空字符串导致菜单不高亮
  const pathname = usePathname();
  const activePath = currentPath || pathname || "";
  const [expandedGroups, setExpandedGroups] = useState<string[]>(["production", "management"]);

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
      <div className="flex items-center gap-3 border-b border-white/10 px-6 py-5">
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
          <button
            onClick={() => router.push("/settings")}
            className="rounded-lg p-1.5 hover:bg-white/10 transition-colors"
            aria-label="系统设置"
          >
            <Settings className="h-4 w-4" />
          </button>
        </div>
      </div>
    </aside>
  );
}