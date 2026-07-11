"use client";

/**
 * JOIN 缓存：根据 ID 列表 / 上下文获取并缓存外键实体的展示字段（name / title）。
 *
 * 使用场景：
 * - 分镜卡片上展示"场景名"（通过 scene_id → Scene.name 反查）
 * - 剪辑时间轴展示分镜标题（通过 storyboard_id → Storyboard.title 反查）
 *
 * 性能：项目级别缓存，切换项目时清空。
 */
import { useEffect, useState, useRef } from "react";
import { useProjectStore } from "@/lib/stores/project-store";

/**
 * 通过 fetcher 拉取一批 id 对应的实体，再用 lookupById 取得要展示的文本。
 *
 * @param ids 当前需要展示的所有 id 数组
 * @param fetcher 通过 id 列表拉取实体（后端实现自定义）
 * @param lookupById 接收 fetcher 返回的实体数组 + 传入的 ids，返回 { id -> text } 映射
 */
export function useNameLookup<T extends { id: string }>(
  ids: string[],
  fetcher: (ids: string[]) => Promise<T[]>,
  lookupById: (items: T[], ids: string[]) => Record<string, string>,
): Record<string, string> {
  const projectId = useProjectStore((s) => s.selectedProjectId);
  const [map, setMap] = useState<Record<string, string>>({});
  const cacheRef = useRef<Record<string, Record<string, string>>>({}); // projectId -> map

  // 用 ref 保存函数引用，避免调用方传入的内联函数导致无限循环
  const fetcherRef = useRef(fetcher);
  const lookupByIdRef = useRef(lookupById);
  fetcherRef.current = fetcher;
  lookupByIdRef.current = lookupById;

  useEffect(() => {
    if (!projectId) {
      setMap({});
      return;
    }
    // 过滤掉空 id
    const unique = Array.from(new Set(ids.filter(Boolean)));
    if (unique.length === 0) {
      setMap({});
      return;
    }
    let cancelled = false;
    fetcherRef.current(unique)
      .then((items) => {
        if (cancelled) return;
        const partial = lookupByIdRef.current(items, unique);
        const projectMap = { ...(cacheRef.current[projectId] ?? {}), ...partial };
        cacheRef.current[projectId] = projectMap;
        setMap(projectMap);
      })
      .catch((err) => console.warn("useNameLookup failed", err));
    return () => {
      cancelled = true;
    };
  }, [ids.join("|"), projectId]);

  return map;
}
