"use client";

import { useState, useCallback } from "react";
import { api, uploadImages } from "@/lib/api-client";
import { cropReferenceImageToPortrait, shouldUseLocalCrop } from "@/lib/media-tools";
import { imageRatioFromSize } from "@/lib/project-workflow";
import type { Attachment, ImageSettings, ImageSize, ImageTask, ImageRequest } from "@/lib/app-types";

export function useImageGeneration({
  conversationId,
  showNotice,
}: {
  conversationId: string;
  showNotice: (message: string) => void;
}) {
  const [imageSettings, setImageSettings] = useState<ImageSettings>({
    ratio: imageRatioFromSize("1024x768"),
    size: "1024x768",
    n: 1,
    seed: "",
    negative_prompt: "",
    response_format: "url",
  });
  const [images, setImages] = useState<ImageTask[]>([]);
  const [imageRequests, setImageRequests] = useState<ImageRequest[]>([]);

  /** 加载指定会话的图片生成任务。 */
  const loadImages = useCallback(
    async (id = conversationId) => {
      if (!id) {
        setImages([]);
        return [];
      }
      try {
        const next = await api<ImageTask[]>(`/api/images?conversationId=${encodeURIComponent(id)}`);
        setImages(next);
        return next;
      } catch (error) {
        showNotice((error as Error).message || "图片列表加载失败");
        return [];
      }
    },
    [conversationId, showNotice]
  );

  /** 提交图片生成请求。 */
  const submitImage = useCallback(
    async ({
      prompt,
      attachments,
      onSuccess,
      onActiveStoryboardRef,
      selectedProject,
      projectStoryboards,
      updateProjectStoryboardItem,
    }: {
      prompt: string;
      attachments: Attachment[];
      onSuccess?: (task: ImageTask) => void;
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
      const requestId = crypto.randomUUID();
      setImageRequests((items) => [
        ...items,
        {
          id: requestId,
          conversationId: targetConversationId,
          prompt: text,
          attachments: attachmentSnapshot,
          status: "generating" as const,
        },
      ]);
      showNotice("正在生成图片...");
      try {
        let task: ImageTask;
        if (shouldUseLocalCrop(text) && readyAttachments.length > 0) {
          showNotice("正在按参考图本地裁切...");
          const cropped = await cropReferenceImageToPortrait(readyAttachments[0], text);
          const [stored] = await uploadImages([cropped]);
          task = await api<ImageTask>("/api/images/local", {
            method: "POST",
            body: JSON.stringify({ prompt: text, conversationId: targetConversationId, image_urls: [stored.url] }),
          });
        } else {
          task = await api<ImageTask>("/api/images/generate", {
            method: "POST",
            body: JSON.stringify({
              prompt: text,
              conversationId: targetConversationId,
              size: imageSettings.size,
              ratio: imageSettings.ratio,
              n: imageSettings.n,
              seed: imageSettings.seed.trim() ? Number(imageSettings.seed) : undefined,
              negative_prompt: imageSettings.negative_prompt.trim() || undefined,
              response_format: imageSettings.response_format,
              images: readyAttachments.map((attachment) => attachment.url),
            }),
          });
        }
        setImageRequests((items) => items.map((item) => (item.id === requestId ? { ...item, status: "success" as const, task } : item)));
        if (
          onActiveStoryboardRef?.current?.mode === "image" &&
          onActiveStoryboardRef.current.id &&
          task.image_urls[0] &&
          selectedProject &&
          projectStoryboards &&
          updateProjectStoryboardItem
        ) {
          const storyboard = projectStoryboards.find((item) => item.id === onActiveStoryboardRef.current?.id);
          if (storyboard) {
            await updateProjectStoryboardItem(storyboard, {
              image_task_id: task.id,
              image_url: task.image_urls[0],
              prompt: text,
              status: "image",
            });
          }
          onActiveStoryboardRef.current = null;
        }
        await loadImages();
        showNotice("图片已生成");
        onSuccess?.(task);
      } catch (error) {
        setImageRequests((items) =>
          items.map((item) => (item.id === requestId ? { ...item, status: "failed" as const, error: (error as Error).message || "图片生成失败" } : item))
        );
        showNotice((error as Error).message || "图片生成失败");
      }
    },
    [conversationId, imageSettings, loadImages, showNotice]
  );

  /** 删除图片任务记录并刷新当前图片列表。 */
  const deleteImage = useCallback(
    async (taskId: string) => {
      await api(`/api/images/${taskId}`, { method: "DELETE" });
      await loadImages();
      showNotice("已删除图片");
    },
    [loadImages, showNotice]
  );

  /** 把已生成图片放回输入编辑器附件区，方便继续编辑。 */
  const continueEditImage = useCallback((url: string) => {
    return {
      id: crypto.randomUUID(),
      name: "已生成图片",
      size: 0,
      url,
      previewUrl: url,
      status: "success" as const,
    };
  }, []);

  return {
    imageSettings,
    setImageSettings,
    images,
    setImages,
    imageRequests,
    setImageRequests,
    loadImages,
    submitImage,
    deleteImage,
    continueEditImage,
  };
}
