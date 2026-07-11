"use client";

/**
 * 音频中心模块
 *
 * 功能：
 * - 音频列表展示
 * - 新建/编辑音频对话框（含必填验证）
 * - 删除音频确认
 */

import { useState } from "react";
import { Music, Plus, Upload, Pencil, Trash2 } from "lucide-react";
import { PageContainer, PageCard } from "@/components/layout/page-container";
import { StatCard, StatCardGrid, ModuleToolbar, SearchInput, FilterSelect, EmptyState } from "@/components/shared";
import { Button } from "@/components/ui/button";
import { FormDialog, type FormFieldConfig } from "@/components/ui/form-dialog";
import { ConfirmDialog } from "@/components/common/confirm-dialog";
import { useModuleCrud } from "@/hooks/use-module-crud";
import type { AudioItem, AudioType } from "@/lib/module-types";

/** 音频表单字段配置 */
const audioFields: FormFieldConfig[] = [
  { name: "name", label: "音频名称", type: "text", required: true, placeholder: "请输入音频名称" },
  {
    name: "type",
    label: "音频类型",
    type: "select",
    required: true,
    options: [
      { value: "voiceover", label: "配音" },
      { value: "bgm", label: "背景音乐" },
      { value: "sfx", label: "音效" },
    ],
    defaultValue: "voiceover",
  },
  { name: "duration", label: "时长（秒）", type: "number", placeholder: "0", min: 0 },
  { name: "file_url", label: "文件路径", type: "text", placeholder: "请输入文件路径" },
  { name: "speaker", label: "说话人", type: "text", placeholder: "请输入说话人" },
  { name: "format", label: "格式", type: "text", placeholder: "mp3" },
];

