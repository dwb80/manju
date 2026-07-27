"use client";

/**
 * @file command-palette.tsx
 * @description 命令面板（⌘K / Ctrl+K）
 *
 * - 提供 ⌘K / Ctrl+K 快捷键和编程式 openCommandPalette() 入口
 * - 内置页面跳转命令（基于前端 app/ 目录的真实路由）
 * - 模糊匹配 + 键盘上下选择 + Enter 执行
 * - 命令可在 CONFIG 中扩展，未来接入 actions、模态框触发等
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Command,
  CornerDownLeft,
  FileText,
  Image as ImageIcon,
  LayoutDashboard,
  Mic2,
  Sparkles,
  Wand2,
  ListTodo,
  Settings,
  Boxes,
  FolderKanban,
  Film,
  MessageSquare,
  ClipboardCheck,
  BookOpen,
  Users,
  Database,
  Activity,
  ShieldCheck,
  ChevronRight,
} from "lucide-react";
import { cn } from "@/lib/utils";

/* ----------------------------- 类型 & 配置 ----------------------------- */

type CommandKind = "navigate" | "action";

interface CommandItem {
  id: string;
  title: string;
  description?: string;
  group: string;
  icon: React.ComponentType<{ className?: string }>;
  keywords?: string[];
  kind: CommandKind;
  /** navigate: 跳转路径；action: 触发自定义回调（未来扩展用） */
  payload: string | (() => void);
}

/**
 * 内置命令表：标题、描述、分组、图标、关键词用于搜索。
 * 这里只罗列真实存在的路由，避免出现点击后 404 的占位命令。
 */
