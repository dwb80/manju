"use client";

import type { ReactNode } from "react";
import { ChevronDown, Copy, Download, ExternalLink, Eye, Loader2, RefreshCw, Square, Trash2, Wrench } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { PortraitImageLink } from "@/components/project/project-workbench";
import { estimateVideoSeconds, messageAttachments, statusText } from "@/lib/project-workflow";
import type { ChatToolCall, FavoriteView, ImageRequest, ImageTask, Message, VideoSettings, VideoTask } from "@/lib/app-types";

type ChatPanelProps = {
  messages: Message[];
  lastAssistantMessageIndex: number;
  currentConversationSubmitting: boolean;
  onStopChat: () => void;
  onRegenerateChat: () => void;
};

/** 渲染单条工具调用的摘要信息。 */
function ToolCallItem({ toolCall }: { toolCall: ChatToolCall }) {
  return (
    <div className="rounded-lg border border-white/10 bg-[#252525] px-3 py-2 text-sm">
      <div className="flex items-center gap-2 font-medium text-emerald-100">
        <Wrench className="h-3.5 w-3.5" />
        {toolCall.function.name}
      </div>
      {toolCall.function.arguments && (
        <pre className="mt-1 max-h-32 overflow-auto whitespace-pre-wrap break-all rounded bg-black/30 p-2 text-xs text-[#b4b4b4]">
          {toolCall.function.arguments}
        </pre>
      )}
    </div>
  );
}

/** Displays the chat transcript, attachments, reasoning, tool calls and assistant controls. */
export function ChatPanel({ messages, lastAssistantMessageIndex, currentConversationSubmitting, onStopChat, onRegenerateChat }: ChatPanelProps) {
  if (messages.length === 0) {
    return (
      <div className="grid min-h-[42vh] place-items-center text-center">
        <div>
          <div className="mb-3 text-3xl font-semibold">今天想创作什么？</div>
          <div className="text-sm text-[#b4b4b4]">聊天、生成图片、生成视频，都从下面的输入框开始。</div>
        </div>
      </div>
    );
  }

  return messages.map((message, index) => {
    const attachments = messageAttachments(message);
    const hasReasoning = Boolean(message.meta?.reasoning);
    const hasToolCalls = Array.isArray(message.meta?.tool_calls) && message.meta!.tool_calls.length > 0;
    return (
      <div key={`${message.role}-${index}`} className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}>
        <div className={message.role === "user" ? "max-w-[78%] rounded-3xl bg-[#2f2f2f] px-5 py-3" : "w-full max-w-full px-1"}>
          {attachments.length > 0 && (
            <div className="mb-3 grid grid-cols-2 gap-2">
              {attachments.map((attachment) => (
                <button key={`${attachment.url}-${attachment.name}`} className="overflow-hidden rounded-xl bg-black/20" onClick={() => window.open(attachment.url, "_blank", "noopener,noreferrer")}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img className="aspect-square w-full object-cover" src={attachment.url} alt={attachment.name} />
                </button>
              ))}
            </div>
          )}
          {message.content && <div className="whitespace-pre-wrap text-[15px] leading-7">{message.content}</div>}
          {hasReasoning && (
            <details className="mt-3 rounded-xl border border-emerald-500/20 bg-emerald-500/5">
              <summary className="flex cursor-pointer list-none items-center gap-2 px-3 py-2 text-sm font-medium text-emerald-100">
                <ChevronDown className="h-4 w-4 details-open:rotate-180" />
                Thinking 过程
              </summary>
              <div className="border-t border-emerald-500/10 px-3 py-2 text-sm text-[#b4b4b4]">
                <div className="whitespace-pre-wrap">{message.meta!.reasoning}</div>
              </div>
            </details>
          )}
          {hasToolCalls && (
            <div className="mt-3 space-y-2">
              <div className="text-xs font-medium text-[#888]">工具调用</div>
              {message.meta!.tool_calls!.map((toolCall) => (
                <ToolCallItem key={toolCall.id} toolCall={toolCall} />
              ))}
            </div>
          )}
          {message.role === "assistant" && index === lastAssistantMessageIndex && (
            <div className="mt-2 flex flex-wrap gap-2">
              {currentConversationSubmitting ? (
                <Button size="sm" variant="secondary" onClick={onStopChat}>
                  <Square className="h-3.5 w-3.5 fill-current" />停止生成
                </Button>
              ) : (
                <Button size="sm" variant="secondary" onClick={onRegenerateChat}>
                  <RefreshCw className="h-4 w-4" />重新生成
                </Button>
              )}
            </div>
          )}
        </div>
      </div>
    );
  });
}

