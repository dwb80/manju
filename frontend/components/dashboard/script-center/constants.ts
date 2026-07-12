/**
 * 剧本中心共享常量与类型
 *
 * 设计原则：
 * - 集中：所有模块标识、Tab 键、工厂入口 URL 在此维护，避免散落
 * - 类型化：使用 union 类型限定取值范围，编译期即可发现问题
 * - 低耦合：业务模块只需 import 常量即可，避免硬编码字符串
 */

/** 右侧面板 Tab 标识
 *
 * 注意：按评审意见已移除 `scene`（场景资产统一由左侧 ScriptSidebar 维护）
 */
export const RIGHT_PANEL_TABS = ['character', 'prop', 'ai', 'comment'] as const

/** 右侧面板 Tab 类型（联合类型） */
export type RightPanelTab = (typeof RIGHT_PANEL_TABS)[number]

/** Tab 显示配置（顺序、标签、键盘快捷键） */
export const RIGHT_PANEL_TAB_CONFIG: Record<
  RightPanelTab,
  { label: string; shortcut?: string }
> = {
  character: { label: '角色', shortcut: '1' },
  prop: { label: '道具', shortcut: '2' },
  ai: { label: 'AI', shortcut: '3' },
  comment: { label: '评论', shortcut: '4' },
}

/** 工厂快捷入口 URL
 *
 * 全部使用新标签页打开（window.open 第二参数 '_blank'），
 * 不打断用户当前的剧本编辑会话。
 */
export const FACTORY_SHORTCUT_URLS = {
  character: '/characters',
  prop: '/props',
} as const

/** 默认打开的 Tab */
export const DEFAULT_RIGHT_PANEL_TAB: RightPanelTab = 'character'
