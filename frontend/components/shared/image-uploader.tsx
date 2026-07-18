/**
 * @file image-uploader.tsx
 * @description 通用图片上传控件，支持本地上传和URL输入两种方式
 */

"use client";

import { useRef, useState } from "react";
import { ImagePlus, X, Loader2, Upload, Link as LinkIcon } from "lucide-react";
import { Button } from "@/components/ui/button";

export interface ImageUploaderProps {
  value?: string;
  onChange: (url: string) => void;
  /** 接受的最大字节数（默认 5MB） */
  maxSize?: number;
  /** 占位提示 */
  placeholder?: string;
  /** 是否禁用 */
  disabled?: boolean;
  /** 上传回调：返回 Promise<url>。如果不传，则只接受 URL 输入 */
  onUpload?: (file: File) => Promise<string>;
  /** 接受的文件类型（默认 image/*） */
  accept?: string;
}

/**
 * ImageUploader - 通用图片上传控件组件
 * @param {ImageUploaderProps} props - 组件属性
 * @returns {JSX.Element} 渲染的上传控件元素
 */
export function ImageUploader({
  value,
  onChange,
  maxSize = 5 * 1024 * 1024,
  placeholder = "上传图片或粘贴 URL",
  disabled = false,
  onUpload,
  accept = "image/*",
}: ImageUploaderProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [showUrlInput, setShowUrlInput] = useState(false);
  const [urlDraft, setUrlDraft] = useState(value ?? "");
  const [error, setError] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError("");

    if (file.size > maxSize) {
      setError(`文件大小超过 ${(maxSize / 1024 / 1024).toFixed(1)}MB`);
      return;
    }

    if (!onUpload) {
      // 降级：没有上传回调时，转为 base64 直接展示（仅用于小图）
      const reader = new FileReader();
      reader.onload = () => {
        const dataUrl = reader.result as string;
        onChange(dataUrl);
      };
      reader.readAsDataURL(file);
      return;
    }

    setIsUploading(true);
    try {
      const url = await onUpload(file);
      onChange(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "上传失败");
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleUrlSubmit = () => {
    setError("");
    if (urlDraft && !/^https?:\/\//.test(urlDraft) && !urlDraft.startsWith("data:")) {
      setError("URL 必须以 http:// 或 https:// 开头");
      return;
    }
    onChange(urlDraft);
    setShowUrlInput(false);
  };

  const handleClear = () => {
    onChange("");
    setUrlDraft("");
    setError("");
  };

  if (value) {
    return (
      <div className="relative group">
        <div className="aspect-video w-full overflow-hidden rounded-md border border-white/10 bg-[#1a1a1a]">
          <img src={value} alt="" className="h-full w-full object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
        </div>
        <button
          type="button"
          onClick={handleClear}
          disabled={disabled}
          className="absolute top-2 right-2 h-7 w-7 rounded-full bg-black/60 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-500"
          aria-label="移除图片"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {showUrlInput ? (
        <div className="flex gap-2">
          <input
            type="url"
            value={urlDraft}
            onChange={(e) => setUrlDraft(e.target.value)}
            placeholder="https://..."
            disabled={disabled}
            className="flex-1 h-9 rounded-md border border-border bg-muted px-3 text-sm outline-none focus:border-primary"
          />
          <Button type="button" size="sm" onClick={handleUrlSubmit} disabled={disabled || !urlDraft}>
            确定
          </Button>
          <Button type="button" size="sm" variant="secondary" onClick={() => { setShowUrlInput(false); setUrlDraft(value ?? ""); }}>
            取消
          </Button>
        </div>
      ) : (
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={disabled || isUploading}
            className="flex-1 h-24 rounded-md border-2 border-dashed border-white/10 bg-[#1a1a1a] hover:border-primary/50 hover:bg-[#202020] transition-colors flex flex-col items-center justify-center gap-1.5 text-[#888] disabled:opacity-50"
          >
            {isUploading ? (
              <>
                <Loader2 className="h-5 w-5 animate-spin" />
                <span className="text-xs">上传中...</span>
              </>
            ) : (
              <>
                <ImagePlus className="h-5 w-5" />
                <span className="text-xs">{placeholder}</span>
              </>
            )}
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept={accept}
            onChange={handleFileChange}
            className="hidden"
          />
          <div className="flex flex-col gap-1">
            <Button
              type="button"
              size="sm"
              variant="secondary"
              onClick={() => setShowUrlInput(true)}
              disabled={disabled}
              title="使用 URL"
            >
              <LinkIcon className="h-3.5 w-3.5" />
            </Button>
            {onUpload && (
              <Button
                type="button"
                size="sm"
                variant="secondary"
                onClick={() => fileInputRef.current?.click()}
                disabled={disabled || isUploading}
                title="本地上传"
              >
                <Upload className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>
        </div>
      )}
      {error && <p className="text-xs text-red-400">{error}</p>}
    </div>
  );
}
