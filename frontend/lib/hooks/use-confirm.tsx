/**
 * @file use-confirm.tsx
 * @description 全局确认对话框 hook（消除 window.confirm 依赖）
 *
 * P1 评审修复：
 * - 收敛 window.confirm → 统一 ConfirmDialog
 * - 提供 useConfirm() hook，让业务代码以 await 形式编写确认逻辑
 *
 * 用法：
 *   const confirm = useConfirm();
 *   if (await confirm({ title: "...", description: "..." })) {
 *     // 确认后逻辑
 *   }
 */

"use client";

import { create } from "zustand";
import { useEffect, useState } from "react";
import { ConfirmDialog } from "@/components/common/confirm-dialog";

interface ConfirmRequest {
  title: string;
  description: string;
  confirmLabel?: string;
  resolve: (ok: boolean) => void;
}

interface ConfirmStore {
  request: ConfirmRequest | null;
  setRequest: (r: ConfirmRequest | null) => void;
}

const useConfirmStore = create<ConfirmStore>((set) => ({
  request: null,
  setRequest: (request) => set({ request }),
}));

export interface ConfirmOptions {
  title: string;
  description: string;
  confirmLabel?: string;
}

export function useConfirm() {
  return (options: ConfirmOptions): Promise<boolean> => {
    return new Promise<boolean>((resolve) => {
      useConfirmStore.getState().setRequest({ ...options, resolve });
    });
  };
}

/**
 * 全局挂载点，需要在 root layout 中渲染一次
 */
export function ConfirmDialogHost() {
  const request = useConfirmStore((s) => s.request);
  const setRequest = useConfirmStore((s) => s.setRequest);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted || !request) return null;

  return (
    <ConfirmDialog
      title={request.title}
      description={request.description}
      confirmLabel={request.confirmLabel ?? "确认"}
      onClose={() => {
        const r = request.resolve;
        setRequest(null);
        r(false);
      }}
      onConfirm={() => {
        const r = request.resolve;
        setRequest(null);
        r(true);
      }}
    />
  );
}
