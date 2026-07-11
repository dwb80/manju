"use client";

/**
 * 剪辑模块（最小可用版本）
 *
 * 设计目标：
 * - 补齐"分镜 → 视频 → 剪辑"工作流的最后一环。
 * - 复用 FactoryCRUDPage 基座，避免与角色/场景/道具三个工厂的风格分裂。
 * - 通过 syncClips 一键从已生成视频的分镜同步，避免手工逐条录入。
 *
 * 注意：当前 ProjectClip 与 FactoryEntity 接口略有差异（无 usage_count / tags），
 * 因此这里不直接套用 FactoryCRUDPage，而是手写一个"轻量"列表页，
 * 保持与其他 4 个手写模块（分镜/视频/音频/剪辑）同样的最小实现。
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { Scissors, RefreshCw, Pencil, Trash2, Plus } from "lucide-react";
import { PageContainer, PageCard } from "@/components/layout/page-container";
import { StatCard, StatCardGrid, ModuleToolbar, SearchInput, FilterSelect, EmptyState } from "@/components/shared";
import { Button } from "@/components/ui/button";
import { FormDialog, type FormFieldConfig } from "@/components/ui/form-dialog";
import { ConfirmDialog } from "@/components/common/confirm-dialog";
import { toast } from "@/components/common/toast";
import { useProjectStore } from "@/lib/stores/project-store";
import { clearApiCache } from "@/lib/api-client";
import { listClips, createClip, updateClip, deleteClip, syncClips } from "@/services/clip.service";
import type { ProjectClip, ProjectClipStatus } from "@/lib/app-types";
import { PROJECT_CLIP_STATUS_LABELS, PROJECT_CLIP_STATUS_COLORS, withAll } from "@/lib/module-dictionaries";

/** 表单字段。 */
const clipFields: FormFieldConfig[] = [
  { name: "title", label: "标题", type: "text", required: true, placeholder: "请输入剪辑标题" },
  {
    name: "status",
    label: "状态",
    type: "select",
    required: true,
    defaultValue: "todo",
    options: [
      { value: "todo", label: "待剪辑" },
      { value: "editing", label: "剪辑中" },
      { value: "review", label: "审核中" },
      { value: "done", label: "已完成" },
    ],
  },
  { name: "episode", label: "集数", type: "number", placeholder: "1", min: 1 },
  { name: "scene", label: "场景", type: "text", placeholder: "如：S01E03" },
  { name: "shot", label: "镜头", type: "text", placeholder: "如：shot-001" },
  { name: "storyboard_id", label: "分镜ID", type: "text", placeholder: "请输入分镜ID" },
  { name: "source_video_url", label: "源视频URL", type: "text", placeholder: "https://..." },
  { name: "duration", label: "时长(秒)", type: "number", placeholder: "0", min: 0 },
  { name: "in_point", label: "入点", type: "text", placeholder: "00:00:00" },
  { name: "out_point", label: "出点", type: "text", placeholder: "00:00:05" },
  { name: "order_index", label: "顺序", type: "number", placeholder: "0", min: 0 },
  { name: "notes", label: "备注", type: "textarea", placeholder: "剪辑要点、节奏、音效…", rows: 2 },
];

