"use client";

import { useEffect, useState } from "react";
import { CheckCircle, Loader2, XCircle, X } from "lucide-react";

type ToastType = "success" | "progress" | "error" | "action";

type ToastAction = {
  label: string;
  onClick: () => void;
};

type ToastProps = {
  /** Toast 类型：success（成功）、progress（进度）、error（错误）、action（带操作按钮） */
  type: ToastType;
  /** 标题 */
  title: string;
  /** 描述文本 */
  description?: string;
  /** 进度百分比（仅在 type 为 progress 时有效，0-100） */
  progress?: number;
  /** 取消回调（仅在 type 为 progress 时有效） */
  onCancel?: () => void;
  /** 显示时长（毫秒），仅在 type 为 success/error/action 时有效，默认 3000ms */
  duration?: number;
  /** Toast ID */
  id: string;
  /** 关闭回调 */
  onClose: (id: string) => void;
  /** 操作按钮（仅在 type 为 action 时有效，比如"撤销"） */
  action?: ToastAction;
};

/**
 * Toast 消息组件：提供清晰的操作反馈。
 *
 * 支持三种类型：
 * - success：成功提示，自动消失
 * - progress：进度提示，显示进度条，可取消
 * - error：错误提示，自动消失
 *
 * @param type - Toast 类型
 * @param title - 标题
 * @param description - 描述文本
 * @param progress - 进度百分比（0-100）
 * @param onCancel - 取消回调
 * @param duration - 显示时长（毫秒）
 * @param id - Toast ID
 * @param onClose - 关闭回调
 *
 * @example
 * ```tsx
 * <Toast
 *   id="toast-1"
 *   type="success"
 *   title="操作成功"
 *   description="项目已创建"
 *   onClose={(id) => removeToast(id)}
 * />
 * ```
 */
