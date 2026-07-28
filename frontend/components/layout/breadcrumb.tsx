"use client";

import { memo } from "react";
import { usePathname, useRouter } from "next/navigation";
import { ChevronRight, Home } from "lucide-react";

/** 路由段 → 中文标签映射 */
const routeLabels: Record<string, string> = {
  assistant: "AI 对话",
  projects: "项目中心",
  workbench: "项目工作台",
  "ai-tasks": "AI 任务队列",
  scripts: "剧本中心",
  characters: "角色工厂",
  scenes: "场景工厂",
  props: "道具工厂",
  storyboards: "分镜导演台",
  "video-production": "视频生产线",
  audio: "音频中心",
  clips: "剪辑中心",
  models: "模型中心",
  assets: "资产中心",
  data: "数据中心",
  review: "审核中心",
  quality: "质检中心",
  publish: "发布准备",
  pipeline: "流水线",
  todos: "待办事项",
  settings: "设置",
  logs: "日志",
  studio: "创意工作室",
  edit: "编辑",
  runs: "运行记录",
};

/** 顶级路由 → 业务分组，确保顶部栏提供生产上下文而不只是 URL 层级。 */
const routeGroups: Record<string, string> = {
  scripts: "生产创作",
  storyboards: "生产创作",
  characters: "生产创作",
  scenes: "生产创作",
  props: "生产创作",
  "video-production": "AI生产与后期",
  audio: "AI生产与后期",
  clips: "AI生产与后期",
  "ai-tasks": "AI生产与后期",
  review: "运营管控",
  quality: "运营管控",
  publish: "运营管控",
  data: "运营管控",
  models: "系统管理",
  settings: "系统管理",
  logs: "系统管理",
};

/** 动态 ID 段的上下文标签（当路径中出现 [id] 时，根据前缀推断） */
function resolveDynamicLabel(segments: string[], index: number): string {
  const current = segments[index];
  const prev = index > 0 ? segments[index - 1] : "";

  // 纯数字 ID 或 UUID → 显示"详情"
  if (/^\d+$/.test(current) || /^[a-f0-9-]{8,}$/i.test(current)) {
    if (prev === "scripts") return "剧本详情";
    if (prev === "videos") return "视频详情";
    if (prev === "images") return "图片详情";
    if (prev === "characters") return "角色详情";
    if (prev === "scenes") return "场景详情";
    if (prev === "props") return "道具详情";
    if (prev === "runs") return "运行详情";
    return "详情";
  }

  return routeLabels[current] ?? current;
}

interface BreadcrumbItem {
  label: string;
  href: string;
  isLast: boolean;
}

/** 从 pathname 构建面包屑列表 */
function buildBreadcrumbs(pathname: string): BreadcrumbItem[] {
  if (!pathname || pathname === "/") {
    return [{ label: "首页", href: "/", isLast: true }];
  }

  const segments = pathname.split("/").filter(Boolean);
  const items: BreadcrumbItem[] = [{ label: "首页", href: "/", isLast: false }];
  const group = routeGroups[segments[0]];
  if (group) items.push({ label: group, href: "", isLast: false });

  let path = "";
  segments.forEach((segment, index) => {
    path += `/${segment}`;
    const label = resolveDynamicLabel(segments, index);
    items.push({
      label,
      href: path,
      isLast: index === segments.length - 1,
    });
  });

  return items;
}

/**
 * Breadcrumb — 面包屑导航组件
 *
 * 根据当前 pathname 自动生成面包屑路径，支持点击导航。
 */
export const Breadcrumb = memo(function Breadcrumb() {
  const pathname = usePathname();
  const router = useRouter();

  const items = buildBreadcrumbs(pathname ?? "/");

  // 面包屑过长时只显示首页 + 当前页（中间用省略号）
  const displayItems = items.length > 4 ? [items[0], ...items.slice(-2)] : items;
  const hasEllipsis = items.length > 4;

  return (
    <nav aria-label="面包屑导航" className="flex min-w-0 items-center gap-1 text-sm">
      {displayItems.map((item, index) => {
        const showEllipsisBefore = hasEllipsis && index === 1;

        return (
          <div key={`${item.href}-${index}`} className="flex min-w-0 items-center gap-1">
            {showEllipsisBefore && (
              <>
                <span className="px-0.5 text-muted-foreground">…</span>
                <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground/50" />
              </>
            )}
            {index > 0 && !showEllipsisBefore && (
              <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground/50" />
            )}
            {index === 0 ? (
              <button
                onClick={() => router.push(item.href)}
                className="flex shrink-0 items-center gap-1 text-muted-foreground transition-colors hover:text-foreground"
                aria-label="首页"
              >
                <Home className="h-3.5 w-3.5" />
              </button>
            ) : item.isLast ? (
              <span className="truncate font-medium text-foreground" aria-current="page">
                {item.label}
              </span>
            ) : !item.href ? (
              <span className="truncate text-muted-foreground">{item.label}</span>
            ) : (
              <button
                onClick={() => router.push(item.href)}
                className="truncate text-muted-foreground transition-colors hover:text-foreground"
              >
                {item.label}
              </button>
            )}
          </div>
        );
      })}
    </nav>
  );
});

export default Breadcrumb;