const COMMANDS: CommandItem[] = [
  {
    id: "go-home",
    title: "前往首页",
    description: "工作台总览",
    group: "页面",
    icon: LayoutDashboard,
    keywords: ["首页", "home", "dashboard", "工作台"],
    kind: "navigate",
    payload: "/",
  },
  {
    id: "go-studio",
    title: "创作工作台",
    description: "聊天 / 图片 / 视频生成",
    group: "页面",
    icon: Sparkles,
    keywords: ["studio", "创作", "工作台", "聊天", "ai"],
    kind: "navigate",
    payload: "/studio",
  },
  {
    id: "go-todos",
    title: "我的待办",
    description: "跨项目待办与回收站",
    group: "页面",
    icon: ListTodo,
    keywords: ["todo", "待办", "任务", "回收站"],
    kind: "navigate",
    payload: "/todos",
  },
  {
    id: "go-assistant",
    title: "AI 助手",
    description: "剧本 / 分镜 / 角色助手",
    group: "页面",
    icon: MessageSquare,
    keywords: ["assistant", "助手", "ai", "对话"],
    kind: "navigate",
    payload: "/assistant",
  },
  {
    id: "go-projects",
    title: "项目管理",
    description: "项目列表与详情",
    group: "页面",
    icon: FolderKanban,
    keywords: ["project", "项目"],
    kind: "navigate",
    payload: "/projects",
  },
  {
    id: "go-scripts",
    title: "剧本中心",
    description: "剧本列表与编辑",
    group: "页面",
    icon: BookOpen,
    keywords: ["script", "剧本"],
    kind: "navigate",
    payload: "/scripts",
  },
  {
    id: "go-storyboards",
    title: "分镜",
    description: "分镜与镜头管理",
    group: "页面",
    icon: Film,
    keywords: ["storyboard", "分镜", "镜头"],
    kind: "navigate",
    payload: "/storyboards",
  },
  {
    id: "go-characters",
    title: "角色",
    description: "角色设定与一致性",
    group: "页面",
    icon: Users,
    keywords: ["character", "角色", "一致性"],
    kind: "navigate",
    payload: "/characters",
  },
  {
    id: "go-props",
    title: "道具",
    description: "道具库与一致性",
    group: "页面",
    icon: Boxes,
    keywords: ["prop", "道具"],
    kind: "navigate",
    payload: "/props",
  },
  {
    id: "go-scenes",
    title: "场景",
    description: "场景库",
    group: "页面",
    icon: Wand2,
    keywords: ["scene", "场景"],
    kind: "navigate",
    payload: "/scenes",
  },
  {
    id: "go-assets",
    title: "资产中心",
    description: "图片 / 视频 / 音频资产",
    group: "页面",
    icon: ImageIcon,
    keywords: ["asset", "资产", "素材"],
    kind: "navigate",
    payload: "/assets",
  },
  {
    id: "go-images",
    title: "图片任务",
    description: "图片生成历史",
    group: "页面",
    icon: ImageIcon,
    keywords: ["image", "图片"],
    kind: "navigate",
    payload: "/images",
  },
  {
    id: "go-videos",
    title: "视频任务",
    description: "视频生成历史",
    group: "页面",
    icon: Film,
    keywords: ["video", "视频"],
    kind: "navigate",
    payload: "/videos",
  },
  {
    id: "go-audio",
    title: "音频",
    description: "音频与配音",
    group: "页面",
    icon: Mic2,
    keywords: ["audio", "音频", "配音", "tts"],
    kind: "navigate",
    payload: "/audio",
  },
  {
    id: "go-clips",
    title: "剪辑",
    description: "视频剪辑",
    group: "页面",
    icon: Film,
    keywords: ["clip", "剪辑", "编辑"],
    kind: "navigate",
    payload: "/clips",
  },
  {
    id: "go-publish",
    title: "发布计划",
    description: "发布排期与多平台",
    group: "页面",
    icon: FileText,
    keywords: ["publish", "发布", "排期"],
    kind: "navigate",
    payload: "/publish",
  },
  {
    id: "go-pipeline",
    title: "Pipeline",
    description: "生成流水线",
    group: "页面",
    icon: Activity,
    keywords: ["pipeline", "流水线", "run"],
    kind: "navigate",
    payload: "/pipeline",
  },
  {
    id: "go-ai-tasks",
    title: "AI 任务",
    description: "异步 AI 任务监控",
    group: "页面",
    icon: Activity,
    keywords: ["ai task", "任务", "异步"],
    kind: "navigate",
    payload: "/ai-tasks",
  },
  {
    id: "go-models",
    title: "模型管理",
    description: "AI 模型与配置",
    group: "页面",
    icon: Sparkles,
    keywords: ["model", "模型", "ai"],
    kind: "navigate",
    payload: "/models",
  },
  {
    id: "go-quality",
    title: "质量评审",
    description: "剧本 / 分镜 / 视频评审",
    group: "页面",
    icon: ShieldCheck,
    keywords: ["quality", "质量", "评审"],
    kind: "navigate",
    payload: "/quality",
  },
  {
    id: "go-review",
    title: "审稿工作台",
    description: "审稿任务与打分",
    group: "页面",
    icon: ClipboardCheck,
    keywords: ["review", "审稿", "打分"],
    kind: "navigate",
    payload: "/review",
  },
  {
    id: "go-data",
    title: "数据概览",
    description: "业务指标与统计",
    group: "页面",
    icon: Database,
    keywords: ["data", "数据", "指标"],
    kind: "navigate",
    payload: "/data",
  },
  {
    id: "go-logs",
    title: "系统日志",
    description: "运行日志与异常",
    group: "页面",
    icon: Activity,
    keywords: ["log", "日志", "异常"],
    kind: "navigate",
    payload: "/logs",
  },
  {
    id: "go-settings",
    title: "系统设置",
    description: "全局偏好与配置",
    group: "页面",
    icon: Settings,
    keywords: ["settings", "设置", "配置", "偏好"],
    kind: "navigate",
    payload: "/settings",
  },
];

/* ---------------------------- 编程式入口 ----------------------------- */

