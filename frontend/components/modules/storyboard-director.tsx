"use client";

/**
 * 分镜导演台模块
 *
 * 功能：
 * - 分镜列表展示
 * - 新建/编辑分镜对话框（含必填验证）
 * - 删除分镜确认
 */

import { useState, useMemo, useEffect } from "react";
import { Film, Plus, Play, Pencil, Trash2 } from "lucide-react";
import { PageContainer, PageCard } from "@/components/layout/page-container";
import { StatCard, StatCardGrid, ModuleToolbar, SearchInput, FilterSelect, EmptyState } from "@/components/shared";
import { Button } from "@/components/ui/button";
import { FormDialog, type FormFieldConfig } from "@/components/ui/form-dialog";
import { ConfirmDialog } from "@/components/common/confirm-dialog";
import { useProjectStore } from "@/lib/stores/project-store";
import { listStoryboards, createStoryboard, updateStoryboard, deleteStoryboard as deleteStoryboardApi } from "@/services/module.service";
import { clearApiCache } from "@/lib/api-client";
import type { Storyboard } from "@/lib/module-types";

/** 分镜状态中文标签映射 */
const statusLabels: Record<string, string> = {
  draft: "草稿",
  approved: "已批准",
  production: "制作中",
  completed: "已完成",
};

/** 分镜表单字段配置 */
const storyboardFields: FormFieldConfig[] = [
  {
    name: "description",
    label: "分镜描述",
    type: "textarea",
    required: true,
    placeholder: "请输入分镜描述",
    rows: 3,
  },
  {
    name: "status",
    label: "状态",
    type: "select",
    required: true,
    options: [
      { value: "draft", label: "草稿" },
      { value: "approved", label: "已批准" },
      { value: "production", label: "制作中" },
      { value: "completed", label: "已完成" },
    ],
    defaultValue: "draft",
  },
  { name: "shot_number", label: "镜头号", type: "number", placeholder: "1", min: 1 },
  { name: "duration", label: "时长(秒)", type: "number", placeholder: "5", min: 1 },
  { name: "camera_angle", label: "机位", type: "text", placeholder: "如：全景、特写、仰角" },
  { name: "movement", label: "运动", type: "text", placeholder: "如：固定、跟随、环绕" },
  { name: "dialogue", label: "台词", type: "textarea", placeholder: "请输入台词内容", rows: 2 },
  { name: "notes", label: "备注", type: "textarea", placeholder: "请输入备注信息", rows: 2 },
  { name: "scene_id", label: "场景ID", type: "text", placeholder: "请输入场景ID" },
];

