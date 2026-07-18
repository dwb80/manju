/**
 * 剧本中心共享常量与类型
 *
 * 设计原则：
 * - 集中：所有模块标识、Tab 键、工厂入口 URL 在此维护，避免散落
 * - 类型化：使用 union 类型限定取值范围，编译期即可发现问题
 * - 低耦合：业务模块只需 import 常量即可，避免硬编码字符串
 *
 * 历史变更：
 * - v3（设计稿对齐）：恢复 scene Tab，与三大工厂一一对应
 *   顺序：角色 / 场景 / 道具 / AI / 评论
 *   工厂入口：角色工厂 / 场景工厂 / 道具工厂（全部新标签页打开）
 */

/** 右侧面板 Tab 标识（5 个，与三大工厂对应） */
export const RIGHT_PANEL_TABS = ['character', 'scene', 'prop', 'ai', 'comment'] as const

/** 右侧面板 Tab 类型（联合类型） */
export type RightPanelTab = (typeof RIGHT_PANEL_TABS)[number]

/** Tab 显示配置（顺序、标签、键盘快捷键） */
export const RIGHT_PANEL_TAB_CONFIG: Record<
  RightPanelTab,
  { label: string; shortcut?: string; color?: string }
> = {
  character: { label: '角色', shortcut: '1', color: '#38bdf8' },
  scene: { label: '场景', shortcut: '2', color: '#4ade80' },
  prop: { label: '道具', shortcut: '3', color: '#fbbf24' },
  ai: { label: 'AI', shortcut: '4' },
  comment: { label: '评论', shortcut: '5' },
}

/** 工厂快捷入口 URL
 *
 * 全部使用新标签页打开（window.open 第二参数 '_blank'），
 * 不打断用户当前的剧本编辑会话。
 */
export const FACTORY_SHORTCUT_URLS = {
  character: '/characters',
  scene: '/scenes',
  prop: '/props',
} as const

/** 工厂快捷入口顺序配置（用于渲染） */
export const FACTORY_SHORTCUTS: Array<{
  key: 'character' | 'scene' | 'prop'
  label: string
  url: string
  color: string
}> = [
  { key: 'character', label: '角色工厂', url: FACTORY_SHORTCUT_URLS.character, color: '#38bdf8' },
  { key: 'scene', label: '场景工厂', url: FACTORY_SHORTCUT_URLS.scene, color: '#4ade80' },
  { key: 'prop', label: '道具工厂', url: FACTORY_SHORTCUT_URLS.prop, color: '#fbbf24' },
]

/** 默认打开的 Tab */
export const DEFAULT_RIGHT_PANEL_TAB: RightPanelTab = 'character'