const isMac =
  typeof navigator !== "undefined" &&
  /mac/i.test(navigator.platform);

/**
 * 编程式打开命令面板。
 * 触发一个自定义事件，由挂载的 CommandPalette 实例响应。
 */
export function openCommandPalette(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent("app:open-command-palette"));
}

/* ----------------------------- 组件实现 ----------------------------- */

/**
 * 简易模糊匹配：所有关键字都得在 haystack 中出现（大小写不敏感）。
 */
function matches(query: string, item: CommandItem): boolean {
  if (!query) return true;
  const q = query.trim().toLowerCase();
  if (!q) return true;
  const haystack = [
    item.title,
    item.description ?? "",
    item.group,
    ...(item.keywords ?? []),
  ]
    .join("\n")
    .toLowerCase();
  return q
    .split(/\s+/)
    .filter(Boolean)
    .every((token) => haystack.includes(token));
}

export function CommandPalette() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // 关闭时清空 query
  useEffect(() => {
    if (!open) {
      setQuery("");
      setActiveIndex(0);
    } else {
      // 打开时让 input 自动获得焦点
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [open]);

  // 过滤 + 分组
  const filtered = useMemo(() => {
    return COMMANDS.filter((c) => matches(query, c));
  }, [query]);

  // 分组渲染
  const grouped = useMemo(() => {
    const map = new Map<string, CommandItem[]>();
    for (const item of filtered) {
      const list = map.get(item.group) ?? [];
      list.push(item);
      map.set(item.group, list);
    }
    return Array.from(map.entries());
  }, [filtered]);

  // 保证 activeIndex 始终在有效范围内
  useEffect(() => {
    if (activeIndex >= filtered.length) {
      setActiveIndex(0);
    }
  }, [filtered, activeIndex]);

  // 让可视 active 行滚入视图
  useEffect(() => {
    if (!open) return;
    const root = listRef.current;
    if (!root) return;
    const node = root.querySelector<HTMLElement>(
      `[data-cmd-index="${activeIndex}"]`,
    );
    node?.scrollIntoView({ block: "nearest" });
  }, [activeIndex, open]);

  // 关闭面板
  const close = useCallback(() => setOpen(false), []);

  // 执行选中的命令
  const runCommand = useCallback(
    (item: CommandItem) => {
      close();
      if (item.kind === "navigate") {
        router.push(item.payload as string);
        return;
      }
      if (item.kind === "action" && typeof item.payload === "function") {
        try {
          (item.payload as () => void)();
        } catch (err) {
          // 静默失败：自定义 action 的错误由各自实现处理
          console.error("[CommandPalette] action error", err);
        }
      }
    },
    [close, router],
  );

  // 快捷键 + 自定义事件监听
  useEffect(() => {
    if (typeof window === "undefined") return;
    const onKey = (e: KeyboardEvent) => {
      const meta = e.metaKey || e.ctrlKey;
      if (meta && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((v) => !v);
      } else if (e.key === "Escape" && open) {
        e.preventDefault();
        close();
      }
    };
    const onCustom = () => setOpen(true);
    window.addEventListener("keydown", onKey);
    window.addEventListener(
      "app:open-command-palette",
      onCustom as EventListener,
    );
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener(
        "app:open-command-palette",
        onCustom as EventListener,
      );
    };
  }, [open, close]);

  // 输入框键盘事件：上下选择 / Enter 执行
  const onInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => (filtered.length === 0 ? 0 : (i + 1) % filtered.length));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) =>
        filtered.length === 0 ? 0 : (i - 1 + filtered.length) % filtered.length,
      );
    } else if (e.key === "Enter") {
      e.preventDefault();
      const target = filtered[activeIndex];
      if (target) runCommand(target);
    }
  };

  if (!open) return null;

  const shortcutLabel = isMac ? "⌘K" : "Ctrl+K";

  // 计算每个项在扁平列表中的 index（用于高亮 + 滚动）
  const flatIndex = new Map<string, number>();
  filtered.forEach((c, i) => flatIndex.set(c.id, i));

  return (
    <div
      className="fixed inset-0 z-[100] flex items-start justify-center bg-black/60 px-4 pt-[12vh]"
      onClick={close}
      role="dialog"
      aria-modal="true"
      aria-label="命令面板"
    >
      <div
        className="bg-[#1a1a1a] border border-white/15 rounded-xl shadow-2xl w-[36rem] max-w-full overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 搜索输入 */}
        <div className="flex items-center gap-2 px-4 py-3 border-b border-white/10">
          <Command className="h-4 w-4 text-white/50 shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setActiveIndex(0);
            }}
            onKeyDown={onInputKeyDown}
            placeholder="输入命令、页面或关键词…"
            className="flex-1 bg-transparent border-none outline-none text-sm text-white placeholder:text-white/40"
            aria-label="命令搜索"
            autoComplete="off"
            spellCheck={false}
          />
          <kbd className="text-[10px] text-white/40 border border-white/10 px-1.5 py-0.5 rounded">
            {shortcutLabel}
          </kbd>
        </div>

        {/* 结果列表 */}
        <div
          ref={listRef}
          className="max-h-[60vh] overflow-y-auto py-2"
          role="listbox"
        >
          {filtered.length === 0 ? (
            <div className="px-6 py-12 text-center text-sm text-white/40">
              未找到匹配「{query}」的命令
            </div>
          ) : (
            grouped.map(([group, items]) => (
              <div key={group} className="mb-1">
                <div className="px-4 pt-2 pb-1 text-[10px] uppercase tracking-wider text-white/40">
                  {group}
                </div>
                {items.map((item) => {
                  const idx = flatIndex.get(item.id) ?? 0;
                  const Icon = item.icon;
                  const active = idx === activeIndex;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      data-cmd-index={idx}
                      role="option"
                      aria-selected={active}
                      onMouseEnter={() => setActiveIndex(idx)}
                      onClick={() => runCommand(item)}
                      className={cn(
                        "w-full flex items-center gap-3 px-4 py-2 text-left transition-colors",
                        active
                          ? "bg-emerald-500/15 text-white"
                          : "text-white/80 hover:bg-white/5",
                      )}
                    >
                      <span
                        className={cn(
                          "grid h-7 w-7 shrink-0 place-items-center rounded-md border",
                          active
                            ? "border-emerald-500/50 bg-emerald-500/10 text-emerald-300"
                            : "border-white/10 bg-white/5 text-white/60",
                        )}
                      >
                        <Icon className="h-3.5 w-3.5" />
                      </span>
                      <span className="flex-1 min-w-0">
                        <span className="block text-sm truncate">
                          {item.title}
                        </span>
                        {item.description && (
                          <span className="block text-[11px] text-white/40 truncate">
                            {item.description}
                          </span>
                        )}
                      </span>
                      {active && (
                        <CornerDownLeft className="h-3.5 w-3.5 text-emerald-300" />
                      )}
                      {!active && (
                        <ChevronRight className="h-3.5 w-3.5 text-white/20" />
                      )}
                    </button>
                  );
                })}
              </div>
            ))
          )}
        </div>

        {/* 底部提示 */}
        <div className="flex items-center justify-between border-t border-white/10 px-4 py-2 text-[10px] text-white/40">
          <div className="flex items-center gap-3">
            <span>
              <kbd className="border border-white/10 px-1 rounded">↑↓</kbd> 选择
            </span>
            <span>
              <kbd className="border border-white/10 px-1 rounded">Enter</kbd> 执行
            </span>
            <span>
              <kbd className="border border-white/10 px-1 rounded">Esc</kbd> 关闭
            </span>
          </div>
          <span>{filtered.length} 条结果</span>
        </div>
      </div>
    </div>
  );
}

export default CommandPalette;