export function StoryboardDirectorPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  // 对话框状态
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingStoryboard, setEditingStoryboard] = useState<Storyboard | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // 删除确认状态
  const [deleteConfirm, setDeleteConfirm] = useState<{ id: string; description: string } | null>(null);

  // 从 store 获取选中的项目ID
  const selectedProjectId = useProjectStore((state) => state.selectedProjectId);

  // 根据 selectedProjectId 加载分镜数据
  const [storyboards, setStoryboards] = useState<Storyboard[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!selectedProjectId) { setStoryboards([]); return; }
    setIsLoading(true);
    listStoryboards(selectedProjectId)
      .then(data => setStoryboards(data))
      .catch(err => console.error("Failed to load storyboards:", err))
      .finally(() => setIsLoading(false));
  }, [selectedProjectId]);

  const statusOptions = [
    { value: "", label: "全部状态" },
    { value: "draft", label: "草稿" },
    { value: "approved", label: "已批准" },
    { value: "production", label: "制作中" },
    { value: "completed", label: "已完成" },
  ];

  const filteredStoryboards = useMemo(() => {
    return storyboards.filter((sb) => {
      const matchesSearch = sb.description.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesStatus = !statusFilter || sb.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [storyboards, searchQuery, statusFilter]);

  // 统计数据
  const stats = useMemo(() => {
    return {
      total: storyboards.length,
      completed: storyboards.filter((s) => s.status === "completed").length,
      reviewing: storyboards.filter((s) => s.status === "production" || s.status === "approved").length,
      pending: storyboards.filter((s) => s.status === "draft").length,
    };
  }, [storyboards]);

  // 打开新建对话框
  const handleCreate = () => {
    setEditingStoryboard(null);
    setIsFormOpen(true);
  };

  // 打开编辑对话框
  const handleEdit = (storyboard: Storyboard) => {
    setEditingStoryboard(storyboard);
    setIsFormOpen(true);
  };

  // 保存分镜（新建或编辑）
  const handleSave = async (values: Record<string, string | number | string[]>) => {
    setIsSaving(true);
    try {
      const payload = { ...values, project_id: selectedProjectId } as any;
      if (editingStoryboard) {
        await updateStoryboard(editingStoryboard.id, payload);
      } else {
        await createStoryboard(payload);
      }
      setIsFormOpen(false);
      setEditingStoryboard(null);
      // Refresh the list
      clearApiCache();
      const data = await listStoryboards(selectedProjectId);
      setStoryboards(data);
    } finally {
      setIsSaving(false);
    }
  };

  // 确认删除
  const handleDeleteConfirm = async () => {
    if (!deleteConfirm) return;
    await deleteStoryboardApi(deleteConfirm.id);
    setDeleteConfirm(null);
    clearApiCache();
    const data = await listStoryboards(selectedProjectId);
    setStoryboards(data);
  };

  return (
    <PageContainer title="分镜导演台" description="设计和编排漫剧分镜">
      <PageCard className="mb-6">
        <StatCardGrid columns={4}>
          <StatCard label="分镜总数" value={stats.total} icon={Film} color="emerald" />
          <StatCard label="已完成" value={stats.completed} color="blue" />
          <StatCard label="审核中" value={stats.reviewing} color="purple" />
          <StatCard label="草稿" value={stats.pending} color="orange" />
        </StatCardGrid>
      </PageCard>

      <ModuleToolbar
        left={
          <>
            <SearchInput value={searchQuery} onChange={setSearchQuery} placeholder="搜索分镜..." />
            <FilterSelect value={statusFilter} onChange={setStatusFilter} options={statusOptions} placeholder="状态筛选" />
          </>
        }
        right={
          <>
            <Button variant="secondary" size="sm">
              <Play className="mr-2 h-4 w-4" />
              预览
            </Button>
            <Button size="sm" onClick={handleCreate}>
              <Plus className="mr-2 h-4 w-4" />
              新建分镜
            </Button>
          </>
        }
      />

      <PageCard title="分镜时间轴">
        {filteredStoryboards.length > 0 ? (
          <div className="space-y-3">
            {filteredStoryboards.map((storyboard) => (
              <StoryboardCard
                key={storyboard.id}
                storyboard={storyboard}
                onEdit={() => handleEdit(storyboard)}
                onDelete={() => setDeleteConfirm({ id: storyboard.id, description: storyboard.description })}
              />
            ))}
          </div>
        ) : (
          <EmptyState
            type="no-results"
            title="未找到分镜"
            description={searchQuery || statusFilter ? "尝试调整搜索条件" : "点击上方按钮创建新分镜"}
            action={{ label: "新建分镜", onClick: handleCreate }}
          />
        )}
      </PageCard>

      {/* 新建/编辑对话框 */}
      <FormDialog
        title={editingStoryboard ? "编辑分镜" : "新建分镜"}
        fields={storyboardFields}
        initialValues={
          editingStoryboard
            ? {
              description: editingStoryboard.description,
              status: editingStoryboard.status,
              shot_number: editingStoryboard.shot_number ?? 0,
              duration: editingStoryboard.duration ?? 0,
              camera_angle: editingStoryboard.camera_angle || "",
              movement: editingStoryboard.movement || "",
              dialogue: editingStoryboard.dialogue || "",
              notes: editingStoryboard.notes || "",
              scene_id: editingStoryboard.scene_id || "",
            }
            : {}
        }
        isOpen={isFormOpen}
        onClose={() => {
          setIsFormOpen(false);
          setEditingStoryboard(null);
        }}
        onSave={handleSave}
        isLoading={isSaving}
      />

      {/* 删除确认对话框 */}
      {deleteConfirm && (
        <ConfirmDialog
          title="删除分镜"
          description={`确定要删除分镜「${deleteConfirm.description}」吗？此操作无法撤销。`}
          confirmLabel="删除"
          onClose={() => setDeleteConfirm(null)}
          onConfirm={handleDeleteConfirm}
        />
      )}
    </PageContainer>
  );
}

function StoryboardCard({
  storyboard,
  onEdit,
  onDelete,
}: {
  storyboard: Storyboard;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const statusColors: Record<string, string> = {
    draft: "bg-gray-500/20 text-gray-400",
    approved: "bg-emerald-500/20 text-emerald-400",
    production: "bg-yellow-500/20 text-yellow-400",
    completed: "bg-purple-500/20 text-purple-400",
  };

  return (
    <div className="flex items-start gap-4 p-4 rounded-lg border border-white/10 bg-[#252525] hover:bg-white/5 transition-colors">
      <div className="flex flex-col items-center justify-center h-12 w-12 rounded bg-[#1a1a1a] text-emerald-400 font-bold text-lg">
        {storyboard.shot_number ?? "-"}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-3 mb-1">
          <span className={`px-2 py-0.5 rounded text-xs ${statusColors[storyboard.status] ?? "bg-gray-500/20 text-gray-400"}`}>
            {statusLabels[storyboard.status] ?? storyboard.status}
          </span>
          <span className="text-xs text-[#888]">时长: {storyboard.duration ?? 0}s</span>
          {storyboard.scene_id && <span className="text-xs text-[#888]">场景: {storyboard.scene_id}</span>}
        </div>
        <p className="text-sm text-[#888] mb-2">{storyboard.description}</p>
        {storyboard.dialogue && (
          <p className="text-sm text-white/70 italic mb-1">“{storyboard.dialogue}”</p>
        )}
        <div className="flex items-center gap-4 mt-2 text-xs text-[#666]">
          {storyboard.camera_angle && <span>机位: {storyboard.camera_angle}</span>}
          {storyboard.movement && <span>运动: {storyboard.movement}</span>}
        </div>
      </div>
      <div className="flex gap-2">
        <Button variant="ghost" size="sm" onClick={onEdit}>
          <Pencil className="h-4 w-4" />
        </Button>
        <Button variant="ghost" size="sm" onClick={onDelete}>
          <Trash2 className="h-4 w-4 text-red-400" />
        </Button>
      </div>
    </div>
  );
}