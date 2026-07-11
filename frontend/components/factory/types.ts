/**
 * 通用工厂 CRUD 页面类型定义
 *
 * 三个工厂（角色 / 场景 / 道具）90% 高度同构，
 * 把可参数化的部分都集中到这里。
 */

import type { ReactNode } from "react";
import type { FormFieldConfig } from "@/components/ui/form-dialog";
import type { AITypeFieldConfig, AIConfirmPayload } from "@/components/shared/ai-generate-dialog";

/** 工厂实体类型（用于卡片图标 / 资产类型分发）。 */
export type FactoryEntityType = "character" | "scene" | "prop" | "storyboard" | "video" | "audio" | "clip";

/**
 * 工厂实体最基础的形状。
 *
 * 三个工厂（character/scene/prop）有 name；
 * 分镜/视频/音频的"主标题"在 description/title 上，
 * 因此 name 字段是可选的。父组件渲染卡片时必须用 `getEntityLabel(entity)` 取显示名。
 */
export interface FactoryEntity {
  id: string;
  /** 主标题（角色/场景/道具）。分镜/视频/音频可能没有。 */
  name?: string;
  /** 备选主标题，例如分镜 description、视频 title、音频 name。 */
  title?: string;
  description?: string;
  project_id?: string;
  /** 资产被引用次数（缓存字段，可选）。 */
  usage_count?: number;
  /** 软删除时间戳，仅回收站列表会使用到。 */
  deleted_at?: string;
}

/** 统一取实体显示名：name > title > description > "未命名"。 */
export function getEntityLabel(entity: { name?: string; title?: string; description?: string }, fallback = "未命名"): string {
  return (entity.name && entity.name.trim()) || (entity.title && entity.title.trim()) || (entity.description && entity.description.trim().slice(0, 40)) || fallback;
}

/** 通用筛选选项。 */
export interface FilterOption {
  value: string;
  label: string;
}

/** 单个统计卡配置。 */
export interface StatCardConfig {
  label: string;
  value: number | string;
  icon?: React.ComponentType<{ className?: string }>;
  color?: "emerald" | "blue" | "purple" | "orange";
}

/** 卡片渲染时父组件注入的操作函数。 */
export interface CardActions {
  onEdit: () => void;
  onDelete: () => void;
  onToggleSelect: () => void;
  /** 任务12：统一版本管理 - 打开"历史"弹窗。可选。 */
  onViewHistory?: () => void;
  /** 打开"复制到其他项目"弹窗（仅当 copyToProjects 配置时可用）。 */
  onCopyToProjects?: () => void;
  /** 任务：UsageBadge - 引用次数与来源列表。 */
  usage?: { count: number; references: { id: string; title: string }[] };
  /** 任务：点击 UsageBadge 后弹出引用列表 / 跳转。 */
  onOpenSource?: () => void;
  /** 任务：「插入到分镜」按钮回调（仅当 insertToStoryboard 配置时可用）。 */
  onInsertToStoryboard?: () => void;
  selected: boolean;
}

/** AI 生成配置。 */
export interface FactoryAIConfig {
  /** 对话框标题，例如 "AI 生成角色"。 */
  title: string;
  /** 描述输入框的占位提示。 */
  promptPlaceholder: string;
  /** 类型字段配置（角色类型 / 场景类型 / 道具类别）。 */
  typeField: AITypeFieldConfig;
  /** 额外字段（描述 / 性格 / 光线 / 材质 等）。 */
  extraFields?: { name: string; label: string; placeholder?: string; defaultValue?: string }[];
  /** 父组件生成实体时调用。 */
  onGenerate: (payload: AIConfirmPayload) => Promise<void>;
  /** AI 按钮上的文字（默认 "AI生成xxx" 会自动生成）。 */
  buttonLabel?: string;
}

