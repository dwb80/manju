"use client";

/**
 * 场景一致性包页面
 *
 * 路由: /scenes/[id]/consistency-pack
 * - 拉取场景 → 渲染 7 图一致性包面板
 */

import { useEffect, useState, use } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Loader2, AlertTriangle } from "lucide-react";
import { ConsistencyPackPanel } from "@/components/assets/consistency-pack-panel";
import { api } from "@/lib/api-client";
import type { Scene } from "@/lib/module-types";

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

export default function SceneConsistencyPackPage({ params }: PageProps) {
  const router = useRouter();
  const { id } = use(params);

  const [scene, setScene] = useState<Scene | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await api<Scene>(`/api/scenes/${id}`, { method: "GET" });
        if (cancelled) return;
        if (!res) {
          setError("场景不存在或已删除");
          setLoading(false);
          return;
        }
        setScene(res);
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
        <p style={{ fontSize: 13, color: "#888" }}>正在加载场景「{id}」…</p>
      </div>
    );
  }

  if (error || !scene) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", background: "#0a0a0a", color: "white", gap: 16 }}>
        <AlertTriangle size={40} color="rgb(248,113,113)" />
        <h1 style={{ fontSize: 18, fontWeight: 500 }}>{error ?? "场景不存在"}</h1>
        <div style={{ display: "flex", gap: 8 }}>
          <button type="button" style={backLinkStyle} onClick={() => router.push("/scenes")}>
            <ArrowLeft size={14} />
            返回场景工厂
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
          <button type="button" style={backLinkStyle} onClick={() => router.push("/scenes")}>
            <ArrowLeft size={14} />
            场景工厂
          </button>
          <span style={{ color: "rgba(255,255,255,0.3)" }}>/</span>
          <span style={{ fontSize: 13, color: "rgba(255,255,255,0.6)" }}>场景「{scene.name}」</span>
          <span style={{ color: "rgba(255,255,255,0.3)" }}>/</span>
          <span style={{ fontSize: 13, color: "white" }}>一致性包</span>
        </div>
        <ConsistencyPackPanel
          entityType="scene"
          entityId={scene.id}
          entityName={scene.name}
        />
      </div>
    </div>
  );
}
