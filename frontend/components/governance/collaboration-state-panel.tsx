"use client";

import { useCallback, useEffect, useState } from "react";
import { LockKeyhole, RefreshCw, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { acquireEditLease, getCollaborationState, type CollaborationState } from "@/services/governance.service";

export function CollaborationStatePanel({ targetType, targetId }: { targetType: string; targetId: string }) {
  const [state, setState] = useState<CollaborationState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const load = useCallback(async () => { setLoading(true); setError(null); try { setState(await getCollaborationState(targetType, targetId)); } catch (cause) { setError(cause instanceof Error ? cause.message : "无法加载协作状态"); } finally { setLoading(false); } }, [targetId, targetType]);
  useEffect(() => { void load(); }, [load]);
  async function acquire() { try { await acquireEditLease(targetType, targetId); await load(); } catch (cause) { setError(cause instanceof Error ? cause.message : "获取租约失败"); } }
  return <section aria-labelledby="collab-title" className="rounded-xl border border-border bg-card p-4">
    <div className="flex items-center justify-between"><div><h2 id="collab-title" className="font-semibold">协作、权限与版本</h2><p className="text-xs text-muted-foreground">在线状态不替代权限；保存仍校验租约与 expectedVersion</p></div><Button size="sm" variant="outline" onClick={() => void load()}><RefreshCw className="h-3.5 w-3.5" /></Button></div>
    {loading && <p role="status" className="mt-3 text-sm text-muted-foreground">加载协作状态…</p>}{error && <p role="alert" className="mt-3 text-sm text-destructive">{error}</p>}
    {state && <div className="mt-3 space-y-3"><div className="flex flex-wrap gap-2"><Badge variant="info"><Users className="mr-1 h-3 w-3" />查看者 {state.viewers.length}</Badge><Badge variant={state.lease ? "warning" : "success"}><LockKeyhole className="mr-1 h-3 w-3" />{state.lease ? `${state.lease.holderName} 编辑至 ${new Date(state.lease.expiresAt).toLocaleTimeString()}` : "无活动租约"}</Badge><Badge variant="muted">版本 {state.version}</Badge></div>{state.readOnlyReason && <p className="text-sm text-warning">只读：{state.readOnlyReason}</p>}{state.conflict && <div role="alert" className="rounded-md border border-warning/30 bg-warning/10 p-3 text-sm"><strong>版本冲突，本地草稿已保留</strong><p className="mt-1 text-xs">基础 v{state.conflict.baseVersion} / 服务端 v{state.conflict.serverVersion}；冲突字段：{state.conflict.conflictingFields.join("、")}</p></div>}{!state.lease && state.effectivePermissions.includes("edit") && <Button size="sm" onClick={() => void acquire()}>获取 30 分钟编辑租约</Button>}</div>}
  </section>;
}

