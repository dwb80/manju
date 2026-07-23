"use client";

/**
 * 角色一致性包页面
 *
 * 路由: /characters/[id]/consistency-pack
 * - 拉取角色 → 渲染 13 图一致性包面板
 * - 顶部"返回角色工厂"按钮
 *
 * 注意：Stream C 重构后 ui/button 等基础组件依赖未补齐，本页只用 HTML 原生
 * button 避免连锁 ModuleBuildError。
 */

import { useEffect, useState, use } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Loader2, AlertTriangle } from "lucide-react";
import { ConsistencyPackPanel } from "@/components/assets/consistency-pack-panel";
import { getCharacter } from "@/services/character.service";
import type { Character } from "@/lib/module-types";

interface PageProps {
  params: Promise<{ id: string }>;
}

const backLinkStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 4,
  padding: "6px 12px",
  borderRadius: 6,
  background: "transparent",
  color: "white",
  border: "1px solid rgba(255,255,255,0.15)",
  cursor: "pointer",
  fontSize: 13,
};

const primaryButtonStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 4,
  padding: "6px 12px",
  borderRadius: 6,
  background: "linear-gradient(135deg, rgb(34,197,94) 0%, rgb(16,185,129) 100%)",
  color: "white",
  border: "none",
  cursor: "pointer",
  fontSize: 13,
};

export default function CharacterConsistencyPackPage({ params }: PageProps) {
  const router = useRouter();
  const { id } = use(params);

  const [character, setCharacter] = useState<Character | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const ch = await getCharacter(id);
        if (cancelled) return;
        if (!ch) {
          setError("角色不存在或已删除");
          setLoading(false);
          return;
        }
        setCharacter(ch);
        setLoading(false);
      } catch (err) {
        if (cancelled) return;
        setError((err as Error)?.message ?? "加载失败");
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

  if (loading) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", background: "#0a0a0a", color: "white", gap: 12 }}>
        <Loader2 size={32} className="animate-spin" color="rgb(52,211,153)" />
        <p style={{ fontSize: 13, color: "#888" }}>正在加载角色「{id}」…</p>
      </div>
    );
  }

  if (error || !character) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", background: "#0a0a0a", color: "white", gap: 16 }}>
        <AlertTriangle size={40} color="rgb(248,113,113)" />
        <h1 style={{ fontSize: 18, fontWeight: 500 }}>{error ?? "角色不存在"}</h1>
        <div style={{ display: "flex", gap: 8 }}>
          <button type="button" style={backLinkStyle} onClick={() => router.push("/characters")}>
            <ArrowLeft size={14} />
            返回角色工厂
          </button>
          <button type="button" style={primaryButtonStyle} onClick={() => window.location.reload()}>
            重新加载
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", background: "#0a0a0a", color: "white", padding: "24px 32px" }}>
      <div style={{ maxWidth: 1280, margin: "0 auto", display: "flex", flexDirection: "column", gap: 24 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <button type="button" style={backLinkStyle} onClick={() => router.push("/characters")}>
            <ArrowLeft size={14} />
            角色工厂
          </button>
          <span style={{ color: "rgba(255,255,255,0.3)" }}>/</span>
          <span style={{ fontSize: 13, color: "rgba(255,255,255,0.6)" }}>角色「{character.name}」</span>
          <span style={{ color: "rgba(255,255,255,0.3)" }}>/</span>
          <span style={{ fontSize: 13, color: "white" }}>一致性包</span>
        </div>
        <ConsistencyPackPanel
          entityType="character"
          entityId={character.id}
          entityName={character.name}
        />
      </div>
    </div>
  );
}
