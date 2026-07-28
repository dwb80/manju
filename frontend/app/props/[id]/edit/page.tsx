"use client";

/**
 * 道具图片生成页（独立路由）
 *
 * 路由: /props/[id]/edit
 * - 新标签页打开，不显示侧边栏（layout-shell 已识别）
 * - 拉取道具 → 渲染极简生图界面
 * - 关闭按钮直接 window.close() 关闭当前标签页
 *
 * 生图参数严格遵循 `images.txt`（Agnes Image 2.1 Flash 接口文档）：
 *   - model: agnes-image-2.1-flash
 *   - size:  1024x1024（与 1:1 比例匹配，道具为方形实物图）
 *   - n:     1（默认生成 1 张）
 *   - extra_body.response_format: url
 * 调用后端 /api/images/generate，后端会把这些参数映射到 Agnes API 规范。
 *
 * 与 /characters/[id]/edit 同构，区别仅在于比例（道具用 1:1 方形）。
 */

import { useEffect, useState, use } from "react";
import { useRouter } from "next/navigation";
import { Loader2, ArrowLeft, AlertTriangle, Sparkles, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { getProp } from "@/services/prop.service";
import { api } from "@/lib/api-client";
import type { Prop } from "@/lib/module-types";
import type { ImageTask } from "@/lib/app-types";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default function PropEditPage({ params }: PageProps) {
  const router = useRouter();
  // Next 15+ 的 params 是 Promise，需要用 use() 解包
  const { id } = use(params);

  const [prop, setProp] = useState<Prop | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // 提示词 + 生成状态
  const [prompt, setPrompt] = useState("");
  const [generating, setGenerating] = useState(false);
  const [resultUrl, setResultUrl] = useState<string>("");
  const [resultTaskId, setResultTaskId] = useState<string>("");
  const [generateError, setGenerateError] = useState<string>("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const pr = await getProp(id);
        if (cancelled) return;
        if (!pr) {
          setError("道具不存在或已删除");
          setLoading(false);
          return;
        }
        setProp(pr);
        // 预填 AI 生图标准化提示词（如已由剧本分析生成）
        if (pr.generation_prompt) setPrompt(pr.generation_prompt);
        setLoading(false);
      } catch (err) {
        if (cancelled) return;
        setError((err as Error)?.message ?? "加载失败");
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

  // 关闭：优先关闭当前标签页；不行则回退到道具工厂列表
  const handleClose = () => {
    if (typeof window !== "undefined" && window.history.length > 1) {
      try {
        window.close();
        // 某些浏览器不允许脚本关闭非脚本打开的标签页 → 回退
        setTimeout(() => {
          router.push("/props");
        }, 100);
      } catch {
        router.push("/props");
      }
    } else {
      router.push("/props");
    }
  };

  /** 提交生图：按 images.txt 文档的默认参数（方形 1:1、1 张）。 */
  const handleGenerate = async () => {
    const text = prompt.trim();
    if (!text || generating) return;
    setGenerating(true);
    setGenerateError("");
    setResultUrl("");
    setResultTaskId("");
    try {
      // 默认参数：方形 1:1、生成 1 张、url 输出
      // 1:1 对应 size 1024x1024（与后端 imageSizeOptions 一致）
      const task = await api<ImageTask>("/api/images/generate", {
        method: "POST",
        body: JSON.stringify({
          model: "agnes-image-2.1-flash",
          prompt: text,
          size: "1024x1024",
          ratio: "1:1",
          n: 1,
          response_format: "url",
        }),
      });
      const url = task.image_urls?.[0] ?? "";
      if (!url) throw new Error("生图返回为空，请稍后重试");
      setResultUrl(url);
      setResultTaskId(task.id);
    } catch (err) {
      setGenerateError((err as Error)?.message ?? "生图失败");
    } finally {
      setGenerating(false);
    }
  };

  if (loading) {
    return (
      <div className="h-screen w-screen flex flex-col items-center justify-center bg-background text-foreground gap-3">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground">正在加载道具「{id}」…</p>
      </div>
    );
  }

  if (error || !prop) {
    return (
      <div className="h-screen w-screen flex flex-col items-center justify-center bg-background text-foreground gap-4">
        <AlertTriangle className="h-10 w-10 text-destructive" />
        <h1 className="text-lg font-medium">{error ?? "道具不存在"}</h1>
        <div className="flex gap-2">
          <Button variant="ghost" onClick={() => router.push("/props")}>
            <ArrowLeft className="mr-1 h-4 w-4" />
            返回道具工厂
          </Button>
          <Button onClick={() => window.location.reload()}>重新加载</Button>
        </div>
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-background text-foreground">
      {/* 顶栏：返回 + 标题 */}
      <header className="sticky top-0 z-20 flex h-14 items-center justify-between border-b border-border bg-background/95 px-4 backdrop-blur">
        <Button size="sm" variant="ghost" onClick={handleClose}>
          <ArrowLeft className="mr-1 h-4 w-4" />
          返回
        </Button>
        <h1 className="truncate px-4 text-sm font-medium text-foreground">
          {prop.name} · 道具生图
        </h1>
        <div className="w-16" />
      </header>

      {/* 主体：左侧输入 + 右侧预览 */}
      <section className="mx-auto grid max-w-6xl gap-6 p-6 lg:grid-cols-[420px_1fr]">
        {/* 左：输入面板 */}
        <Card className="space-y-4 border-border bg-card p-5">
          <div>
            <label className="mb-2 block text-sm font-medium text-muted-foreground">
              生成提示词
            </label>
            <Textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder={`请描述要为道具「${prop.name}」生成的图片，如：古铜色长剑，剑身刻有云纹，剑柄缠绕红绳…`}
              rows={12}
              disabled={generating}
              className="bg-secondary border-border text-sm resize-none"
            />
            <div className="mt-1.5 text-[11px] text-muted-foreground">
              {prompt.length} 字符
            </div>
          </div>

          {/* 道具上下文信息 */}
          {(prop.category || prop.material || prop.color || prop.size) && (
            <div className="rounded-md border border-border bg-secondary px-3 py-2 text-[11px] text-muted-foreground space-y-0.5">
              {prop.category && <div>类别：<span className="text-foreground">{prop.category}</span></div>}
              {prop.material && <div>材质：<span className="text-foreground">{prop.material}</span></div>}
              {prop.color && <div>颜色：<span className="text-foreground">{prop.color}</span></div>}
              {prop.size && <div>尺寸：<span className="text-foreground">{prop.size}</span></div>}
            </div>
          )}

          {/* 默认参数展示（与 images.txt 文档对应） */}
          <div className="rounded-md border border-border bg-secondary px-3 py-2 text-[11px] text-muted-foreground space-y-0.5">
            <div>模型：<span className="text-foreground">agnes-image-2.1-flash</span></div>
            <div>比例：<span className="text-foreground">1:1（方形）</span></div>
            <div>尺寸：<span className="text-foreground">1024 × 1024</span></div>
            <div>数量：<span className="text-foreground">1 张</span></div>
          </div>

          {generateError && (
            <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-[12px] text-destructive">
              {generateError}
            </div>
          )}

          <Button
            onClick={handleGenerate}
            disabled={!prompt.trim() || generating}
            className="w-full bg-primary hover:bg-primary/90"
          >
            {generating ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                生成中…
              </>
            ) : (
              <>
                <Sparkles className="mr-2 h-4 w-4" />
                生成图片
              </>
            )}
          </Button>
        </Card>

        {/* 右：预览面板 */}
        <div className="grid min-h-[600px] place-items-center rounded-lg border border-border bg-card p-4">
          {generating ? (
            <div className="flex flex-col items-center gap-3 text-muted-foreground">
              <Loader2 className="h-10 w-10 animate-spin text-primary" />
              <div className="text-sm">AI 正在生成图片，请稍候…</div>
            </div>
          ) : resultUrl ? (
            <div className="relative h-full w-full flex flex-col items-center gap-3">
              <div
                className="overflow-hidden rounded-lg border border-border"
                style={{ maxHeight: "calc(100vh - 220px)", aspectRatio: "1 / 1" }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  className="h-full w-auto object-contain"
                  src={resultUrl}
                  alt={prompt}
                />
              </div>
              <div className="flex gap-2">
                <a
                  className="inline-flex h-9 items-center gap-2 rounded-md bg-muted px-3 text-sm hover:bg-muted"
                  href={resultUrl}
                  download={`${prop.name}-${resultTaskId || "image"}.png`}
                  target="_blank"
                  rel="noreferrer"
                >
                  <Download className="h-4 w-4" />
                  下载图片
                </a>
                <a
                  className="inline-flex h-9 items-center gap-2 rounded-md bg-muted px-3 text-sm hover:bg-muted"
                  href={resultUrl}
                  target="_blank"
                  rel="noreferrer"
                >
                  新窗口打开
                </a>
              </div>
            </div>
          ) : (
            <div className="text-sm text-muted-foreground">填写提示词后点击「生成图片」</div>
          )}
        </div>
      </section>
    </main>
  );
}
