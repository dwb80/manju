/**
 * @file error-boundary.tsx
 * @description 全局错误边界组件，捕获React组件渲染错误并显示友好的错误提示页面
 */

"use client";

import React from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * 全局错误边界组件
 * 
 * 功能：
 * - 捕获React组件渲染错误
 * - 显示友好的错误提示页面
 * - 提供重新加载按钮
 * - 记录错误日志
 * 
 * 使用方法：
 * ```tsx
 * <ErrorBoundary>
 *   <App />
 * </ErrorBoundary>
 * ```
 */

interface ErrorBoundaryProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: React.ErrorInfo | null;
}

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    // 更新状态以显示降级UI
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    // 记录错误日志
    console.error("ErrorBoundary caught an error:", error, errorInfo);
    
    // 可以在这里发送错误日志到监控系统
    // logErrorToService(error, errorInfo);
    
    this.setState({
      errorInfo,
    });
  }

  handleReload = () => {
    // 重置错误状态
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });
    
    // 刷新页面
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      // 如果提供了自定义降级UI，则使用它
      if (this.props.fallback) {
        return this.props.fallback;
      }

      // 默认错误UI
      return (
        <div className="min-h-screen bg-[#181818] flex items-center justify-center px-4">
          <div className="max-w-md w-full">
            {/* 错误图标 */}
            <div className="flex justify-center mb-6">
              <div className="w-20 h-20 rounded-full bg-red-500/10 border border-red-500/30 flex items-center justify-center">
                <AlertTriangle className="h-10 w-10 text-red-400" />
              </div>
            </div>

            {/* 错误标题 */}
            <div className="text-center mb-6">
              <h1 className="text-2xl font-bold text-white mb-2">
                页面加载失败
              </h1>
              <p className="text-sm text-[#888]">
                应用遇到了一个意外错误，请刷新页面重试
              </p>
            </div>

            {/* 错误详情（开发环境） */}
            {process.env.NODE_ENV === "development" && this.state.error && (
              <div className="mb-6 p-4 rounded-lg bg-[#1a1a1a] border border-white/10">
                <div className="text-xs text-[#888] mb-2 font-medium">
                  错误详情：
                </div>
                <pre className="text-xs text-red-400 overflow-auto">
                  {this.state.error.toString()}
                </pre>
                {this.state.errorInfo && (
                  <pre className="text-xs text-[#666] mt-2 overflow-auto">
                    {this.state.errorInfo.componentStack}
                  </pre>
                )}
              </div>
            )}

            {/* 操作按钮 */}
            <div className="flex justify-center gap-3">
              <Button
                variant="secondary"
                onClick={() => window.history.back()}
              >
                返回上一页
              </Button>
              <Button
                variant="default"
                onClick={this.handleReload}
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                刷新页面
              </Button>
            </div>

            {/* 帮助提示 */}
            <div className="mt-6 text-center">
              <p className="text-xs text-[#666]">
                如果问题持续存在，请联系技术支持
              </p>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

/**
 * 错误回退组件（用于Suspense）
 */
export function ErrorFallback({ error, resetErrorBoundary }: { error: Error; resetErrorBoundary: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[400px] px-4">
      <div className="w-16 h-16 rounded-full bg-red-500/10 border border-red-500/30 flex items-center justify-center mb-4">
        <AlertTriangle className="h-8 w-8 text-red-400" />
      </div>
      <h3 className="text-lg font-semibold text-white mb-2">
        组件加载失败
      </h3>
      <p className="text-sm text-[#888] mb-4 text-center max-w-md">
        {error.message || "组件渲染过程中发生错误"}
      </p>
      <Button
        variant="secondary"
        onClick={resetErrorBoundary}
      >
        <RefreshCw className="h-4 w-4 mr-2" />
        重试
      </Button>
    </div>
  );
}