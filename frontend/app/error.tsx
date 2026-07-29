"use client";

import { useEffect } from "react";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function ErrorBoundary({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => { console.error("route error", error); }, [error]);
  return <main role="alert" className="grid min-h-[60vh] place-items-center p-6"><div className="max-w-lg rounded-xl border border-destructive/30 bg-destructive/10 p-6"><AlertTriangle className="mb-3 h-6 w-6 text-destructive" /><h1 className="font-semibold">页面加载失败</h1><p className="mt-2 text-sm text-muted-foreground">{error.message || "未预期错误。当前输入与本地草稿不会被自动清除。"}</p><Button className="mt-4" onClick={reset}>重试</Button></div></main>;
}

