"use client";

/**
 * 剧集预览组件
 * 展示解析结果：剧集列表、每个剧集下的场景、每个场景下的对白
 *
 * 按需求变更：不再使用 lucide-react 图标，改用纯文本 [-]/[+] 折叠符。
 */

import { useState } from "react";
import type { PreviewEpisode } from "./types";
import { formatSceneAnchor } from "./utils";

interface EpisodePreviewProps {
  episodes: PreviewEpisode[];
}

export function EpisodePreview({ episodes }: EpisodePreviewProps) {
  const [expandedEpisodes, setExpandedEpisodes] = useState<Set<string>>(new Set());
  const [expandedScenes, setExpandedScenes] = useState<Set<string>>(new Set());

  const toggleEpisode = (id: string) => {
    setExpandedEpisodes((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleScene = (id: string) => {
    setExpandedScenes((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <div className="p-4 space-y-2">
      {episodes.map((ep) => {
        const epId = `ep-${ep.episode_no}`;
        const expanded = expandedEpisodes.has(epId);
        return (
          <div key={epId} className="rounded-lg border border-border bg-muted overflow-hidden">
            <button
              type="button"
              onClick={() => toggleEpisode(epId)}
              className="w-full flex items-center gap-2 px-3 py-2 hover:bg-muted/50 transition-colors text-left"
            >
              <span className="text-xs text-muted-foreground font-mono w-7 inline-block text-center">
                {expanded ? "[-]" : "[+]"}
              </span>
              <span className="text-sm font-medium text-foreground flex-1">
                第{ep.episode_no}集 · {ep.title}
              </span>
              <span className="text-xs text-muted-foreground">
                {ep.scenes.length} 个场景
              </span>
            </button>
            {expanded && (
              <div className="border-t border-border px-3 py-2 space-y-2 bg-card">
                {ep.synopsis && (
                  <div className="text-xs text-muted-foreground">
                    简介: <span className="text-muted-foreground">{ep.synopsis}</span>
                  </div>
                )}
                {ep.scenes.length === 0 ? (
                  <div className="text-xs text-chart-5">⚠ 本集未识别到场景</div>
                ) : (
                  ep.scenes.map((scene) => {
                    const scId = `${epId}-sc-${scene.scene_no}`;
                    const scExpanded = expandedScenes.has(scId);
                    return (
                      <div key={scId} className="rounded border border-border/50 bg-card overflow-hidden">
                        <button
                          type="button"
                          onClick={() => toggleScene(scId)}
                          className="w-full flex items-center gap-2 px-2 py-1.5 hover:bg-muted/50 transition-colors text-left"
                        >
                          <span className="text-xs text-muted-foreground font-mono w-5 inline-block text-center">
                            {scExpanded ? "[-]" : "[+]"}
                          </span>
                          <span className="text-xs text-primary">景{scene.scene_no}</span>
                          <span className="text-xs text-foreground flex-1">
                            {formatSceneAnchor(scene)}
                            {scene.time_of_day ? ` · ${scene.time_of_day}` : ""}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {scene.dialogues.length} 句对白
                          </span>
                        </button>
                        {scExpanded && (
                          <div className="border-t border-border/50 px-2 py-2 space-y-1">
                            {scene.description && (
                              <div className="text-xs text-muted-foreground line-clamp-3">
                                {scene.description}
                              </div>
                            )}
                            {scene.dialogues.length === 0 ? (
                              <div className="text-xs text-muted-foreground">无对白</div>
                            ) : (
                              scene.dialogues.map((d, dIdx) => (
                                <div
                                  key={dIdx}
                                  className="text-xs flex gap-2 px-2 py-1 rounded bg-muted/50"
                                >
                                  <span className="text-primary font-medium">
                                    {d.character}
                                  </span>
                                  {d.emotion && (
                                    <span className="text-chart-5">
                                      （{d.emotion}）
                                    </span>
                                  )}
                                  <span className="text-muted-foreground flex-1">：{d.text}</span>
                                </div>
                              ))
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
