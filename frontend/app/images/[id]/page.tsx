"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { ArrowLeft, Copy, Download, ExternalLink, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

type Status = "pending" | "processing" | "success" | "failed";

interface ImageTask {
  id: string;
  conversation_id: string;
  prompt: string;
  negative: string;
  params: Record<string, unknown>;
  image_urls: string[];
  status: Status;
  error: string;
  created_at: string;
}

/** 请求图片详情接口，并解包后端统一响应格式。 */
async function api<T>(path: string): Promise<T> {
  const response = await fetch(path);
  const payload = await response.json();
  if (payload.code !== 0) throw new Error(payload.message);
  return payload.data as T;
}

/** 图片详情页，在新标签页中查看、下载和复制生成结果。 */
export default function ImageDetailPage() {
  const params = useParams<{ id: string }>();
  const [task, setTask] = useState<ImageTask | null>(null);
  const [selected, setSelected] = useState(0);
  const [notice, setNotice] = useState("");

  const selectedUrl = useMemo(() => task?.image_urls[selected] ?? task?.image_urls[0] ?? "", [selected, task]);

  /** 加载图片任务详情，并根据 URL 参数选中指定图片。 */
  async function load() {
    try {
      setNotice("");
      const data = await api<ImageTask>(`/api/images/${params.id}`);
      setTask(data);
      const index = Number(new URLSearchParams(window.location.search).get("index") ?? "0");
      setSelected(Number.isFinite(index) ? Math.max(0, Math.min(index, data.image_urls.length - 1)) : 0);
    } catch (error) {
      setNotice((error as Error).message || "图片详情加载失败");
    }
  }

  /** 复制当前图片地址到剪贴板。 */
  async function copy(text: string) {
    await navigator.clipboard.writeText(text);
    setNotice("已复制");
  }

  useEffect(() => {
    void load();
  }, [params.id]);

  return (
    <main className="min-h-screen bg-[#212121] text-[#ececec]">
      <header className="sticky top-0 z-20 flex h-14 items-center justify-between border-b border-white/10 bg-[#212121]/95 px-4 backdrop-blur">
        <Button size="sm" variant="ghost" onClick={() => window.close()}>
          <ArrowLeft className="h-4 w-4" />关闭
        </Button>
        <div className="truncate px-4 text-sm text-[#b4b4b4]">{notice || "图片详情"}</div>
        <Button size="sm" variant="ghost" onClick={() => void load()}>
          <RefreshCw className="h-4 w-4" />刷新
        </Button>
      </header>

      <section className="mx-auto grid max-w-7xl gap-4 p-4 lg:grid-cols-[1fr_360px]">
        <div className="grid min-h-[calc(100vh-88px)] place-items-center rounded-lg bg-[#171717] p-3">
          {selectedUrl ? (
            <div
              className="aspect-[9/16] max-h-[calc(100vh-120px)] overflow-hidden rounded-lg"
              style={{ width: "min(100%, calc((100vh - 120px) * 9 / 16))" }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img className="h-full w-full object-contain" src={selectedUrl} alt={task?.prompt ?? "图片作品"} />
            </div>
          ) : (
            <div className="text-sm text-[#b4b4b4]">正在加载图片...</div>
          )}
        </div>

        <aside className="space-y-3">
          <Card className="space-y-3 border-white/10 bg-[#2a2a2a] p-4">
            <div className="text-sm text-[#b4b4b4]">提示词</div>
            <div className="whitespace-pre-wrap text-sm leading-7">{task?.prompt || "-"}</div>
          </Card>

          {task && task.image_urls.length > 1 && (
            <Card className="space-y-3 border-white/10 bg-[#2a2a2a] p-3">
              <div className="text-sm text-[#b4b4b4]">全部图片</div>
              <div className="grid grid-cols-4 gap-2">
                {task.image_urls.map((url, index) => (
                  <button key={url} className={`overflow-hidden rounded-md border ${selected === index ? "border-emerald-400" : "border-white/10"}`} onClick={() => setSelected(index)}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img className="aspect-square w-full object-cover" src={url} alt={`图片 ${index + 1}`} />
                  </button>
                ))}
              </div>
            </Card>
          )}

          <Card className="space-y-3 border-white/10 bg-[#2a2a2a] p-4 text-sm">
            <div className="flex justify-between gap-3">
              <span className="text-[#b4b4b4]">状态</span>
              <span>{task?.status ?? "-"}</span>
            </div>
            <div className="flex justify-between gap-3">
              <span className="text-[#b4b4b4]">创建时间</span>
              <span className="text-right">{task?.created_at ? new Date(task.created_at).toLocaleString() : "-"}</span>
            </div>
            {task?.error && <div className="text-red-300">{task.error}</div>}
          </Card>

          <div className="flex flex-wrap gap-2">
            <a className="inline-flex h-9 items-center gap-2 rounded-md bg-white/10 px-3 text-sm" href={selectedUrl} download={`${task?.id ?? "image"}.png`} target="_blank">
              <Download className="h-4 w-4" />下载
            </a>
            <a className="inline-flex h-9 items-center gap-2 rounded-md bg-white/10 px-3 text-sm" href={selectedUrl} target="_blank">
              <ExternalLink className="h-4 w-4" />打开原图
            </a>
            <Button size="sm" variant="secondary" disabled={!selectedUrl} onClick={() => void copy(selectedUrl)}>
              <Copy className="h-4 w-4" />复制链接
            </Button>
          </div>
        </aside>
      </section>
    </main>
  );
}
