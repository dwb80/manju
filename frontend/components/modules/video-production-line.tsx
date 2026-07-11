"use client";

import { useState, useMemo, useEffect } from "react";
import { Video, Plus, Play, Pencil, Trash2 } from "lucide-react";
import { PageContainer, PageCard } from "@/components/layout/page-container";
import { StatCard, StatCardGrid, ModuleToolbar, SearchInput, FilterSelect, EmptyState } from "@/components/shared";
import { Button } from "@/components/ui/button";
import { FormDialog, type FormFieldConfig } from "@/components/ui/form-dialog";
import { ConfirmDialog } from "@/components/common/confirm-dialog";
import { useProjectStore } from "@/lib/stores/project-store";
import { listModuleVideoTasks, createModuleVideoTask, updateModuleVideoTask, deleteModuleVideoTask } from "@/services/module.service";
import { clearApiCache } from "@/lib/api-client";
import type { VideoTask } from "@/lib/module-types";

/** 视频任务状态中文标签映射 */
const statusLabels: Record<string, string> = {
  queued: "排队中",
  processing: "处理中",
  completed: "已完成",
  failed: "失败",
};

/** 视频任务表单字段配置 */
const videoFields: FormFieldConfig[] = [
  { name: "title", label: "视频标题", type: "text", required: true, placeholder: "请输入视频标题" },
  {
    name: "status",
    label: "状态",
    type: "select",
    required: true,
    options: [
      { value: "queued", label: "排队中" },
      { value: "processing", label: "处理中" },
      { value: "completed", label: "已完成" },
      { value: "failed", label: "失败" },
    ],
    defaultValue: "queued",
  },
  { name: "duration", label: "时长(秒)", type: "number", placeholder: "0", min: 0 },
  { name: "progress", label: "进度(0-100)", type: "number", placeholder: "0", min: 0, max: 100 },
  { name: "resolution", label: "分辨率", type: "text", placeholder: "如：1080p, 4K" },
  { name: "fps", label: "帧率", type: "number", placeholder: "如：30", min: 0 },
  { name: "format", label: "格式", type: "text", placeholder: "如：mp4, mov" },
  { name: "file_url", label: "文件地址", type: "text", placeholder: "请输入文件URL" },
];

