/**
 * @file avatar.tsx
 * @description 通用头像组件，有图显示图，无图回退首字+颜色
 */

"use client";

export interface AvatarProps {
  /** 头像图片 URL（可选） */
  src?: string | null;
  /** 名称（用于生成首字 fallback） */
  name: string;
  /** 尺寸（像素） */
  size?: number;
  /** 自定义 className */
  className?: string;
}

/**
 * Avatar - 通用头像组件
 * @param {AvatarProps} props - 组件属性
 * @returns {JSX.Element} 渲染的头像元素
 */
export function Avatar({ src, name, size = 40, className = "" }: AvatarProps) {
  const firstChar = name?.trim()?.charAt(0)?.toUpperCase() || "?";

  // 基于 name 哈希生成颜色
  const colors = [
    "bg-primary/20 text-primary",
    "bg-info/20 text-info",
    "bg-chart-1/20 text-chart-1",
    "bg-chart-3/20 text-chart-3",
    "bg-chart-4/20 text-chart-4",
    "bg-chart-2/20 text-chart-2",
    "bg-chart-5/20 text-chart-5",
    "bg-destructive/20 text-destructive",
  ];

  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
  }
  const colorClass = colors[hash % colors.length];

  const dimensionStyle = {
    width: `${size}px`,
    height: `${size}px`,
    fontSize: `${Math.max(12, size * 0.45)}px`,
  };

  if (src) {
    return (
      <div
        className={`overflow-hidden rounded-full bg-card flex-shrink-0 ${className}`}
        style={dimensionStyle}
      >
        <img
          src={src}
          alt={name}
          className="h-full w-full object-cover"
          onError={(e) => {
            const target = e.target as HTMLImageElement;
            target.style.display = "none";
            const parent = target.parentElement;
            if (parent) {
              parent.classList.add(...colorClass.split(" "));
              parent.textContent = firstChar;
              parent.classList.add("flex", "items-center", "justify-center", "font-semibold");
            }
          }}
        />
      </div>
    );
  }

  return (
    <div
      className={`flex items-center justify-center rounded-full font-semibold flex-shrink-0 ${colorClass} ${className}`}
      style={dimensionStyle}
      aria-label={name}
    >
      {firstChar}
    </div>
  );
}
