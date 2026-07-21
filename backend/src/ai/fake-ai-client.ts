/**
 * @file fake-ai-client.ts
 * @description 测试用假 AI 客户端。所有调用都返回固定 demo URL，**绝不真请求后端**。
 *
 * ## 使用场景
 *  - CI 单元测试：避免依赖真实模型 API。
 *  - 前端 demo 演示：无需 API Key 也能跑通"假出图/假出视频"流程。
 *  - 离线开发：本机无网络时仍能完成前后端联调。
 *
 * ## 重要
 *  - 仅在 `FAKE_AI_CLIENT=1` 或开发模式启用，**生产环境绝不允许**。
 */
import type { AgnesClient } from "./agnes-client.js";
import type { ChatChunk, ChatParams, ImageParams, TaskStatus, VideoParams } from "../types.js";

export class FakeAIClient implements AgnesClient {
  private sequence = 0;

  async *chat(params: ChatParams, signal?: AbortSignal): AsyncIterable<ChatChunk> {
    if (signal?.aborted) throw new Error("测试请求已取消");
    yield { content: `测试回复：${params.message}` };
    yield { done: true };
  }

  async generateImage(
    params: ImageParams,
    signal?: AbortSignal,
  ): Promise<{ imageUrls: string[] }> {
    if (signal?.aborted) throw new Error("测试请求已取消");
    const count = Math.max(1, Math.min(4, params.n ?? 1));
    const batch = ++this.sequence;
    return {
      imageUrls: Array.from(
        { length: count },
        (_, index) => `https://example.invalid/test-images/${batch}-${index + 1}.png`,
      ),
    };
  }

  async generateVideo(
    _params: VideoParams,
    signal?: AbortSignal,
  ): Promise<{ taskId: string }> {
    if (signal?.aborted) throw new Error("测试请求已取消");
    return { taskId: `fake-video-${++this.sequence}` };
  }

  async queryTask(
    taskId: string,
    signal?: AbortSignal,
  ): Promise<{ status: TaskStatus; videoUrl?: string }> {
    if (signal?.aborted) throw new Error("测试请求已取消");
    return { status: "success", videoUrl: `https://example.invalid/test-videos/${taskId}.mp4` };
  }

  async generateTTS(
    params: { text: string; voice?: string; emotion?: string; speed?: number; format?: string },
    signal?: AbortSignal,
  ): Promise<{
    file_url: string;
    duration: number;
    status: string;
    voice?: string;
    emotion?: string;
  }> {
    if (signal?.aborted) throw new Error("测试请求已取消");
    return {
      file_url: `https://example.invalid/test-audio/${++this.sequence}.${params.format ?? "mp3"}`,
      duration: Math.max(1, Math.ceil(params.text.length / 5)),
      status: "success",
      voice: params.voice,
      emotion: params.emotion,
    };
  }

  async queryVideoStatus(
    taskId: string,
    signal?: AbortSignal,
  ): Promise<{ status: string; progress: number; file_url: string; error: string }> {
    if (signal?.aborted) throw new Error("测试请求已取消");
    return {
      status: "success",
      progress: 100,
      file_url: `https://example.invalid/test-videos/${taskId}.mp4`,
      error: "",
    };
  }
}
