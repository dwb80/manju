import { api } from "@/lib/api-client";

export interface AssetImage {
  id: string;
  url: string;
  project_id?: string;
  prompt?: string;
  view_type?: string;
  is_primary?: number | boolean;
  created_at?: string;
}

export const listCharacterImages = (id: string) => api<AssetImage[]>(`/api/characters/${encodeURIComponent(id)}/images`);
export const listSceneImages = (id: string) => api<AssetImage[]>(`/api/scenes/${encodeURIComponent(id)}/images`);
export const listPropImages = (id: string) => api<AssetImage[]>(`/api/props/${encodeURIComponent(id)}/images`);

export function pickPrimaryImage(images: AssetImage[] | null | undefined): AssetImage | undefined {
  if (!images?.length) return undefined;
  return images.find((image) => image.is_primary === 1 || image.is_primary === true) ?? images[0];
}
