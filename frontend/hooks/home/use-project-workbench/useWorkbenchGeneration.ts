"use client";

/**
 * 工作台：分镜图像生成 / 视频生成（提交任务）
 */

import { useCallback } from "react";
import { api } from "@/lib/api-client";
import type {
  Project,
  ProjectStoryboard,
  ImageTask,
  VideoTask,
} from "@/lib/app-types";
import type { WorkbenchState } from "./useWorkbenchState";

/**
 * 分镜生成（图片 / 视频 模式）
 *
 * 由外部 UI 触发，统一签名 useStoryboardForGeneration(storyboard, mode)
 * 内部按 mode 调用 image / video 子任务。
 */
export function useStoryboardForGeneration({
  state,
  showNotice,
}: {
  state: WorkbenchState;
  showNotice: (message: string) => void;
}) {
  const { activeStoryboardRef } = state;

  const generateImage = useCallback(async (selectedProject: Project | undefined, storyboard: ProjectStoryboard) => {
    if (!selectedProject) return;
    const prompt = (storyboard.prompt || storyboard.description).trim();
    if (!prompt) { showNotice("请先填写分镜描述或 prompt"); return; }
    try {
      showNotice("已提交图像生成任务");
      const task = await api<ImageTask>(`/api/projects/${selectedProject.id}/storyboards/${storyboard.id}/generate-image`, { method: "POST", body: JSON.stringify({ prompt }) });
      activeStoryboardRef.current = { id: storyboard.id, mode: "image" };
      return task;
    } catch (error) {
      showNotice((error as Error).message || "图像生成失败");
    }
  }, [activeStoryboardRef, showNotice]);

  const generateVideo = useCallback(async (selectedProject: Project | undefined, storyboard: ProjectStoryboard) => {
    if (!selectedProject) return;
    const prompt = (storyboard.prompt || storyboard.description).trim();
    if (!prompt) { showNotice("请先填写分镜描述或 prompt"); return; }
    try {
      showNotice("已提交视频生成任务");
      const task = await api<VideoTask>(`/api/projects/${selectedProject.id}/storyboards/${storyboard.id}/generate-video`, { method: "POST", body: JSON.stringify({ prompt, duration: storyboard.duration }) });
      activeStoryboardRef.current = { id: storyboard.id, mode: "video" };
      return task;
    } catch (error) {
      showNotice((error as Error).message || "视频生成失败");
    }
  }, [activeStoryboardRef, showNotice]);

  return useCallback((selectedProject: Project | undefined, storyboard: ProjectStoryboard, mode: "image" | "video") => {
    if (mode === "image") return generateImage(selectedProject, storyboard);
    return generateVideo(selectedProject, storyboard);
  }, [generateImage, generateVideo]);
}

/**
 * 分镜生成图像（独立调用入口）
 */
export function useGenerateStoryboardImage({
  state,
  showNotice,
}: {
  state: WorkbenchState;
  showNotice: (message: string) => void;
}) {
  const { activeStoryboardRef } = state;

  return useCallback(async (selectedProject: Project | undefined, storyboard: ProjectStoryboard) => {
    if (!selectedProject) return;
    const prompt = (storyboard.prompt || storyboard.description).trim();
    if (!prompt) { showNotice("请先填写分镜描述或 prompt"); return; }
    try {
      showNotice("已提交图像生成任务");
      const task = await api<ImageTask>(`/api/projects/${selectedProject.id}/storyboards/${storyboard.id}/generate-image`, { method: "POST", body: JSON.stringify({ prompt }) });
      activeStoryboardRef.current = { id: storyboard.id, mode: "image" };
      return task;
    } catch (error) {
      showNotice((error as Error).message || "图像生成失败");
    }
  }, [activeStoryboardRef, showNotice]);
}

/**
 * 分镜生成视频（独立调用入口）
 */
export function useGenerateStoryboardVideo({
  state,
  showNotice,
}: {
  state: WorkbenchState;
  showNotice: (message: string) => void;
}) {
  const { activeStoryboardRef } = state;

  return useCallback(async (selectedProject: Project | undefined, storyboard: ProjectStoryboard) => {
    if (!selectedProject) return;
    const prompt = (storyboard.prompt || storyboard.description).trim();
    if (!prompt) { showNotice("请先填写分镜描述或 prompt"); return; }
    try {
      showNotice("已提交视频生成任务");
      const task = await api<VideoTask>(`/api/projects/${selectedProject.id}/storyboards/${storyboard.id}/generate-video`, { method: "POST", body: JSON.stringify({ prompt, duration: storyboard.duration }) });
      activeStoryboardRef.current = { id: storyboard.id, mode: "video" };
      return task;
    } catch (error) {
      showNotice((error as Error).message || "视频生成失败");
    }
  }, [activeStoryboardRef, showNotice]);
}
