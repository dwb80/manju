"use client";

/**
 * 角色图片编辑页（独立路由，/_全屏_/_独占_）
 *
 * 路由: /characters/[id]/edit
 * - 新标签页打开，不显示侧边栏（layout-shell 已识别）
 * - 拉取角色 → 渲染 CharacterImageGenerator 全屏编辑界面
 * - 关闭按钮直接 window.close() 关闭当前标签页
 */

import { useEffect, useState, use } from "react";
import { useRouter } from "next/navigation";
import { Loader2, ArrowLeft, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CharacterImageGenerator } from "@/components/modules/character-image-generator";
import { getCharacter } from "@/services/character.service";
import { clearApiCache } from "@/lib/api-client";
import { toast } from "@/components/common/toast";
import type { Character } from "@/lib/module-types";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default function CharacterEditPage({ params }: PageProps) {
  const router = useRouter();
  // Next 15+ 的 params 是 Promise，需要用 use() 解包
  const { id } = use(params);

  const [character, setCharacter] = useState<Character | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const ch = await getCharacter(id);
        if (cancelled) return;
        if (!ch) {
          setError("角色不存在或已删除");
          setLoading(false);
          return;
        }
        setCharacter(ch);
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

  // 关闭：优先关闭当前标签页；不行则回退到角色工厂列表
  const handleClose = () => {
    if (typeof window !== "undefined" && window.history.length > 1) {
      try {
        window.close();
        // 某些浏览器不允许脚本关闭非脚本打开的标签页 → 回退
        setTimeout(() => {
          router.push("/characters");
        }, 100);
      } catch {
        router.push("/characters");
      }
    } else {
      router.push("/characters");
    }
  };

  // 保存/删除成功时通知原标签页刷新
  const handleCloseImageGenerator = () => {
    clearApiCache();
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("factory:reload"));
      toast.success("已保存", "回到列表页查看最新内容");
    }
    handleClose();
  };

  if (loading) {
    return (
      <div className="h-screen w-screen flex flex-col items-center justify-center bg-[#0a0a0a] text-white gap-3">
        <Loader2 className="h-8 w-8 animate-spin text-emerald-400" />
        <p className="text-sm text-[#888]">正在加载角色「{id}」…</p>
      </div>
    );
  }

  if (error || !character) {
    return (
      <div className="h-screen w-screen flex flex-col items-center justify-center bg-[#0a0a0a] text-white gap-4">
        <AlertTriangle className="h-10 w-10 text-red-400" />
        <h1 className="text-lg font-medium">{error ?? "角色不存在"}</h1>
        <div className="flex gap-2">
          <Button variant="ghost" onClick={() => router.push("/characters")}>
            <ArrowLeft className="mr-1 h-4 w-4" />
            返回角色工厂
          </Button>
          <Button onClick={() => window.location.reload()}>重新加载</Button>
        </div>
      </div>
    );
  }

  return (
    <CharacterImageGenerator
      character={character}
      onClose={handleCloseImageGenerator}
    />
  );
}