export function ClipCenterPage() {
  const selectedProjectId = useProjectStore((s) => s.selectedProjectId);
  const [clips, setClips] = useState<ProjectClip[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  // 表单 / 删除状态
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editing, setEditing] = useState<ProjectClip | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<{ id: string; title: string } | null>(null);

  /** 加载列表。 */
  const load = useCallback(async () => {
    if (!selectedProjectId) {
      setClips([]);
      return;
    }
    setIsLoading(true);
    try {
      const data = await listClips(selectedProjectId);
      setClips(data);
    } catch (err) {
      console.error("Failed to load clips", err);
      toast.error("加载剪辑失败", (err as Error).message ?? "请稍后重试");
    } finally {
      setIsLoading(false);
    }
  }, [selectedProjectId]);

  useEffect(() => {
    load();
  }, [load]);

  /** 一键同步：从已生成视频的分镜同步到剪辑。 */
  const handleSync = useCallback(async () => {
    if (!selectedProjectId) return;
    setIsSyncing(true);
    try {
      const result = await syncClips(selectedProjectId);
      toast.success("同步完成", `新增/更新 ${result.length} 条剪辑`);
      clearApiCache();
      await load();
    } catch (err) {
      toast.error("同步失败", (err as Error).message ?? "请稍后重试");
    } finally {
      setIsSyncing(false);
    }
  }, [selectedProjectId, load]);

  /** 过滤。 */
  const filtered = useMemo(() => {
    const q = searchQuery.toLowerCase();
    return clips.filter((c) => {
      const matchSearch =
        !q ||
        c.title.toLowerCase().includes(q) ||
        (c.scene ?? "").toLowerCase().includes(q) ||
        (c.shot ?? "").toLowerCase().includes(q);
      const matchStatus = !statusFilter || c.status === statusFilter;
      return matchSearch && matchStatus;
    });
  }, [clips, searchQuery, statusFilter]);

  /** 统计。 */
  const stats = useMemo(() => {
    return {
      total: clips.length,
      todo: clips.filter((c) => c.status === "todo").length,
      editing: clips.filter((c) => c.status === "editing").length,
      done: clips.filter((c) => c.status === "done").length,
    };
  }, [clips]);

  /** 保存。 */
  const handleSave = useCallback(
    async (values: Record<string, string | number | string[]>) => {
      if (!selectedProjectId) return;
      setIsSaving(true);
      try {
        const payload = {
          ...values,
          project_id: selectedProjectId,
        } as Partial<ProjectClip>;
        if (editing) {
          await updateClip(selectedProjectId, editing.id, payload);
        } else {
          await createClip(selectedProjectId, payload);
        }
        setIsFormOpen(false);
        setEditing(null);
        clearApiCache();
        await load();
        toast.success("已保存", `剪辑「${values.title}」已${editing ? "更新" : "创建"}`);
      } catch (err) {
        toast.error("保存失败", (err as Error).message ?? "请稍后重试");
      } finally {
        setIsSaving(false);
      }
    },
    [selectedProjectId, editing, load],
  );

  /** 删除。 */
  const handleDelete = useCallback(async () => {
    if (!deleteConfirm || !selectedProjectId) return;
    const target = deleteConfirm;
    setDeleteConfirm(null);
    try {
      await deleteClip(selectedProjectId, target.id);
      clearApiCache();
      await load();
      toast.action(
        `已删除剪辑「${target.title}」`,
        {
          label: "已完成",
          onClick: () => {
            /* 提示用：toast 自身可关闭 */
          },
        },
        "如需恢复请重新从分镜同步",
        5000,
      );
    } catch (err) {
      toast.error("删除失败", (err as Error).message ?? "请稍后重试");
    }
  }, [deleteConfirm, selectedProjectId, load]);

  return (
    <PageContainer title="剪辑中心" description="从已生成视频的分镜同步并管理剪辑条目">
      <PageCard className="mb-6">
        <StatCardGrid columns={4}>
          <StatCard label="剪辑总数" value={stats.total} icon={Scissors} color="emerald" />
          <StatCard label="待剪辑" value={stats.todo} color="blue" />
          <StatCard label="剪辑中" value={stats.editing} color="purple" />
          <StatCard label="已完成" value={stats.done} color="orange" />
        </StatCardGrid>
      </PageCard>

      <ModuleToolbar
        left={
          <>
            <SearchInput value={searchQuery} onChange={setSearchQuery} placeholder="搜索标题 / 场景 / 镜头..." />
            <FilterSelect
              value={statusFilter}
              onChange={setStatusFilter}
              options={withAll(
                Object.entries(PROJECT_CLIP_STATUS_LABELS).map(([value, label]) => ({ value, label })),
                "全部状态",
              )}
              placeholder="状态筛选"
            />
          </>
        }
        right={
          <>
            <Button variant="secondary" size="sm" onClick={handleSync} disabled={!selectedProjectId || isSyncing}>
              <RefreshCw className={`mr-2 h-4 w-4 ${isSyncing ? "animate-spin" : ""}`} />
              {isSyncing ? "同步中..." : "从分镜同步"}
            </Button>
            <Button size="sm" onClick={() => { setEditing(null); setIsFormOpen(true); }} disabled={!selectedProjectId}>
              <Plus className="mr-2 h-4 w-4" />
              新建剪辑
            </Button>
          </>
        }
      />

      <PageCard title="剪辑列表">
        {isLoading ? (
          <div className="py-8 text-center text-[#888]">加载中…</div>
        ) : filtered.length === 0 ? (
          <EmptyState
            type="no-results"
            title="暂无剪辑"
            description={clips.length === 0 ? "可点击「从分镜同步」一键导入，或手工新建" : "尝试调整搜索条件"}
            action={{ label: "从分镜同步", onClick: handleSync }}
          />
        ) : (
          <div className="space-y-2">
            {filtered.map((c) => (
              <ClipRow
                key={c.id}
                clip={c}
                onEdit={() => { setEditing(c); setIsFormOpen(true); }}
                onDelete={() => setDeleteConfirm({ id: c.id, title: c.title })}
              />
            ))}
          </div>
        )}
      </PageCard>

      <FormDialog
        title={editing ? "编辑剪辑" : "新建剪辑"}
        fields={clipFields}
        initialValues={
          editing
            ? {
                title: editing.title,
                status: editing.status,
                episode: editing.episode ?? 1,
                scene: editing.scene ?? "",
                shot: editing.shot ?? "",
                storyboard_id: editing.storyboard_id ?? "",
                source_video_url: editing.source_video_url ?? "",
                duration: editing.duration ?? 0,
                in_point: editing.in_point ?? "",
                out_point: editing.out_point ?? "",
                order_index: editing.order_index ?? 0,
                notes: editing.notes ?? "",
              }
            : { status: "todo" }
        }
        isOpen={isFormOpen}
        onClose={() => { setIsFormOpen(false); setEditing(null); }}
        onSave={handleSave}
        isLoading={isSaving}
      />

      {deleteConfirm && (
        <ConfirmDialog
          title="删除剪辑"
          description={`确定要删除剪辑「${deleteConfirm.title}」吗？此操作无法撤销。`}
          confirmLabel="删除"
          onClose={() => setDeleteConfirm(null)}
          onConfirm={handleDelete}
        />
      )}
    </PageContainer>
  );
}

