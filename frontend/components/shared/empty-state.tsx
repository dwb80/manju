"use client";

/**
 * 空状态组件
 *
 * 功能：
 * - 友好的空状态提示
 * - 支持自定义图标和操作
 * - 多种预设样式
 */

import { FolderOpen, Search, FileX, Inbox } from "lucide-react";
import { Button } from "@/components/ui/button";

type EmptyStateType = 'no-data' | 'no-results' | 'error' | 'default';

interface EmptyStateProps {
  type?: EmptyStateType;
  title?: string;
  description?: string;
  icon?: React.ComponentType<{ className?: string }>;
  action?: {
    label: string;
    onClick: () => void;
  };
  className?: string;
}

const emptyStateConfigs = {
  'no-data': {
    icon: FolderOpen,
    title: '暂无数据',
    description: '还没有任何内容，点击下方按钮创建',
  },
  'no-results': {
    icon: Search,
    title: '未找到结果',
    description: '尝试使用不同的关键词搜索',
  },
  'error': {
    icon: FileX,
    title: '加载失败',
    description: '数据加载失败，请稍后重试',
  },
  'default': {
    icon: Inbox,
    title: '暂无内容',
    description: '',
  },
};

export function EmptyState({
  type = 'default',
  title,
  description,
  icon,
  action,
  className = '',
}: EmptyStateProps) {
  const config = emptyStateConfigs[type];
  const Icon = icon || config.icon;
  const displayTitle = title || config.title;
  const displayDescription = description || config.description;

  return (
    <div className={`flex flex-col items-center justify-center py-12 ${className}`}>
      <div className="mb-4">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[#252525] border border-white/10">
          <Icon className="h-8 w-8 text-[#888]" />
        </div>
      </div>

      <h3 className="mb-2 text-lg font-medium text-white">
        {displayTitle}
      </h3>

      {displayDescription && (
        <p className="mb-4 text-sm text-[#888] text-center max-w-md">
          {displayDescription}
        </p>
      )}

      {action && (
        <Button onClick={action.onClick} variant="secondary" size="sm">
          {action.label}
        </Button>
      )}
    </div>
  );
}

/**
 * 加载状态组件
 */

interface LoadingStateProps {
  message?: string;
  className?: string;
}

export function LoadingState({
  message = "正在加载...",
  className = "",
}: LoadingStateProps) {
  return (
    <div className={`flex flex-col items-center justify-center py-12 ${className}`}>
      <div className="mb-4">
        <div className="h-8 w-8 rounded-full border-2 border-emerald-500 border-t-transparent animate-spin" />
      </div>
      <p className="text-sm text-[#888]">{message}</p>
    </div>
  );
}

/**
 * 错误状态组件
 */

interface ErrorStateProps {
  message?: string;
  onRetry?: () => void;
  className?: string;
}

export function ErrorState({
  message = "加载失败，请重试",
  onRetry,
  className = "",
}: ErrorStateProps) {
  return (
    <div className={`flex flex-col items-center justify-center py-12 ${className}`}>
      <div className="mb-4 text-red-400">
        <FileX className="h-12 w-12" />
      </div>
      <p className="mb-4 text-sm text-[#888]">{message}</p>
      {onRetry && (
        <Button onClick={onRetry} variant="secondary" size="sm">
          重新加载
        </Button>
      )}
    </div>
  );
}

/**
 * 空分镜状态组件
 */
export function EmptyStoryboards({ onCreateStoryboard }: { onCreateStoryboard?: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-10">
      <div className="mb-4">
        <div className="w-16 h-16 rounded-full bg-[#252525] border border-white/10 flex items-center justify-center">
          <Inbox className="h-8 w-8 text-[#888]" />
        </div>
      </div>
      <h3 className="text-base font-semibold text-white mb-2">暂无分镜</h3>
      <p className="text-sm text-[#888] mb-4">创建分镜开始您的创作</p>
      {onCreateStoryboard && (
        <Button onClick={onCreateStoryboard} size="sm">
          创建分镜
        </Button>
      )}
    </div>
  );
}

/**
 * 空剪辑状态组件
 */
export function EmptyClips({ onSyncClips }: { onSyncClips?: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-10">
      <div className="mb-4">
        <div className="w-16 h-16 rounded-full bg-[#252525] border border-white/10 flex items-center justify-center">
          <Inbox className="h-8 w-8 text-[#888]" />
        </div>
      </div>
      <h3 className="text-base font-semibold text-white mb-2">暂无剪辑条目</h3>
      <p className="text-sm text-[#888] mb-4">同步剪辑内容到项目</p>
      {onSyncClips && (
        <Button onClick={onSyncClips} size="sm">
          同步剪辑
        </Button>
      )}
    </div>
  );
}