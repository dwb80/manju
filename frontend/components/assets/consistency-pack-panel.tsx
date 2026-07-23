"use client";

/**
 * @file consistency-pack-panel.tsx
 * @description V2 MOD-ASSET FEAT-ASSET-011/012/013 一致性包主面板
 *
 * - 4 参考 + 6 表情 + 3 角度 = 13 张图（角色）
 * - 4 参考 + 3 角度 = 7 张图（场景/道具）
 * - 异步生成（202 Accepted + packId）
 * - 3 秒轮询状态
 * - 单图重生命令
 *
 * 注意：本组件只用 HTML 原生 button + inline style，不依赖 `@/components/ui/*`。
 * 原因：Stream C 重构留下 ui/button-variants 等多个缺失文件，引入会触发
 * ModuleBuildError 阻塞整个 dev server build（与 W4 一致性包无关）。
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Loader2, RefreshCw, Sparkles, AlertTriangle, Image as ImageIcon, Clock } from "lucide-react";
import {
  CONSISTENCY_IMAGE_LABELS,
  type ConsistencyImageStatus,
  type ConsistencyImageType,
  type ConsistencyPackImage,
  type ConsistencyPackSnapshot,
} from "@/lib/app-types";
import {
  CONSISTENCY_TYPES_PER_ENTITY,
  generateConsistencyPack,
  getConsistencyPack,
  regeneratePackImage,
  type ConsistencyEntityType,
} from "@/services/consistency-pack.service";

interface ConsistencyPackPanelProps {
  entityType: ConsistencyEntityType;
  entityId: string;
  entityName?: string;
}

const POLL_INTERVAL_MS = 3000;

const STATUS_LABELS: Record<ConsistencyImageStatus, string> = {
  pending: "待生成",
  generating: "生成中",
  success: "已完成",
  failed: "失败",
};

const STATUS_TONE: Record<ConsistencyImageStatus, { bg: string; border: string; text: string }> = {
  pending: { bg: "rgba(255,255,255,0.05)", border: "rgba(255,255,255,0.10)", text: "rgba(255,255,255,0.5)" },
  generating: { bg: "rgba(34,211,238,0.15)", border: "rgba(34,211,238,0.40)", text: "rgb(165,243,252)" },
  success: { bg: "rgba(16,185,129,0.15)", border: "rgba(16,185,129,0.40)", text: "rgb(167,243,208)" },
  failed: { bg: "rgba(239,68,68,0.15)", border: "rgba(239,68,68,0.40)", text: "rgb(252,165,165)" },
};

const buttonStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: "6px",
  padding: "6px 14px",
  borderRadius: "6px",
  border: "1px solid rgba(255,255,255,0.15)",
  background: "rgba(255,255,255,0.05)",
  color: "white",
  fontSize: "13px",
  cursor: "pointer",
  transition: "all 0.15s",
};

const buttonPrimaryStyle: React.CSSProperties = {
  ...buttonStyle,
  background: "linear-gradient(135deg, rgb(34,197,94) 0%, rgb(16,185,129) 100%)",
  border: "none",
  color: "white",
};

const buttonDisabledStyle: React.CSSProperties = {
  ...buttonStyle,
  opacity: 0.4,
  cursor: "not-allowed",
};

export function ConsistencyPackPanel({ entityType, entityId, entityName }: ConsistencyPackPanelProps) {
  const expectedTypes = useMemo(() => CONSISTENCY_TYPES_PER_ENTITY[entityType], [entityType]);
  const [snapshot, setSnapshot] = useState<ConsistencyPackSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);
  const [regenerating, setRegenerating] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<{ type: "success" | "error"; title: string; description: string } | null>(null);
  const pollTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const total = expectedTypes.length;
  const images = snapshot?.images ?? [];
  const completed = images.filter((i) => i.status === "success").length;
  const failed = images.filter((i) => i.status === "failed").length;
  const pending = images.filter((i) => i.status === "pending" || i.status === "generating").length;
  const progressPct = images.length > 0 ? Math.round((completed / total) * 100) : 0;
  const isWorking = pending > 0;

  // 简易 toast
  const showToast = useCallback((type: "success" | "error", title: string, description: string) => {
    setToast({ type, title, description });
    setTimeout(() => setToast(null), 3500);
  }, []);

  // 加载当前一致性包
  const refresh = useCallback(
    async (silent = false) => {
      try {
        if (!silent) setLoading(true);
        const data = await getConsistencyPack(entityType, entityId);
        setSnapshot(data);
        setError(null);
      } catch (err) {
        setError((err as Error)?.message ?? "加载一致性包失败");
      } finally {
        if (!silent) setLoading(false);
      }
    },
    [entityType, entityId],
  );

  useEffect(() => {
    refresh();
  }, [refresh]);

  // 轮询：仅在有进行中的图时
  useEffect(() => {
    if (pollTimer.current) {
      clearTimeout(pollTimer.current);
      pollTimer.current = null;
    }
    if (!isWorking) return;
    pollTimer.current = setTimeout(() => {
      refresh(true);
    }, POLL_INTERVAL_MS);
    return () => {
      if (pollTimer.current) {
        clearTimeout(pollTimer.current);
        pollTimer.current = null;
      }
    };
  }, [isWorking, refresh, images.length, completed, failed]);

  // 启动 / 重新生成整包
  const handleStart = useCallback(
    async (regenerate: boolean) => {
      try {
        setStarting(true);
        const result = await generateConsistencyPack(entityType, entityId, { regenerate });
        showToast("success", regenerate ? "已重新生成" : "已启动", `共 ${result.total} 张图，packId=${result.packId.slice(0, 12)}…`);
        await refresh(true);
      } catch (err) {
        showToast("error", "启动失败", (err as Error)?.message ?? "请稍后重试");
      } finally {
        setStarting(false);
      }
    },
    [entityType, entityId, refresh, showToast],
  );

  // 单图重生
  const handleRegenerateOne = useCallback(
    async (image: ConsistencyPackImage) => {
      try {
        setRegenerating(image.id);
        await regeneratePackImage(image.id);
        showToast("success", "已提交重生", `${STATUS_LABELS[image.status]} → 重新生成`);
        await refresh(true);
      } catch (err) {
        showToast("error", "重生失败", (err as Error)?.message ?? "请稍后重试");
      } finally {
        setRegenerating(null);
      }
    },
    [refresh, showToast],
  );

  if (loading) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: "80px 0", gap: 12, color: "rgba(255,255,255,0.7)" }}>
        <Loader2 size={20} className="animate-spin" />
        <span>正在加载一致性包…</span>
      </div>
    );
  }

  if (error && !snapshot) {
    return (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "80px 0", gap: 12 }}>
        <AlertTriangle size={32} color="rgb(248,113,113)" />
        <p style={{ color: "rgba(255,255,255,0.8)" }}>{error}</p>
        <button type="button" style={buttonStyle} onClick={() => refresh()}>
          <RefreshCw size={14} /> 重试
        </button>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      {/* 头部：标题 + 操作 */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 16 }}>
        <div>
          <h2 style={{ fontSize: 20, fontWeight: 500, color: "white", display: "flex", alignItems: "center", gap: 8, margin: 0 }}>
            <Sparkles size={20} color="rgb(252,211,77)" />
            一致性包 · {entityName ?? entityId}
          </h2>
          <p style={{ fontSize: 13, color: "rgba(255,255,255,0.5)", marginTop: 4 }}>
            4 标准参考图 {entityType === "character" ? "+ 6 表情 + 3 角度" : "+ 3 角度"} = {total} 张图
          </p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <button type="button" style={starting ? buttonDisabledStyle : buttonStyle} onClick={() => refresh()} disabled={starting}>
            <RefreshCw size={14} /> 刷新
          </button>
          {snapshot?.pack ? (
            <button type="button" style={starting ? buttonDisabledStyle : buttonPrimaryStyle} onClick={() => handleStart(true)} disabled={starting}>
              {starting ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
              重新生成全部
            </button>
          ) : (
            <button type="button" style={starting ? buttonDisabledStyle : buttonPrimaryStyle} onClick={() => handleStart(false)} disabled={starting}>
              {starting ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
              启动生成
            </button>
          )}
        </div>
      </div>

      {/* 进度条 */}
      {snapshot?.pack && (
        <div style={{ borderRadius: 8, border: "1px solid rgba(255,255,255,0.10)", background: "rgba(255,255,255,0.05)", padding: 16 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: 13, color: "rgba(255,255,255,0.7)", marginBottom: 8 }}>
            <span>
              packId: <span style={{ fontFamily: "monospace", color: "rgba(255,255,255,0.4)" }}>{snapshot.pack.id}</span>
            </span>
            <span>
              v{snapshot.pack.version} · 完成 {completed}/{total} · 失败 {failed}
              {isWorking && (
                <span style={{ marginLeft: 8, display: "inline-flex", alignItems: "center", gap: 4, color: "rgb(165,243,252)" }}>
                  <Loader2 size={12} className="animate-spin" /> 生成中
                </span>
              )}
            </span>
          </div>
          <div style={{ height: 8, width: "100%", background: "rgba(255,255,255,0.10)", borderRadius: 4, overflow: "hidden" }}>
            <div
              style={{
                height: "100%",
                background: "linear-gradient(to right, rgb(34,211,238) 0%, rgb(16,185,129) 100%)",
                width: `${progressPct}%`,
                transition: "width 0.3s",
              }}
            />
          </div>
        </div>
      )}

      {/* 13 / 7 图网格 */}
      {!snapshot?.pack ? (
        <div style={{ borderRadius: 8, border: "1px dashed rgba(255,255,255,0.15)", padding: 40, textAlign: "center", color: "rgba(255,255,255,0.5)" }}>
          <ImageIcon size={40} style={{ margin: "0 auto 12px", opacity: 0.5 }} />
          <p>尚未生成一致性包，点击「启动生成」开始 {total} 张图的串行生成。</p>
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 16 }}>
          {expectedTypes.map((t) => {
            const img = images.find((i) => i.image_type === t);
            return (
              <ConsistencyImageCard
                key={t}
                type={t}
                image={img}
                regenerating={regenerating === img?.id}
                onRegenerate={() => img && handleRegenerateOne(img)}
              />
            );
          })}
        </div>
      )}

      {/* 简易 toast */}
      {toast && (
        <div
          role="alert"
          style={{
            position: "fixed",
            top: 24,
            right: 24,
            zIndex: 100,
            minWidth: 280,
            maxWidth: 400,
            padding: 12,
            borderRadius: 8,
            border: `1px solid ${toast.type === "success" ? "rgba(16,185,129,0.4)" : "rgba(239,68,68,0.4)"}`,
            background: toast.type === "success" ? "rgba(16,185,129,0.15)" : "rgba(239,68,68,0.15)",
            color: "white",
            fontSize: 13,
            boxShadow: "0 8px 24px rgba(0,0,0,0.4)",
          }}
        >
          <div style={{ fontWeight: 600 }}>{toast.title}</div>
          <div style={{ marginTop: 4, color: "rgba(255,255,255,0.7)" }}>{toast.description}</div>
        </div>
      )}
    </div>
  );
}

