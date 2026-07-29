import { api } from "@/lib/api-client";

export type ReviewIntakeStatus = "qc_running" | "qc_blocked" | "review_pending" | "reviewing" | "needs_fix" | "completed";
export type DependencyFreshness = "current" | "stale" | "blocked" | "unknown";

export interface ReviewIntake {
  id: string;
  targetType: string;
  targetId: string;
  targetVersion: number;
  snapshotHash: string;
  status: ReviewIntakeStatus;
  qcReportId?: string | null;
  reviewId?: string | null;
  blockers: Array<{ code: string; message: string; mandatory?: boolean }>;
  warnings: Array<{ code: string; message: string; waivable?: boolean }>;
  version: number;
}

export interface DependencyImpactItem {
  sourceRef: string;
  targetRef: string;
  targetType: string;
  freshness: DependencyFreshness;
  severity: "info" | "warning" | "blocking";
  reason: string;
  evidenceHash?: string;
}

export interface DependencyImpactList {
  projectionWatermark: string;
  items: DependencyImpactItem[];
  counts: Record<DependencyFreshness, number>;
}

export interface CollaborationState {
  targetType: string;
  targetId: string;
  version: number;
  viewers: Array<{ id: string; displayName: string; lastSeenAt: string }>;
  lease: { id: string; holderId: string; holderName: string; expiresAt: string; lastHeartbeatAt: string; version: number } | null;
  effectivePermissions: string[];
  readOnlyReason?: string | null;
  conflict?: {
    id: string;
    baseVersion: number;
    serverVersion: number;
    conflictingFields: string[];
    localDraftPreserved: boolean;
  } | null;
}

function itemsOf<T>(result: T[] | { items: T[] }): T[] {
  return Array.isArray(result) ? result : result.items;
}

export async function listReviewIntakes(projectId: string): Promise<ReviewIntake[]> {
  const result = await api<ReviewIntake[] | { items: ReviewIntake[] }>(`/api/v1/review-intakes?projectId=${encodeURIComponent(projectId)}`);
  return itemsOf(result);
}

export async function waiveReviewIntake(intake: ReviewIntake, reason: string): Promise<ReviewIntake> {
  return api<ReviewIntake>(`/api/v1/review-intakes/${encodeURIComponent(intake.id)}/qc-waivers`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ commandId: crypto.randomUUID(), qcReportId: intake.qcReportId, reason, expectedVersion: intake.version }),
  });
}

export async function listDependencyImpacts(projectId: string): Promise<DependencyImpactList> {
  return api<DependencyImpactList>(`/api/v1/projects/${encodeURIComponent(projectId)}/dependency-impacts`);
}

export async function getCollaborationState(targetType: string, targetId: string): Promise<CollaborationState> {
  const query = new URLSearchParams({ targetType, targetId });
  return api<CollaborationState>(`/api/v1/collaboration-states?${query.toString()}`);
}

export async function acquireEditLease(targetType: string, targetId: string): Promise<void> {
  await api("/api/v1/edit-leases", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ commandId: crypto.randomUUID(), targetType, targetId, leaseSeconds: 1800 }),
  });
}