/** 批量改类型的字段配置。 */
export interface FactoryBatchTypeConfig {
  /** 字段名（role / type / category）。 */
  fieldName: string;
  /** 批量修改对话框标题前缀。 */
  confirmTitle: string;
  /** 工具栏按钮文字。 */
  buttonLabel: string;
  /** 改类型时使用的 patch key。 */
  patchKey: string;
  /** 用于展示的中文 label 映射。 */
  typeLabels: Record<string, string>;
  /** 选项（不含 "全部类型"）。 */
  options: FilterOption[];
}

/**
 * FactoryCRUDPage 的 props。
 * 三个工厂的差异点全部通过 props 注入。
 */
export interface FactoryCRUDPageProps<TEntity extends FactoryEntity> {
  // ===== 基本信息 =====
  /** 页面标题。 */
  title: string;
  /** 页面描述。 */
  description: string;
  /** 实体类型（可选，目前未在页面逻辑里使用，留作未来扩展）。 */
  entityType?: FactoryEntityType;
  /** 实体中文名（用于按钮 / 弹窗 / 日志等），例如 "角色"。 */
  entityLabel: string;
  /** 列表卡片标题。 */
  listTitle: string;
  /** 空状态标题 / 描述 / 按钮。 */
  emptyTitle: string;
  /** 工具栏搜索框 placeholder。 */
  searchPlaceholder: string;

  // ===== 数据 API =====
  /** 加载列表。 */
  fetchList: (projectId: string) => Promise<TEntity[]>;
  /** 创建。 */
  createItem: (input: Record<string, unknown>) => Promise<TEntity>;
  /** 更新。 */
  updateItem: (id: string, input: Record<string, unknown>) => Promise<TEntity>;
  /** 删除。 */
  deleteItem: (id: string) => Promise<void>;
  /** 恢复（用于撤销删除）。 */
  restoreItem?: (id: string) => Promise<void>;
  /** 批量操作（删除 / 改类型）。 */
  batch?: (action: "delete" | "update", ids: string[], patch?: Record<string, unknown>) => Promise<{ deleted?: number; updated?: number }>;
  /** 加载回收站列表（已软删除）。 */
  fetchDeleted?: (projectId: string) => Promise<TEntity[]>;
  /** 永久删除（真删，无法恢复）。 */
  permanentDelete?: (ids: string[]) => Promise<void>;
  /** 回收站实体上展示的辅助字段标签，例如"删除时间"。 */
  recycleBinMetaLabel?: string;

  // ===== 表单 / 字段 =====
  /** 新建 / 编辑表单字段配置。 */
  fields: FormFieldConfig[];
  /** 编辑实体时把 entity 转成表单 initial values。 */
  toFormValues: (entity: TEntity) => Record<string, string | number | string[]>;
  /** 保存前对表单值进行预处理（例如 traits 字符串转数组）。 */
  transformFormValues?: (values: Record<string, string | number | string[]>, projectId: string) => Record<string, unknown>;

  // ===== 卡片渲染 =====
  /** 渲染卡片（父组件负责视觉差异）。 */
  renderCard: (item: TEntity, actions: CardActions) => ReactNode;
  /** 卡片所在容器的 grid className（不同实体列宽不同）。 */
  gridClassName?: string;

  // ===== 搜索 / 过滤 =====
  /** 自定义搜索匹配。 */
  searchFields: (item: TEntity, query: string) => boolean;
  /** 过滤下拉选项（含 "" 表示"全部"）。 */
  filterOptions?: FilterOption[];
  /** 当前过滤值（受控）。 */
  filterValue?: string;
  /** 过滤值变更。 */
  onFilterChange?: (value: string) => void;
  /** 过滤匹配函数。 */
  filterField?: (item: TEntity, value: string) => boolean;
  /** 过滤下拉 placeholder。 */
  filterPlaceholder?: string;

