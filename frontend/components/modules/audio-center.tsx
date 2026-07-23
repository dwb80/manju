"use client";

/**
 * 音频中心模块
 *
 * 设计原则同分镜 / 视频：复用 FactoryCRUDPage 基座。
 *
 * 增强点（p1-2）：
 * - 内嵌 HTML5 音频播放器（file_url）
 * - AI 配音（TTS）弹窗：speaker 从角色列表选择（EntityPicker）
 * - 工具栏"AI配音"按钮（选中则批量配音）
 * - 关联分镜：卡片显示已关联分镜，点击可重选
 * - 时间轴编辑：设置 start_time / end_time 与视频对齐
 */

import { useState, useEffect, useCallback } from "react";
import { Music, Pencil, Trash2, CheckSquare, Wand2, Mic, Loader2, Link as LinkIcon, Film, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { FactoryCRUDPage, type FactoryCRUDPageProps, getEntityLabel } from "@/components/factory";
import { EntityPicker } from "@/components/shared";
import { toast } from "@/components/common/toast";
import { createLogger } from "@/lib/logger";
import type { FormFieldConfig } from "@/components/ui/form-dialog";
import type { AudioItem, AudioType, Character, Storyboard } from "@/lib/module-types";
import { useProjectStore } from "@/lib/stores/project-store";
import { clearApiCache } from "@/lib/api-client";
import {
  listAudios,
  createAudio,
  updateAudio,
  deleteAudio,
  listDeletedAudios,
  restoreAudio,
  permanentDeleteAudios,
  copyAudioToProjects,
  generateTTS,
  batchGenerateTTS,
} from "@/services/audio.service";
import { listCharacters } from "@/services/module.service";
import { listStoryboards } from "@/services/storyboard.service";
import {
  AUDIO_TYPE_LABELS,
  AUDIO_TYPE_COLORS,
  AUDIO_TYPE_OPTIONS,
} from "@/lib/module-dictionaries";

// 模块级 logger
const log = createLogger('audio-center')

/** 音频表单字段。 */
const audioFields: FormFieldConfig[] = [
  { name: "name", label: "音频名称", type: "text", required: true, placeholder: "请输入音频名称" },
  {
    name: "type",
    label: "音频类型",
    type: "select",
    required: true,
    options: AUDIO_TYPE_OPTIONS,
    defaultValue: "voiceover",
  },
  { name: "episode", label: "集数", type: "number", placeholder: "1", min: 1, defaultValue: 1 },
  { name: "duration", label: "时长（秒）", type: "number", placeholder: "0", min: 0 },
  { name: "file_url", label: "文件路径", type: "text", placeholder: "请输入文件路径" },
  { name: "speaker", label: "说话人", type: "text", placeholder: "请输入说话人" },
  { name: "format", label: "格式", type: "text", placeholder: "mp3" },
];

/** 关联分镜弹窗：选一个项目内的分镜写入 audio.storyboard_id */
function AssociateStoryboardDialog({
  audio,
  isOpen,
  onClose,
  onSuccess,
}: {
  audio: AudioItem | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}) {
  const [storyboardId, setStoryboardId] = useState<string>("");
  const [busy, setBusy] = useState<boolean>(false);

  useEffect(() => {
    if (isOpen && audio) {
      setStoryboardId(audio.storyboard_id ?? "");
    }
  }, [isOpen, audio]);

  if (!isOpen || !audio) return null;

  const handleSubmit = async () => {
    setBusy(true);
    try {
      await updateAudio(audio.id, { storyboard_id: storyboardId });
      clearApiCache();
      log.info('associate storyboard success', { audioId: audio.id, storyboardId })
      toast.success("已关联分镜", storyboardId ? "音频已绑定到分镜" : "已清空分镜关联");
      onSuccess?.();
      onClose();
    } catch (err) {
      log.error('associate storyboard failed', { error: (err as Error).message })
      toast.error("关联失败", (err as Error)?.message ?? "请稍后重试");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="border-border">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <LinkIcon className="h-4 w-4 text-emerald-400" />
            关联分镜 · {audio.name}
          </DialogTitle>
          <DialogDescription>将这条音频绑定到指定分镜，或解除关联</DialogDescription>
        </DialogHeader>

        <div className="space-y-3 px-6">
          <EntityPicker<Storyboard>
            name="audio-storyboard"
            label="关联分镜（这条音频用在哪个镜头）"
            placeholder="选择项目内的分镜"
            value={storyboardId}
            onChange={setStoryboardId}
            fetcher={listStoryboards}
            formatLabel={(s) => s.title || `第 ${s.episode ?? 1} 集 · 镜头 ${s.shot_number}`}
            formatHint={(s) => s.description?.slice(0, 40) ?? ""}
            allowEmpty
            emptyLabel="不关联分镜"
          />
        </div>

        <DialogFooter className="gap-2">
          <Button variant="ghost" size="sm" onClick={onClose} disabled={busy}>取消</Button>
          <Button variant="secondary" size="sm" onClick={handleSubmit} disabled={busy}>
            {busy ? <><Loader2 className="mr-1 h-3 w-3 animate-spin" />保存中...</> : "保存关联"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** 时间轴编辑弹窗：设置 audio.start_time / end_time */
function TimelineDialog({
  audio,
  isOpen,
  onClose,
  onSuccess,
}: {
  audio: AudioItem | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}) {
  const [startTime, setStartTime] = useState<string>("");
  const [endTime, setEndTime] = useState<string>("");
  const [busy, setBusy] = useState<boolean>(false);

  useEffect(() => {
    if (isOpen && audio) {
      setStartTime(audio.start_time !== undefined ? String(audio.start_time) : "");
      setEndTime(audio.end_time !== undefined ? String(audio.end_time) : "");
    }
  }, [isOpen, audio]);

  if (!isOpen || !audio) return null;

  const handleSubmit = async () => {
    setBusy(true);
    try {
      const patch: Partial<AudioItem> = {};
      if (startTime.trim() !== "") {
        patch.start_time = parseFloat(startTime);
      } else {
        patch.start_time = undefined as any;
      }
      if (endTime.trim() !== "") {
        patch.end_time = parseFloat(endTime);
      } else {
        patch.end_time = undefined as any;
      }
      await updateAudio(audio.id, patch);
      clearApiCache();
      toast.success("时间轴已更新", `起始: ${startTime || "未设置"}s, 结束: ${endTime || "未设置"}s`);
      onSuccess?.();
      onClose();
    } catch (err) {
      toast.error("更新失败", (err as Error)?.message ?? "请稍后重试");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="border-border">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-orange-400" />
            时间轴编辑 · {audio.name}
          </DialogTitle>
          <DialogDescription>设置音频在时间轴上的起始和结束位置（秒），用于与视频对齐</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 px-6">
          <div>
            <label className="mb-1 block text-xs text-muted-foreground">起始时间（秒）</label>
            <input
              type="number"
              min={0}
              step={0.1}
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
              placeholder="例如: 0.0"
              className="w-full rounded-md border border-input bg-muted px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary/50 focus:outline-none focus:ring-2 focus:ring-ring/40"
            />
            <p className="text-[10px] text-[#666] mt-1">留空表示不设置起始时间</p>
          </div>
          <div>
            <label className="mb-1 block text-xs text-muted-foreground">结束时间（秒）</label>
            <input
              type="number"
              min={0}
              step={0.1}
              value={endTime}
              onChange={(e) => setEndTime(e.target.value)}
              placeholder="例如: 5.5"
              className="w-full rounded-md border border-input bg-muted px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary/50 focus:outline-none focus:ring-2 focus:ring-ring/40"
            />
            <p className="text-[10px] text-[#666] mt-1">留空表示不设置结束时间</p>
          </div>
          <div className="rounded-md bg-orange-500/5 border border-orange-500/20 px-3 py-2">
            <p className="text-xs text-orange-300/80">
              提示：设置时间轴后，音频将在视频编辑时自动对齐到指定位置。
            </p>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="ghost" size="sm" onClick={onClose} disabled={busy}>取消</Button>
          <Button variant="secondary" size="sm" onClick={handleSubmit} disabled={busy}>
            {busy ? <><Loader2 className="mr-1 h-3 w-3 animate-spin" />保存中...</> : "保存时间轴"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** 集数下拉选项（1-20）。 */
const episodeOptions: { value: string; label: string }[] = [
  { value: "", label: "全部集数" },
  ...Array.from({ length: 20 }, (_, i) => ({ value: String(i + 1), label: `第 ${i + 1} 集` })),
];

/** 把秒数格式化为 m:ss。 */
function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

/** 把时间（秒）格式化为 mm:ss.ms */
function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  const ms = Math.floor((seconds % 1) * 10);
  return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}${ms > 0 ? "." + ms : ""}`;
}

/**
 * AI 配音（TTS）弹窗
 */
function TTSDialog({
  audio,
  isOpen,
  onClose,
  onSuccess,
}: {
  audio: AudioItem | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}) {
  const [text, setText] = useState<string>("");
  const [characterId, setCharacterId] = useState<string>("");
  const [speed, setSpeed] = useState<number>(1.0);
  const [busy, setBusy] = useState<boolean>(false);

  useEffect(() => {
    if (isOpen && audio) {
      setText(audio.description ?? "");
      setCharacterId(audio.character_id ?? "");
      setSpeed(1.0);
    }
  }, [isOpen, audio]);

  if (!isOpen || !audio) return null;

  const handleSubmit = async () => {
    if (!text.trim()) {
      toast.error("请输入文本", "AI 配音需要文本内容");
      return;
    }
    setBusy(true);
    try {
      await generateTTS(audio.id, {
        text: text.trim(),
        speaker: characterId || audio.speaker,
        speed,
      });
      clearApiCache();
      toast.success("配音已生成", "请刷新列表查看最新文件");
      onSuccess?.();
      onClose();
    } catch (err) {
      toast.error("配音失败", (err as Error)?.message ?? "请稍后重试");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="border-border">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Mic className="h-4 w-4 text-emerald-400" />
            AI 配音 · {audio.name}
          </DialogTitle>
          <DialogDescription>输入配音文本并选择角色与语速，生成新的音频文件</DialogDescription>
        </DialogHeader>

        <div className="space-y-3 px-6">
          <div>
            <label className="mb-1 block text-xs text-muted-foreground">配音文本</label>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={5}
              className="w-full rounded-md border border-input bg-muted px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary/50 focus:outline-none focus:ring-2 focus:ring-ring/40"
              placeholder="请输入要配音的文本..."
            />
          </div>

          <EntityPicker<Character>
            name="tts-character"
            label="说话角色"
            placeholder="选择项目内的角色"
            value={characterId}
            onChange={setCharacterId}
            fetcher={listCharacters}
            formatLabel={(c) => c.name}
            formatHint={(c) => c.role ?? ""}
            allowEmpty
            emptyLabel="不指定（系统默认）"
          />

          <div>
            <label className="mb-1 block text-xs text-muted-foreground">
              语速：<span className="text-emerald-300">{speed.toFixed(1)}x</span>
            </label>
            <input
              type="range"
              min={0.5}
              max={2.0}
              step={0.1}
              value={speed}
              onChange={(e) => setSpeed(Number(e.target.value))}
              className="w-full"
            />
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="ghost" size="sm" onClick={onClose} disabled={busy}>
            取消
          </Button>
          <Button variant="secondary" size="sm" onClick={handleSubmit} disabled={busy}>
            {busy ? (
              <>
                <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                生成中...
              </>
            ) : (
              <>
                <Wand2 className="mr-1 h-3 w-3" />
                开始配音
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/**
 * 音频卡片：内嵌播放器 + AI 配音按钮
 */
function AudioCard({
  a,
  actions,
  onTTSClick,
  onAssociateClick,
  onTimelineClick,
}: {
  a: AudioItem;
  actions: import("@/components/factory").CardActions;
  onTTSClick: (a: AudioItem) => void;
  onAssociateClick: (a: AudioItem) => void;
  onTimelineClick: (a: AudioItem) => void;
}) {
  const type = (a.type ?? "voiceover") as AudioType;
  const color = AUDIO_TYPE_COLORS[type] ?? "bg-gray-500/20 text-gray-400";
  const label = AUDIO_TYPE_LABELS[type] ?? type;
  const display = getEntityLabel(a, "未命名音频");
  return (
    <div
      className={`group relative rounded-lg border bg-[#202020] p-3 transition-colors ${actions.selected
        ? "border-emerald-500 ring-1 ring-emerald-500/40"
        : "border-white/10 hover:border-emerald-500/50"
        }`}
    >
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            actions.onToggleSelect();
          }}
          className={`grid h-5 w-5 shrink-0 place-items-center rounded border transition-opacity ${actions.selected
            ? "border-emerald-500 bg-emerald-500 opacity-100"
            : "border-white/40 bg-black/30 opacity-0 group-hover:opacity-100 hover:border-emerald-400"
            }`}
          aria-label={actions.selected ? "取消选择" : "选择"}
        >
          {actions.selected && <CheckSquare className="h-3 w-3 text-white" />}
        </button>
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-emerald-500/10">
          <Music className="h-5 w-5 text-emerald-400" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <h3 className="font-medium text-white text-sm truncate">{display}</h3>
            <span className={`px-2 py-0.5 rounded text-xs ${color}`}>{label}</span>
            <span className="text-emerald-300/90 bg-emerald-500/10 px-1.5 py-0.5 rounded text-xs">
              第 {a.episode ?? 1} 集
            </span>
            <span className="text-xs text-[#888]">时长: {formatDuration(a.duration ?? 0)}</span>
            {a.speaker && <span className="text-xs text-[#888]">说话人: {a.speaker}</span>}
            {a.format && <span className="text-xs text-[#888]">格式: {a.format}</span>}
            {a.storyboard_id && (
              <span className="inline-flex items-center gap-1 text-xs text-blue-300/90 bg-blue-500/10 px-1.5 py-0.5 rounded" title="已关联分镜">
                <Film className="h-3 w-3" />
                已关联分镜
              </span>
            )}
            {a.shot_id && (
              <span className="inline-flex items-center gap-1 text-xs text-purple-300/90 bg-purple-500/10 px-1.5 py-0.5 rounded" title="已关联镜头">
                <Film className="h-3 w-3" />
                已关联镜头
              </span>
            )}
            {(a.start_time !== undefined || a.end_time !== undefined) && (
              <span className="text-xs text-orange-300/90 bg-orange-500/10 px-1.5 py-0.5 rounded">
                {formatTime(a.start_time ?? 0)} - {formatTime(a.end_time ?? (a.duration ?? 0))}
              </span>
            )}
          </div>
          {a.file_url ? (
            <audio
              src={a.file_url}
              controls
              className="w-full h-8 mt-1"
              preload="metadata"
            />
          ) : (
            <div className="text-[10px] text-[#666] mt-1">尚未生成音频文件</div>
          )}
        </div>
        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onTTSClick(a)}
            title="AI 配音"
            className="text-emerald-300"
          >
            <Mic className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onTimelineClick(a)}
            title="编辑时间轴"
            className="text-orange-300"
          >
            <Clock className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onAssociateClick(a)}
            title="关联分镜"
            className="text-blue-300"
          >
            <LinkIcon className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="sm" onClick={actions.onEdit}>
            <Pencil className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="sm" onClick={actions.onDelete} className="text-red-400">
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}

const config: FactoryCRUDPageProps<AudioItem> = {
  title: "音频中心",
  description: "管理音频素材与配音",
  entityLabel: "音频",
  listTitle: "音频素材",
  emptyTitle: "未找到音频",
  searchPlaceholder: "搜索音频名称、说话人、格式...",

  fetchList: listAudios,
  createItem: createAudio as unknown as (input: Record<string, unknown>) => Promise<AudioItem>,
  updateItem: updateAudio as unknown as (id: string, input: Record<string, unknown>) => Promise<AudioItem>,
  deleteItem: deleteAudio,
  restoreItem: restoreAudio,
  fetchDeleted: listDeletedAudios,
  permanentDelete: permanentDeleteAudios,
  copyToProjects: copyAudioToProjects,

  fields: audioFields,
  toFormValues: (a) => ({
    name: a.name ?? "",
    type: a.type ?? "voiceover",
    episode: a.episode ?? 1,
    duration: a.duration ?? 0,
    file_url: a.file_url ?? "",
    speaker: a.speaker ?? "",
    format: a.format ?? "",
  }),

  gridClassName: "grid-cols-1",

  // P0-5：集数二级筛选
  secondaryFilter: {
    options: episodeOptions,
    placeholder: "集数",
    match: (a, v) => !v || String(a.episode ?? 1) === v,
  },

  // p1-2：renderCard 由 AudioCenterPage 注入（需要外部 onTTSClick / onAssociateClick 回调）。
  // 此处提供一个空的占位渲染，FactoryCRUDPage 接收 props 时的 renderCard 优先。
  renderCard: (a, actions) => (
    <AudioCard
      a={a}
      actions={actions}
      onTTSClick={() => {}}
      onAssociateClick={() => {}}
      onTimelineClick={() => {}}
    />
  ),

  searchFields: (a, q) => {
    if ((a.name ?? "").toLowerCase().includes(q)) return true;
    if ((a.speaker ?? "").toLowerCase().includes(q)) return true;
    if ((a.format ?? "").toLowerCase().includes(q)) return true;
    return false;
  },

  filterOptions: [
    { value: "", label: "全部类型" },
    ...AUDIO_TYPE_OPTIONS,
  ],
  filterField: (a, v) => !v || a.type === v,
  filterPlaceholder: "音频类型",

  stats: (list) => [
    { label: "音频总数", value: list.length, icon: Music, color: "emerald" },
    { label: "配音", value: list.filter((a) => a.type === "voiceover").length, color: "blue" },
    { label: "背景音乐", value: list.filter((a) => a.type === "bgm").length, color: "purple" },
    { label: "音效", value: list.filter((a) => a.type === "sfx").length, color: "orange" },
  ],
  // 音频中心：不展示顶部统计卡片
  showStats: false,
};

export function AudioCenterPage() {
  const [ttsTarget, setTtsTarget] = useState<AudioItem | null>(null);
  const [ttsOpen, setTtsOpen] = useState<boolean>(false);
  const [associateTarget, setAssociateTarget] = useState<AudioItem | null>(null);
  const [associateOpen, setAssociateOpen] = useState<boolean>(false);
  const [timelineTarget, setTimelineTarget] = useState<AudioItem | null>(null);
  const [timelineOpen, setTimelineOpen] = useState<boolean>(false);

  // 监听 FactoryCRUDPage 内的选中状态变化（用于批量 TTS）
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [audioList, setAudioList] = useState<AudioItem[]>([]);
  const [isBatchTTSLoading, setIsBatchTTSLoading] = useState(false);
  const selectedProjectId = useProjectStore((s) => s.selectedProjectId);

  // 拉取音频列表（用于批量 TTS 时获取选中项的详细信息）
  useEffect(() => {
    if (!selectedProjectId) {
      setAudioList([]);
      return;
    }
    listAudios(selectedProjectId)
      .then((data) => setAudioList(data))
      .catch((err) => console.warn("listAudios failed", err));
  }, [selectedProjectId]);

  // 监听选中状态变化
  useEffect(() => {
    if (typeof window === "undefined") return;
    const id = setInterval(() => {
      const container = document.querySelector("[data-factory-selected]");
      if (!container) return;
      try {
        const raw = container.getAttribute("data-factory-selected") ?? "[]";
        const ids: string[] = JSON.parse(raw);
        setSelectedIds((prev) => {
          const next = new Set(ids);
          if (next.size === prev.size && Array.from(next).every((x) => prev.has(x))) return prev;
          return next;
        });
      } catch {
        // ignore parse errors
      }
    }, 500);
    return () => clearInterval(id);
  }, []);

  // 批量 TTS 处理
  const handleBatchTTS = useCallback(async () => {
    if (!selectedProjectId) {
      toast.error("未选择项目", "请先在右上角选择或创建项目");
      return;
    }
    if (selectedIds.size === 0) {
      toast.error("未选中音频", "请先勾选要配音的音频素材");
      return;
    }

    // 获取选中音频的详细信息
    const selectedAudios = audioList.filter((a) => selectedIds.has(a.id));
    if (selectedAudios.length === 0) {
      toast.error("未找到选中音频", "请刷新列表后重试");
      return;
    }

    // 过滤出有 description（文本内容）的音频
    const validAudios = selectedAudios.filter((a) => a.description?.trim());
    if (validAudios.length === 0) {
      toast.error("无可用文本", "选中的音频都没有描述文本，无法生成配音");
      return;
    }

    setIsBatchTTSLoading(true);
    try {
      const items = validAudios.map((a) => ({
        text: a.description!.trim(),
        speaker: a.speaker || "默认配音",
        character_id: a.character_id,
        storyboard_id: a.storyboard_id,
        shot_id: a.shot_id,
      }));

      const result = await batchGenerateTTS({
        project_id: selectedProjectId,
        items,
      });

      toast.success(
        "批量配音完成",
        `成功: ${result.success.length} 条, 失败: ${result.failed} 条`
      );
      clearApiCache();
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("factory:reload"));
      }
    } catch (err) {
      toast.error("批量配音失败", (err as Error)?.message ?? "请稍后重试");
    } finally {
      setIsBatchTTSLoading(false);
    }
  }, [selectedIds, audioList, selectedProjectId]);

  return (
    <>
      <FactoryCRUDPage<AudioItem>
        {...config}
        renderCard={(a, actions) => (
          <AudioCard
            a={a}
            actions={actions}
            onTTSClick={(it) => {
              setTtsTarget(it);
              setTtsOpen(true);
            }}
            onAssociateClick={(it) => {
              setAssociateTarget(it);
              setAssociateOpen(true);
            }}
            onTimelineClick={(it) => {
              setTimelineTarget(it);
              setTimelineOpen(true);
            }}
          />
        )}
        toolbarExtra={
          <Button
            variant="secondary"
            size="sm"
            onClick={handleBatchTTS}
            disabled={isBatchTTSLoading || selectedIds.size === 0}
            title={selectedIds.size === 0 ? "请先勾选要配音的音频" : `为选中的 ${selectedIds.size} 条音频批量配音`}
          >
            {isBatchTTSLoading ? (
              <>
                <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                配音中...
              </>
            ) : (
              <>
                <Wand2 className="mr-1 h-3 w-3" />
                AI配音{selectedIds.size > 0 ? `(${selectedIds.size})` : ""}
              </>
            )}
          </Button>
        }
      />
      <TTSDialog
        audio={ttsTarget}
        isOpen={ttsOpen}
        onClose={() => setTtsOpen(false)}
        onSuccess={() => {
          if (typeof window !== "undefined") {
            window.dispatchEvent(new CustomEvent("factory:reload"));
          }
        }}
      />
      <AssociateStoryboardDialog
        audio={associateTarget}
        isOpen={associateOpen}
        onClose={() => setAssociateOpen(false)}
        onSuccess={() => {
          if (typeof window !== "undefined") {
            window.dispatchEvent(new CustomEvent("factory:reload"));
          }
        }}
      />
      <TimelineDialog
        audio={timelineTarget}
        isOpen={timelineOpen}
        onClose={() => setTimelineOpen(false)}
        onSuccess={() => {
          if (typeof window !== "undefined") {
            window.dispatchEvent(new CustomEvent("factory:reload"));
          }
        }}
      />
    </>
  );
}