export function VideoProductionLinePage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  // 对话框状态
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingVideo, setEditingVideo] = useState<VideoTask | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // 删除确认状态
  const [deleteConfirm, setDeleteConfirm] = useState<{ id: string; title: string } | null>(null);

  // 从 store 获取选中的项目ID
  const selectedProjectId = useProjectStore((state) => state.selectedProjectId);

  // 根据 selectedProjectId 加载视频数据
  const [videos, setVideos] = useState<VideoTask[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!selectedProjectId) { setVideos([]); return; }
    setIsLoading(true);
    listModuleVideoTasks(selectedProjectId)
      .then(data => setVideos(data))
      .catch(err => console.error("Failed to load videos:", err))
      .finally(() => setIsLoading(false));
  }, [selectedProjectId]);

  // 计算统计数据
  const stats = useMemo(() => {
    const totalDuration = videos.reduce((sum, v) => sum + (v.duration || 0), 0);
    const hours = Math.floor(totalDuration / 3600);
    const minutes = Math.floor((totalDuration % 3600) / 60);
    return {
      total: videos.length,
      processing: videos.filter((v) => v.status === "processing" || v.status === "queued").length,
      completed: videos.filter((v) => v.status === "completed").length,
      totalDuration: `${hours}h ${minutes}m`,
    };
  }, [videos]);

  const statusOptions = [
    { value: "", label: "全部状态" },
    { value: "queued", label: "排队中" },
    { value: "processing", label: "处理中" },
    { value: "completed", label: "已完成" },
    { value: "failed", label: "失败" },
  ];

  const filteredVideos = useMemo(() => {
    return videos.filter((video) => {
      const matchesSearch = video.title.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesStatus = !statusFilter || video.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [videos, searchQuery, statusFilter]);

  // 打开新建对话框
  const handleCreate = () => {
    setEditingVideo(null);
    setIsFormOpen(true);
  };

  // 打开编辑对话框
  const handleEdit = (video: VideoTask) => {
    setEditingVideo(video);
    setIsFormOpen(true);
  };

  // 保存视频（新建或编辑）
  const handleSave = async (values: Record<string, string | number | string[]>) => {
    setIsSaving(true);
    try {
      const payload = { ...values, project_id: selectedProjectId } as any;
      if (editingVideo) {
        await updateModuleVideoTask(editingVideo.id, payload);
      } else {
        await createModuleVideoTask(payload);
      }
      setIsFormOpen(false);
      setEditingVideo(null);
      // Refresh the list
      clearApiCache();
      const data = await listModuleVideoTasks(selectedProjectId);
      setVideos(data);
    } finally {
      setIsSaving(false);
    }
  };

  // 确认删除
  const handleDeleteConfirm = async () => {
    if (!deleteConfirm) return;
    await deleteModuleVideoTask(deleteConfirm.id);
    setDeleteConfirm(null);
    clearApiCache();
    const data = await listModuleVideoTasks(selectedProjectId);
    setVideos(data);
  };

  return (
    <PageContainer title="视频生产线" description="管理视频生成和编辑流程">
      <PageCard className="mb-6">
        <StatCardGrid columns={4}>
          <StatCard label="视频总数" value={stats.total} icon={Video} color="emerald" />
          <StatCard label="处理中" value={stats.processing} color="blue" />
          <StatCard label="已完成" value={stats.completed} color="purple" />
          <StatCard label="总时长" value={stats.totalDuration} color="orange" />
        </StatCardGrid>
      </PageCard>

      <ModuleToolbar
        left={
          <>
            <SearchInput value={searchQuery} onChange={setSearchQuery} placeholder="搜索视频..." />
            <FilterSelect value={statusFilter} onChange={setStatusFilter} options={statusOptions} placeholder="状态筛选" />
          </>
        }
        right={
          <>
            <Button variant="secondary" size="sm">
              <Play className="mr-2 h-4 w-4" />
              批量导入
            </Button>
            <Button size="sm" onClick={handleCreate}>
              <Plus className="mr-2 h-4 w-4" />
              新建视频
            </Button>
          </>
        }
      />

      <PageCard title="视频任务">
        {filteredVideos.length > 0 ? (
          <div className="space-y-3">
            {filteredVideos.map((video) => (
              <VideoTaskCard
                key={video.id}
                video={video}
                onEdit={() => handleEdit(video)}
                onDelete={() => setDeleteConfirm({ id: video.id, title: video.title })}
              />
            ))}
          </div>
        ) : (
          <EmptyState type="no-results" title="未找到视频" action={{ label: "新建视频", onClick: handleCreate }} />
        )}
      </PageCard>

      {/* 新建/编辑对话框 */}
      <FormDialog
        title={editingVideo ? "编辑视频" : "新建视频"}
        fields={videoFields}
        initialValues={editingVideo ? {
          title: editingVideo.title,
          status: editingVideo.status,
          duration: editingVideo.duration ?? 0,
          progress: editingVideo.progress ?? 0,
          resolution: editingVideo.resolution || "",
          fps: editingVideo.fps ?? 0,
          format: editingVideo.format || "",
          file_url: editingVideo.file_url || "",
        } : {}}
        isOpen={isFormOpen}
        onClose={() => { setIsFormOpen(false); setEditingVideo(null); }}
        onSave={handleSave}
        isLoading={isSaving}
      />

      {/* 删除确认对话框 */}
      {deleteConfirm && (
        <ConfirmDialog
          title="删除视频"
          description={`确定要删除视频「${deleteConfirm.title}」吗？此操作无法撤销。`}
          confirmLabel="删除"
          onClose={() => setDeleteConfirm(null)}
          onConfirm={handleDeleteConfirm}
        />
      )}
    </PageContainer>
  );
}

function VideoTaskCard({
  video,
  onEdit,
  onDelete,
}: {
  video: VideoTask;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const statusColors: Record<string, string> = {
    queued: "bg-gray-500/20 text-gray-400",
    processing: "bg-blue-500/20 text-blue-400",
    completed: "bg-emerald-500/20 text-emerald-400",
    failed: "bg-red-500/20 text-red-400",
  };

  const progress = video.status === "completed" ? 100 : video.progress ?? 0;

  return (
    <div className="flex items-center justify-between p-4 rounded-lg border border-white/10 bg-[#252525]">
      <div className="flex-1">
        <div className="flex items-center gap-3 mb-2">
          <h3 className="font-medium text-white">{video.title}</h3>
          <span className={`px-2 py-0.5 rounded text-xs ${statusColors[video.status] ?? "bg-gray-500/20 text-gray-400"}`}>
            {statusLabels[video.status] ?? video.status}
          </span>
          <span className="text-xs text-[#888]">时长: {video.duration ?? 0}s</span>
        </div>
        {(video.status === "processing" || video.status === "queued") && (
          <div className="w-full bg-[#1a1a1a] rounded-full h-2 mb-2">
            <div className="bg-emerald-500 h-2 rounded-full" style={{ width: `${progress}%` }} />
          </div>
        )}
        <div className="flex items-center gap-4 text-xs text-[#888]">
          {video.resolution && <span>分辨率: {video.resolution}</span>}
          {video.fps && <span>帧率: {video.fps}</span>}
          {video.format && <span>格式: {video.format}</span>}
        </div>
      </div>
      <div className="flex items-center gap-2">
        {video.status === "completed" && (
          <Button variant="ghost" size="sm">预览</Button>
        )}
        <Button variant="ghost" size="sm" onClick={onEdit} title="编辑">
          <Pencil className="h-4 w-4" />
        </Button>
        <Button variant="ghost" size="sm" onClick={onDelete} title="删除">
          <Trash2 className="h-4 w-4 text-red-400" />
        </Button>
      </div>
    </div>
  );
}