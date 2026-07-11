/**
 * 共享组件导出
 *
 * 设计原则：
 * - 统一的组件导出入口
 * - 清晰的命名规范
 * - 易于导入和使用
 */

// 统计卡片组件
export { StatCard, StatCardGrid } from './stat-card';

// 工具栏组件
export { ModuleToolbar, SearchInput, FilterSelect, TagFilter } from './module-toolbar';

// 状态组件
export { EmptyState, LoadingState, ErrorState, EmptyStoryboards, EmptyClips } from './empty-state';

// 分页组件
export { Pagination } from './pagination';
export type { PaginationProps } from './pagination';

// 头像组件（首字 fallback）
export { Avatar } from './avatar';
export type { AvatarProps } from './avatar';

// 图片上传组件
export { ImageUploader } from './image-uploader';
export type { ImageUploaderProps } from './image-uploader';

// 标签输入组件
export { TagInput } from './tag-input';
export type { TagInputProps } from './tag-input';

// 资产引用徽标组件
export { UsageBadge } from './usage-badge';
export type { UsageBadgeProps, UsageEntityType } from './usage-badge';

// 通用 AI 生成图片对话框（三厂共用：角色/场景/道具）
export { AIGenerateImageDialog } from './ai-generate-dialog';
export type { AIGenerateImageDialogProps, AIConfirmPayload, AITypeFieldConfig } from './ai-generate-dialog';

// 资产版本历史弹窗（任务12：三厂共性 - 统一版本管理）
export { VersionHistoryDialog } from './version-history-dialog';
export type { VersionHistoryDialogProps } from './version-history-dialog';

// 资产模板/预设选择器（三厂共用：角色/场景/道具）
export { TemplateSelector } from './template-selector';
export type { AssetTemplate, TemplateEntityType, TemplateSelectorProps } from './template-selector';

// 跨项目复制资产弹窗（三厂共用：任务14）
export { CopyToProjectDialog } from './copy-to-project-dialog';
export type { CopyToProjectDialogProps } from './copy-to-project-dialog';