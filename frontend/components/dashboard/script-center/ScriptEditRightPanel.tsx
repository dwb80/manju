'use client'

/**
 * ScriptEditRightPanel —— 剧本编辑器右侧面板
 *
 * 设计原则：
 * - 单一职责：负责 Tab 切换 + 工厂快捷入口 + 各面板内容渲染
 * - 低耦合：所有数据/回调通过 props 注入，内部不直接访问 store
 * - 可配置：Tab 列表来源于 constants.ts，扩展/移除 Tab 仅需修改一处
 * - 可测试：纯组件，便于快照测试与单元测试
 *
 * 历史变更：
 * - v2 (评审优化)：移除 "场景" Tab（场景资产统一在左侧 ScriptSidebar 维护，避免双源）
 * - v2 (评审优化)：将面板渲染逻辑收敛到 PANEL_REGISTRY 配置表
 */

import { lazy, Suspense, useState, useCallback } from 'react'
import { ExternalLink } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  RIGHT_PANEL_TABS,
  RIGHT_PANEL_TAB_CONFIG,
  FACTORY_SHORTCUT_URLS,
  DEFAULT_RIGHT_PANEL_TAB,
  type RightPanelTab,
} from './constants'
import { createLogger } from '@/lib/logger'

// 模块级 logger
const log = createLogger('script-right-panel')

// === 懒加载策略 ===
// 每个面板独立拆分 chunk，只有切换到对应 Tab 时才下载对应代码
// CharacterPanel/PropPanel/AIPanel 较重（依赖工厂、ProseMirror），独立分包收益高
// CommentSystem 较轻，但与其他面板同捆会拖累首屏
const CharacterPanelLazy = lazy(() =>
  import('./CharacterPanel').then((m) => ({ default: m.CharacterPanel })),
)
const PropPanelLazy = lazy(() =>
  import('./PropPanel').then((m) => ({ default: m.PropPanel })),
)
const AIPanelLazy = lazy(() => import('./AIPanel').then((m) => ({ default: m.AIPanel })))
const CommentSystemLazy = lazy(() =>
  import('./CommentSystem').then((m) => ({ default: m.CommentSystem })),
)

/** 单面板加载占位符（避免大块白屏） */
const PanelFallback = () => (
  <div className="p-4 text-center text-xs text-gray-500">
    <div className="animate-pulse">面板加载中...</div>
  </div>
)

/** 各 Tab 所需数据 props（仅声明用到的字段，避免大对象透传） */
export interface ScriptEditRightPanelProps {
  // === 角色面板 ===
  characters: Array<{
    id: string
    name: string
    assetId?: string
    description?: string
    color: string
    thumbnail?: string
  }>
  onAddCharacter: () => void
  onSelectCharacter: (char: any) => void
  onEditCharacter?: (char: any) => void
  onDeleteCharacter: (id: string) => void

  // === 道具面板 ===
  propAssets: Array<{
    id: string
    name: string
    assetId?: string
    description?: string
    category?: string
    color?: string
    thumbnail?: string
  }>
  onAddProp: () => void
  onSelectProp: (p: any) => void
  onEditProp?: (p: any) => void
  onDeleteProp: (id: string) => void

  // === AI 面板 ===
  editor: any
  hasSelection: boolean
  onGenerateScript: (params: any) => Promise<void>
  onOptimizeScript: (params: any) => Promise<{ optimizedContent: string }>
  onGenerateScene: (params: any) => Promise<void>
  onGenerateDialogue: (params: any) => Promise<void>

  // === 评论面板 ===
  scriptId: string
  selectedText: string
  selectionPosition?: { from: number; to: number }
  /** 新增评论后回调（父组件可借此刷新计数/列表） */
  onCommentAdded?: (comment: { id: string; content: string; created_at: string }) => void

  // === 受控/非受控 Tab 状态（可选） ===
  /** 是否走受控模式（用显式标志区分"未传值"和"传了 undefined"两种语义） */
  controlled?: boolean
  /** 受控模式：当前 Tab 由外部传入 */
  activeTab?: RightPanelTab
  /** 受控模式：Tab 切换回调 */
  onActiveTabChange?: (tab: RightPanelTab) => void
}

/**
 * 工厂快捷入口渲染配置
 *
 * 顺序：角色 / 道具（已移除场景工厂入口，原因见顶部注释）
 */
const FACTORY_SHORTCUTS: Array<{
  key: 'character' | 'prop'
  label: string
  url: string
}> = [
    { key: 'character', label: '角色工厂', url: FACTORY_SHORTCUT_URLS.character },
    { key: 'prop', label: '道具工厂', url: FACTORY_SHORTCUT_URLS.prop },
  ]

/**
 * 面板渲染注册表（评审 P1-H7 修复）
 *
 * - 每个 tab 对应一个渲染函数，按需懒加载并用 Suspense 包裹
 * - 新增/删除 Tab 只需在 RIGHT_PANEL_TABS + 此处登记，无需修改 switch
 * - 默认分支走 fallback（未知 Tab）
 */
