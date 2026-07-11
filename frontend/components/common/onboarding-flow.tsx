"use client";

import { useState, useEffect } from "react";
import { ChevronRight, ChevronLeft, X, Sparkles, FolderOpen, BarChart3, Rocket, CheckCircle, Video, Image } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * 新手引导流程组件
 *
 * 功能：
 * - 5步快速入门教程
 * - 可跳过和重新播放
 * - 记录用户完成状态
 * - 支持断点续播
 */

type OnboardingStep = {
  id: string;
  title: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  content: React.ReactNode;
  action?: {
    label: string;
    onClick: () => void;
  };
};

interface OnboardingFlowProps {
  onComplete: () => void;
  onSkip: () => void;
  initialStep?: number;
}

export function OnboardingFlow({ onComplete, onSkip, initialStep = 0 }: OnboardingFlowProps) {
  const [currentStep, setCurrentStep] = useState(initialStep);
  const [isVisible, setIsVisible] = useState(true);

  // 引导步骤定义
  const steps: OnboardingStep[] = [
    {
      id: "welcome",
      title: "欢迎来到 Agnes AI Studio",
      description: "AI漫剧创作项目管理系统，让创作更简单",
      icon: Sparkles,
      content: <WelcomeContent />,
    },
    {
      id: "features",
      title: "核心功能",
      description: "了解系统的主要功能模块",
      icon: FolderOpen,
      content: <FeaturesContent />,
    },
    {
      id: "create-project",
      title: "创建第一个项目",
      description: "开始您的漫剧创作之旅",
      icon: Rocket,
      content: <CreateProjectContent />,
      action: {
        label: "创建项目",
        onClick: () => {
          window.location.href = "/?action=create-project";
        },
      },
    },
    {
      id: "ai-creation",
      title: "体验AI创作",
      description: "感受AI辅助创作的魅力",
      icon: Sparkles,
      content: <AICreationContent />,
      action: {
        label: "开始创作",
        onClick: () => {
          window.location.href = "/?mode=chat";
        },
      },
    },
    {
      id: "complete",
      title: "准备就绪",
      description: "您已经了解了核心功能",
      icon: CheckCircle,
      content: <CompleteContent />,
    },
  ];

  const handleNext = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
      localStorage.setItem("onboarding_progress", String(currentStep + 1));
    } else {
      handleComplete();
    }
  };

  const handlePrevious = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleComplete = () => {
    setIsVisible(false);
    localStorage.setItem("onboarding_completed", "true");
    onComplete();
  };

  const handleSkip = () => {
    setIsVisible(false);
    localStorage.setItem("onboarding_skipped", "true");
    onSkip();
  };

  if (!isVisible) return null;

  const CurrentIcon = steps[currentStep].icon;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
      <div className="relative w-full max-w-2xl rounded-2xl border border-white/10 bg-[#1a1a1a] p-8 shadow-2xl">
        {/* 关闭按钮 */}
        <button
          onClick={handleSkip}
          className="absolute right-4 top-4 rounded-lg p-2 text-[#888] hover:bg-white/10 hover:text-white"
          aria-label="跳过引导"
        >
          <X className="h-5 w-5" />
        </button>

        {/* 进度指示器 */}
        <div className="mb-8 flex justify-center gap-2">
          {steps.map((step, index) => (
            <div
              key={step.id}
              className={`h-2 w-12 rounded-full transition-all ${index <= currentStep ? "bg-emerald-500" : "bg-white/10"
                }`}
            />
          ))}
        </div>

        {/* 步骤内容 */}
        <div className="text-center">
          {/* 图标 */}
          <div className="mb-6 flex justify-center">
            <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-500/20 to-emerald-600/10">
              <CurrentIcon className="h-10 w-10 text-emerald-400" />
            </div>
          </div>

          {/* 标题 */}
          <h2 className="mb-2 text-2xl font-bold text-white">
            {steps[currentStep].title}
          </h2>

          {/* 描述 */}
          <p className="mb-6 text-sm text-[#888]">
            {steps[currentStep].description}
          </p>

          {/* 内容区 */}
          <div className="mb-8 min-h-[200px]">
            {steps[currentStep].content}
          </div>

          {/* 操作按钮 */}
          <div className="flex justify-center gap-4">
            {currentStep > 0 && (
              <Button variant="secondary" onClick={handlePrevious}>
                <ChevronLeft className="mr-2 h-4 w-4" />
                上一步
              </Button>
            )}

            {steps[currentStep].action && (
              <Button variant="default" onClick={steps[currentStep].action.onClick}>
                {steps[currentStep].action.label}
              </Button>
            )}

            <Button variant="default" onClick={handleNext}>
              {currentStep < steps.length - 1 ? (
                <>
                  下一步
                  <ChevronRight className="ml-2 h-4 w-4" />
                </>
              ) : (
                "开始使用"
              )}
            </Button>
          </div>

          {/* 跳过链接 */}
          <button
            onClick={handleSkip}
            className="mt-4 text-xs text-[#666] hover:text-[#888]"
          >
            跳过引导，稍后再看
          </button>
        </div>
      </div>
    </div>
  );
}

