"use client";

import { useState, useCallback } from "react";
import { Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api-client";
import type { Favorite, FavoriteView, ImageTask, VideoTask } from "@/lib/app-types";

export function useFavorites({
  showNotice,
}: {
  showNotice: (message: string) => void;
}) {
  const [favorites, setFavorites] = useState<FavoriteView[]>([]);

  /** 加载收藏列表，并补全收藏指向的图片或视频详情。 */
  const loadFavorites = useCallback(async () => {
    try {
      const items = await api<Favorite[]>("/api/favorites");
      const resolved = await Promise.all(
        items.map(async (favoriteItem): Promise<FavoriteView> => {
          try {
            if (favoriteItem.type === "image") {
              return { favorite: favoriteItem, image: await api<ImageTask>(`/api/images/${favoriteItem.ref_id}`) };
            }
            if (favoriteItem.type === "video") {
              return { favorite: favoriteItem, video: await api<VideoTask>(`/api/videos/${favoriteItem.ref_id}`) };
            }
          } catch {
            return { favorite: favoriteItem };
          }
          return { favorite: favoriteItem };
        })
      );
      setFavorites(resolved);
      return resolved;
    } catch (error) {
      showNotice((error as Error).message || "收藏列表加载失败");
      return [];
    }
  }, [showNotice]);

  /** 查找图片或视频是否已经被收藏，用于渲染按钮状态。 */
  const findFavorite = useCallback(
    (type: "image" | "video", refId: string) => {
      return favorites.find((item) => item.favorite.type === type && item.favorite.ref_id === refId)?.favorite;
    },
    [favorites]
  );

  /** 切换图片或视频收藏状态：未收藏则收藏，已收藏则取消收藏。 */
  const toggleFavorite = useCallback(
    async (type: "image" | "video", refId: string) => {
      try {
        const existing = findFavorite(type, refId);
        if (existing) {
          await api(`/api/favorites/${existing.id}`, { method: "DELETE" });
          showNotice("已取消收藏");
        } else {
          await api("/api/favorites", { method: "POST", body: JSON.stringify({ type, ref_id: refId }) });
          showNotice("已收藏");
        }
        await loadFavorites();
      } catch (error) {
        showNotice((error as Error).message || "收藏状态更新失败");
      }
    },
    [findFavorite, loadFavorites, showNotice]
  );

  /** 从收藏列表中移除指定收藏。 */
  const removeFavorite = useCallback(
    async (favoriteId: string) => {
      await api(`/api/favorites/${favoriteId}`, { method: "DELETE" });
      await loadFavorites();
      showNotice("已取消收藏");
    },
    [loadFavorites, showNotice]
  );

  return {
    favorites,
    setFavorites,
    loadFavorites,
    findFavorite,
    toggleFavorite,
    removeFavorite,
  };
}