type FavoritePanelProps = {
  favorites: FavoriteView[];
  onRefresh: () => void;
  onOpenImageDetail: (taskId: string, index: number) => void;
  onDownloadMedia: (url: string, filename: string) => void;
  onOpenRawMedia: (url: string) => void;
  onCopy: (text: string) => void;
  onContinueEditImage: (url: string) => void;
  onRemoveFavorite: (favoriteId: string) => void;
  onImageLoad: () => void;
};

/** Displays saved image and video favorites with reuse actions. */
export function FavoritePanel({
  favorites,
  onRefresh,
  onOpenImageDetail,
  onDownloadMedia,
  onOpenRawMedia,
  onCopy,
  onContinueEditImage,
  onRemoveFavorite,
  onImageLoad,
}: FavoritePanelProps) {
  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-xl font-semibold">收藏</div>
          <div className="text-sm text-[#b4b4b4]">已收藏的图片和视频会显示在这里。</div>
        </div>
        <Button size="sm" variant="ghost" onClick={onRefresh}><RefreshCw className="h-4 w-4" />刷新</Button>
      </div>

      {favorites.length === 0 ? (
        <Card className="border-white/10 bg-[#2a2a2a] p-6 text-sm text-[#b4b4b4]">还没有收藏内容。可以在图片或视频作品下点击收藏。</Card>
      ) : (
        <div className="flex flex-col gap-3">
          {favorites.map((item) => (
            <Card key={item.favorite.id} className="overflow-hidden border-white/10 bg-[#2a2a2a]">
              {item.image && (
                <div className="space-y-3">
                  {item.image.image_urls.map((url, index) => (
                    <PortraitImageLink key={`${item.favorite.id}-${url}`} href={`/images/${item.image!.id}?index=${index}`} src={url} alt={item.image!.prompt} onLoad={onImageLoad} />
                  ))}
                  <div className="space-y-2 p-3 pt-0">
                    <div className="line-clamp-2 text-sm">{item.image.prompt}</div>
                    <div className="flex flex-wrap gap-2">
                      <Button size="sm" variant="secondary" onClick={() => onOpenImageDetail(item.image!.id, 0)}><Eye className="h-4 w-4" />查看</Button>
                      {item.image.image_urls[0] && <Button size="sm" variant="secondary" onClick={() => onDownloadMedia(item.image!.image_urls[0], `${item.image!.id}.png`)}><Download className="h-4 w-4" />下载</Button>}
                      {item.image.image_urls[0] && <Button size="sm" variant="secondary" onClick={() => onOpenRawMedia(item.image!.image_urls[0])}><ExternalLink className="h-4 w-4" />打开</Button>}
                      {item.image.image_urls[0] && <Button size="sm" variant="secondary" onClick={() => onCopy(item.image!.image_urls[0])}><Copy className="h-4 w-4" />复制</Button>}
                      {item.image.image_urls[0] && <Button size="sm" variant="secondary" onClick={() => onContinueEditImage(item.image!.image_urls[0])}>继续编辑</Button>}
                      <Button size="sm" variant="destructive" onClick={() => onRemoveFavorite(item.favorite.id)}><Trash2 className="h-4 w-4" />取消收藏</Button>
                    </div>
                  </div>
                </div>
              )}

              {item.video && (
                <div className="space-y-3 p-3">
                  <div className="flex justify-between gap-3 text-sm">
                    <span>{item.video.prompt}</span>
                    <span className="shrink-0 text-[#b4b4b4]">{statusText(item.video.status)}</span>
                  </div>
                  {item.video.video_url && <video className="w-full rounded-lg" src={item.video.video_url} controls preload="metadata" />}
                  <div className="flex flex-wrap gap-2">
                    {item.video.video_url && <a className="inline-flex h-8 items-center gap-1 rounded-md bg-white/10 px-3 text-sm" href={`/videos/${item.video.id}`} target="_blank" rel="noreferrer"><Eye className="h-4 w-4" />查看</a>}
                    {item.video.video_url && <a className="inline-flex h-8 items-center gap-1 rounded-md bg-white/10 px-3 text-sm" href={item.video.video_url} download={`${item.video.id}.mp4`} target="_blank"><Download className="h-4 w-4" />下载</a>}
                    {item.video.video_url && <a className="inline-flex h-8 items-center gap-1 rounded-md bg-white/10 px-3 text-sm" href={item.video.video_url} target="_blank"><ExternalLink className="h-4 w-4" />打开</a>}
                    {item.video.video_url && <Button size="sm" variant="secondary" onClick={() => onCopy(item.video!.video_url)}><Copy className="h-4 w-4" />复制</Button>}
                    <Button size="sm" variant="destructive" onClick={() => onRemoveFavorite(item.favorite.id)}><Trash2 className="h-4 w-4" />取消收藏</Button>
                  </div>
                </div>
              )}

              {!item.image && !item.video && (
                <div className="flex items-center justify-between gap-3 p-4 text-sm text-[#b4b4b4]">
                  <span>收藏的内容已不存在或暂不支持展示：{item.favorite.type} / {item.favorite.ref_id}</span>
                  <Button size="sm" variant="destructive" onClick={() => onRemoveFavorite(item.favorite.id)}><Trash2 className="h-4 w-4" />取消收藏</Button>
                </div>
              )}
            </Card>
          ))}
        </div>
      )}
    </section>
  );
}