type PanelRenderer = (props: ScriptEditRightPanelProps) => React.ReactNode

const PANEL_REGISTRY: Record<RightPanelTab, PanelRenderer> = {
  character: (p) => (
    <Suspense fallback={<PanelFallback />}>
      <CharacterPanelLazy
        characters={p.characters as any}
        onAddCharacter={p.onAddCharacter}
        onSelectCharacter={p.onSelectCharacter}
        onEditCharacter={p.onEditCharacter}
        onDeleteCharacter={p.onDeleteCharacter}
      />
    </Suspense>
  ),
  prop: (p) => (
    <Suspense fallback={<PanelFallback />}>
      <PropPanelLazy
        props={p.propAssets as any}
        onAddProp={p.onAddProp}
        onSelectProp={p.onSelectProp}
        onEditProp={p.onEditProp}
        onDeleteProp={p.onDeleteProp}
      />
    </Suspense>
  ),
  ai: (p) => (
    <Suspense fallback={<PanelFallback />}>
      <AIPanelLazy
        editor={p.editor}
        hasSelection={p.hasSelection}
        onGenerateScript={p.onGenerateScript}
        onOptimizeScript={p.onOptimizeScript}
        onGenerateScene={p.onGenerateScene}
        onGenerateDialogue={p.onGenerateDialogue}
      />
    </Suspense>
  ),
  comment: (p) => (
    <Suspense fallback={<PanelFallback />}>
      <CommentSystemLazy
        scriptId={p.scriptId}
        selectedText={p.selectedText}
        selectionPosition={p.selectionPosition}
        onCommentAdded={p.onCommentAdded}
      />
    </Suspense>
  ),
}

/**
 * 剧本编辑器右侧面板组件
 */
export function ScriptEditRightPanel(props: ScriptEditRightPanelProps) {
  // 受控/非受控：用显式 `controlled` 布尔标志区分"父组件未传值"和"父组件传 undefined 但想走受控"
  const isControlled = props.controlled === true
  const [internalTab, setInternalTab] = useState<RightPanelTab>(DEFAULT_RIGHT_PANEL_TAB)
  const activeTab = isControlled ? (props.activeTab ?? DEFAULT_RIGHT_PANEL_TAB) : internalTab

  // 切换 Tab：受控模式回调外部，非受控模式更新内部 state
  const handleTabChange = useCallback(
    (tab: RightPanelTab) => {
      log.debug('switch tab', { from: activeTab, to: tab })
      if (isControlled) {
        props.onActiveTabChange?.(tab)
      } else {
        setInternalTab(tab)
      }
    },
    [activeTab, isControlled, props],
  )

  // 打开工厂快捷入口（新标签页，不打断编辑流）
  const openFactory = useCallback((label: string, url: string) => {
    log.info('open factory', { label, url })
    window.open(url, '_blank', 'noopener,noreferrer')
  }, [])

  // 当前 Tab 的内容（评审 P1-H7：按 PANEL_REGISTRY 渲染，默认 fallback）
  const renderTabContent = (tab: RightPanelTab): React.ReactNode => {
    const renderer = PANEL_REGISTRY[tab]
    if (!renderer) return <div className="p-4 text-[#888]">未知面板</div>
    return renderer(props)
  }

  return (
    <div className="w-80 flex-shrink-0 bg-[#1a1a1a] border-l border-white/10 flex flex-col overflow-hidden">
      {/* === Tab 切换栏 === */}
      <div className="flex border-b border-white/10 bg-[#1a1a1a]" role="tablist">
        {RIGHT_PANEL_TABS.map((tab) => {
          const cfg = RIGHT_PANEL_TAB_CONFIG[tab]
          const isActive = activeTab === tab
          return (
            <Button
              key={tab}
              variant={isActive ? 'default' : 'ghost'}
              size="sm"
              role="tab"
              aria-selected={isActive}
              className="flex-1 h-9 text-xs rounded-none"
              onClick={() => handleTabChange(tab)}
              title={cfg.shortcut ? `快捷键 ${cfg.shortcut}` : cfg.label}
            >
              {cfg.label}
            </Button>
          )
        })}
      </div>

      {/* === 工厂快捷入口 === */}
      <div className="flex border-b border-white/10 bg-[#1a1a1a]">
        {FACTORY_SHORTCUTS.map((entry, idx) => (
          <button
            key={entry.key}
            type="button"
            onClick={() => openFactory(entry.label, entry.url)}
            className={
              'flex-1 flex items-center justify-center gap-1 h-7 text-[10px] text-emerald-400 hover:bg-white/5' +
              (idx > 0 ? ' border-l border-white/10' : '')
            }
            aria-label={`在浏览器新标签页打开${entry.label}`}
          >
            <ExternalLink className="h-3 w-3" />
            {entry.label}
          </button>
        ))}
      </div>

      {/* === 面板内容区（仅当前 Tab 加载对应 chunk） === */}
      <div className="flex-1 overflow-y-auto">{renderTabContent(activeTab)}</div>
    </div>
  )
}
