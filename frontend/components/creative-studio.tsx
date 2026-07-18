"use client";

import { useMemo, useRef, useState, type ReactNode, type RefObject } from "react";
import { Check, Copy, Download, ExternalLink, ImagePlus, Loader2, MessageSquare, Paperclip, RefreshCw, Send, Square, Trash2, Video, Wand2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ShadcnSelect } from "@/components/ui/select";
import { Card } from "@/components/ui/card";
import { ChatPanel } from "@/components/layout/workspace-panels";
import { Tip } from "@/components/ui/tip";
import { imageSizeOptions, defaultVideoSize, estimateVideoSeconds, statusText } from "@/lib/project-workflow";
import type { Attachment, ImageRequest, ImageSettings, ImageTask, Message, Mode, VideoSettings, VideoTask } from "@/lib/app-types";

type CreativeStudioProps = {
  mode: "image" | "video";
  onModeChange: (mode: Mode) => void;
  prompt: string;
  onPromptChange: (value: string) => void;
  onSubmit: () => void;
  submitting: boolean;
  attachments: Attachment[];
  fileInputRef: RefObject<HTMLInputElement | null>;
  onAddFiles: (files: FileList) => void;
  onRemoveAttachment: (attachment: Attachment) => void;
  imageSettings: ImageSettings;
  onImageSettingsChange: (updater: (draft: ImageSettings) => ImageSettings) => void;
  videoSettings: VideoSettings;
  onVideoSettingsChange: (updater: (draft: VideoSettings) => VideoSettings) => void;
  messages: Message[];
  lastAssistantMessageIndex: number;
  currentConversationSubmitting: boolean;
  onStopChat: () => void;
  onRegenerateChat: () => void;
  renderFavoriteAction: (type: "image" | "video", refId: string) => ReactNode;
  visibleImages: ImageTask[];
  visibleImagesChronological: ImageTask[];
  currentImageRequests: ImageRequest[];
  onRefreshImages: () => void;
  onOpenImageDetail: (taskId: string, index: number) => void;
  onDownloadMedia: (url: string, filename: string) => void;
  onOpenRawMedia: (url: string) => void;
  onCopy: (text: string) => void;
  onAddGeneratedImageToAsset: (task: ImageTask, imageUrl: string) => void;
  onContinueEditImage: (url: string) => void;
  onDeleteImage: (taskId: string) => void;
  onImageLoad: () => void;
  videos: VideoTask[];
  onRefreshVideos: () => void;
  onDeleteVideo: (videoId: string) => void;
};

