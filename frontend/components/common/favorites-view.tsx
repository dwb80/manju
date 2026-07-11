"use client";

import { FavoritePanel } from "@/components/layout/workspace-panels";
import type { FavoriteView } from "@/lib/app-types";

export type FavoritesViewProps = {
  favorites: FavoriteView[];
  onRefresh: () => void;
  onOpenImageDetail: (taskId: string, index: number) => void;
  onDownloadMedia: (url: string, filename: string) => void;
  onOpenRawMedia: (url: string) => void;
  onCopy: (text: string) => void;
  onContinueEditImage: (url: string) => void;
  onRemoveFavorite: (favoriteId: string) => void;
  onImageLoad: () => void;
};

/** 渲染收藏视图 */
export function FavoritesView({
  favorites,
  onRefresh,
  onOpenImageDetail,
  onDownloadMedia,
  onOpenRawMedia,
  onCopy,
  onContinueEditImage,
  onRemoveFavorite,
  onImageLoad,
}: FavoritesViewProps) {
  return (
    <FavoritePanel
      favorites={favorites}
      onRefresh={onRefresh}
      onOpenImageDetail={onOpenImageDetail}
      onDownloadMedia={onDownloadMedia}
      onOpenRawMedia={onOpenRawMedia}
      onCopy={onCopy}
      onContinueEditImage={onContinueEditImage}
      onRemoveFavorite={onRemoveFavorite}
      onImageLoad={onImageLoad}
    />
  );
}