export function AudioCenterPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState("");

  // 对话框状态
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingAudio, setEditingAudio] = useState<AudioItem | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // 删除确认状态
  const [deleteConfirm, setDeleteConfirm] = useState<{ id: string; name: string } | null>(null);

  // 使用通用 CRUD Hook
  const { items: audios, isLoading, create, update, remove } = useModuleCrud<AudioItem>("/api/audios");

  // 计算统计数据
  const stats = {
    total: audios.length,
    voiceover: audios.filter((a) => a.type === "voiceover").length,
    bgm: audios.filter((a) => a.type === "bgm").length,
    sfx: audios.filter((a) => a.type === "sfx").length,
  };

  // 筛选音频列表
  const filteredAudios = audios.filter((audio) => {
    const matchesSearch = audio.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesType = !typeFilter || audio.type === typeFilter;
    return matchesSearch && matchesType;
  });

  // 打开新建对话框
  const handleCreate = () => {
    setEditingAudio(null);
    setIsFormOpen(true);
  };

  // 打开编辑对话框
  const handleEdit = (audio: AudioItem) => {
    setEditingAudio(audio);
    setIsFormOpen(true);
  };

  // 保存音频（新建或编辑）
  const handleSave = async (values: Record<string, string | number | string[]>) => {
    setIsSaving(true);
    try {
      const data = {
        name: String(values.name),
        type: String(values.type) as AudioType,
        duration: Number(values.duration || 0),
        file_url: String(values.file_url || ""),
        speaker: String(values.speaker || ""),
        format: String(values.format || ""),
        tags: [] as string[],
        size: 0,
      };

      let result: AudioItem | null = null;
      if (editingAudio) {
        result = await update(editingAudio.id, data);
      } else {
        result = await create(data);
      }

      if (result) {
        setIsFormOpen(false);
        setEditingAudio(null);
      }
    } finally {
      setIsSaving(false);
    }
  };

  // 确认删除
  const handleDeleteConfirm = async () => {
    if (!deleteConfirm) return;
    const success = await remove(deleteConfirm.id);
    if (success) {
      setDeleteConfirm(null);
    }
  };

  const typeOptions = [
    { value: "", label: "全部类型" },
    { value: "voiceover", label: "配音" },
    { value: "bgm", label: "背景音乐" },
    { value: "sfx", label: "音效" },
  ];

  return (
    <PageContainer title="音频中心" description="管理音频素材和配音">
      {/* 统计卡片 */}
      <PageCard className="mb-6">
        <StatCardGrid columns={4}>
          <StatCard label="音频总数" value={stats.total} icon={Music} color="emerald" />
          <StatCard label="配音" value={stats.voiceover} color="blue" />
          <StatCard label="背景音乐" value={stats.bgm} color="purple" />
          <StatCard label="音效" value={stats.sfx} color="orange" />
        </StatCardGrid>
      </PageCard>

      {/* 工具栏 */}
      <ModuleToolbar
        left={
          <>
            <SearchInput value={searchQuery} onChange={setSearchQuery} placeholder="搜索音频..." />
            <FilterSelect value={typeFilter} onChange={setTypeFilter} options={typeOptions} placeholder="音频类型" />
          </>
        }
        right={
          <>
            <Button variant="secondary" size="sm">
              <Upload className="mr-2 h-4 w-4" />
              上传音频
            </Button>
            <Button size="sm" onClick={handleCreate}>
              <Plus className="mr-2 h-4 w-4" />
              新建音频
            </Button>
          </>
        }
      />

      {/* 音频列表 */}
      <PageCard title="音频素材">
        {isLoading ? (
          <div className="text-center py-8 text-[#888]">加载中...</div>
        ) : filteredAudios.length > 0 ? (
          <div className="space-y-2">
            {filteredAudios.map((audio) => (
              <AudioItemCard
                key={audio.id}
                audio={audio}
                onEdit={() => handleEdit(audio)}
                onDelete={() => setDeleteConfirm({ id: audio.id, name: audio.name })}
              />
            ))}
          </div>
        ) : (
          <EmptyState
            type="no-results"
            title="未找到音频"
            description={searchQuery || typeFilter ? "尝试调整搜索条件" : "点击上方按钮创建新音频"}
            action={{ label: "新建音频", onClick: handleCreate }}
          />
        )}
      </PageCard>

      {/* 新建/编辑对话框 */}
      <FormDialog
        title={editingAudio ? "编辑音频" : "新建音频"}
        fields={audioFields}
        initialValues={editingAudio ? {
          name: editingAudio.name,
          type: editingAudio.type,
          duration: editingAudio.duration,
          file_url: editingAudio.file_url,
          speaker: editingAudio.speaker || "",
          format: editingAudio.format || "",
        } : {}}
        isOpen={isFormOpen}
        onClose={() => { setIsFormOpen(false); setEditingAudio(null); }}
        onSave={handleSave}
        isLoading={isSaving}
      />

      {/* 删除确认对话框 */}
      {deleteConfirm && (
        <ConfirmDialog
          title="删除音频"
          description={`确定要删除音频「${deleteConfirm.name}」吗？此操作无法撤销。`}
          confirmLabel="删除"
          onClose={() => setDeleteConfirm(null)}
          onConfirm={handleDeleteConfirm}
        />
      )}
    </PageContainer>
  );
}

function AudioItemCard({
  audio,
  onEdit,
  onDelete,
}: {
  audio: AudioItem;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const typeLabels: Record<AudioType, string> = {
    voiceover: "配音",
    bgm: "背景音乐",
    sfx: "音效",
  };

  const typeColors: Record<AudioType, string> = {
    voiceover: "bg-emerald-500/20 text-emerald-400",
    bgm: "bg-blue-500/20 text-blue-400",
    sfx: "bg-purple-500/20 text-purple-400",
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  return (
    <div className="flex items-center justify-between p-3 rounded-lg border border-white/10 bg-[#252525] hover:bg-white/5">
      <div className="flex items-center gap-3 flex-1">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-500/10">
          <Music className="h-5 w-5 text-emerald-400" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h3 className="font-medium text-white text-sm">{audio.name}</h3>
            <span className={`px-2 py-0.5 rounded text-xs ${typeColors[audio.type]}`}>
              {typeLabels[audio.type]}
            </span>
          </div>
          <div className="flex items-center gap-3 text-xs text-[#888]">
            <span>时长: {formatDuration(audio.duration)}</span>
            {audio.speaker && <span>说话人: {audio.speaker}</span>}
            {audio.format && <span>格式: {audio.format}</span>}
          </div>
        </div>
      </div>
      <div className="flex gap-2">
        <Button variant="ghost" size="sm">播放</Button>
        <Button variant="ghost" size="sm">下载</Button>
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