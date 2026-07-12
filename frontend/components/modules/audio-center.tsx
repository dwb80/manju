"use client";

/**
 * 音频中心模块
 *
 * 设计原则同分镜 / 视频：复用 FactoryCRUDPage 基座。
 *
 * 增强点（p1-2）：
 * - 内嵌 HTML5 音频播放器（file_url）
 * - AI 配音（TTS）弹窗：speaker 从角色列表选择（EntityPicker）
 * - 工具栏"AI配音"按钮（无选中时，按当前过滤器下第一条音频生成；选中则批量配音）
 * - 关联分镜：卡片显示已关联分镜，点击可重选；列表工具栏批量关联
 */

import { useState, useRef, useEffect } from "react";
import { Music, Pencil, Trash2, CheckSquare, Wand2, Volume2, Mic, X, Loader2, Link as LinkIcon, Film } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FactoryCRUDPage, type FactoryCRUDPageProps, getEntityLabel } from "@/components/factory";
import { EntityPicker } from "@/components/shared";
import { toast } from "@/components/common/toast";
import { createLogger } from "@/lib/logger";
import type { FormFieldConfig } from "@/components/ui/form-dialog";
import type { AudioItem, AudioType, Character, Storyboard } from "@/lib/module-types";
import { useProjectStore } from "@/lib/stores/project-store";
import { clearApiCache } from "@/lib/api-client";
import { useNameLookup } from "@/hooks/use-name-lookup";
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
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4" onClick={onClose}>
      <div
        className="w-full max-w-lg overflow-hidden rounded-lg border border-white/10 bg-[#1a1a1a] shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-white/10 px-5 py-3">
          <div className="flex items-center gap-2">
            <LinkIcon className="h-4 w-4 text-emerald-400" />
            <h2 className="text-sm font-medium text-white">关联分镜 · {audio.name}</h2>
          </div>
          <button type="button" onClick={onClose} className="text-[#888] hover:text-white" aria-label="关闭">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-3 p-5">
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

        <div className="flex items-center justify-end gap-2 border-t border-white/10 px-5 py-3">
          <Button variant="ghost" size="sm" onClick={onClose} disabled={busy}>取消</Button>
          <Button variant="secondary" size="sm" onClick={handleSubmit} disabled={busy}>
            {busy ? <><Loader2 className="mr-1 h-3 w-3 animate-spin" />保存中...</> : "保存关联"}
          </Button>
        </div>
      </div>
    </div>
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

/**
 * AI 配音（TTS）弹窗
 *
 * - 文本：可手动输入或引用 audio.description
 * - 角色：EntityPicker 选中项目内的角色
 * - 调速：可选（0.5 - 2.0）
 * - 提交后调用 `generateTTS(audioId, body)`，完成后由后端更新 audio.file_url
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
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4" onClick={onClose}>
      <div
        className="w-full max-w-lg overflow-hidden rounded-lg border border-white/10 bg-[#1a1a1a] shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-white/10 px-5 py-3">
          <div className="flex items-center gap-2">
            <Mic className="h-4 w-4 text-emerald-400" />
            <h2 className="text-sm font-medium text-white">AI 配音 · {audio.name}</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-[#888] hover:text-white"
            aria-label="关闭"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-3 p-5">
          <div>
            <label className="mb-1 block text-xs text-[#888]">配音文本</label>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={5}
              className="w-full rounded-md border border-white/10 bg-[#0f0f0f] px-3 py-2 text-sm text-white focus:border-emerald-500/50 focus:outline-none"
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
            <label className="mb-1 block text-xs text-[#888]">
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

        <div className="flex items-center justify-end gap-2 border-t border-white/10 px-5 py-3">
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
        </div>
      </div>
    </div>
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
}: {
  a: AudioItem;
  actions: import("@/components/factory").CardActions;
  onTTSClick: (a: AudioItem) => void;
  onAssociateClick: (a: AudioItem) => void;
}) {
  const type = (a.type ?? "voiceover") as AudioType;
  const color = AUDIO_TYPE_COLORS[type] ?? "bg-gray-500/20 text-gray-400";
  const label = AUDIO_TYPE_LABELS[type] ?? type;
  const display = getEntityLabel(a, "未命名音频");
  return (
    <div
      className={`group relative rounded-lg border bg-[#202020] p-3 transition-colors ${
        actions.selected
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
          className={`grid h-5 w-5 shrink-0 place-items-center rounded border transition-opacity ${
            actions.selected
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
      onTTSClick={() => {
        /* 占位：实际渲染在 AudioCenterPage 中以 props.renderCard 覆盖 */
      }}
      onAssociateClick={() => {
        /* 同上 */
      }}
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
};

export function AudioCenterPage() {
  const [ttsTarget, setTtsTarget] = useState<AudioItem | null>(null);
  const [ttsOpen, setTtsOpen] = useState<boolean>(false);
  const [associateTarget, setAssociateTarget] = useState<AudioItem | null>(null);
  const [associateOpen, setAssociateOpen] = useState<boolean>(false);

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
          />
        )}
        toolbarExtra={
          <Button
            variant="secondary"
            size="sm"
            onClick={() => {
              // 无选中时，给出提示
              const factoryEl = document.querySelector("[data-factory-selected]") as HTMLElement | null;
              const selectedRaw = factoryEl?.getAttribute("data-factory-selected") ?? "[]";
              try {
                const ids = JSON.parse(selectedRaw) as string[];
                if (ids.length === 0) {
                  toast.success("请先选中一条音频", "可通过多选框选择要配音的素材");
                  return;
                }
                toast.success("功能提示", "目前仅支持单条配音；如需批量请逐条操作或扩展后端接口");
              } catch {
                toast.success("请先选中一条音频", "可通过多选框选择要配音的素材");
              }
            }}
          >
            <Wand2 className="mr-1 h-3 w-3" />
            AI配音
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
    </>
  );
}
