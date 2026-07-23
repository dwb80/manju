/**
 * @file consistency-pack.service.ts
 * @description V2 MOD-ASSET FEAT-ASSET-011/012/013 一致性包 API
 *
 * 端点：
 * - POST /api/characters|scenes|props/:id/consistency-pack/generate
 *   → 202 { packId, total, types }
 * - GET  /api/characters|scenes|props/:id/consistency-pack
 *   → 200 { pack, images, typeCounts }
 * - POST /api/consistency-pack/images/:imageId/regenerate
 *   → 202 { imageId, status, ... }
 */

import { api } from "@/lib/api-client";
import type {
  ConsistencyPackGenerateResponse,
  ConsistencyPackSnapshot,
  ConsistencyImageType,
} from "@/lib/app-types";

export type ConsistencyEntityType = "character" | "scene" | "prop";

const ENTITY_PATH: Record<ConsistencyEntityType, string> = {
  character: "characters",
  scene: "scenes",
  prop: "props",
};

export function buildGenerateUrl(entityType: ConsistencyEntityType, entityId: string): string {
  return `/api/${ENTITY_PATH[entityType]}/${entityId}/consistency-pack/generate`;
}

export function buildStatusUrl(entityType: ConsistencyEntityType, entityId: string): string {
  return `/api/${ENTITY_PATH[entityType]}/${entityId}/consistency-pack`;
}

export function buildRegenerateUrl(imageId: string): string {
  return `/api/consistency-pack/images/${imageId}/regenerate`;
}

export async function generateConsistencyPack(
  entityType: ConsistencyEntityType,
  entityId: string,
  options: { regenerate?: boolean; model?: string } = {},
): Promise<ConsistencyPackGenerateResponse> {
  const { regenerate, model } = options;
  const url = buildGenerateUrl(entityType, entityId);
  return api<ConsistencyPackGenerateResponse>(url, {
    method: "POST",
    body: JSON.stringify({ ...(regenerate ? { regenerate: true } : {}), ...(model ? { model } : {}) }),
  });
}

export async function getConsistencyPack(
  entityType: ConsistencyEntityType,
  entityId: string,
): Promise<ConsistencyPackSnapshot> {
  const url = buildStatusUrl(entityType, entityId);
  return api<ConsistencyPackSnapshot>(url, { method: "GET" });
}

export async function regeneratePackImage(
  imageId: string,
  options: { model?: string } = {},
): Promise<{ imageId: string; status: string }> {
  const url = buildRegenerateUrl(imageId);
  return api(url, {
    method: "POST",
    body: JSON.stringify(options.model ? { model: options.model } : {}),
  });
}

export const CONSISTENCY_TYPES_PER_ENTITY: Record<ConsistencyEntityType, ConsistencyImageType[]> = {
  character: [
    "full_front",
    "full_side",
    "full_back",
    "half_body",
    "neutral",
    "happy",
    "sad",
    "angry",
    "surprised",
    "thinking",
    "eye_level",
    "low_angle",
    "high_angle",
  ],
  scene: [
    "full_front",
    "full_side",
    "full_back",
    "half_body",
    "eye_level",
    "low_angle",
    "high_angle",
  ],
  prop: [
    "full_front",
    "full_side",
    "full_back",
    "half_body",
    "eye_level",
    "low_angle",
    "high_angle",
  ],
};