  // ===== 二级筛选（可选，用于分镜/视频/音频的 episode 集数筛选） =====
  /**
   * 二级筛选配置：与 filterField/filterValue 并列生效，两者都通过才显示。
   * value 为空字符串表示"全部集数"。
   */
  secondaryFilter?: {
    /** 筛选下拉选项（含 "" 表示"全部"）。 */
    options: FilterOption[];
    /** 匹配函数（item, value），value 为空时通常直接返回 true。 */
    match: (item: TEntity, value: string) => boolean;
    /** 当前值（受控）。 */
    value?: string;
    /** 值变更。 */
    onChange?: (value: string) => void;
    /** 占位文字。 */
    placeholder?: string;
  };

  // ===== 统计卡 =====
  stats: (items: TEntity[]) => StatCardConfig[];

  // ===== AI 生成（可选） =====
  aiConfig?: FactoryAIConfig;

  // ===== 引用查询（可选，删除时给出警告） =====
  fetchUsage?: (id: string) => Promise<{ total?: number; usage_count?: number }>;
  /** 删除确认时附加的警告文案（影响剧本/分镜/对白等）。 */
  usageImpact?: string;

  // ===== 版本历史（可选，任务12：统一版本管理） =====
  /** 是否启用版本历史入口（不传则不显示"历史"按钮和弹窗）。 */
  fetchVersions?: {
    /** 资产类型，必须是 character / scene / prop 中的一个。 */
    entityType: FactoryEntityType;
  };

  // ===== 批量操作（可选） =====
  batchTypeConfig?: FactoryBatchTypeConfig;

  // ===== 跨项目复制（可选） =====
  /**
   * 配置后，卡片操作菜单会显示"复制到其他项目"按钮。
   * 实际复制行为由后端同名去重逻辑处理。
   */
  copyToProjects?: (sourceId: string, targetProjectIds: string[]) => Promise<{ copied: number; skipped: number }>;

  // ===== 引用统计 / 插入到分镜（可选） =====
  /**
   * 获取资产的引用次数与来源列表。
   * 用于卡片右下角展示 `referenced N times` 徽章。
   */
  fetchReferences?: (entity: FactoryEntity) => Promise<{
    count: number;
    references: { id: string; title: string }[];
    episodes: number[];
  }>;
  /**
   * 配置后，卡片会显示「插入到分镜」按钮，调用此函数快速创建一个分镜。
   * 父组件需要根据实体类型（character / scene / prop）从 service 中选择目标分镜创建函数。
   */
  insertToStoryboard?: (entity: FactoryEntity) => Promise<void>;

  // ===== 分页（可选，场景/道具需要） =====
  pageSize?: number;
  /** 分页场景下"全选所有页"按钮的 label。 */
  selectAllLabel?: string;

  // ===== 加载 / 空态 =====
  /** 自定义加载中渲染。 */
  loadingView?: ReactNode;
  /** 顶部"全选"区下方插入额外操作（可选）。 */
  extraToolbarContent?: ReactNode;
  /**
   * 工具栏右侧注入自定义按钮（位于「新建」按钮左侧）。
   * 用于子类添加专属于该模块的快捷入口，例如剪辑中心的「从分镜同步」。
   */
  toolbarExtra?: ReactNode;

  // ===== 模板/预设（任务15：三厂共性 - 资产模板） =====
  /**
   * 是否启用"使用模板"按钮。提供后会在工具栏右侧出现入口，点击后弹出 TemplateSelector。
   * 父组件需要同时提供 `templateFetcher`（拉取模板）和 `onApplyTemplate`（填表逻辑）。
   */
  enableTemplates?: boolean;
  /** 拉取模板列表的服务函数（返回该工厂关心的模板数组）。 */
  templateFetcher?: () => Promise<import("@/components/shared/template-selector").AssetTemplate[]>;
  /** 用户选择模板后的填表回调，参数是模板对象，父组件需要把它映射成表单 initialValues 并打开对话框。 */
  onApplyTemplate?: (template: import("@/components/shared/template-selector").AssetTemplate) => Record<string, string | number | string[]>;
}
