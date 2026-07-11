"use client";

import { useState, useEffect } from "react";
import { Loader2, Sparkles, X, Check, Trash2, Wand2, Image as ImageIcon, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { api } from "@/lib/api-client";
import { toast } from "@/components/common/toast";
import type { Character } from "@/lib/module-types";
import { updateCharacter } from "@/services/character.service";

interface ImageTask {
  id: string;
  status: string;
  image_urls: string[];
  error?: string;
  prompt?: string;
}

interface HistoryImage {
  id: string;
  url: string;
  prompt: string;
  timestamp: string;
}

interface CharacterImageGeneratorProps {
  character: Character;
  scriptInfo?: {
    name: string;
    description?: string;
    traits?: string[];
    role?: string;
    gender?: string;
    age?: number;
  };
  onClose: () => void;
}

const STYLE_OPTIONS = [
  { value: "", label: "默认" },
  { value: "写实", label: "写实" },
  { value: "动漫", label: "动漫" },
  { value: "古风", label: "古风" },
  { value: "科幻", label: "科幻" },
  { value: "二次元", label: "二次元" },
];

const COUNT_OPTIONS = [
  { value: "1", label: "1 张" },
  { value: "2", label: "2 张" },
  { value: "3", label: "3 张" },
  { value: "4", label: "4 张" },
];

export function CharacterImageGenerator({ character, scriptInfo, onClose }: CharacterImageGeneratorProps) {
  const [prompt, setPrompt] = useState("");
  const [style, setStyle] = useState("");
  const [count, setCount] = useState("4");
  const [isGenerating, setIsGenerating] = useState(false);
  const [candidates, setCandidates] = useState<string[]>([]);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [history, setHistory] = useState<HistoryImage[]>([]);
  const [selectedAsset, setSelectedAsset] = useState<string | null>(character.image || null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (scriptInfo) {
      const parts: string[] = [];
      if (scriptInfo.name) parts.push(scriptInfo.name);
      if (scriptInfo.role) {
        const roleMap: Record<string, string> = {
          protagonist: "主角",
          supporting: "配角",
          antagonist: "反派",
          minor: "次要角色",
        };
        parts.push(roleMap[scriptInfo.role] || scriptInfo.role);
      }
      if (scriptInfo.gender) {
        const genderMap: Record<string, string> = { male: "男性", female: "女性", other: "其他" };
        parts.push(genderMap[scriptInfo.gender] || scriptInfo.gender);
      }
      if (scriptInfo.age) parts.push(`${scriptInfo.age}岁`);
      if (scriptInfo.description) parts.push(scriptInfo.description);
      if (scriptInfo.traits && scriptInfo.traits.length > 0) parts.push(scriptInfo.traits.join("，"));
      setPrompt(parts.join("，"));
    } else if (character.description) {
      const parts: string[] = [];
      parts.push(character.name);
      const roleMap: Record<string, string> = {
        protagonist: "主角",
        supporting: "配角",
        antagonist: "反派",
        minor: "次要角色",
      };
      if (character.role) parts.push(roleMap[character.role] || character.role);
      if (character.gender) {
        const genderMap: Record<string, string> = { male: "男性", female: "女性", other: "其他" };
        parts.push(genderMap[character.gender] || character.gender);
      }
      if (character.age) parts.push(`${character.age}岁`);
      if (character.description) parts.push(character.description);
      if (character.traits && character.traits.length > 0) parts.push(character.traits.join("，"));
      setPrompt(parts.join("，"));
    }
  }, [character, scriptInfo]);

  const handleGenerate = async () => {
    const trimmedPrompt = prompt.trim();
    if (!trimmedPrompt) {
      toast.error("请输入描述");
      return;
    }
    setIsGenerating(true);
    setCandidates([]);
    setSelectedIndex(null);
    try {
      const n = Math.max(1, Math.min(4, Number(count) || 4));
      const task = await api<ImageTask>("/api/images/generate", {
        method: "POST",
        body: JSON.stringify({
          prompt: style ? `${trimmedPrompt}, ${style}风格` : trimmedPrompt,
          n,
          size: "1024x1024",
          response_format: "url",
        }),
      });
      const urls = Array.isArray(task.image_urls) ? task.image_urls.filter(Boolean) : [];
      if (urls.length === 0) {
        throw new Error("AI 未返回任何图片");
      }
      setCandidates(urls);
      urls.forEach((url) => {
        const newHistory: HistoryImage = {
          id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
          url,
          prompt: trimmedPrompt,
          timestamp: new Date().toLocaleString(),
        };
        setHistory((prev) => [newHistory, ...prev].slice(0, 20));
      });
      setSelectedIndex(0);
    } catch (err) {
      console.error("AI 生成图片失败:", err);
      const n = Math.max(1, Math.min(4, Number(count) || 4));
      const fallback = Array.from({ length: n }, (_, idx) => {
        const label = encodeURIComponent(`${prompt || "image"} #${idx + 1}`);
        return `https://placehold.co/512x512/0d0d0d/10a37f/png?text=${label}`;
      });
      setCandidates(fallback);
      setSelectedIndex(0);
      toast.error("AI 生成失败", "已使用占位图，你可以重新尝试");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSelectAsAsset = async (url: string) => {
    setIsSaving(true);
    try {
      await updateCharacter(character.id, { image: url });
      setSelectedAsset(url);
      toast.success("角色图片已更新");
    } catch (err) {
      toast.error("更新失败", (err as Error).message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleRemoveAsset = async () => {
    setIsSaving(true);
    try {
      await updateCharacter(character.id, { image: "" });
      setSelectedAsset(null);
      toast.success("角色图片已移除");
    } catch (err) {
      toast.error("移除失败", (err as Error).message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteFromHistory = (id: string) => {
    setHistory((prev) => prev.filter((h) => h.id !== id));
  };

  const handleUseFromHistory = (url: string, historyPrompt: string) => {
    setCandidates([url]);
    setSelectedIndex(0);
    setPrompt(historyPrompt);
  };

  const truncatePrompt = (text: string) => {
    return text.length > 10 ? text.slice(0, 10) + "..." : text;
  };

  return (
    <div className="fixed inset-0 z-[100] bg-[#0a0a0a] flex flex-col">
      <div className="border-b border-white/10 bg-[#1a1a1a] px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Wand2 className="h-5 w-5 text-emerald-400" />
          <h1 className="text-lg font-semibold text-white">编辑角色 - {character.name}</h1>
        </div>
        <Button variant="ghost" size="sm" onClick={onClose} className="gap-1">
          <X className="h-4 w-4" />
          关闭
        </Button>
      </div>

      <div className="flex-1 flex overflow-hidden">
        <div className="w-80 flex-shrink-0 border-r border-white/10 bg-[#1a1a1a] p-4 overflow-y-auto">
          <h2 className="text-sm font-medium text-white mb-4 flex items-center gap-2">
            <ImageIcon className="h-4 w-4 text-emerald-400" />
            图片参数
          </h2>

          {scriptInfo && (
            <div className="mb-4 p-3 rounded-lg bg-white/5 border border-white/10">
              <div className="text-xs text-[#888] mb-2">剧本中心导入信息</div>
              <div className="space-y-1 text-sm">
                {scriptInfo.name && (
                  <div className="flex justify-between">
                    <span className="text-[#888]">角色名</span>
                    <span className="text-white">{scriptInfo.name}</span>
                  </div>
                )}
                {scriptInfo.role && (
                  <div className="flex justify-between">
                    <span className="text-[#888]">类型</span>
                    <span className="text-white">
                      {{ protagonist: "主角", supporting: "配角", antagonist: "反派", minor: "次要" }[scriptInfo.role] || scriptInfo.role}
                    </span>
                  </div>
                )}
                {scriptInfo.gender && (
                  <div className="flex justify-between">
                    <span className="text-[#888]">性别</span>
                    <span className="text-white">
                      {{ male: "男", female: "女", other: "其他" }[scriptInfo.gender] || scriptInfo.gender}
                    </span>
                  </div>
                )}
                {scriptInfo.age && (
                  <div className="flex justify-between">
                    <span className="text-[#888]">年龄</span>
                    <span className="text-white">{scriptInfo.age}岁</span>
                  </div>
                )}
                {scriptInfo.description && (
                  <div className="mt-2">
                    <span className="text-[#888]">描述</span>
                    <div className="text-white text-xs mt-1 line-clamp-2">{scriptInfo.description}</div>
                  </div>
                )}
              </div>
            </div>
          )}

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-[#888] mb-1.5">
                提示词 <span className="text-red-400">*</span>
              </label>
              <Textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="请输入角色描述，如：古风少年剑客，黑发高马尾，身披白袍…"
                rows={6}
                className="bg-[#252525] border-white/10 text-sm"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-[#888] mb-1.5">风格</label>
                <select
                  value={style}
                  onChange={(e) => setStyle(e.target.value)}
                  className="h-10 w-full rounded-md border border-white/10 bg-[#252525] px-3 text-sm outline-none focus:border-emerald-500 text-white"
                >
                  {STYLE_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-[#888] mb-1.5">数量</label>
                <select
                  value={count}
                  onChange={(e) => setCount(e.target.value)}
                  className="h-10 w-full rounded-md border border-white/10 bg-[#252525] px-3 text-sm outline-none focus:border-emerald-500 text-white"
                >
                  {COUNT_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </div>
            </div>

            <Button
              type="button"
              onClick={handleGenerate}
              disabled={isGenerating || !prompt.trim()}
              className="w-full bg-emerald-500 hover:bg-emerald-600"
            >
              {isGenerating ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  生成中...
                </>
              ) : (
                <>
                  <Sparkles className="mr-2 h-4 w-4" />
                  生成图片
                </>
              )}
            </Button>
          </div>
        </div>

        <div className="flex-1 p-4 overflow-y-auto">
          <h2 className="text-sm font-medium text-white mb-4">生成预览</h2>

          {isGenerating ? (
            <div className="flex items-center justify-center h-[600px] text-[#888] border border-dashed border-white/10 rounded-lg">
              <Loader2 className="h-8 w-8 mr-3 animate-spin text-emerald-400" />
              AI 正在生成图片，请稍候…
            </div>
          ) : candidates.length > 0 ? (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {candidates.map((url, idx) => {
                const selected = selectedIndex === idx;
                return (
                  <div
                    key={`${url}-${idx}`}
                    className={`relative aspect-square overflow-hidden rounded-lg border-2 transition-all ${
                      selected
                        ? "border-emerald-400 ring-2 ring-emerald-400/40"
                        : "border-white/10 hover:border-white/30"
                    }`}
                  >
                    <img
                      src={url}
                      alt={`候选图 ${idx + 1}`}
                      className="w-full h-full object-cover bg-[#1a1a1a]"
                    />
                    <button
                      type="button"
                      onClick={() => setSelectedIndex(selected ? null : idx)}
                      className={`absolute top-2 right-2 h-7 w-7 rounded-full flex items-center justify-center transition-all ${
                        selected
                          ? "bg-emerald-500 text-white"
                          : "bg-black/60 text-white/70 hover:bg-black/80"
                      }`}
                    >
                      {selected ? <Check className="h-4 w-4" /> : <Input type="checkbox" className="opacity-0" />}
                    </button>
                    {selected && (
                      <div className="absolute bottom-2 left-2 right-2">
                        <Button
                          type="button"
                          size="sm"
                          onClick={() => handleSelectAsAsset(url)}
                          disabled={isSaving}
                          className="w-full bg-emerald-500 hover:bg-emerald-600"
                        >
                          {isSaving ? (
                            <>
                              <Loader2 className="mr-2 h-3 w-3 animate-spin" />
                              保存中...
                            </>
                          ) : (
                            <>设为角色资产</>
                          )}
                        </Button>
                      </div>
                    )}
                    <div className="absolute bottom-2 left-2 px-2 py-0.5 rounded bg-black/60 text-[10px] text-white/90">
                      #{idx + 1}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-[600px] text-[#666] border border-dashed border-white/10 rounded-lg">
              <ImageIcon className="h-12 w-12 mb-3 opacity-50" />
              <span className="text-sm">填写提示词后点击「生成图片」</span>
            </div>
          )}
        </div>

        <div className="w-64 flex-shrink-0 border-l border-white/10 bg-[#1a1a1a] p-4 overflow-y-auto">
          <h2 className="text-sm font-medium text-white mb-4">历史图片</h2>

          {history.length === 0 ? (
            <div className="text-center py-8 text-[#666] text-sm">暂无历史记录</div>
          ) : (
            <div className="space-y-3">
              {history.map((item) => (
                <div
                  key={item.id}
                  className="group relative rounded-lg overflow-hidden border border-white/10 hover:border-emerald-500/50 transition-colors"
                >
                  <img
                    src={item.url}
                    alt={truncatePrompt(item.prompt)}
                    className="w-full aspect-square object-cover"
                  />
                  <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-end p-2">
                    <div className="text-[10px] text-white line-clamp-2 mb-1">{truncatePrompt(item.prompt)}</div>
                    <div className="flex gap-1">
                      <Button
                        type="button"
                        size="sm"
                        onClick={() => handleUseFromHistory(item.url, item.prompt)}
                        className="flex-1 bg-emerald-500/80 hover:bg-emerald-500 text-xs h-6"
                      >
                        使用
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={() => handleDeleteFromHistory(item.id)}
                        className="text-[#888] hover:text-red-400 h-6"
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                  <div className="absolute bottom-1 right-1 px-1 py-0.5 rounded bg-black/60 text-[8px] text-white/70">
                    {item.timestamp.split(" ")[1] || item.timestamp}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {selectedAsset && (
        <div className="border-t border-white/10 bg-[#1a1a1a] px-4 py-3">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-emerald-500/20 flex items-center justify-center">
                <User className="h-4 w-4 text-emerald-400" />
              </div>
              <span className="text-sm text-white">已选角色资产</span>
            </div>
            <div className="flex items-center gap-2">
              <img
                src={selectedAsset}
                alt="角色资产"
                className="w-12 h-12 rounded-lg object-cover border border-white/10"
              />
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={handleRemoveAsset}
                disabled={isSaving}
                className="text-red-400 hover:text-red-300"
              >
                <Trash2 className="mr-1 h-3 w-3" />
                移除
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