type ImagePanelProps = {
  visibleImages: ImageTask[];
  visibleImagesChronological: ImageTask[];
  currentImageRequests: ImageRequest[];
  renderFavoriteAction: (type: "image" | "video", refId: string) => ReactNode;
  onRefresh: () => void;
  onOpenImageDetail: (taskId: string, index: number) => void;
  onDownloadMedia: (url: string, filename: string) => void;
  onOpenRawMedia: (url: string) => void;
  onCopy: (text: string) => void;
  onAddGeneratedImageToAsset: (task: ImageTask, imageUrl: string) => void;
  onContinueEditImage: (url: string) => void;
  onDeleteImage: (taskId: string) => void;
  onImageLoad: () => void;
};

/** Displays image generation results and in-flight image requests. */
export function ImagePanel({
  visibleImages,
  visibleImagesChronological,
  currentImageRequests,
  renderFavoriteAction,
  onRefresh,
  onOpenImageDetail,
  onDownloadMedia,
  onOpenRawMedia,
  onCopy,
  onAddGeneratedImageToAsset,
  onContinueEditImage,
  onDeleteImage,
  onImageLoad,
}: ImagePanelProps) {
  return (
    <section className="space-y-4">
      <div className="agnes-panel rounded-2xl p-4">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="text-xs font-medium text-emerald-200/80">Runway-style media workspace</div>
            <div className="mt-1 text-2xl font-semibold">图片作品</div>
            <div className="mt-1 text-sm text-[#b4b4b4]">素材优先展示，提示词、状态和复用动作放在结果下方。</div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="agnes-status-pill" data-status="success">本页 {visibleImages.length} 张</span>
            {currentImageRequests.length > 0 && <span className="agnes-status-pill" data-status="processing">{currentImageRequests.length} 个生成请求</span>}
            <Button size="sm" variant="ghost" onClick={onRefresh}><RefreshCw className="h-4 w-4" />刷新</Button>
          </div>
        </div>
      </div>

      {visibleImages.length === 0 && currentImageRequests.length === 0 ? (
        <Card className="agnes-empty-state rounded-xl p-6 text-sm">还没有图片。请在底部输入框描述图片，上传参考图后点击发送。</Card>
      ) : (
        <div className="grid grid-cols-2 gap-4 max-xl:grid-cols-1">
          {visibleImagesChronological.flatMap((task) => task.image_urls.map((url, index) => (
            <Card key={`${task.id}-${url}`} className="agnes-media-card rounded-2xl">
              <div className="agnes-media-viewport p-3">
                <PortraitImageLink href={`/images/${task.id}?index=${index}`} src={url} alt={task.prompt} onLoad={onImageLoad} />
              </div>
              <div className="space-y-3 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-xs text-[#888]">图片作品 / {index + 1}</div>
                    <div className="mt-1 line-clamp-2 text-sm leading-6">{task.prompt}</div>
                  </div>
                  <span className="agnes-status-pill" data-status={task.status}>{statusText(task.status)}</span>
                </div>
                <div className="agnes-action-bar -mx-4 -mb-4 flex flex-wrap gap-2 px-4 py-3">
                  <Button size="sm" variant="secondary" onClick={() => onOpenImageDetail(task.id, index)}><Eye className="h-4 w-4" />查看</Button>
                  <Button size="sm" variant="secondary" onClick={() => onDownloadMedia(url, `${task.id}-${index + 1}.png`)}><Download className="h-4 w-4" />下载</Button>
                  <Button size="sm" variant="secondary" onClick={() => onOpenRawMedia(url)}><ExternalLink className="h-4 w-4" />打开</Button>
                  <Button size="sm" variant="secondary" onClick={() => onCopy(url)}><Copy className="h-4 w-4" />复制</Button>
                  {renderFavoriteAction("image", task.id)}
                  <Button size="sm" variant="secondary" onClick={() => onAddGeneratedImageToAsset(task, url)}>加入资产</Button>
                  <Button size="sm" variant="secondary" onClick={() => onContinueEditImage(url)}>继续编辑</Button>
                  <Button aria-label="删除图片" size="sm" variant="destructive" onClick={() => onDeleteImage(task.id)}><Trash2 className="h-4 w-4" /></Button>
                </div>
              </div>
            </Card>
          )))}
        </div>
      )}

      {currentImageRequests.map((request) => (
        <Card key={request.id} className="agnes-panel overflow-hidden rounded-2xl">
          <div className="flex justify-end p-4 pb-3">
            <div className="max-w-[86%] rounded-3xl bg-[#2f2f2f] px-4 py-3 text-sm leading-6">
              <div className="whitespace-pre-wrap">{request.prompt}</div>
              {request.attachments.length > 0 && (
                <div className="mt-3 grid grid-cols-4 gap-2 max-sm:grid-cols-3">
                  {request.attachments.map((attachment) => (
                    <button key={attachment.id} className="overflow-hidden rounded-xl bg-black/20" onClick={() => window.open(attachment.url, "_blank", "noopener,noreferrer")}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img className="aspect-square w-full object-cover" src={attachment.previewUrl} alt={attachment.name} />
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {request.status === "generating" && (
            <div className="mx-4 mb-4 flex items-center gap-2 rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-100">
              <Loader2 className="h-4 w-4 animate-spin" />正在生成图片...
            </div>
          )}

          {request.status === "failed" && (
            <div className="mx-4 mb-4 rounded-lg bg-red-500/10 p-3 text-sm text-red-200">{request.error}</div>
          )}

          {request.task && (
            <div className="grid grid-cols-2 gap-4 p-4 max-xl:grid-cols-1">
              {request.task.image_urls.map((url, index) => (
                <Card key={`${request.task?.id}-${url}`} className="agnes-media-card rounded-2xl">
                  <div className="agnes-media-viewport p-3">
                    <PortraitImageLink href={`/images/${request.task?.id}?index=${index}`} src={url} alt={request.prompt} onLoad={onImageLoad} />
                  </div>
                  <div className="agnes-action-bar flex flex-wrap gap-2 p-3">
                    <Button size="sm" variant="secondary" onClick={() => onOpenImageDetail(request.task!.id, index)}><Eye className="h-4 w-4" />查看</Button>
                    <Button size="sm" variant="secondary" onClick={() => onDownloadMedia(url, `${request.task!.id}-${index + 1}.png`)}><Download className="h-4 w-4" />下载</Button>
                    <Button size="sm" variant="secondary" onClick={() => onOpenRawMedia(url)}><ExternalLink className="h-4 w-4" />打开</Button>
                    <Button size="sm" variant="secondary" onClick={() => onCopy(url)}><Copy className="h-4 w-4" />复制</Button>
                    {renderFavoriteAction("image", request.task!.id)}
                    <Button size="sm" variant="secondary" onClick={() => onAddGeneratedImageToAsset(request.task!, url)}>加入资产</Button>
                    <Button size="sm" variant="secondary" onClick={() => onContinueEditImage(url)}>继续编辑</Button>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </Card>
      ))}
    </section>
  );
}

type VideoPanelProps = {
  videos: VideoTask[];
  videoSettings: VideoSettings;
  attachmentCount: number;
  renderFavoriteAction: (type: "image" | "video", refId: string) => ReactNode;
  onRefresh: () => void;
  onCopy: (text: string) => void;
  onDeleteVideo: (videoId: string) => void;
};

/** Displays video generation dashboard cards and task players. */
export function VideoPanel({ videos, videoSettings, attachmentCount, renderFavoriteAction, onRefresh, onCopy, onDeleteVideo }: VideoPanelProps) {
  return (
    <section className="mx-auto w-full max-w-[980px] space-y-4">
      <div className="rounded-[22px] border border-white/10 bg-[#202020] p-5 shadow-[0_18px_60px_rgba(0,0,0,0.22)]">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="text-sm font-medium text-emerald-200/90">Agnes Video V2.0 工作台</div>
            <div className="mt-1 text-2xl font-semibold text-white">视频生成</div>
            <div className="mt-2 max-w-2xl text-sm leading-6 text-[#cfcfcf]">输入提示词即可文生视频；上传参考图后可图生视频；多张参考图会按关键帧模式参与生成。</div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="agnes-status-pill" data-status="success">共 {videos.length} 个任务</span>
            <span className="agnes-status-pill" data-status="processing">{videos.filter((video) => video.status === "processing" || video.status === "pending").length} 个进行中</span>
            <Button size="sm" variant="ghost" onClick={onRefresh}><RefreshCw className="h-4 w-4" />刷新</Button>
          </div>
        </div>
        <div className="mt-5 grid grid-cols-3 gap-3 max-md:grid-cols-1">
          <div className="rounded-2xl border border-white/10 bg-[#2a2a2a] p-4">
            <div className="text-sm font-semibold text-white">当前规格</div>
            <div className="mt-2 text-2xl font-semibold text-white">{videoSettings.width}x{videoSettings.height}</div>
            <div className="mt-1 text-sm text-[#cfcfcf]">{videoSettings.ratio} · 约 {estimateVideoSeconds(videoSettings.num_frames, videoSettings.frame_rate)} 秒</div>
          </div>
          <div className="rounded-2xl border border-white/10 bg-[#2a2a2a] p-4">
            <div className="text-sm font-semibold text-white">生成模式</div>
            <div className="mt-2 text-2xl font-semibold text-white">{videoSettings.mode === "keyframes" ? "关键帧" : "文生/图生"}</div>
            <div className="mt-1 text-sm text-[#cfcfcf]">{attachmentCount > 0 ? `已添加 ${attachmentCount} 张参考图` : "未添加参考图"}</div>
          </div>
          <div className="rounded-2xl border border-white/10 bg-[#2a2a2a] p-4">
            <div className="text-sm font-semibold text-white">任务状态</div>
            <div className="mt-2 text-2xl font-semibold text-white">{videos.filter((video) => ["pending", "processing"].includes(video.status)).length}</div>
            <div className="mt-1 text-sm text-[#cfcfcf]">正在排队或生成的视频</div>
          </div>
        </div>
      </div>
      {videos.length === 0 ? (
        <div className="rounded-[22px] border border-dashed border-white/15 bg-[#202020]/70 p-8">
          <div className="mx-auto max-w-2xl text-center">
            <div className="text-lg font-semibold text-white">还没有视频任务</div>
            <div className="mt-2 text-sm leading-6 text-[#cfcfcf]">在底部输入视频描述，或先上传分镜底图/参考图。生成后这里会展示播放器、进度、下载、收藏和二次复用入口。</div>
          </div>
          <div className="mt-6 grid grid-cols-3 gap-3 max-md:grid-cols-1">
            {[
              ["1", "描述镜头", "写清主体、动作、镜头运动、光影和风格。"],
              ["2", "上传参考", "可拖入分镜底图，作为图生视频或关键帧素材。"],
              ["3", "生成管理", "任务会在这里显示进度，完成后可预览和下载。"],
            ].map(([step, title, text]) => (
              <div key={step} className="rounded-2xl border border-white/10 bg-[#2a2a2a] p-4">
                <div className="grid h-8 w-8 place-items-center rounded-full bg-emerald-500/15 text-sm font-semibold text-emerald-100">{step}</div>
                <div className="mt-3 text-sm font-semibold text-white">{title}</div>
                <div className="mt-2 text-sm leading-6 text-[#cfcfcf]">{text}</div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        videos.map((video) => (
          <Card key={video.id} className="agnes-media-card rounded-2xl">
            <div className="grid grid-cols-[minmax(0,1.4fr)_360px] gap-0 max-xl:grid-cols-1">
              <div className="agnes-media-viewport p-3">
                {video.video_url ? (
                  <video className="max-h-[68vh] w-full rounded-xl bg-black object-contain" src={video.video_url} controls preload="metadata" />
                ) : (
                  <div className="grid min-h-64 place-items-center rounded-xl border border-dashed border-white/10 bg-black/30 text-sm text-[#b4b4b4]">
                    {video.status === "failed" ? "视频生成失败" : "等待视频结果"}
                  </div>
                )}
              </div>
              <div className="flex flex-col border-l border-white/10 bg-[#181818] p-4 max-xl:border-l-0 max-xl:border-t">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-xs text-[#888]">视频生成任务</div>
                    <div className="mt-1 text-base font-semibold text-white">{video.video_url ? "可播放预览" : "生成中"}</div>
                  </div>
                  <span className="agnes-status-pill" data-status={video.status}>{statusText(video.status)}</span>
                </div>
                <div className="mt-4 line-clamp-6 whitespace-pre-wrap text-sm leading-6 text-[#d8d8d8]">{video.prompt}</div>
                <div className="mt-4 grid grid-cols-2 gap-2 text-xs text-[#b4b4b4]">
                  <div className="rounded-lg bg-white/[0.04] px-3 py-2">
                    <div className="text-[#888]">视频 ID</div>
                    <div className="mt-1 truncate text-white">{video.video_id || video.id}</div>
                  </div>
                  <div className="rounded-lg bg-white/[0.04] px-3 py-2">
                    <div className="text-[#888]">进度</div>
                    <div className="mt-1 text-white">{video.progress ?? (video.video_url ? 100 : 0)}%</div>
                  </div>
                  <div className="rounded-lg bg-white/[0.04] px-3 py-2">
                    <div className="text-[#888]">规格</div>
                    <div className="mt-1 text-white">{video.size || "API 标准化中"}</div>
                  </div>
                  <div className="rounded-lg bg-white/[0.04] px-3 py-2">
                    <div className="text-[#888]">时长</div>
                    <div className="mt-1 text-white">{video.seconds ? `${video.seconds}s` : "生成后确认"}</div>
                  </div>
                </div>
                {video.error && <div className="mt-3 rounded-lg bg-red-500/10 px-3 py-2 text-xs text-red-200">{video.error}</div>}
                {video.video_url && (
                  <div className="agnes-action-bar -mx-4 -mb-4 mt-auto flex flex-wrap gap-2 px-4 py-3">
                    <a className="inline-flex h-8 items-center gap-1 rounded-md bg-white/10 px-3 text-sm hover:bg-white/15" href={`/videos/${video.id}`} target="_blank" rel="noreferrer"><Eye className="h-4 w-4" />查看</a>
                    <a className="inline-flex h-8 items-center gap-1 rounded-md bg-white/10 px-3 text-sm hover:bg-white/15" href={video.video_url} download={`${video.id}.mp4`} target="_blank"><Download className="h-4 w-4" />下载</a>
                    <a className="inline-flex h-8 items-center gap-1 rounded-md bg-white/10 px-3 text-sm hover:bg-white/15" href={video.video_url} target="_blank"><ExternalLink className="h-4 w-4" />打开</a>
                    <Button size="sm" variant="secondary" onClick={() => onCopy(video.video_url)}><Copy className="h-4 w-4" />复制</Button>
                    {renderFavoriteAction("video", video.id)}
                    <Button size="sm" variant="destructive" onClick={() => onDeleteVideo(video.id)}><Trash2 className="h-4 w-4" /></Button>
                  </div>
                )}
              </div>
            </div>
          </Card>
        ))
      )}
    </section>
  );
}