interface ConsistencyImageCardProps {
  type: ConsistencyImageType;
  image?: ConsistencyPackImage;
  regenerating: boolean;
  onRegenerate: () => void;
}

function ConsistencyImageCard({ type, image, regenerating, onRegenerate }: ConsistencyImageCardProps) {
  const status: ConsistencyImageStatus = image?.status ?? "pending";
  const label = CONSISTENCY_IMAGE_LABELS[type] ?? type;
  const tone = STATUS_TONE[status];
  const statusLabel = STATUS_LABELS[status];

  return (
    <div
      style={{
        borderRadius: 8,
        border: "1px solid rgba(255,255,255,0.10)",
        background: "rgba(255,255,255,0.05)",
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <div
        style={{
          aspectRatio: "1 / 1",
          background: "rgba(0,0,0,0.40)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          position: "relative",
        }}
      >
        {image?.url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={image.url} alt={label} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        ) : status === "generating" || regenerating ? (
          <Loader2 size={32} color="rgb(165,243,252)" className="animate-spin" />
        ) : status === "failed" ? (
          <AlertTriangle size={32} color="rgb(248,113,113)" />
        ) : (
          <Clock size={32} color="rgba(255,255,255,0.3)" />
        )}
        {image?.url && (
          <a
            href={image.url}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              position: "absolute",
              top: 8,
              right: 8,
              fontSize: 10,
              background: "rgba(0,0,0,0.6)",
              color: "rgba(255,255,255,0.8)",
              padding: "2px 6px",
              borderRadius: 4,
              textDecoration: "none",
            }}
          >
            打开
          </a>
        )}
      </div>
      <div style={{ padding: 12, display: "flex", flexDirection: "column", gap: 8 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span style={{ fontSize: 13, fontWeight: 500, color: "rgba(255,255,255,0.9)" }}>{label}</span>
          <span
            style={{
              fontSize: 10,
              padding: "2px 6px",
              borderRadius: 4,
              border: `1px solid ${tone.border}`,
              background: tone.bg,
              color: tone.text,
            }}
          >
            {statusLabel}
          </span>
        </div>
        {image?.error_message && (
          <p
            style={{
              fontSize: 10,
              color: "rgba(252,165,165,0.8)",
              margin: 0,
              overflow: "hidden",
              textOverflow: "ellipsis",
              display: "-webkit-box",
              WebkitLineClamp: 2,
              WebkitBoxOrient: "vertical",
            }}
            title={image.error_message}
          >
            {image.error_message}
          </p>
        )}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: 10, color: "rgba(255,255,255,0.4)" }}>
          <span style={{ fontFamily: "monospace", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={image?.id ?? "-"}>
            {image ? image.id.slice(0, 12) + "…" : "—"}
          </span>
          <button
            type="button"
            disabled={!image || regenerating}
            onClick={onRegenerate}
            style={{
              fontSize: 10,
              color: regenerating ? "rgba(165,243,252,0.6)" : "rgb(165,243,252)",
              background: "none",
              border: "none",
              cursor: !image || regenerating ? "not-allowed" : "pointer",
              opacity: !image || regenerating ? 0.4 : 1,
              padding: 0,
            }}
          >
            {regenerating ? <Loader2 size={10} className="inline animate-spin" /> : "重生"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default ConsistencyPackPanel;