/** 创意工作室布局：顶部输入、左侧参数、中间画布、右侧 AI 对话、底部历史画廊。 */
export function CreativeStudio(props: CreativeStudioProps) {
  const [selectedImageTaskId, setSelectedImageTaskId] = useState<string | null>(null);
  const [selectedVideoId, setSelectedVideoId] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const isImage = props.mode === "image";

  const latestImageTask = useMemo(() => {
    if (props.currentImageRequests.length > 0) return props.currentImageRequests[0].task ?? null;
    return props.visibleImagesChronological[props.visibleImagesChronological.length - 1] ?? null;
  }, [props.currentImageRequests, props.visibleImagesChronological]);

  const selectedImageTask = useMemo(() => {
    if (!selectedImageTaskId) return latestImageTask;
    return props.visibleImages.find((task) => task.id === selectedImageTaskId) ?? latestImageTask;
  }, [selectedImageTaskId, latestImageTask, props.visibleImages]);

  const latestVideo = useMemo(() => {
    return props.videos[0] ?? null;
  }, [props.videos]);

  const selectedVideo = useMemo(() => {
    if (!selectedVideoId) return latestVideo;
    return props.videos.find((video) => video.id === selectedVideoId) ?? latestVideo;
  }, [selectedVideoId, latestVideo, props.videos]);

  return (
    <div className="grid h-full grid-rows-[auto_1fr_auto] overflow-hidden bg-[#181818]">
      {/* 顶部：创意输入 */}
      <header className="border-b border-white/10 bg-[#202020]/90 px-6 py-4 backdrop-blur">
        <div className="mx-auto flex max-w-6xl flex-col gap-3">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-300 transition-all duration-200">
                {isImage ? <ImagePlus className="h-5 w-5" /> : <Video className="h-5 w-5" />}
              </div>
              <div className="min-w-0">
                <div className="text-sm font-semibold text-white">{isImage ? "图片创意工作台" : "视频创意工作台"}</div>
                <div className="text-xs text-[#a0a0a0]">输入提示词，左侧调整参数，右侧与 AI 助手协作。</div>
              </div>
            </div>
            <div className="flex items-center gap-2.5">
              <div className="flex items-center gap-1 rounded-xl border border-white/10 bg-[#2a2a2a] p-1" role="tablist" aria-label="模式切换">
                <ModeTab active={false} icon={<MessageSquare className="h-3.5 w-3.5" />} label="聊天" onClick={() => props.onModeChange("chat")} />
                <ModeTab active={isImage} icon={<ImagePlus className="h-3.5 w-3.5" />} label="图片" onClick={() => props.onModeChange("image")} />
                <ModeTab active={!isImage} icon={<Video className="h-3.5 w-3.5" />} label="视频" onClick={() => props.onModeChange("video")} />
              </div>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => (isImage ? props.onRefreshImages() : props.onRefreshVideos())}
                className="transition-all duration-200 hover:scale-105 hover:bg-white/10"
                aria-label="刷新内容"
              >
                <RefreshCw className="h-4 w-4" aria-hidden="true" />
                <span className="hidden sm:inline">刷新</span>
              </Button>
            </div>
          </div>
          <div className="relative">
            <textarea
              className="max-h-40 min-h-[64px] w-full resize-y rounded-xl border border-white/10 bg-[#2a2a2a] px-5 py-3.5 pr-28 text-sm leading-7 text-white outline-none transition-all duration-200 placeholder:text-[#777] focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/30"
              placeholder={isImage ? "描述你想要的画面：主体、场景、光影、风格、情绪..." : "描述视频镜头：主体动作、镜头运动、光影、风格..."}
              value={props.prompt}
              onChange={(event) => props.onPromptChange(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault();
                  props.onSubmit();
                }
              }}
            />
            <div className="absolute bottom-2.5 right-2.5 flex items-center gap-2">
              <input
                ref={props.fileInputRef}
                className="hidden"
                type="file"
                accept="image/png,image/jpeg,image/webp"
                multiple
                onChange={(event) => {
                  if (event.target.files) props.onAddFiles(event.target.files);
                  event.target.value = "";
                }}
              />
              <Button size="icon" variant="ghost" className="h-9 w-9 transition-all duration-200 hover:scale-105 hover:bg-white/10" onClick={() => props.fileInputRef.current?.click()}>
                <Paperclip className="h-4 w-4" />
              </Button>
              <Button size="sm" disabled={props.submitting || !props.prompt.trim()} onClick={props.onSubmit} className="transition-all duration-200 hover:scale-[1.02] hover:bg-emerald-600 disabled:opacity-60">
                {props.submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                生成
              </Button>
            </div>
          </div>
          {props.attachments.length > 0 && (
            <div className="flex flex-wrap gap-2.5">
              {props.attachments.map((attachment) => (
                <div key={attachment.id} className="flex items-center gap-2 rounded-lg border border-white/10 bg-[#2a2a2a] px-2.5 py-2 text-xs transition-all duration-200 hover:border-white/20">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img className="h-7 w-7 rounded-md object-cover" src={attachment.previewUrl} alt={attachment.name} />
                  <span className="max-w-[120px] truncate">{attachment.name}</span>
                  <button className="text-[#888] transition-colors hover:text-white" onClick={() => props.onRemoveAttachment(attachment)}>
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </header>

      {/* 主体：左侧参数 + 中间画布 + 右侧 AI */}
      <div className="grid min-h-0 grid-cols-[280px_1fr_380px] overflow-hidden">
        {/* 左侧：专业参数 */}
        <aside className="flex flex-col gap-4 overflow-y-auto border-r border-white/10 bg-[#1e1e1e] p-5">
          {isImage ? (
            <ImageParamsForm settings={props.imageSettings} onChange={props.onImageSettingsChange} />
          ) : (
            <VideoParamsForm settings={props.videoSettings} onChange={props.onVideoSettingsChange} />
          )}
        </aside>

        {/* 中间：实时画布 */}
        <main ref={scrollRef} className="relative min-h-0 overflow-auto bg-[#151515]">
          {isImage ? (
            <ImageCanvas
              task={selectedImageTask}
              requests={props.currentImageRequests}
              onOpenDetail={props.onOpenImageDetail}
              onDownload={props.onDownloadMedia}
              onOpenRaw={props.onOpenRawMedia}
              onCopy={props.onCopy}
              onAddToAsset={props.onAddGeneratedImageToAsset}
              onContinueEdit={props.onContinueEditImage}
              renderFavoriteAction={props.renderFavoriteAction}
              onImageLoad={props.onImageLoad}
            />
          ) : (
            <VideoCanvas task={selectedVideo} renderFavoriteAction={props.renderFavoriteAction} onCopy={props.onCopy} onDelete={props.onDeleteVideo} />
          )}
        </main>

        {/* 右侧：AI 助手对话 */}
        <aside className="sticky top-0 flex min-h-0 flex-col border-l border-white/10 bg-[#1e1e1e]">
          <div className="border-b border-white/10 px-5 py-3.5 text-xs font-semibold uppercase tracking-wider text-[#777]">AI 助手</div>
          {/* 生成历史快捷入口 */}
          <div className="border-b border-white/10 px-5 py-2.5">
            <div className="flex items-center justify-between">
              <div className="text-xs text-[#888]">最近生成</div>
              <div className="flex items-center gap-1">
                {(isImage ? props.visibleImagesChronological : props.videos).slice(-10).map((item, index) => (
                  <div
                    key={item.id}
                    className={`h-1.5 w-1.5 rounded-full transition-all duration-200 ${index === (isImage ? props.visibleImagesChronological.length : props.videos.length) - 1
                      ? "bg-emerald-400 scale-125"
                      : "bg-[#555]"
                      }`}
                  />
                ))}
              </div>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto p-4">
            <ChatPanel
              messages={props.messages}
              lastAssistantMessageIndex={props.lastAssistantMessageIndex}
              currentConversationSubmitting={props.currentConversationSubmitting}
              onStopChat={props.onStopChat}
              onRegenerateChat={props.onRegenerateChat}
            />
          </div>
        </aside>
      </div>

      {/* 底部：历史作品瀑布流 / 画廊 */}
      <div className="h-52 shrink-0 border-t border-white/10 bg-[#202020]">
        <div className="flex h-full flex-col">
          <div className="flex items-center justify-between border-b border-white/10 px-5 py-3">
            <div className="text-xs font-semibold uppercase tracking-wider text-[#777]">历史作品</div>
            <div className="flex items-center gap-3">
              {/* 生成历史快捷入口（最近10条） */}
              <div className="flex items-center gap-1">
                {isImage && props.visibleImagesChronological.slice(-10).map((task, index) => (
                  <Tip key={task.id} label={task.prompt} side="top" className="max-w-md">
                    <div
                      className={`h-2 w-2 rounded-full transition-all duration-200 ${index === props.visibleImagesChronological.length - 1 ? "bg-emerald-400 scale-150" : "bg-[#555]"}`}
                    />
                  </Tip>
                ))}
                {isImage && props.visibleImagesChronological.length === 0 && <span className="text-xs text-[#666]">无历史</span>}
              </div>
              <div className="text-xs text-[#888]">
                {isImage ? `${props.visibleImages.length} 张图片` : `${props.videos.length} 个视频`}
              </div>
            </div>
          </div>
          <div className="flex-1 overflow-x-auto overflow-y-hidden p-4">
            {isImage ? (
              <ImageGalleryStrip
                tasks={props.visibleImagesChronological}
                selectedId={selectedImageTask?.id ?? null}
                onSelect={(taskId) => setSelectedImageTaskId(taskId)}
                onOpenDetail={props.onOpenImageDetail}
                onImageLoad={props.onImageLoad}
              />
            ) : (
              <VideoGalleryStrip
                tasks={props.videos}
                selectedId={selectedVideo?.id ?? null}
                onSelect={(taskId) => setSelectedVideoId(taskId)}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/** 模式切换 Tab。 */
function ModeTab({ active, icon, label, onClick }: { active: boolean; icon: ReactNode; label: string; onClick: () => void }) {
  return (
    <button
      className={`flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-xs font-medium transition-all duration-200 ${active ? "bg-emerald-500/15 text-emerald-100" : "text-[#a0a0a0] hover:bg-white/5 hover:text-white"}`}
      onClick={onClick}
    >
      {icon}
      {label}
    </button>
  );
}

/** 图片参数表单。 */
function ImageParamsForm({ settings, onChange }: { settings: ImageSettings; onChange: (updater: (draft: ImageSettings) => ImageSettings) => void }) {
  const [showAdvanced, setShowAdvanced] = useState(false);

  return (
    <div className="space-y-4 text-sm">
      {/* 基础参数 */}
      <div className="space-y-4">
        <div className="text-xs font-semibold uppercase tracking-wider text-[#777]">基础参数</div>
        <label className="block space-y-2">
          <span className="text-xs text-[#a0a0a0]">模型</span>
          <div className="rounded-lg border border-white/10 bg-[#2a2a2a] px-4 py-2.5 text-white">agnes-image-2.1-flash</div>
        </label>
        {/* 参数预设：常用尺寸 */}
        <div className="space-y-2">
          <span className="text-xs text-[#a0a0a0]">快捷尺寸</span>
          <div className="flex gap-2">
            {["1024x1024", "1024x1792", "1792x1024"].map((size) => (
              <button
                key={size}
                className={`shrink-0 rounded-md border px-3 py-1.5 text-xs transition-all duration-200 ${settings.size === size ? "border-emerald-500 bg-emerald-500/10 text-emerald-300" : "border-white/10 bg-[#2a2a2a] text-[#a0a0a0] hover:bg-white/10"
                  }`}
                onClick={() => onChange((draft) => ({ ...draft, size: size as ImageSettings["size"] }))}
              >
                {size === "1024x1024" ? "1:1" : size === "1024x1792" ? "竖版" : "横版"}
              </button>
            ))}
          </div>
        </div>
        <label className="block space-y-2">
          <span className="text-xs text-[#a0a0a0]">输出尺寸</span>
          <ShadcnSelect
            options={imageSizeOptions.map((o) => ({ value: o.value, label: o.label }))}
            value={settings.size}
            onChange={(value) => onChange((draft) => ({ ...draft, size: value as ImageSettings["size"] }))}
            className="h-10"
          />
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className="block space-y-2">
            <span className="text-xs text-[#a0a0a0]">数量</span>
            <input
              type="number"
              min={1}
              max={4}
              className="w-full rounded-lg border border-white/10 bg-[#2a2a2a] px-4 py-2.5 text-white outline-none transition-all duration-200 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/30"
              value={settings.n}
              onChange={(event) => onChange((draft) => ({ ...draft, n: Math.min(4, Math.max(1, Number(event.target.value) || 1)) }))}
            />
          </label>
          <label className="block space-y-2">
            <span className="text-xs text-[#a0a0a0]">输出格式</span>
            <ShadcnSelect
              options={[
                { value: "url", label: "URL" },
                { value: "b64_json", label: "Base64" },
              ]}
              value={settings.response_format}
              onChange={(value) => onChange((draft) => ({ ...draft, response_format: value as "url" | "b64_json" }))}
              className="h-10"
            />
          </label>
        </div>
      </div>

      {/* 高级参数（可折叠） */}
      <div className="border-t border-white/10 pt-4">
        <button className="flex items-center justify-between w-full text-xs font-semibold uppercase tracking-wider text-[#777]" onClick={() => setShowAdvanced(!showAdvanced)}>
          <span>高级参数</span>
          <span className={`transition-transform duration-200 ${showAdvanced ? "rotate-180" : ""}`}>▼</span>
        </button>
        {showAdvanced && (
          <div className="mt-4 space-y-4">
            <label className="block space-y-2">
              <span className="text-xs text-[#a0a0a0]">随机种子</span>
              <input
                className="w-full rounded-lg border border-white/10 bg-[#2a2a2a] px-4 py-2.5 text-white outline-none transition-all duration-200 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/30"
                inputMode="numeric"
                placeholder="可选"
                value={settings.seed}
                onChange={(event) => onChange((draft) => ({ ...draft, seed: event.target.value.replace(/[^\d-]/g, "") }))}
              />
            </label>
            <label className="block space-y-2">
              <span className="text-xs text-[#a0a0a0]">反向提示词</span>
              <input
                className="w-full rounded-lg border border-white/10 bg-[#2a2a2a] px-4 py-2.5 text-white outline-none transition-all duration-200 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/30"
                placeholder="避免模糊、畸形..."
                value={settings.negative_prompt}
                onChange={(event) => onChange((draft) => ({ ...draft, negative_prompt: event.target.value }))}
              />
            </label>
          </div>
        )}
      </div>

      {/* 参数摘要 */}
      <div className="rounded-lg border border-white/10 bg-[#252525] p-3 text-xs text-[#888]">
        <div>当前：{settings.size}</div>
        <div>画幅：{imageSizeOptions.find((option) => option.value === settings.size)?.ratio}</div>
        <div>模式：{settings.response_format === "url" ? "URL 输出" : "Base64 输出"}</div>
      </div>
    </div>
  );
}

/** 视频参数表单。 */
function VideoParamsForm({ settings, onChange }: { settings: VideoSettings; onChange: (updater: (draft: VideoSettings) => VideoSettings) => void }) {
  return (
    <div className="space-y-4 text-sm">
      <label className="block space-y-2">
        <span className="text-xs text-[#a0a0a0]">模型</span>
        <div className="rounded-lg border border-white/10 bg-[#2a2a2a] px-4 py-2.5 text-white">agnes-video-v2.0</div>
      </label>
      <label className="block space-y-2">
        <span className="text-xs text-[#a0a0a0]">画幅比例</span>
        <ShadcnSelect
          options={(["16:9", "9:16", "1:1", "4:3", "3:4"] as VideoSettings["ratio"][]).map((r) => ({ value: r, label: r }))}
          value={settings.ratio}
          onChange={(value) => {
            const ratio = value as VideoSettings["ratio"];
            onChange((draft) => ({ ...draft, ratio, ...defaultVideoSize(ratio) }));
          }}
          className="h-10"
        />
      </label>
      <label className="block space-y-2">
        <span className="text-xs text-[#a0a0a0]">生成模式</span>
        <ShadcnSelect
          options={[
            { value: "ti2vid", label: "文生/图生视频" },
            { value: "keyframes", label: "关键帧动画" },
          ]}
          value={settings.mode}
          onChange={(value) => onChange((draft) => ({ ...draft, mode: value as VideoSettings["mode"] }))}
          className="h-10"
        />
      </label>
      <label className="block space-y-2">
        <span className="text-xs text-[#a0a0a0]">时长档位</span>
        <ShadcnSelect
          options={[
            { value: "81", label: "81 帧 · 约 3 秒" },
            { value: "121", label: "121 帧 · 约 5 秒" },
            { value: "241", label: "241 帧 · 约 10 秒" },
            { value: "441", label: "441 帧 · 约 18 秒" },
          ]}
          value={String(settings.num_frames)}
          onChange={(value) => onChange((draft) => ({ ...draft, num_frames: Number(value) }))}
          className="h-10"
        />
      </label>
      <div className="grid grid-cols-2 gap-3">
        <label className="block space-y-2">
          <span className="text-xs text-[#a0a0a0]">帧率</span>
          <input
            type="number"
            min={1}
            max={60}
            className="w-full rounded-lg border border-white/10 bg-[#2a2a2a] px-4 py-2.5 text-white outline-none transition-all duration-200 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/30"
            value={settings.frame_rate}
            onChange={(event) => onChange((draft) => ({ ...draft, frame_rate: Number(event.target.value) }))}
          />
        </label>
        <label className="block space-y-2">
          <span className="text-xs text-[#a0a0a0]">推理步数</span>
          <input
            type="number"
            min={1}
            max={100}
            className="w-full rounded-lg border border-white/10 bg-[#2a2a2a] px-4 py-2.5 text-white outline-none transition-all duration-200 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/30"
            value={settings.num_inference_steps ?? ""}
            placeholder="默认"
            onChange={(event) => {
              const value = event.target.value;
              const num = value === "" ? undefined : Math.min(100, Math.max(1, Number(value) || 1));
              onChange((draft) => ({ ...draft, num_inference_steps: num }));
            }}
          />
        </label>
      </div>
      <label className="block space-y-2">
        <span className="text-xs text-[#a0a0a0]">随机种子</span>
        <input
          className="w-full rounded-lg border border-white/10 bg-[#2a2a2a] px-4 py-2.5 text-white outline-none transition-all duration-200 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/30"
          inputMode="numeric"
          placeholder="可选"
          value={settings.seed}
          onChange={(event) => onChange((draft) => ({ ...draft, seed: event.target.value.replace(/[^\d-]/g, "") }))}
        />
      </label>
      <label className="block space-y-2">
        <span className="text-xs text-[#a0a0a0]">反向提示词</span>
        <input
          className="w-full rounded-lg border border-white/10 bg-[#2a2a2a] px-4 py-2.5 text-white outline-none transition-all duration-200 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/30"
          placeholder="避免模糊、闪烁..."
          value={settings.negative_prompt}
          onChange={(event) => onChange((draft) => ({ ...draft, negative_prompt: event.target.value }))}
        />
      </label>
      <div className="rounded-lg border border-white/10 bg-[#252525] p-3 text-xs text-[#888]">
        <div>尺寸：{settings.width}x{settings.height}</div>
        <div>时长：约 {estimateVideoSeconds(settings.num_frames, settings.frame_rate)} 秒</div>
        <div>模式：{settings.mode === "keyframes" ? "关键帧" : "文生/图生"}</div>
      </div>
    </div>
  );
}

/** 图片画布：展示选中任务的生成结果。 */
function ImageCanvas({
  task,
  requests,
  onOpenDetail,
  onDownload,
  onOpenRaw,
  onCopy,
  onAddToAsset,
  onContinueEdit,
  renderFavoriteAction,
  onImageLoad,
}: {
  task: ImageTask | null;
  requests: ImageRequest[];
  onOpenDetail: (taskId: string, index: number) => void;
  onDownload: (url: string, filename: string) => void;
  onOpenRaw: (url: string) => void;
  onCopy: (text: string) => void;
  onAddToAsset: (task: ImageTask, imageUrl: string) => void;
  onContinueEdit: (url: string) => void;
  renderFavoriteAction: (type: "image" | "video", refId: string) => ReactNode;
  onImageLoad: () => void;
}) {
  const generatingRequest = requests.find((request) => request.status === "generating");

  if (generatingRequest) {
    return (
      <div className="grid h-full place-items-center p-6">
        <div className="text-center">
          <Loader2 className="mx-auto h-10 w-10 animate-spin text-emerald-400" />
          <div className="mt-4 text-sm text-[#b4b4b4]">正在生成图片...</div>
          <div className="mt-1 line-clamp-2 max-w-md text-xs text-[#777]">{generatingRequest.prompt}</div>
        </div>
      </div>
    );
  }

  if (!task || task.image_urls.length === 0) {
    return (
      <div className="grid h-full place-items-center p-6">
        <div className="text-center">
          <Wand2 className="mx-auto h-10 w-10 text-[#444]" />
          <div className="mt-4 text-sm text-[#b4b4b4]">在顶部输入提示词并点击生成</div>
          <div className="mt-1 text-xs text-[#666]">结果将实时显示在这里</div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col p-5">
      <div className="flex-1 min-h-0 overflow-hidden rounded-2xl border border-white/10 bg-[#202020] shadow-lg">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          className="h-full w-full object-contain"
          src={task.image_urls[0]}
          alt={task.prompt}
          onLoad={onImageLoad}
        />
      </div>
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="text-xs text-[#888]">图片作品</div>
          <div className="line-clamp-1 text-sm text-white">{task.prompt}</div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="secondary" onClick={() => onOpenDetail(task.id, 0)} className="transition-all duration-200 hover:scale-[1.02]"><ExternalLink className="h-4 w-4" />详情</Button>
          <Button size="sm" variant="secondary" onClick={() => onDownload(task.image_urls[0], `${task.id}.png`)} className="transition-all duration-200 hover:scale-[1.02]"><Download className="h-4 w-4" />下载</Button>
          <Button size="sm" variant="secondary" onClick={() => onCopy(task.image_urls[0])} className="transition-all duration-200 hover:scale-[1.02]"><Copy className="h-4 w-4" />复制</Button>
          <Button size="sm" variant="secondary" onClick={() => onContinueEdit(task.image_urls[0])} className="transition-all duration-200 hover:scale-[1.02]">继续编辑</Button>
          <Button size="sm" variant="secondary" onClick={() => onAddToAsset(task, task.image_urls[0])} className="transition-all duration-200 hover:scale-[1.02]">加入资产</Button>
          {renderFavoriteAction("image", task.id)}
        </div>
      </div>
    </div>
  );
}

/** 视频画布：展示选中任务的播放器。 */
function VideoCanvas({
  task,
  renderFavoriteAction,
  onCopy,
  onDelete,
}: {
  task: VideoTask | null;
  renderFavoriteAction: (type: "image" | "video", refId: string) => ReactNode;
  onCopy: (text: string) => void;
  onDelete: (videoId: string) => void;
}) {
  if (!task) {
    return (
      <div className="grid h-full place-items-center p-6">
        <div className="text-center">
          <Video className="mx-auto h-10 w-10 text-[#444]" />
          <div className="mt-4 text-sm text-[#b4b4b4]">在顶部输入提示词并点击生成</div>
          <div className="mt-1 text-xs text-[#666]">视频任务将在这里播放</div>
        </div>
      </div>
    );
  }

  const isDone = task.status === "success" && task.video_url;
  const isRunning = task.status === "processing" || task.status === "pending";

  return (
    <div className="flex h-full flex-col p-5">
      <div className="flex-1 min-h-0 overflow-hidden rounded-2xl border border-white/10 bg-[#202020] shadow-lg">
        {isDone ? (
          <video className="h-full w-full object-contain" src={task.video_url} controls autoPlay preload="metadata" />
        ) : (
          <div className="grid h-full place-items-center">
            <div className="text-center">
              {isRunning ? <Loader2 className="mx-auto h-10 w-10 animate-spin text-emerald-400" /> : <div className="text-red-300">生成失败</div>}
              <div className="mt-3 text-sm text-[#b4b4b4]">{statusText(task.status)} {task.progress > 0 ? `${task.progress}%` : ""}</div>
            </div>
          </div>
        )}
      </div>
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="text-xs text-[#888]">视频任务</div>
          <div className="line-clamp-1 text-sm text-white">{task.prompt}</div>
          <div className="text-xs text-[#777]">{task.size} · {task.seconds ? `${task.seconds}s` : ""}</div>
        </div>
        <div className="flex flex-wrap gap-2">
          {task.video_url && (
            <>
              <a className="inline-flex h-8 items-center gap-1.5 rounded-md bg-white/10 px-3.5 text-xs transition-all duration-200 hover:bg-white/15 hover:scale-[1.02]" href={task.video_url} download={`${task.id}.mp4`} target="_blank" rel="noreferrer"><Download className="h-3.5 w-3.5" />下载</a>
              <a className="inline-flex h-8 items-center gap-1.5 rounded-md bg-white/10 px-3.5 text-xs transition-all duration-200 hover:bg-white/15 hover:scale-[1.02]" href={task.video_url} target="_blank" rel="noreferrer"><ExternalLink className="h-3.5 w-3.5" />打开</a>
              <Button size="sm" variant="secondary" onClick={() => onCopy(task.video_url)} className="transition-all duration-200 hover:scale-[1.02]"><Copy className="h-4 w-4" />复制</Button>
            </>
          )}
          {renderFavoriteAction("video", task.id)}
          <Button size="sm" variant="destructive" onClick={() => onDelete(task.id)} className="transition-all duration-200 hover:scale-[1.02]"><Trash2 className="h-4 w-4" /></Button>
        </div>
      </div>
    </div>
  );
}

/** 图片历史画廊条。 */
function ImageGalleryStrip({
  tasks,
  selectedId,
  onSelect,
  onOpenDetail,
  onImageLoad,
}: {
  tasks: ImageTask[];
  selectedId: string | null;
  onSelect: (taskId: string) => void;
  onOpenDetail: (taskId: string, index: number) => void;
  onImageLoad: () => void;
}) {
  if (tasks.length === 0) {
    return <div className="grid h-full place-items-center text-xs text-[#666]">暂无历史作品</div>;
  }
  return (
    <div className="flex h-full gap-4">
      {tasks.map((task) => (
        <button
          key={task.id}
          className={`group relative flex h-full w-36 shrink-0 overflow-hidden rounded-xl border transition-all duration-200 ${selectedId === task.id ? "border-emerald-500 shadow-lg shadow-emerald-500/20" : "border-white/10 hover:border-white/30 hover:scale-[1.02]"}`}
          onClick={() => onSelect(task.id)}
          onDoubleClick={() => onOpenDetail(task.id, 0)}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className="h-full w-full object-cover" src={task.image_urls[0]} alt={task.prompt} onLoad={onImageLoad} />
          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent p-2.5">
            <div className="line-clamp-2 text-left text-[10px] text-white/90">{task.prompt}</div>
          </div>
        </button>
      ))}
    </div>
  );
}

/** 视频历史画廊条。 */
function VideoGalleryStrip({
  tasks,
  selectedId,
  onSelect,
}: {
  tasks: VideoTask[];
  selectedId: string | null;
  onSelect: (taskId: string) => void;
}) {
  if (tasks.length === 0) {
    return <div className="grid h-full place-items-center text-xs text-[#666]">暂无历史作品</div>;
  }
  return (
    <div className="flex h-full gap-4">
      {tasks.map((task) => {
        const isDone = task.status === "success" && task.video_url;
        const isRunning = task.status === "processing" || task.status === "pending";
        const isFailed = task.status === "failed";

        return (
          <button
            key={task.id}
            className={`group relative flex h-full w-48 shrink-0 overflow-hidden rounded-xl border transition-all duration-200 ${selectedId === task.id ? "border-emerald-500 shadow-lg shadow-emerald-500/20" : "border-white/10 hover:border-white/30 hover:scale-[1.02]"
              }`}
            onClick={() => onSelect(task.id)}
          >
            {/* 状态图标 */}
            <div className="absolute left-2 top-2 z-10 flex items-center gap-1.5">
              {isDone && (
                <div className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-500/80 text-white">
                  <Check className="h-4 w-4" />
                </div>
              )}
              {isRunning && (
                <div className="flex h-6 items-center justify-center gap-2 rounded-full bg-blue-500/80 px-2.5 text-white">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  {task.progress > 0 && <span className="text-xs">{task.progress}%</span>}
                </div>
              )}
              {isFailed && (
                <div className="flex h-6 w-6 items-center justify-center rounded-full bg-red-500/80 text-white">
                  <X className="h-4 w-4" />
                </div>
              )}
            </div>

            {task.video_url ? (
              <video className="h-full w-full object-cover" src={task.video_url} preload="metadata" />
            ) : (
              <div className="grid h-full w-full place-items-center bg-[#2a2a2a]">
                <div className="text-center text-xs text-[#888]">
                  {isRunning ? (
                    <>
                      <Loader2 className="mx-auto h-8 w-8 animate-spin text-emerald-400" />
                      {task.progress > 0 && (
                        <div className="mt-2 w-32">
                          <div className="h-1.5 rounded-full bg-white/10">
                            <div className="h-full rounded-full bg-emerald-500" style={{ width: `${task.progress}%` }} />
                          </div>
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="text-red-300">生成失败</div>
                  )}
                  <div className="mt-2">{statusText(task.status)}</div>
                </div>
              </div>
            )}
            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent p-2.5">
              <div className="line-clamp-2 text-left text-[10px] text-white/90">{task.prompt}</div>
            </div>
          </button>
        );
      })}
    </div>
  );
}
