'use client'

/**
 * ScriptEditRightPanel —— 剧本编辑器右侧面板（v3）
 *
 * 设计原则：
 * - 单一职责：负责 Tab 切换 + 工厂快捷入口 + 各面板内容渲染
 * - 低耦合：所有数据/回调通过 props 注入，内部不直接访问 store
 * - 可配置：Tab 列表与工厂入口来源于 constants.ts，扩展/移除 Tab 仅需修改一处
 * - 可测试：纯组件，便于快照测试与单元测试
 *
 * v3 变更（与三大工厂设计稿对齐）：
 * - Tab 顺序恢复为 5 个：角色 / 场景 / 道具 / AI / 评论
 * - 工厂快捷入口从底部移到 Tab 下方顶部位置，并扩展为 3 个：
 *     ↗ 角色工厂（/characters）  ↗ 场景工厂（/scenes）  ↗ 道具工厂（/props）
 * - 工厂入口与 Tab 颜色语义一致：角色=蓝 / 场景=绿 / 道具=黄
 * - PANEL_REGISTRY 增加 scene 分支，懒加载 ScenePanel
 */

import { lazy, Suspense, useState, useCallback } from 'react'
import { ExternalLink } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Tip } from '@/components/ui/tip'
import {
  RIGHT_PANEL_TABS,
  RIGHT_PANEL_TAB_CONFIG,
  FACTORY_SHORTCUTS,
  DEFAULT_RIGHT_PANEL_TAB,
  type RightPanelTab,
} from './constants'
import { createLogger } from '@/lib/logger'

// 模块级 logger
const log = createLogger('script-right-panel')

