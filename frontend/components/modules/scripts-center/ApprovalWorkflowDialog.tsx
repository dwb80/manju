"use client";

/**
 * 审批工作流对话框
 */

import { useState } from "react";
import { CheckCircle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { scriptCenterService } from "@/services/script-center.service";
import { clearApiCache } from "@/lib/api-client";
import { notify } from "@/lib/notify";
import { useProjectStore } from "@/lib/stores/project-store";
import type { Script } from "@/lib/module-types";
import { DialogOverlay } from "./ScriptsCenterPage";

export function ApprovalWorkflowDialog({
  script,
  isOpen,
  onClose,
  onStatusUpdated,
}: {
  script: Script | null;
  isOpen: boolean;
  onClose: () => void;
  onStatusUpdated: (script: Script) => void | Promise<void>;
}) {
  if (!isOpen || !script) return null;

  return (
    <DialogOverlay title={`审批流程 - ${script.title}`} onClose={onClose}>
      <SimpleApprovalWorkflow
        script={script}
        onStatusUpdated={onStatusUpdated}
      />
    </DialogOverlay>
  );
}

function SimpleApprovalWorkflow({
  script,
  onStatusUpdated,
}: {
  script: Script;
  onStatusUpdated: (script: Script) => void | Promise<void>;
}) {
  const selectedProjectId = useProjectStore((s) => s.selectedProjectId);
  const [currentStatus, setCurrentStatus] = useState(script.status);
  const [comment, setComment] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [history, setHistory] = useState<Array<{ status: string; comment: string; time: string }>>([]);

  const workflowSteps = [
    { status: "draft", label: "草稿", desc: "剧本创作中" },
    { status: "active", label: "进行中", desc: "剧本正在完善" },
    { status: "review", label: "审核中", desc: "提交审核，等待审批" },
    { status: "completed", label: "已完成", desc: "审核通过，转入审核中心" },
  ];

  const currentIndex = workflowSteps.findIndex((s) => s.status === currentStatus);

  const handleStatusChange = async (newStatus: string) => {
    setIsSaving(true);
    try {
      if (!selectedProjectId) { notify.warn("未选择项目"); return; }
      await scriptCenterService.updateDocument(script.id, { status: newStatus } as any);
      const oldStatus = currentStatus;
      setCurrentStatus(newStatus as Script["status"]);
      setHistory([
        ...history,
        {
          status: newStatus,
          comment: comment || `状态从「${workflowSteps.find((s) => s.status === oldStatus)?.label}」变更为「${workflowSteps.find((s) => s.status === newStatus)?.label}」`,
          time: new Date().toLocaleString(),
        },
      ]);
      setComment("");
      onStatusUpdated({ ...script, status: newStatus as any });
      clearApiCache();
    } catch (err) {
      console.error("更新状态失败:", err);
      notify.error("更新状态失败", (err as Error).message);
    } finally {
      setIsSaving(false);
    }
  };

  const statusColors: Record<string, string> = {
    draft: "bg-muted/20 text-muted-foreground border-border/30",
    active: "bg-info/20 text-info border-info/30",
    review: "bg-chart-5/20 text-chart-5 border-chart-5/30",
    completed: "bg-primary/20 text-primary border-primary/30",
    archived: "bg-secondary text-muted-foreground border-border",
  };

  return (
    <div className="space-y-4">
      {/* 审批通过提示 */}
      {currentStatus === "completed" && (
        <div className="flex items-start gap-2 p-3 rounded-lg bg-primary/10 border border-primary/20">
          <CheckCircle className="h-4 w-4 text-primary flex-shrink-0 mt-0.5" />
          <div className="text-sm text-primary">
            <p className="font-medium">剧本已审批通过</p>
            <p className="text-xs text-primary/80 mt-1">该剧本已自动流转到审核中心，可在审核中心查看和管理</p>
          </div>
        </div>
      )}

      {/* 当前状态 */}
      <div>
        <div className="text-sm font-medium text-foreground mb-3">当前状态</div>
        <div className={`rounded-lg p-3 border ${statusColors[currentStatus]}`}>
          <div className="flex items-center justify-between">
            <div>
              <div className="text-lg font-bold">{workflowSteps.find((s) => s.status === currentStatus)?.label || currentStatus}</div>
              <div className="text-xs opacity-80">{workflowSteps.find((s) => s.status === currentStatus)?.desc}</div>
            </div>
            <div className="text-xs">
              步骤 {currentIndex + 1} / {workflowSteps.length}
            </div>
          </div>
        </div>
      </div>

      {/* 审批流程步骤 */}
      <div>
        <div className="text-sm font-medium text-foreground mb-3">审批流程</div>
        <div className="space-y-2">
          {workflowSteps.map((step, index) => {
            const isCompleted = index < currentIndex;
            const isCurrent = index === currentIndex;

            return (
              <div
                key={step.status}
                className={`border rounded-lg p-3 transition-colors ${
                  isCurrent
                    ? "bg-info/10 border-info/30 ring-2 ring-info/20"
                    : isCompleted
                    ? "bg-primary/5 border-primary/20"
                    : "bg-muted/50 border-border"
                }`}
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-medium ${
                      isCompleted
                        ? "bg-primary/20 text-primary"
                        : isCurrent
                        ? "bg-info/20 text-info"
                        : "bg-muted/50 text-muted-foreground"
                    }`}
                  >
                    {isCompleted ? <CheckCircle className="h-4 w-4" /> : index + 1}
                  </div>
                  <div className="flex-1">
                    <div className="text-sm font-medium text-foreground">{step.label}</div>
                    <div className="text-xs text-muted-foreground">{step.desc}</div>
                  </div>
                  {isCurrent && (
                    <span className="text-xs px-2 py-0.5 rounded bg-info/20 text-info">当前</span>
                  )}
                  {isCompleted && (
                    <span className="text-xs px-2 py-0.5 rounded bg-primary/20 text-primary">已完成</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 操作区域 */}
      {currentIndex < workflowSteps.length - 1 && (
        <div>
          <div className="text-sm font-medium text-foreground mb-3">审批操作</div>
          <div className="space-y-3">
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="输入审批意见（可选）..."
              className="w-full h-20 p-3 rounded-lg bg-secondary border border-border text-sm text-foreground resize-none focus:outline-none focus:border-primary/50"
            />
            <div className="flex gap-2">
              <Button
                size="sm"
                onClick={() => handleStatusChange(workflowSteps[currentIndex + 1].status)}
                disabled={isSaving}
              >
                {isSaving ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <CheckCircle className="mr-2 h-4 w-4" />
                )}
                通过，进入「{workflowSteps[currentIndex + 1].label}」
              </Button>
              {currentIndex > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleStatusChange(workflowSteps[currentIndex - 1].status)}
                  disabled={isSaving}
                >
                  退回「{workflowSteps[currentIndex - 1].label}」
                </Button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 审批历史 */}
      {history.length > 0 && (
        <div>
          <div className="text-sm font-medium text-foreground mb-3">审批历史</div>
          <div className="space-y-2">
            {history.map((record, idx) => (
              <div key={idx} className="bg-muted/50 rounded p-2 text-xs">
                <div className="flex items-center gap-2 mb-1">
                  <span className={`px-2 py-0.5 rounded ${statusColors[record.status]}`}>
                    {workflowSteps.find((s) => s.status === record.status)?.label || record.status}
                  </span>
                  <span className="text-muted-foreground">{record.time}</span>
                </div>
                {record.comment && (
                  <div className="text-muted-foreground">{record.comment}</div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
