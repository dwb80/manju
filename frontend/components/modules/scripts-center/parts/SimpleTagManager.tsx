"use client";

/**
 * 剧本中心 - 极简标签管理组件
 *
 * 在 DialogOverlay 中渲染：
 * - 当前标签列表（可逐个删除）
 * - 输入框 + 添加按钮（回车快速添加）
 * - 快捷标签（古装/现代/科幻 等预设）
 * - 保存按钮（调 updateScript 写回 tags 字段）
 */

import { useState } from "react";
import { Plus, X, CheckCircle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { clearApiCache } from "@/lib/api-client";
import { notify } from "@/lib/notify";
import { scriptCenterService } from "@/services/script-center.service";
import type { Script } from "@/lib/module-types";

export function SimpleTagManager({
  script,
  onTagsUpdated,
}: {
  script: Script;
  onTagsUpdated: (script: Script) => void;
}) {
  const [tags, setTags] = useState<string[]>(script.tags ?? []);
  const [newTag, setNewTag] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const handleAdd = () => {
    const trimmed = newTag.trim();
    if (!trimmed || tags.includes(trimmed)) return;
    setTags([...tags, trimmed]);
    setNewTag("");
  };

  const handleRemove = (tag: string) => {
    setTags(tags.filter((t) => t !== tag));
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await scriptCenterService.updateDocument(script.id, { tags } as any);
      onTagsUpdated({ ...script, tags });
      clearApiCache();
    } catch (err) {
      console.error("保存标签失败:", err);
      notify.error("保存标签失败", (err as Error).message);
    } finally {
      setIsSaving(false);
    }
  };

  const presetTags = ["古装", "现代", "科幻", "奇幻", "悬疑", "喜剧", "言情", "动作", "AI生成", "导入", "已审核", "需修改"];

  return (
    <div className="space-y-4">
      <div>
        <div className="text-xs text-muted-foreground mb-2">当前标签 ({tags.length})</div>
        {tags.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {tags.map((tag, idx) => (
              <span
                key={idx}
                className="flex items-center gap-1 px-2 py-1 rounded text-xs bg-primary/10 text-primary"
              >
                {tag}
                <button onClick={() => handleRemove(tag)} className="ml-1 hover:text-destructive">
                  <X className="h-3 w-3" />
                </button>
              </span>
            ))}
          </div>
        ) : (
          <div className="text-sm text-muted-foreground">暂无标签</div>
        )}
      </div>

      <div>
        <div className="text-xs text-muted-foreground mb-2">添加新标签</div>
        <div className="flex gap-2">
          <input
            type="text"
            value={newTag}
            onChange={(e) => setNewTag(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleAdd()}
            placeholder="输入标签名称后回车"
            className="flex-1 h-9 px-3 rounded-lg bg-secondary border border-border text-sm text-foreground focus:outline-none focus:border-primary/50"
          />
          <Button size="sm" onClick={handleAdd} disabled={!newTag.trim()}>
            <Plus className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div>
        <div className="text-xs text-muted-foreground mb-2">快捷标签</div>
        <div className="flex flex-wrap gap-2">
          {presetTags.map((tag) => (
            <button
              key={tag}
              onClick={() => !tags.includes(tag) && setTags([...tags, tag])}
              disabled={tags.includes(tag)}
              className={`px-2 py-1 rounded text-xs transition-colors ${
                tags.includes(tag)
                  ? "bg-muted/50 text-muted-foreground cursor-not-allowed"
                  : "bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground"
              }`}
            >
              + {tag}
            </button>
          ))}
        </div>
      </div>

      <div className="flex justify-end gap-2 pt-2 border-t border-border">
        <Button size="sm" onClick={handleSave} disabled={isSaving}>
          {isSaving ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              保存中...
            </>
          ) : (
            <>
              <CheckCircle className="mr-2 h-4 w-4" />
              保存标签
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
