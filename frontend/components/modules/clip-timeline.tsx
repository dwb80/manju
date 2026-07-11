"use client";

/**
 * 剪辑时间轴（简易版）
 *
 * - 把每个 ProjectClip 解析为「开始 / 结束」时间点（解析 in_point / out_point）
 * - 按 episode 分多轨（每集一条横向轨道）
 * - 每条 clip 作为色块绘制在轨道上，宽度按时间占比
 * - 拖动支持暂未提供（V2 计划），目前为只读视图
 *
 * 设计原则：
 * - 数据稀疏：未填写时间点的 clip 会归到最末尾"未排期"区域
 * - 颜色：与状态色保持一致，hover 显示标题/时长
 */

import { Scissors, Clock } from "lucide-react";
import type { ProjectClip } from "@/lib/app-types";
import { PROJECT_CLIP_STATUS_COLORS, PROJECT_CLIP_STATUS_LABELS } from "@/lib/module-dictionaries";

interface BlockMeta {
  id: string;
  title: string;
  status: string;
  start: number;
  end: number;
  episode: number;
  shot: string;
  notes: string;
}

/** 解析 "HH:MM:SS" / "MM:SS" / 秒数字符串。无法解析时返回 -1（视为"未排期"）。 */
function parseTimecode(tc: string | number | undefined | null): number {
  if (tc == null) return -1;
  if (typeof tc === "number") return tc;
  const s = String(tc).trim();
  if (!s) return -1;
  // 纯数字（秒）
  if (/^\d+(\.\d+)?$/.test(s)) return Number(s);
  // HH:MM:SS 或 MM:SS
  const parts = s.split(":").map((x) => Number(x));
  if (parts.length === 3 && parts.every((x) => !Number.isNaN(x))) {
    return parts[0] * 3600 + parts[1] * 60 + parts[2];
  }
  if (parts.length === 2 && parts.every((x) => !Number.isNaN(x))) {
    return parts[0] * 60 + parts[1];
  }
  return -1;
}

/** 把秒数格式化为 HH:MM:SS。 */
function formatTC(seconds: number): string {
  if (seconds < 0) return "--:--";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  return h > 0
    ? `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`
    : `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}

function buildBlocks(clips: ProjectClip[]): { blocks: BlockMeta[]; maxTime: number; episodes: number[] } {
  const blocks: BlockMeta[] = [];
  let maxTime = 0;
  const episodeSet = new Set<number>();
  for (const c of clips) {
    const start = parseTimecode(c.in_point);
    const endRaw = parseTimecode(c.out_point);
    const end = endRaw > start ? endRaw : start + Math.max(0, c.duration ?? 0);
    blocks.push({
      id: c.id,
      title: c.title ?? "未命名剪辑",
      status: c.status ?? "todo",
      start,
      end,
      episode: c.episode ?? 1,
      shot: c.shot ?? "",
      notes: c.notes ?? "",
    });
    if (start >= 0) maxTime = Math.max(maxTime, end);
    episodeSet.add(c.episode ?? 1);
  }
  blocks.sort((a, b) => a.episode - b.episode || a.start - b.start);
  return { blocks, maxTime, episodes: Array.from(episodeSet).sort((a, b) => a - b) };
}

export function ClipTimeline({ clips }: { clips: ProjectClip[] }) {
  if (!clips || clips.length === 0) {
    return (
      <div className="rounded-lg border border-white/10 bg-[#1a1a1a] p-8 text-center text-sm text-[#666]">
        <Clock className="mx-auto mb-2 h-8 w-8 text-emerald-500/40" />
        暂无剪辑数据，先从分镜同步或新建剪辑。
      </div>
    );
  }

  const { blocks, maxTime, episodes } = buildBlocks(clips);
  const total = maxTime > 0 ? maxTime : 60; // 给一个最小宽度
  const timeMarkers = 5; // 5 个时间刻度
  const markerStep = total / timeMarkers;

  return (
    <div className="space-y-4">
      {episodes.map((ep) => {
        const epBlocks = blocks.filter((b) => b.episode === ep);
        return (
          <div key={ep} className="rounded-lg border border-white/10 bg-[#1a1a1a] p-3">
            <div className="mb-2 flex items-center gap-2 text-xs text-emerald-300/90">
              <span className="rounded bg-emerald-500/10 px-1.5 py-0.5">第 {ep} 集</span>
              <span className="text-[#666]">{epBlocks.length} 条剪辑</span>
            </div>
            {/* 时间刻度尺 */}
            <div className="relative ml-12 mb-1 h-4">
              {Array.from({ length: timeMarkers + 1 }).map((_, i) => {
                const t = markerStep * i;
                return (
                  <span
                    key={i}
                    className="absolute -translate-x-1/2 text-[10px] text-[#666]"
                    style={{ left: `${(t / total) * 100}%` }}
                  >
                    {formatTC(t)}
                  </span>
                );
              })}
            </div>
            {/* 轨道 */}
            <div className="relative ml-12 h-12 rounded bg-[#0f0f0f]">
              {epBlocks.map((b) => {
                if (b.start < 0) return null;
                const left = (b.start / total) * 100;
                const width = Math.max(((b.end - b.start) / total) * 100, 2);
                const color =
                  PROJECT_CLIP_STATUS_COLORS[b.status as keyof typeof PROJECT_CLIP_STATUS_COLORS] ??
                  "bg-gray-500/20 text-gray-300";
                return (
                  <div
                    key={b.id}
                    className={`absolute top-1 bottom-1 flex items-center overflow-hidden rounded border border-white/10 ${color} hover:z-10 hover:ring-1 hover:ring-emerald-400`}
                    style={{ left: `${left}%`, width: `${width}%` }}
                    title={`${b.title}\n${formatTC(b.start)} → ${formatTC(b.end)}\n${b.notes ?? ""}`}
                  >
                    <Scissors className="ml-1 h-3 w-3 shrink-0 opacity-70" />
                    <span className="truncate px-1 text-[10px]">
                      {b.shot ? `${b.shot} · ` : ""}
                      {b.title}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}

      {/* 未排期 */}
      {(() => {
        const unscheduled = blocks.filter((b) => b.start < 0);
        if (unscheduled.length === 0) return null;
        return (
          <div className="rounded-lg border border-dashed border-white/10 bg-[#1a1a1a] p-3">
            <div className="mb-2 flex items-center gap-2 text-xs text-[#888]">
              <span className="rounded bg-white/5 px-1.5 py-0.5">未排期</span>
              <span className="text-[#666]">{unscheduled.length} 条剪辑未填写时间点</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {unscheduled.map((b) => (
                <div
                  key={b.id}
                  className="rounded border border-white/10 bg-[#252525] px-2 py-1 text-xs text-white/70"
                  title={b.notes}
                >
                  {b.shot ? `${b.shot} · ` : ""}
                  {b.title}
                </div>
              ))}
            </div>
          </div>
        );
      })()}

      <div className="text-[10px] text-[#666]">
        共 {clips.length} 条剪辑 / 总时长 {formatTC(maxTime)}
      </div>
    </div>
  );
}
