"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { ArrowLeft, Copy, Download, ExternalLink, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

type Status = "pending" | "processing" | "success" | "failed";

interface VideoTask {
  id: string;
  conversation_id: string;
  prompt: string;
  image_url: string;
  params: Record<string, unknown>;
  video_url: string;
  status: Status;
  error: string;
  created_at: string;
}

/** 请求视频详情接口，并解包后端统一响应格式。 */
async function api<T>(path: string): Promise<T> {
  const response = await fetch(path);
  const payload = await response.json();
  if (payload.code !== 0) throw new Error(payload.message);
  return payload.data as T;
}

/** 把任务状态转换成用户能看懂的中文文案。 */
function statusText(status?: Status) {
  return ({ pending: "排队中", processing: "生成中", success: "已完成", failed: "失败" } as const)[status ?? "pending"] ?? status;
}

/** 视频详情页，在新标签页中查看、刷新、下载和复制生成结果。 */
export default function VideoDetailPage() {
  const params = useParams<{ id: string }>();
  const [task, setTask] = useState<VideoTask | null>(null);
  const [notice, setNotice] = useState("");

  /** 加载视频任务详情，失败时把错误展示在顶部提示区。 */
  async function load() {
    try {
      setNotice("");
      setTask(await api<VideoTask>(`/api/videos/${params.id}`));
    } catch (error) {
      setNotice((error as Error).message || "视频详情加载失败");
    }
  }

  /** 复制当前视频地址到剪贴板。 */
  async function copy(text: string) {
    await navigator.clipboard.writeText(text);
    setNotice("已复制");
  }

  useEffect(() => {
    void load();
  }, [params.id]);

  useEffect(() => {
    if (!task || !["pending", "processing"].includes(task.status)) return;
    const timer = window.setInterval(() => void load(), 3000);
    return () => window.clearInterval(timer);
  }, [task?.status]);

  return (
    <main className="min-h-screen bg-[#212121] text-[#ececec]">
      <header className="sticky top-0 z-20 flex h-14 items-center justify-between border-b border-white/10 bg-[#212121]/95 px-4 backdrop-blur">
        <Button size="sm" variant="ghost" onClick={() => window.close()}>
          <ArrowLeft className="h-4 w-4" />关闭
        </Button>
        <div className="truncate px-4 text-sm text-[#b4b4b4]">{notice || "视频详情"}</div>
        <Button size="sm" variant="ghost" onClick={() => void load()}>
          <RefreshCw className="h-4 w-4" />刷新
        </Button>
      </header>

      <section className="mx-auto grid max-w-7xl gap-4 p-4 lg:grid-cols-[1fr_360px]">
        <div className="grid min-h-[calc(100vh-88px)] place-items-center rounded-lg bg-[#171717] p-3">
          {task?.video_url ? (
            <video className="max-h-[calc(100vh-120px)] max-w-full rounded-lg" src={task.video_url} controls autoPlay preload="metadata" />
          ) : (
            <div className="text-sm text-[#b4b4b4]">{task ? statusText(task.status) : "正在加载视频..."}</div>
          )}
        </div>

        <aside className="space-y-3">
          <Card className="space-y-3 border-white/10 bg-[#2a2a2a] p-4">
            <div className="text-sm text-[#b4b4b4]">提示词</div>
            <div className="whitespace-pre-wrap text-sm leading-7">{task?.prompt || "-"}</div>
          </Card>

          {task?.image_url && (
            <Card className="space-y-3 border-white/10 bg-[#2a2a2a] p-3">
              <div className="text-sm text-[#b4b4b4]">参考图片</div>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img className="max-h-64 w-full rounded-md object-contain" src={task.image_url} alt="参考图片" />
            </Card>
          )}

          <Card className="space-y-3 border-white/10 bg-[#2a2a2a] p-4 text-sm">
            <div className="flex justify-between gap-3">
              <span className="text-[#b4b4b4]">状态</span>
              <span>{statusText(task?.status)}</span>
            </div>
            <div className="flex justify-between gap-3">
              <span className="text-[#b4b4b4]">创建时间</span>
              <span className="text-right">{task?.created_at ? new Date(task.created_at).toLocaleString() : "-"}</span>
            </div>
            {task?.error && <div className="text-red-300">{task.error}</div>}
          </Card>

          <div className="flex flex-wrap gap-2">
            <a className="inline-flex h-9 items-center gap-2 rounded-md bg-white/10 px-3 text-sm" href={task?.video_url || "#"} download={`${task?.id ?? "video"}.mp4`} target="_blank">
              <Download className="h-4 w-4" />下载
            </a>
            <a className="inline-flex h-9 items-center gap-2 rounded-md bg-white/10 px-3 text-sm" href={task?.video_url || "#"} target="_blank">
              <ExternalLink className="h-4 w-4" />打开原视频
            </a>
            <Button size="sm" variant="secondary" disabled={!task?.video_url} onClick={() => task?.video_url && void copy(task.video_url)}>
              <Copy className="h-4 w-4" />复制链接
            </Button>
          </div>
        </aside>
      </section>
    </main>
  );
}
