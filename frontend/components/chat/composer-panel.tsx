"use client";

import { useEffect } from "react";
import type { RefObject } from "react";
import { ImagePlus, Loader2, Paperclip, Pencil, Send, Video, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { defaultVideoSize, estimateVideoSeconds, aspectRatioOptions, defaultSizeFromRatio, imageSizeOptions } from "@/lib/project-workflow";
import { formatBytes } from "@/lib/media-tools";
import type { Attachment, ChatSettings, ImageRatio, ImageSettings, Mode, VideoMode, VideoRatio, VideoSettings } from "@/lib/app-types";
import { AspectRatioPicker } from "@/components/modules/image-picker-aspect-ratio";

type ComposerPanelProps = {
  mode: Mode;
  prompt: string;
  attachments: Attachment[];
  chatSettings: ChatSettings;
  imageSettings: ImageSettings;
  videoSettings: VideoSettings;
  enhancingPrompt: boolean;
  submitting: boolean;
  fileInputRef: RefObject<HTMLInputElement | null>;
  onPromptChange: (value: string) => void;
  onChatSettingsChange: (updater: (draft: ChatSettings) => ChatSettings) => void;
  onImageSettingsChange: (updater: (draft: ImageSettings) => ImageSettings) => void;
  onVideoSettingsChange: (updater: (draft: VideoSettings) => VideoSettings) => void;
  onAddFiles: (files: FileList) => void;
  onRemoveAttachment: (attachment: Attachment) => void;
  onModeChange: (mode: Mode) => void;
  onEnhancePrompt: () => void;
  onSubmit: () => void;
};

/** Renders the fixed composer with attachment previews, mode switcher, and video parameters. */
export function ComposerPanel({
  mode,
  prompt,
  attachments,
  chatSettings,
  imageSettings,
  videoSettings,
  enhancingPrompt,
  submitting,
  fileInputRef,
  onPromptChange,
  onChatSettingsChange,
  onImageSettingsChange,
  onVideoSettingsChange,
  onAddFiles,
  onRemoveAttachment,
  onModeChange,
  onEnhancePrompt,
  onSubmit,
}: ComposerPanelProps) {
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.ctrlKey || event.metaKey) {
        if (event.key === "1") {
          event.preventDefault();
          onModeChange("chat");
        } else if (event.key === "2") {
          event.preventDefault();
          onModeChange("image");
        } else if (event.key === "3") {
          event.preventDefault();
          onModeChange("video");
        }
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onModeChange]);

  return (
    <footer className={`border-t border-white/5 bg-[#181818]/80 px-8 backdrop-blur ${mode === "video" ? "pb-6 pt-6" : "pb-4 pt-3"}`}>
      <div
        className={`pointer-events-auto mx-auto flex max-h-[52vh] w-full flex-col overflow-hidden border border-white/10 bg-[#2f2f2f] p-4 shadow-lg ${mode === "video" ? "max-w-[980px] rounded-[22px]" : "max-w-[768px] rounded-[28px]"}`}
        onDragOver={(event) => event.preventDefault()}
        onDrop={(event) => {
          event.preventDefault();
          onAddFiles(event.dataTransfer.files);
        }}
      >
        <div className="mb-3 flex max-h-28 flex-wrap gap-3 overflow-y-auto pr-1">
          {attachments.map((attachment) => (
            <div key={attachment.id} className="flex max-w-[240px] items-center gap-2.5 rounded-2xl bg-[#404040] p-1.5 pr-2.5 transition-all duration-200 hover:bg-[#484848]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img className="h-11 w-11 cursor-zoom-in rounded-xl object-cover" src={attachment.previewUrl} alt={attachment.name} onClick={() => attachment.url && window.open(attachment.url, "_blank", "noopener,noreferrer")} />
              <div className="min-w-0">
                <div className="truncate text-xs">{attachment.name}</div>
                <div className={`text-[11px] ${attachment.status === "failed" ? "text-red-300" : "text-[#b4b4b4]"}`}>
                  {attachment.status === "uploading" ? "上传中..." : attachment.status === "failed" ? "上传失败" : formatBytes(attachment.size)}
                </div>
              </div>
              <button aria-label={`移除附件 ${attachment.name}`} className="rounded-full p-1 transition-all duration-200 hover:bg-white/15 hover:scale-105" onClick={() => onRemoveAttachment(attachment)}>
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
        <Textarea
          value={prompt}
          onChange={(event) => onPromptChange(event.target.value)}
          placeholder={mode === "chat" ? "询问任何问题" : mode === "image" ? "描述你想生成或编辑的图片" : "描述你想生成的视频"}
          className="max-h-40 min-h-[72px] flex-1 resize-none border-0 bg-transparent px-3 py-3 text-base leading-7 focus:border-0 focus:ring-2 focus:ring-emerald-500/30"
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              onSubmit();
            }
          }}
        />
        {mode === "chat" && (
          <div className="mt-4 rounded-2xl border border-white/10 bg-[#242424] p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="text-base font-semibold text-white">聊天参数</div>
                <div className="mt-1 text-sm text-[#bdbdbd]">调整模型采样、输出长度和 Thinking 模式。</div>
              </div>
              <div className="rounded-full border border-emerald-500/25 bg-emerald-500/10 px-3.5 py-1.5 text-sm font-medium text-emerald-100 transition-all duration-200 hover:bg-emerald-500/15">
                {chatSettings.model}
              </div>
            </div>
            <div className="grid grid-cols-[1fr_1fr_1fr_auto] gap-4 max-lg:grid-cols-2 max-sm:grid-cols-1">
              <label className="space-y-2">
                <span className="text-xs text-[#b4b4b4]">模型</span>
                <select
                  className="w-full rounded-xl border border-white/10 bg-[#1e1e1e] px-4 py-2.5 text-sm outline-none transition-all duration-200 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/30"
                  value={chatSettings.model}
                  onChange={(event) => onChatSettingsChange((draft) => ({ ...draft, model: event.target.value }))}
                >
                  <option value="agnes-2.0-flash">agnes-2.0-flash</option>
                </select>
              </label>
              <label className="space-y-2">
                <span className="text-xs text-[#b4b4b4]">Temperature</span>
                <input
                  type="number"
                  min={0}
                  max={2}
                  step={0.1}
                  value={chatSettings.temperature}
                  onChange={(event) => onChatSettingsChange((draft) => ({ ...draft, temperature: Number(event.target.value) }))}
                  className="w-full rounded-xl border border-white/10 bg-[#1e1e1e] px-4 py-2.5 text-sm outline-none transition-all duration-200 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/30"
                />
              </label>
              <label className="space-y-2">
                <span className="text-xs text-[#b4b4b4]">Top P</span>
                <input
                  type="number"
                  min={0}
                  max={1}
                  step={0.05}
                  value={chatSettings.top_p}
                  onChange={(event) => onChatSettingsChange((draft) => ({ ...draft, top_p: Number(event.target.value) }))}
                  className="w-full rounded-xl border border-white/10 bg-[#1e1e1e] px-4 py-2.5 text-sm outline-none transition-all duration-200 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/30"
                />
              </label>
              <label className="space-y-2">
                <span className="text-xs text-[#b4b4b4]">Max Tokens</span>
                <input
                  type="number"
                  min={1}
                  step={1}
                  value={chatSettings.max_tokens ?? ""}
                  placeholder="不限"
                  onChange={(event) => onChatSettingsChange((draft) => ({ ...draft, max_tokens: event.target.value ? Number(event.target.value) : undefined }))}
                  className="w-full rounded-xl border border-white/10 bg-[#1e1e1e] px-4 py-2.5 text-sm outline-none transition-all duration-200 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/30"
                />
              </label>
              <label className="col-span-full flex items-center gap-3 text-sm">
                <input
                  type="checkbox"
                  checked={chatSettings.enableThinking}
                  onChange={(event) => onChatSettingsChange((draft) => ({ ...draft, enableThinking: event.target.checked }))}
                  className="h-4.5 w-4.5 accent-emerald-500 rounded transition-all duration-200"
                />
                <span className="text-[#b4b4b4]">启用 Thinking 模式（适合推理、调试、复杂任务）</span>
              </label>
            </div>
          </div>
        )}
        {mode === "image" && (
          <div className="mt-4 rounded-2xl border border-white/10 bg-[#242424] p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="text-base font-semibold text-white">图片参数</div>
                <div className="mt-1 text-sm text-[#bdbdbd]">控制尺寸、数量和输出格式；上传参考图即可切换为图生图。</div>
              </div>
              <div className="rounded-full border border-emerald-500/25 bg-emerald-500/10 px-3.5 py-1.5 text-sm font-medium text-emerald-100 transition-all duration-200 hover:bg-emerald-500/15">
                {imageSettings.size} · {imageSettings.response_format === "url" ? "URL 输出" : "Base64 输出"}
              </div>
            </div>
            <div className="grid grid-cols-[1fr_1fr_120px_120px] gap-4 max-lg:grid-cols-2 max-sm:grid-cols-1">
              <div className="col-span-full max-lg:col-span-full space-y-2">
                <span className="block text-sm font-medium text-[#cfcfcf]">比例</span>
                <AspectRatioPicker
                  value={(imageSizeOptions.find((o) => o.value === imageSettings.size)?.ratio ?? "1:1") as ImageRatio}
                  options={aspectRatioOptions}
                  onChange={(ratio) => onImageSettingsChange((draft) => ({ ...draft, size: defaultSizeFromRatio(ratio) }))}
                />
              </div>
              <label className="space-y-2">
                <span className="block text-sm font-medium text-[#cfcfcf]">生成数量</span>
                <input
                  className="h-12 w-full rounded-xl border border-white/10 bg-[#303030] px-4 text-sm text-white outline-none transition-all duration-200 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/30"
                  type="number"
                  min={1}
                  max={4}
                  value={imageSettings.n}
                  onChange={(event) => onImageSettingsChange((draft) => ({ ...draft, n: Math.min(4, Math.max(1, Number(event.target.value) || 1)) }))}
                />
              </label>
              <label className="space-y-2">
                <span className="block text-sm font-medium text-[#cfcfcf]">随机种子</span>
                <input
                  className="h-12 w-full rounded-xl border border-white/10 bg-[#303030] px-4 text-sm text-white outline-none transition-all duration-200 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/30"
                  value={imageSettings.seed}
                  inputMode="numeric"
                  placeholder="可选"
                  onChange={(event) => onImageSettingsChange((draft) => ({ ...draft, seed: event.target.value.replace(/[^\d-]/g, "") }))}
                />
              </label>
              <label className="space-y-2">
                <span className="block text-sm font-medium text-[#cfcfcf]">输出格式</span>
                <select
                  className="h-12 w-full rounded-xl border border-white/10 bg-[#303030] px-4 text-sm text-white outline-none transition-all duration-200 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/30"
                  value={imageSettings.response_format}
                  onChange={(event) => onImageSettingsChange((draft) => ({ ...draft, response_format: event.target.value as "url" | "b64_json" }))}
                >
                  <option value="url">URL</option>
                  <option value="b64_json">Base64</option>
                </select>
              </label>
            </div>
            <div className="mt-4 grid grid-cols-[1fr] gap-4">
              <label className="space-y-2">
                <span className="block text-sm font-medium text-[#cfcfcf]">反向提示词</span>
                <input
                  className="h-12 w-full rounded-xl border border-white/10 bg-[#303030] px-4 text-sm text-white outline-none transition-all duration-200 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/30"
                  value={imageSettings.negative_prompt}
                  placeholder="避免模糊、畸形、错误结构"
                  onChange={(event) => onImageSettingsChange((draft) => ({ ...draft, negative_prompt: event.target.value }))}
                />
              </label>
            </div>
            <div className="mt-4 flex flex-wrap items-center gap-3 text-sm text-[#bdbdbd]">
              <span className="rounded-lg bg-white/5 px-3 py-1.5 transition-all duration-200 hover:bg-white/8">画幅 {imageSizeOptions.find((option) => option.value === imageSettings.size)?.ratio}</span>
              <span className="rounded-lg bg-white/5 px-3 py-1.5 transition-all duration-200 hover:bg-white/8">一次生成 {imageSettings.n} 张</span>
              <span className="rounded-lg bg-white/5 px-3 py-1.5 transition-all duration-200 hover:bg-white/8">{attachments.length > 0 ? `已添加 ${attachments.length} 张参考图（图生图）` : "未添加参考图（文生图）"}</span>
            </div>
          </div>
        )}
        {mode === "video" && (
          <div className="mt-4 rounded-2xl border border-white/10 bg-[#242424] p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="text-base font-semibold text-white">视频参数</div>
                <div className="mt-1 text-sm text-[#bdbdbd]">控制画幅、时长和稳定性；最终规格以 Agnes API 返回为准。</div>
              </div>
              <div className="rounded-full border border-emerald-500/25 bg-emerald-500/10 px-3.5 py-1.5 text-sm font-medium text-emerald-100 transition-all duration-200 hover:bg-emerald-500/15">
                {videoSettings.width}x{videoSettings.height} · {estimateVideoSeconds(videoSettings.num_frames, videoSettings.frame_rate)}s
              </div>
            </div>
            <div className="grid grid-cols-[1fr_1.3fr_1.3fr_120px] gap-4 max-lg:grid-cols-2 max-sm:grid-cols-1">
              <label className="space-y-2">
                <span className="block text-sm font-medium text-[#cfcfcf]">画幅比例</span>
                <select
                  className="h-12 w-full rounded-xl border border-white/10 bg-[#303030] px-4 text-sm text-white outline-none transition-all duration-200 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/30"
                  value={videoSettings.ratio}
                  onChange={(event) => {
                    const ratio = event.target.value as VideoRatio;
                    onVideoSettingsChange((draft) => ({ ...draft, ratio, ...defaultVideoSize(ratio) }));
                  }}
                >
                  {(["16:9", "9:16", "1:1", "4:3", "3:4"] as VideoRatio[]).map((ratio) => <option key={ratio} value={ratio}>{ratio}</option>)}
                </select>
              </label>
              <label className="space-y-2">
                <span className="block text-sm font-medium text-[#cfcfcf]">生成模式</span>
                <select
                  className="h-12 w-full rounded-xl border border-white/10 bg-[#303030] px-4 text-sm text-white outline-none transition-all duration-200 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/30"
                  value={videoSettings.mode}
                  onChange={(event) => onVideoSettingsChange((draft) => ({ ...draft, mode: event.target.value as VideoMode }))}
                >
                  <option value="ti2vid">文生/图生视频</option>
                  <option value="keyframes">关键帧动画</option>
                </select>
              </label>
              <label className="space-y-2">
                <span className="block text-sm font-medium text-[#cfcfcf]">时长档位</span>
                <select
                  className="h-12 w-full rounded-xl border border-white/10 bg-[#303030] px-4 text-sm text-white outline-none transition-all duration-200 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/30"
                  value={videoSettings.num_frames}
                  onChange={(event) => onVideoSettingsChange((draft) => ({ ...draft, num_frames: Number(event.target.value) }))}
                >
                  <option value={81}>81 帧，约 {estimateVideoSeconds(81, videoSettings.frame_rate)} 秒</option>
                  <option value={121}>121 帧，约 {estimateVideoSeconds(121, videoSettings.frame_rate)} 秒</option>
                  <option value={241}>241 帧，约 {estimateVideoSeconds(241, videoSettings.frame_rate)} 秒</option>
                  <option value={441}>441 帧，约 {estimateVideoSeconds(441, videoSettings.frame_rate)} 秒</option>
                </select>
              </label>
              <label className="space-y-2">
                <span className="block text-sm font-medium text-[#cfcfcf]">帧率</span>
                <input
                  className="h-12 w-full rounded-xl border border-white/10 bg-[#303030] px-4 text-sm text-white outline-none transition-all duration-200 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/30"
                  type="number"
                  min={1}
                  max={60}
                  value={videoSettings.frame_rate}
                  onChange={(event) => onVideoSettingsChange((draft) => ({ ...draft, frame_rate: Number(event.target.value) }))}
                />
              </label>
            </div>
            <div className="mt-4 grid grid-cols-[180px_1fr_120px] gap-4 max-sm:grid-cols-1">
              <label className="space-y-2">
                <span className="block text-sm font-medium text-[#cfcfcf]">随机种子</span>
                <input
                  className="h-12 w-full rounded-xl border border-white/10 bg-[#303030] px-4 text-sm text-white outline-none transition-all duration-200 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/30"
                  value={videoSettings.seed}
                  inputMode="numeric"
                  placeholder="可选"
                  onChange={(event) => onVideoSettingsChange((draft) => ({ ...draft, seed: event.target.value.replace(/[^\d-]/g, "") }))}
                />
              </label>
              <label className="space-y-2">
                <span className="block text-sm font-medium text-[#cfcfcf]">反向提示词</span>
                <input
                  className="h-12 w-full rounded-xl border border-white/10 bg-[#303030] px-4 text-sm text-white outline-none transition-all duration-200 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/30"
                  value={videoSettings.negative_prompt}
                  placeholder="避免模糊、畸形、闪烁、错误结构"
                  onChange={(event) => onVideoSettingsChange((draft) => ({ ...draft, negative_prompt: event.target.value }))}
                />
              </label>
              <label className="space-y-2">
                <span className="block text-sm font-medium text-[#cfcfcf]">推理步数</span>
                <input
                  className="h-12 w-full rounded-xl border border-white/10 bg-[#303030] px-4 text-sm text-white outline-none transition-all duration-200 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/30"
                  type="number"
                  min={1}
                  max={100}
                  value={videoSettings.num_inference_steps ?? ""}
                  placeholder="默认"
                  onChange={(event) => onVideoSettingsChange((draft) => {
                    const value = event.target.value;
                    const num = value === "" ? undefined : Math.min(100, Math.max(1, Number(value) || 1));
                    return { ...draft, num_inference_steps: num };
                  })}
                />
              </label>
            </div>
            <div className="mt-4 flex flex-wrap items-center gap-3 text-sm text-[#bdbdbd]">
              <span className="rounded-lg bg-white/5 px-3 py-1.5 transition-all duration-200 hover:bg-white/8">帧数 {videoSettings.num_frames}</span>
              <span className="rounded-lg bg-white/5 px-3 py-1.5 transition-all duration-200 hover:bg-white/8">帧率 {videoSettings.frame_rate} fps</span>
              {typeof videoSettings.num_inference_steps === "number" && <span className="rounded-lg bg-white/5 px-3 py-1.5 transition-all duration-200 hover:bg-white/8">步数 {videoSettings.num_inference_steps}</span>}
              <span className="rounded-lg bg-white/5 px-3 py-1.5 transition-all duration-200 hover:bg-white/8">{videoSettings.mode === "keyframes" ? "使用上传图片作为关键帧" : "支持文生视频 / 图生视频"}</span>
            </div>
          </div>
        )}
        <div className="mt-3 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <input
              ref={fileInputRef}
              className="hidden"
              type="file"
              accept="image/png,image/jpeg,image/webp"
              multiple
              onChange={(event) => {
                if (event.target.files) onAddFiles(event.target.files);
                event.target.value = "";
              }}
            />
            <Button aria-label="上传附件" size="icon" variant="ghost" onClick={() => fileInputRef.current?.click()} className="transition-all duration-200 hover:scale-105 hover:bg-white/10"><Paperclip className="h-4 w-4" /></Button>
            {(["chat", "image", "video"] as Mode[]).map((item) => (
              <Button key={item} size="sm" variant={mode === item ? "default" : "ghost"} onClick={() => onModeChange(item)} title={item === "chat" ? "Ctrl+1" : item === "image" ? "Ctrl+2" : "Ctrl+3"} className="transition-all duration-200">
                {item === "chat" && <span className="flex items-center gap-1.5">聊天<span className="rounded bg-white/10 px-1.5 py-0.5 text-[10px] text-[#888]">Ctrl+1</span></span>}
                {item === "image" && <><ImagePlus className="h-4 w-4" />图片<span className="ml-1 rounded bg-white/10 px-1.5 py-0.5 text-[10px] text-[#888]">Ctrl+2</span></>}
                {item === "video" && <><Video className="h-4 w-4" />视频<span className="ml-1 rounded bg-white/10 px-1.5 py-0.5 text-[10px] text-[#888]">Ctrl+3</span></>}
              </Button>
            ))}
            {(mode === "image" || mode === "video") && (
              <Button size="sm" variant="secondary" disabled={enhancingPrompt || !prompt.trim()} onClick={onEnhancePrompt} className="transition-all duration-200 hover:scale-[1.02] disabled:opacity-60">
                {enhancingPrompt ? <Loader2 className="h-4 w-4 animate-spin" /> : <Pencil className="h-4 w-4" />}
                增强提示词
              </Button>
            )}
          </div>
          <Button aria-label="发送" size="icon" disabled={submitting || !prompt.trim()} onClick={onSubmit} className="transition-all duration-200 hover:scale-105 hover:bg-emerald-500 disabled:opacity-60">
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </Button>
        </div>
      </div>
    </footer>
  );
}
