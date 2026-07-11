"use client";

import { useRef, useState, useCallback } from "react";

export interface ConfirmDialog {
  title: string;
  description: string;
  confirmLabel: string;
}

export function useNotice() {
  const [notice, setNotice] = useState("");
  const [confirmDialog, setConfirmDialog] = useState<ConfirmDialog | null>(null);
  const noticeTimerRef = useRef<number | null>(null);
  const confirmActionRef = useRef<(() => Promise<void> | void) | null>(null);

  /** 显示顶部临时提示，并在短时间后自动清空。 */
  const showNotice = useCallback((message: string) => {
    setNotice(message);
    if (noticeTimerRef.current) window.clearTimeout(noticeTimerRef.current);
    noticeTimerRef.current = window.setTimeout(() => setNotice(""), 2200);
  }, []);

  /** 打开统一确认弹层，用于删除、移除等危险操作。 */
  const requestConfirm = useCallback(
    (title: string, description: string, confirmLabel: string, action: () => Promise<void> | void) => {
      confirmActionRef.current = action;
      setConfirmDialog({ title, description, confirmLabel });
    },
    []
  );

  /** 执行确认弹层绑定的危险操作，并在完成后关闭弹层。 */
  const runConfirmAction = useCallback(async () => {
    const action = confirmActionRef.current;
    setConfirmDialog(null);
    confirmActionRef.current = null;
    if (action) await action();
  }, []);

  /** 关闭确认弹层。 */
  const closeConfirmDialog = useCallback(() => {
    confirmActionRef.current = null;
    setConfirmDialog(null);
  }, []);

  return {
    notice,
    confirmDialog,
    showNotice,
    requestConfirm,
    runConfirmAction,
    closeConfirmDialog,
  };
}
