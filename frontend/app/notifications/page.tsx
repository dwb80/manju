"use client";

import { useState } from "react";
import { CheckCheck } from "lucide-react";
import { api } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { TargetListPage } from "@/components/governance";

export default function NotificationsPage() {
  const [busy, setBusy] = useState(false);
  async function markAllRead() { setBusy(true); try { await api("/api/v1/notifications/read-batch", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ commandId: crypto.randomUUID(), notificationIds: [] }) }); } finally { setBusy(false); } }
  return <TargetListPage title="通知中心" description="按类别、项目、优先级与未读状态管理通知；安全通知渠道不可全部关闭" endpoint="/api/v1/notifications" emptyText="当前没有通知。SSE 断线后会按游标补拉，不会生成模拟消息。" actions={<Button size="sm" onClick={() => void markAllRead()} disabled={busy}><CheckCheck className="mr-1 h-4 w-4" />全部已读</Button>} />;
}