// === 懒加载策略 ===
// 每个面板独立拆分 chunk，只有切换到对应 Tab 时才下载对应代码
// CharacterPanel/ScenePanel/PropPanel 较重（依赖工厂字段、缩略图），独立分包收益高
// AIPanel 重（依赖 ProseMirror），独立分包
// CommentSystem 较轻，但与其他面板同捆会拖累首屏
const CharacterPanelLazy = lazy(() =>
  import('./CharacterPanel').then((m) => ({ default: m.CharacterPanel })),
)
const ScenePanelLazy = lazy(() =>
  import('./ScenePanel').then((m) => ({ default: m.ScenePanel })),
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
    image?: string
    role?: string
    gender?: string
    age?: number
    appearance?: string
    personality?: string
    traits?: string[]
    tags?: string[]
    // v3 扩展字段
    identity?: string
    face?: string
    hair?: string
    body?: string
    temperament?: string
    costume_name?: string
    costume_description?: string
    costume_color?: string
    costume_material?: string
    costume_style?: string
    accessories?: string[]
    emotion_states?: string
    action_assets?: string
    relationships?: string
    first_appearance?: string
    dialogue_count?: number
    generation_prompt?: string
    confidence?: string
    usage_count?: number
    version?: number
  }>
  onAddCharacter: () => void
  onSelectCharacter: (char: any) => void
  onDeleteCharacter: (id: string) => void
  /**
   * 可选：点击"眼睛"按钮查看详情时由父组件注入的回调。
   * 父组件负责：查找 AI analyzePreview 同名数据 + 返回保存回调 + 写库后刷 store。
   */
  onViewCharacterDetail?: (
    char: any,
  ) => Promise<{
    onSaveAsAsset: (merged: any) => Promise<void> | void
    projectId: string
    scriptId?: string
    analyzePreviewCharacter?: any | null
  } | null>
  /** 当前项目 ID（详情弹框需要） */
  projectId?: string

  // === 场景面板 ===
  sceneAssets: Array<{
    id: string
    name: string
    assetId?: string
    description?: string
    location?: string
    time?: string
    thumbnail?: string
    image?: string
    // v3 扩展字段
    type?: string
    lighting?: string
    time_of_day?: string
    weather?: string
    tags?: string[]
    usage_count?: number
    version?: number
  }>
  onAddScene: () => void
  onSelectScene: (scene: any) => void
  onDeleteScene: (id: string) => void
  /** 可选：场景详情弹框的保存上下文（直接写剧本中心，不走工厂） */
  onViewSceneDetail?: (
    scene: any,
  ) => Promise<{
    onSaveAsAsset: (merged: any) => Promise<void> | void
    projectId: string
    scriptId?: string
    analyzePreviewScene?: any | null
  } | null>

  // === 道具面板 ===
  propAssets: Array<{
    id: string
    name: string
    assetId?: string
    description?: string
    category?: string
    color?: string
    thumbnail?: string
    image?: string
    // v3 扩展字段
    appearance?: string
    material?: string
    size?: string
    tags?: string[]
    usage_count?: number
    version?: number
  }>
  onAddProp: () => void
  onSelectProp: (p: any) => void
  onEditProp?: (p: any) => void
  onDeleteProp: (id: string) => void
  /** 可选：道具详情弹框的保存上下文（直接写剧本中心，不走工厂） */
  onViewPropDetail?: (
    prop: any,
  ) => Promise<{
    onSaveAsAsset: (merged: any) => Promise<void> | void
    projectId: string
    scriptId?: string
    analyzePreviewProp?: any | null
  } | null>

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
 * 面板渲染注册表（v3：5 个 Tab）
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
        onDeleteCharacter={p.onDeleteCharacter}
        onViewCharacterDetail={p.onViewCharacterDetail}
        projectId={p.projectId}
        scriptId={p.scriptId}
      />
    </Suspense>
  ),
  scene: (p) => (
    <Suspense fallback={<PanelFallback />}>
      <ScenePanelLazy
        scenes={p.sceneAssets as any}
        onAddScene={p.onAddScene}
        onSelectScene={p.onSelectScene}
        onDeleteScene={p.onDeleteScene}
        onViewSceneDetail={p.onViewSceneDetail}
        projectId={p.projectId}
        scriptId={p.scriptId}
      />
    </Suspense>
  ),
  prop: (p) => (
    <Suspense fallback={<PanelFallback />}>
      <PropPanelLazy
        props={p.propAssets as any}
        onAddProp={p.onAddProp}
        onSelectProp={p.onSelectProp}
        onDeleteProp={p.onDeleteProp}
        onViewPropDetail={p.onViewPropDetail}
        projectId={p.projectId}
        scriptId={p.scriptId}
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
 * 剧本编辑器右侧面板组件（v3）
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

  // 当前 Tab 的内容（按 PANEL_REGISTRY 渲染，默认 fallback）
  const renderTabContent = (tab: RightPanelTab): React.ReactNode => {
    const renderer = PANEL_REGISTRY[tab]
    if (!renderer) return <div className="p-4 text-[#888]">未知面板</div>
    return renderer(props)
  }

  return (
    <div className="w-80 flex-shrink-0 bg-[#1a1a1a] border-l border-white/10 flex flex-col overflow-hidden">
      {/* === Tab 切换栏（5 个：角色/场景/道具/AI/评论） === */}
      <div className="flex border-b border-white/10 bg-[#1a1a1a]" role="tablist">
        {RIGHT_PANEL_TABS.map((tab) => {
          const cfg = RIGHT_PANEL_TAB_CONFIG[tab]
          const isActive = activeTab === tab
          return (
            <Tip key={tab} label={cfg.shortcut ? `快捷键 ${cfg.shortcut}` : cfg.label} side="bottom">
              <Button
                variant={isActive ? 'default' : 'ghost'}
                size="sm"
                role="tab"
                aria-selected={isActive}
                className="flex-1 h-9 text-xs rounded-none"
                onClick={() => handleTabChange(tab)}
              >
                {cfg.label}
              </Button>
            </Tip>
          )
        })}
      </div>

      {/* === 工厂快捷入口（顶部，紧贴 Tab 下方） ===
       * 3 个入口：角色工厂 / 场景工厂 / 道具工厂
       * 全部新标签页打开（window.open '_blank'），不打断当前编辑会话
       * 颜色与对应 Tab 一致：角色=蓝 / 场景=绿 / 道具=黄
       */}
      <div className="grid grid-cols-3 border-b border-white/10 bg-[#232326]">
        {FACTORY_SHORTCUTS.map((entry, idx) => (
          <button
            key={entry.key}
            type="button"
            onClick={() => openFactory(entry.label, entry.url)}
            className={
              'flex items-center justify-center gap-1 h-8 text-[10px] hover:bg-white/5 transition-colors' +
              (idx > 0 ? ' border-l border-white/10' : '')
            }
            style={{ color: entry.color }}
            aria-label={`在浏览器新标签页打开${entry.label}`}
            title={`新标签页打开 ${entry.label}（${entry.url}）`}
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