function ClipRow({
  clip,
  onEdit,
  onDelete,
}: {
  clip: ProjectClip;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const colorClass = PROJECT_CLIP_STATUS_COLORS[clip.status as ProjectClipStatus] ?? "bg-gray-500/20 text-gray-400";
  const label = PROJECT_CLIP_STATUS_LABELS[clip.status as ProjectClipStatus] ?? clip.status;
  return (
    <div className="flex items-center gap-3 rounded-lg border border-white/10 bg-[#252525] p-3 hover:bg-white/5">
      <Scissors className="h-4 w-4 shrink-0 text-emerald-400" />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <h3 className="truncate text-sm font-medium text-white">{clip.title}</h3>
          <span className={`rounded px-2 py-0.5 text-xs ${colorClass}`}>{label}</span>
          {clip.episode > 0 && <span className="text-xs text-[#888]">第 {clip.episode} 集</span>}
        </div>
        <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-[#888]">
          {clip.scene && <span>场景: {clip.scene}</span>}
          {clip.shot && <span>镜头: {clip.shot}</span>}
          {clip.duration > 0 && <span>时长: {clip.duration}s</span>}
          {clip.in_point && clip.out_point && <span>{clip.in_point} → {clip.out_point}</span>}
        </div>
      </div>
      <Button variant="ghost" size="sm" onClick={onEdit} title="编辑">
        <Pencil className="h-4 w-4" />
      </Button>
      <Button variant="ghost" size="sm" onClick={onDelete} title="删除">
        <Trash2 className="h-4 w-4 text-red-400" />
      </Button>
    </div>
  );
}
