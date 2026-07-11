import type { UploadedFile } from "@/lib/app-types";

/** 判断提示词是否更像“精准裁切/截取”，这类任务不应该交给生图模型重绘。 */
export function shouldUseLocalCrop(prompt: string): boolean {
  return /精准截取|严格截取|像素级一致|不做任何创作|不做创作|不做修改|禁止自创|精准取景|裁切|裁剪|截取近景/.test(prompt);
}

/** 把图片 URL 读取成浏览器可绘制的 HTMLImageElement。 */
async function loadImageElement(url: string): Promise<HTMLImageElement> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`图片读取失败 ${response.status}`);
  const blob = await response.blob();
  const objectUrl = URL.createObjectURL(blob);
  try {
    const image = new Image();
    image.src = objectUrl;
    await image.decode();
    return image;
  } finally {
    window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
  }
}

/** 从参考图本地裁切 9:16 竖版近景，避免图片模型重新创作人物细节。 */
export async function cropReferenceImageToPortrait(file: Pick<UploadedFile, "name" | "url">, prompt: string): Promise<File> {
  const image = await loadImageElement(file.url);
  const sourceWidth = image.naturalWidth;
  const sourceHeight = image.naturalHeight;
  const targetRatio = 9 / 16;
  const isCloseShot = /近景|头部至胸部|胸部|上半身/.test(prompt);
  const preferredHeight = isCloseShot ? Math.round(sourceHeight * 0.58) : sourceHeight;
  const cropHeight = Math.min(sourceHeight, preferredHeight, Math.floor(sourceWidth / targetRatio));
  const cropWidth = Math.min(sourceWidth, Math.floor(cropHeight * targetRatio));
  const cropX = Math.max(0, Math.floor((sourceWidth - cropWidth) / 2));
  const cropY = isCloseShot ? Math.max(0, Math.floor(sourceHeight * 0.04)) : Math.max(0, Math.floor((sourceHeight - cropHeight) / 2));
  const canvas = document.createElement("canvas");
  canvas.width = 1080;
  canvas.height = 1920;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("浏览器不支持图片裁切");
  context.fillStyle = "#000";
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.drawImage(image, cropX, cropY, cropWidth, cropHeight, 0, 0, canvas.width, canvas.height);
  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((value) => value ? resolve(value) : reject(new Error("图片裁切失败")), "image/png", 0.96);
  });
  return new File([blob], `${file.name.replace(/\.[^.]+$/, "")}-crop-9x16.png`, { type: "image/png" });
}

/** 把字节数格式化成 KB/MB，远程图片没有大小时显示远程图片。 */
export function formatBytes(bytes: number) {
  if (!bytes) return "远程图片";
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}