// 步骤内容组件
function WelcomeContent() {
  return (
    <div className="space-y-4 text-left">
      <div className="rounded-lg border border-white/10 bg-white/5 p-4">
        <h3 className="mb-2 font-semibold text-white">🎬 AI漫剧工业化生产平台</h3>
        <p className="text-sm text-[#888]">
          从剧本到发布的全流程管理，AI辅助让创作更高效
        </p>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-lg bg-[#252525] p-3 text-center">
          <div className="text-2xl font-bold text-emerald-400">30%</div>
          <div className="text-xs text-[#888]">效率提升</div>
        </div>
        <div className="rounded-lg bg-[#252525] p-3 text-center">
          <div className="text-2xl font-bold text-blue-400">10+</div>
          <div className="text-xs text-[#888]">AI模型</div>
        </div>
        <div className="rounded-lg bg-[#252525] p-3 text-center">
          <div className="text-2xl font-bold text-purple-400">24/7</div>
          <div className="text-xs text-[#888]">在线服务</div>
        </div>
      </div>
    </div>
  );
}

function FeaturesContent() {
  const features = [
    { icon: Sparkles, name: "AI辅助创作", desc: "智能对话、图片生成、视频制作" },
    { icon: FolderOpen, name: "项目管理", desc: "剧本、分镜、资产一体化管理" },
    { icon: BarChart3, name: "数据分析", desc: "成本监控、效率分析、团队绩效" },
  ];

  return (
    <div className="space-y-3">
      {features.map((feature) => {
        const Icon = feature.icon;
        return (
          <div key={feature.name} className="flex items-start gap-3 rounded-lg border border-white/10 bg-white/5 p-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#252525]">
              <Icon className="h-5 w-5 text-emerald-400" />
            </div>
            <div>
              <div className="font-medium text-white">{feature.name}</div>
              <div className="text-xs text-[#888]">{feature.desc}</div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function CreateProjectContent() {
  return (
    <div className="space-y-4">
      <div className="rounded-lg border-2 border-dashed border-emerald-500/30 bg-emerald-500/5 p-6 text-center">
        <FolderOpen className="mx-auto mb-3 h-12 w-12 text-emerald-400" />
        <p className="text-sm text-[#888]">
          创建您的第一个漫剧项目，开始AI辅助创作之旅
        </p>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <div className="rounded-lg bg-[#252525] p-3 text-center text-xs">
          <div className="font-medium text-white">现代都市</div>
          <div className="text-[#666]">模板</div>
        </div>
        <div className="rounded-lg bg-[#252525] p-3 text-center text-xs">
          <div className="font-medium text-white">古风武侠</div>
          <div className="text-[#666]">模板</div>
        </div>
        <div className="rounded-lg bg-[#252525] p-3 text-center text-xs">
          <div className="font-medium text-white">科幻冒险</div>
          <div className="text-[#666]">模板</div>
        </div>
      </div>
    </div>
  );
}

function AICreationContent() {
  return (
    <div className="space-y-4">
      <div className="rounded-lg bg-[#252525] p-4">
        <div className="mb-3 flex items-center gap-2">
          <div className="h-8 w-8 rounded-full bg-emerald-500/20" />
          <div className="text-sm font-medium text-white">AI助手</div>
        </div>
        <div className="rounded-lg bg-[#1a1a1a] p-3 text-sm text-[#ccc]">
          "我可以帮助您生成角色设定、场景图片和动画片段。您只需要描述您想要的内容..."
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-lg border border-white/10 bg-[#252525] p-3">
          <div className="flex items-center gap-2 mb-1">
            <Image className="h-4 w-4 text-emerald-400" />
            <div className="text-xs text-[#888]">图片生成</div>
          </div>
          <div className="text-sm text-white">平均45秒</div>
        </div>
        <div className="rounded-lg border border-white/10 bg-[#252525] p-3">
          <div className="flex items-center gap-2 mb-1">
            <Video className="h-4 w-4 text-blue-400" />
            <div className="text-xs text-[#888]">视频生成</div>
          </div>
          <div className="text-sm text-white">平均3分钟</div>
        </div>
      </div>
    </div>
  );
}

function CompleteContent() {
  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-6 text-center">
        <CheckCircle className="mx-auto mb-3 h-12 w-12 text-emerald-400" />
        <p className="text-sm text-[#888]">
          您已经了解了系统的核心功能，可以开始创作了！
        </p>
      </div>

      <div className="rounded-lg bg-[#252525] p-4">
        <div className="mb-2 text-xs font-medium text-white">快捷键提示</div>
        <div className="space-y-1 text-xs text-[#888]">
          <div><kbd className="rounded bg-white/10 px-1.5 py-0.5 text-white">Ctrl</kbd> + <kbd className="rounded bg-white/10 px-1.5 py-0.5 text-white">K</kbd> 全局搜索</div>
          <div><kbd className="rounded bg-white/10 px-1.5 py-0.5 text-white">Ctrl</kbd> + <kbd className="rounded bg-white/10 px-1.5 py-0.5 text-white">N</kbd> 新建项目</div>
          <div><kbd className="rounded bg-white/10 px-1.5 py-0.5 text-white">?</kbd> 查看帮助</div>
        </div>
      </div>
    </div>
  );
}