"use client";

import { useState, useCallback, useRef } from "react";
import { api } from "@/lib/api-client";
import { defaultVideoSize, validVideoFrames } from "@/lib/project-workflow";
import type { VideoSettings, VideoTask, VideoRatio, Attachment } from "@/lib/app-types";

export function useVideoGeneration({
  conversationId,
  showNotice,
}: {
  conversationId: string;
  showNotice: (message: string) => void;
}) {
  const [videoSettings, setVideoSettings] = useState<VideoSettings>({
    ratio: "16:9",
    mode: "ti2vid",
    width: 1152,
    height: 768,
    num_frames: 121,
    frame_rate: 24,
    num_inference_steps: undefined,
    seed: "",
    negative_prompt: "",
  });
  const [videos, setVideos] = useState<VideoTask[]>([]);
  const [runningVideoConversationIds, setRunningVideoConversationIds] = useState<string[]>([]);
  const videoQueryAtRef = useRef<Record<string, number>>({});

  /** 加载并刷新指定会话的视频任务状态。 */
  const loadVideos = useCallback(
    async (id = conversationId) => {
      if (!id) {
        setVideos([]);
        return [];
      }
      try {
        const tasks = await api<VideoTask[]>(`/api/videos?conversationId=${encodeURIComponent(id)}`);
        const now = Date.now();
        const next: VideoTask[] = [];
        for (const task of tasks) {
          if (!["pending", "processing"].includes(task.status)) {
            next.push(task);
            continue;
          }
          const lastQueryAt = videoQueryAtRef.current[task.id] ?? 0;
          if (now - lastQueryAt < 12000) {
            next.push(task);
            continue;
          }
          videoQueryAtRef.current[task.id] = now;
          try {
            next.push(await api<VideoTask>(`/api/videos/${task.id}`));
          } catch (error) {
            if (/429|rate limit/i.test((error as Error).message)) {
              next.push({ ...task, error: "状态查询太频繁，稍后自动重试" });
              continue;
            }
            throw error;
          }
        }
        setRunningVideoConversationIds((items) => {
          const hasRunning = next.some((video) => ["pending", "processing"].includes(video.status));
          if (hasRunning && !items.includes(id)) return [...items, id];
          if (!hasRunning && items.includes(id)) return items.filter((item) => item !== id);
          return items;
        });
        setVideos(next);
        return next;
      } catch (error) {
        showNotice((error as Error).message || "视频列表加载失败");
        return [];
      }
    },
    [conversationId, showNotice]
  );

  /** 提交视频生成请求。 */
  const submitVideo = useCallback(
    async ({
      prompt,
      attachments,
      onActiveStoryboardRef,
      selectedProject,
      projectStoryboards,
      updateProjectStoryboardItem,
    }: {
      prompt: string;
      attachments: Attachment[];
      onActiveStoryboardRef?: React.MutableRefObject<{ id: string; mode: "image" | "video" } | null>;
      selectedProject?: { id: string } | null;
      projectStoryboards?: import("@/lib/app-types").ProjectStoryboard[];
      updateProjectStoryboardItem?: (storyboard: import("@/lib/app-types").ProjectStoryboard, patch: Partial<import("@/lib/app-types").ProjectStoryboard>) => Promise<void>;
    }) => {
      const text = prompt.trim();
      if (!text) return;
      const targetConversationId = conversationId;
      if (!targetConversationId) return;
      const attachmentSnapshot = attachments;
      const readyAttachments = attachmentSnapshot.filter((attachment) => attachment.status === "success" && attachment.url);
      if (attachmentSnapshot.some((attachment) => attachment.status === "uploading")) {
        showNotice("图片还在上传，请稍等");
        return;
      }
      if (attachmentSnapshot.some((attachment) => attachment.status === "failed")) {
        showNotice("有图片上传失败，请移除后重新上传");
        return;
      }
      if (!validVideoFrames(videoSettings.num_frames)) {
        showNotice("视频帧数必须 <=441 且满足 8n+1");
        return;
      }
      if (videoSettings.frame_rate < 1 || videoSettings.frame_rate > 60) {
        showNotice("视频帧率必须在 1-60 之间");
        return;
      }
      showNotice("正在提交视频任务...");
      const keyframeUrls = videoSettings.mode === "keyframes" ? readyAttachments.map((attachment) => attachment.url) : [];
      const created = await api<VideoTask>("/api/videos/generate", {
        method: "POST",
        body: JSON.stringify({
          prompt: text,
          conversationId: targetConversationId,
          image: readyAttachments[0]?.url,
          images: keyframeUrls,
          ratio: videoSettings.ratio,
          mode: videoSettings.mode,
          width: videoSettings.width,
          height: videoSettings.height,
          num_frames: videoSettings.num_frames,
          frame_rate: videoSettings.frame_rate,
          num_inference_steps: videoSettings.num_inference_steps,
          seed: videoSettings.seed.trim() ? Number(videoSettings.seed) : undefined,
          negative_prompt: videoSettings.negative_prompt.trim() || undefined,
        }),
      });
      if (
        onActiveStoryboardRef?.current?.mode === "video" &&
        onActiveStoryboardRef.current.id &&
        selectedProject &&
        projectStoryboards &&
        updateProjectStoryboardItem
      ) {
        const storyboard = projectStoryboards.find((item) => item.id === onActiveStoryboardRef.current?.id);
        if (storyboard) {
          await updateProjectStoryboardItem(storyboard, {
            video_task_id: created.id,
            video_url: created.video_url,
            prompt: text,
            image_url: readyAttachments[0]?.url ?? storyboard.image_url,
            status: "video",
          });
        }
        onActiveStoryboardRef.current = null;
      }
      setVideos((items) => [created, ...items.filter((item) => item.id !== created.id)]);
      setRunningVideoConversationIds((items) => (!items.includes(targetConversationId) ? [...items, targetConversationId] : items));
      showNotice("视频任务已提交");
    },
    [conversationId, videoSettings, showNotice]
  );

  /** 删除视频任务。 */
  const deleteVideo = useCallback(
    async (videoId: string) => {
      await api(`/api/videos/${videoId}`, { method: "DELETE" });
      await loadVideos();
      showNotice("已删除视频");
    },
    [loadVideos, showNotice]
  );

  return {
    videoSettings,
    setVideoSettings,
    videos,
    setVideos,
    runningVideoConversationIds,
    setRunningVideoConversationIds,
    videoQueryAtRef,
    loadVideos,
    submitVideo,
    deleteVideo,
  };
}
