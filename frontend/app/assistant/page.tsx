/**
 * 智能助手页（/assistant）
 *
 * 侧栏一级入口"智能助手"的对应页面：把 AI 导演助手面板升格为独立工作区，
 * 集成对话能力（暂用快速操作卡片 + 入口跳转，保持与 dashboard/ai-assistant 一致的体验）。
 *
 * 设计原则：
 * - 复用 dashboard/AIAssistant 的快速操作，但布局更宽，支持嵌入式对话占位
 * - 后续可对接 chat-mode-section / chat-view 实现真正对话
 */

import { Bot, Sparkles, MessageSquare, Lightbulb, ArrowRight } from "lucide-react";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import { StandalonePageHeader } from "@/components/layout";
const quickActions = [
  {
    icon: Sparkles,
    title: "创建新项目",
    description: "从模板或空白画布快速立项",
    href: "/projects",
    color: "text-emerald-400",
    bg: "bg-emerald-500/10",
  },
  {
    icon: MessageSquare,
    title: "写剧本",
    description: "AI 拆解、生成剧集大纲与对白",
    href: "/scripts",
    color: "text-blue-400",
    bg: "bg-blue-500/10",
  },
  {
    icon: Lightbulb,
    title: "生成分镜",
    description: "剧本自动拆分镜头并推荐景别/运镜",
    href: "/storyboards",
    color: "text-purple-400",
    bg: "bg-purple-500/10",
  },
  {
    icon: Bot,
    title: "AI 任务队列",
    description: "查看生图/生视频任务进度与失败诊断",
    href: "/ai-tasks",
    color: "text-amber-400",
    bg: "bg-amber-500/10",
  },
];

export default function AssistantPage() {
  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6 p-6">
      <StandalonePageHeader
        title="智能助手"
        description="AI 协作的入口：快速发起任务、查询生产状态、获得导演级建议"
      />

      {/* 欢迎语 */}
      <Card className="border-white/10 bg-[#1f1f1f] p-6">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-500/20">
            <Sparkles className="h-5 w-5 text-emerald-400" />
          </div>
          <div className="min-w-0">
            <h2 className="text-base font-semibold text-white">你好，导演</h2>
            <p className="mt-1 text-sm text-neutral-400">
              今天需要帮你什么？从下方选择一个快捷操作开始，或前往对话面板与 AI 协同创作。
            </p>
          </div>
        </div>
      </Card>

      {/* 快捷操作 */}
      <div>
        <h3 className="mb-3 text-sm font-medium text-neutral-400">快捷操作</h3>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {quickActions.map((action) => {
            const Icon = action.icon;
            return (
              <Link
                key={action.href}
                href={action.href}
                className="group block"
              >
                <Card className="flex items-start gap-4 border-white/10 bg-[#1a1a1a] p-5 transition-colors hover:border-white/20 hover:bg-[#222]">
                  <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${action.bg}`}>
                    <Icon className={`h-5 w-5 ${action.color}`} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <h4 className="text-sm font-semibold text-white">{action.title}</h4>
                      <ArrowRight className="h-4 w-4 text-neutral-500 transition-transform group-hover:translate-x-1 group-hover:text-white" />
                    </div>
                    <p className="mt-1 text-xs text-neutral-400">{action.description}</p>
                  </div>
                </Card>
              </Link>
            );
          })}
        </div>
      </div>

      {/* 对话占位 */}
      <Card className="border-dashed border-white/10 bg-[#161616] p-6">
        <div className="mb-3 flex items-center gap-2">
          <MessageSquare className="h-4 w-4 text-neutral-500" />
          <h3 className="text-sm font-medium text-neutral-300">AI 对话（即将上线）</h3>
        </div>
        <p className="text-xs leading-relaxed text-neutral-500">
          即将接入流式对话与多模态输入，支持剧本分析、角色/场景生成、镜头建议、成本预估等能力。
          当前可先通过 <Link className="text-emerald-400 underline" href="/scripts">剧本中心</Link>、
          <Link className="ml-1 text-emerald-400 underline" href="/characters">角色工厂</Link>
          等模块使用具体 AI 功能。
        </p>
      </Card>
    </div>
  );
}
