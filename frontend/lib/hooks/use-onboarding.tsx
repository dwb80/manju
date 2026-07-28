/**
 * @file use-onboarding.tsx
 * @description 全局新手引导控制 hook + 按需挂载点
 *
 * P1 评审修复：
 * - 用 localStorage 记录 "completed / skipped"，避免重复打扰
 * - 任何位置可调用 useOpenOnboarding() 重新触发（例如设置页 "重新播放引导"）
 *
 * 用法：
 *   const open = useOpenOnboarding();
 *   <Button onClick={open}>重新播放引导</Button>
 */

"use client";

import { create } from "zustand";
import { OnboardingFlow } from "@/components/common/onboarding-flow";

const STORAGE_KEY = "manju:onboarding";

type OnboardingState = "pending" | "completed" | "skipped";

function writeStoredState(state: OnboardingState) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, state);
  } catch {
    // ignore
  }
}

interface OnboardingStore {
  open: boolean;
  initialStep: number;
  setOpen: (open: boolean) => void;
  setInitialStep: (step: number) => void;
}

const useOnboardingStore = create<OnboardingStore>((set) => ({
  open: false,
  initialStep: 0,
  setOpen: (open) => set({ open }),
  setInitialStep: (initialStep) => set({ initialStep }),
}));

/** 触发新手引导（用于"重新播放"等场景） */
export function useOpenOnboarding() {
  return () => {
    useOnboardingStore.getState().setInitialStep(0);
    useOnboardingStore.getState().setOpen(true);
  };
}

/** 重置引导状态（用于测试 / 调试） */
export function useResetOnboarding() {
  return () => {
    writeStoredState("pending");
  };
}

/**
 * 全局挂载点：仅由 useOpenOnboarding 主动触发，避免首次进入时打断任务。
 * 在 root layout 渲染一次即可。
 */
export function OnboardingHost() {
  const open = useOnboardingStore((s) => s.open);
  const setOpen = useOnboardingStore((s) => s.setOpen);
  const initialStep = useOnboardingStore((s) => s.initialStep);
  if (!open) return null;

  return (
    <OnboardingFlow
      initialStep={initialStep}
      onComplete={() => {
        writeStoredState("completed");
        setOpen(false);
      }}
      onSkip={() => {
        writeStoredState("skipped");
        setOpen(false);
      }}
    />
  );
}
