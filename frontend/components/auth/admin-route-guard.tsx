"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { api } from "@/lib/api-client";

export function AdminRouteGuard({ children }: { children: ReactNode }) {
  const [state, setState] = useState<"loading" | "allowed" | "forbidden" | "login">("loading");

  useEffect(() => {
    let active = true;
    api<{ user: { role: string } }>("/api/auth/me", { cache: "no-store" })
      .then((result) => { if (active) setState(result.user.role === "admin" ? "allowed" : "forbidden"); })
      .catch(() => { if (active) setState("login"); });
    return () => { active = false; };
  }, []);

  if (state === "allowed") return <>{children}</>;
  if (state === "loading") return <main className="grid min-h-[60vh] place-items-center text-sm text-muted-foreground">正在校验管理员权限…</main>;
  return (
    <main className="grid min-h-[60vh] place-items-center px-6">
      <div className="max-w-md rounded-xl border border-border bg-muted p-6 text-center">
        <h1 className="text-lg font-semibold text-foreground">{state === "login" ? "需要登录" : "无管理员权限"}</h1>
        <p className="mt-2 text-sm text-muted-foreground">该页面包含系统配置和审计数据，仅管理员可访问。</p>
        <Link className="mt-4 inline-flex rounded-md bg-secondary px-4 py-2 text-sm text-secondary-foreground" href={state === "login" ? "/login" : "/"}>
          {state === "login" ? "前往登录" : "返回首页"}
        </Link>
      </div>
    </main>
  );
}