export function Toast({ type, title, description, progress, onCancel, duration = 3000, id, onClose, action }: ToastProps) {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    if (type === "success" || type === "error" || type === "action") {
      const timer = setTimeout(() => {
        setVisible(false);
        setTimeout(() => onClose(id), 300);
      }, duration);
      return () => clearTimeout(timer);
    }
  }, [type, duration, id, onClose]);

  const typeStyles = {
    success: "border-emerald-500/30 bg-emerald-500/10 text-emerald-100",
    progress: "border-blue-500/30 bg-blue-500/10 text-blue-100",
    error: "border-red-500/30 bg-red-500/10 text-red-100",
    action: "border-amber-500/30 bg-amber-500/10 text-amber-100",
  };

  const typeIcons = {
    success: <CheckCircle className="h-5 w-5 text-emerald-400" />,
    progress: <Loader2 className="h-5 w-5 animate-spin text-blue-400" />,
    error: <XCircle className="h-5 w-5 text-red-400" />,
    action: <CheckCircle className="h-5 w-5 text-amber-400" />,
  };

  return (
    <div
      className={`fixed right-4 bottom-4 z-50 flex min-w-[320px] max-w-md items-start gap-3 rounded-xl border ${typeStyles[type]} p-4 shadow-lg backdrop-blur transition-all duration-300 ${
        visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
      }`}
    >
      {/* 图标 */}
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/10">{typeIcons[type]}</div>

      {/* 内容 */}
      <div className="min-w-0 flex-1">
        <div className="text-sm font-semibold">{title}</div>
        {description && <div className="mt-1 text-xs opacity-80">{description}</div>}

        {/* 进度条 */}
        {type === "progress" && progress !== undefined && (
          <div className="mt-3">
            <div className="h-2 rounded-full bg-white/10">
              <div className="h-full rounded-full bg-blue-500 transition-all duration-200" style={{ width: `${progress}%` }} />
            </div>
            <div className="mt-1.5 text-xs opacity-80">{progress}% 完成</div>
          </div>
        )}

        {/* 操作按钮（撤销等） */}
        {type === "action" && action && (
          <button
            type="button"
            onClick={() => {
              action.onClick();
              setVisible(false);
              setTimeout(() => onClose(id), 300);
            }}
            className="mt-2 inline-flex items-center rounded-md border border-amber-400/40 bg-amber-500/20 px-3 py-1 text-xs font-medium text-amber-100 hover:bg-amber-500/30 transition-colors"
          >
            {action.label}
          </button>
        )}
      </div>

      {/* 操作按钮 */}
      {type === "progress" && onCancel && (
        <button
          className="shrink-0 flex h-8 w-8 items-center justify-center rounded-lg bg-white/10 text-white/60 transition-colors hover:bg-white/20 hover:text-white"
          onClick={onCancel}
          aria-label="取消"
        >
          <X className="h-4 w-4" />
        </button>
      )}

      {/* 关闭按钮 */}
      {(type === "success" || type === "error") && (
        <button
          className="shrink-0 flex h-8 w-8 items-center justify-center rounded-lg bg-white/10 text-white/60 transition-colors hover:bg-white/20 hover:text-white"
          onClick={() => {
            setVisible(false);
            setTimeout(() => onClose(id), 300);
          }}
          aria-label="关闭"
        >
          <X className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}

type ToastItem = {
  id: string;
  type: ToastType;
  title: string;
  description?: string;
  progress?: number;
  onCancel?: () => void;
  duration?: number;
};

/** Toast 容器：管理多个 Toast 消息。 */
export function ToastContainer() {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  // 全局方法：添加 Toast
  const addToast = (toast: Omit<ToastItem, "id">) => {
    const id = `toast-${crypto.randomUUID()}`;
    setToasts((items) => [...items, { ...toast, id }]);
    return id;
  };

  // 全局方法：更新 Toast（用于进度）
  const updateToast = (id: string, updates: Partial<ToastItem>) => {
    setToasts((items) => items.map((item) => (item.id === id ? { ...item, ...updates } : item)));
  };

  // 全局方法：移除 Toast
  const removeToast = (id: string) => {
    setToasts((items) => items.filter((item) => item.id !== id));
  };

  // 挂载全局实例
  useEffect(() => {
    if (typeof window !== "undefined") {
      (window as any).__toastContainer = {
        addToast,
        updateToast,
        removeToast,
      };
    }
  }, []);

  return (
    <div className="fixed right-0 bottom-0 z-50 flex flex-col gap-2 p-4">
      {toasts.map((toast) => (
        <Toast
          key={toast.id}
          id={toast.id}
          type={toast.type}
          title={toast.title}
          description={toast.description}
          progress={toast.progress}
          onCancel={toast.onCancel}
          duration={toast.duration}
          onClose={removeToast}
        />
      ))}
    </div>
  );
}

/**
 * 全局 Toast API：便于在任何地方调用 Toast 消息。
 *
 * 使用方法：
 * ```tsx
 * // 显示成功消息
 * toast.success("操作成功", "项目已创建");
 *
 * // 显示进度消息并更新
 * const progressId = toast.progress("正在处理", "请稍候...");
 * toast.updateProgress(progressId, 50);
 * toast.updateProgress(progressId, 100);
 * toast.remove(progressId);
 *
 * // 显示错误消息
 * toast.error("操作失败", "请重试");
 * ```
 */
export const toast = {
  /**
   * 显示成功消息
   * @param title - 标题
   * @param description - 描述文本
   * @param duration - 显示时长（毫秒），默认 3000ms
   * @returns Toast ID
   */
  success: (title: string, description?: string, duration?: number) => {
    if (typeof window !== "undefined" && (window as any).__toastContainer) {
      return (window as any).__toastContainer.addToast({ type: "success", title, description, duration });
    }
    return "";
  },

  /**
   * 显示进度消息
   * @param title - 标题
   * @param description - 描述文本
   * @param onCancel - 取消回调
   * @returns Toast ID
   */
  progress: (title: string, description?: string, onCancel?: () => void) => {
    if (typeof window !== "undefined" && (window as any).__toastContainer) {
      return (window as any).__toastContainer.addToast({ type: "progress", title, description, progress: 0, onCancel });
    }
    return "";
  },

  /**
   * 更新进度
   * @param id - Toast ID
   * @param progress - 进度百分比（0-100）
   */
  updateProgress: (id: string, progress: number) => {
    if (typeof window !== "undefined" && (window as any).__toastContainer) {
      (window as any).__toastContainer.updateToast(id, { progress });
    }
  },

  /**
   * 显示错误消息
   * @param title - 标题
   * @param description - 描述文本
   * @param duration - 显示时长（毫秒），默认 3000ms
   * @returns Toast ID
   */
  error: (title: string, description?: string, duration?: number) => {
    if (typeof window !== "undefined" && (window as any).__toastContainer) {
      return (window as any).__toastContainer.addToast({ type: "error", title, description, duration });
    }
    return "";
  },

  /**
   * 移除 Toast
   * @param id - Toast ID
   */
  remove: (id: string) => {
    if (typeof window !== "undefined" && (window as any).__toastContainer) {
      (window as any).__toastContainer.removeToast(id);
    }
  },

  /**
   * 显示带操作按钮的 Toast（如"已删除，点击撤销"）
   * @param title - 标题
   * @param description - 描述文本
   * @param action - 操作按钮
   * @param duration - 显示时长（毫秒），默认 5000ms
   * @returns Toast ID
   */
  action: (title: string, action: ToastAction, description?: string, duration = 5000) => {
    if (typeof window !== "undefined" && (window as any).__toastContainer) {
      return (window as any).__toastContainer.addToast({ type: "action", title, description, action, duration });
    }
    return "";
  },
};