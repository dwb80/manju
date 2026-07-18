/**
 * @file ai-assistant.tsx
 * @description AI导演助手组件，提供快捷操作入口的浮动助手面板
 */
"use client";

import { memo, useState } from "react";
import { MessageCircle, X, Sparkles, FileText, Clapperboard, Image, Video, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

interface AIAssistantProps {
  onCreateProject?: () => void;
  onWriteScript?: () => void;
  onGenerateStoryboard?: () => void;
  onGenerateImage?: () => void;
  onGenerateVideo?: () => void;
  onViewFailedTasks?: () => void;
}

/**
 * AIAssistant - AI导演助手组件
 * @param {AIAssistantProps} props - 组件属性
 * @param {Function} props.onCreateProject - 创建项目回调
 * @param {Function} props.onWriteScript - 写剧本回调
 * @param {Function} props.onGenerateStoryboard - 生成分镜回调
 * @param {Function} props.onGenerateImage - 生成图片回调
 * @param {Function} props.onGenerateVideo - 生成视频回调
 * @param {Function} props.onViewFailedTasks - 查看失败任务回调
 * @returns {JSX.Element} 渲染的AI助手浮动面板
 */
export const AIAssistant = memo(function AIAssistant({
  onCreateProject,
  onWriteScript,
  onGenerateStoryboard,
  onGenerateImage,
  onGenerateVideo,
  onViewFailedTasks,
}: AIAssistantProps) {
  const [isOpen, setIsOpen] = useState(false);

  const quickActions = [
    { icon: Sparkles, label: "创建项目", onClick: onCreateProject, color: "text-emerald-400" },
    { icon: FileText, label: "写剧本", onClick: onWriteScript, color: "text-blue-400" },
    { icon: Clapperboard, label: "生成分镜", onClick: onGenerateStoryboard, color: "text-purple-400" },
    { icon: Image, label: "生成图片", onClick: onGenerateImage, color: "text-pink-400" },
    { icon: Video, label: "生成视频", onClick: onGenerateVideo, color: "text-orange-400" },
    { icon: AlertCircle, label: "查看失败任务", onClick: onViewFailedTasks, color: "text-red-400" },
  ];

  return (
    <>
      {/* 浮动按钮 */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="fixed bottom-6 right-6 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500 text-white shadow-lg shadow-emerald-500/30 transition-all hover:bg-emerald-600 hover:scale-110"
        aria-label="打开AI助手"
      >
        {isOpen ? (
          <X className="h-6 w-6" />
        ) : (
          <MessageCircle className="h-6 w-6" />
        )}
      </button>

      {/* 助手面板 */}
      {isOpen && (
        <div className="fixed bottom-24 right-6 z-50 w-80 rounded-2xl border border-white/10 bg-[#1a1a1a] p-4 shadow-2xl">
          {/* 头部 */}
          <div className="mb-4 flex items-center gap-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-500/20">
              <Sparkles className="h-5 w-5 text-emerald-400" />
            </div>
            <div>
              <div className="font-medium text-white">AI 导演助手</div>
              <div className="text-xs text-[#888]">今天需要帮你什么？</div>
            </div>
          </div>

          {/* 问候语 */}
          <div className="mb-4 rounded-lg bg-[#252525] p-3 text-sm text-[#ccc]">
            你好，我是 AI 导演助手。
            <br />
            我可以帮助你完成漫剧创作的各个环节，从剧本到发布全流程管理。
          </div>

          {/* 快捷操作列表 */}
          <div className="space-y-2">
            {quickActions.map((action, index) => (
              <button
                key={index}
                onClick={() => {
                  action.onClick?.();
                  setIsOpen(false);
                }}
                className="flex w-full items-center gap-3 rounded-lg border border-white/5 bg-[#252525] p-3 text-left transition-all hover:border-emerald-500/30 hover:bg-emerald-500/5"
              >
                <action.icon className={`h-5 w-5 ${action.color}`} />
                <span className="text-sm text-white">{action.label}</span>
              </button>
            ))}
          </div>

          {/* 底部提示 */}
          <div className="mt-4 text-center text-xs text-[#666]">
            点击任意操作开始创作
          </div>
        </div>
      )}
    </>
  );
});