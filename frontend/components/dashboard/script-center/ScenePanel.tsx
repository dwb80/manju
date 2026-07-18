'use client'

/**
 * ScenePanel —— 场景资产面板（v3）
 *
 * 与场景工厂联动：
 * - 顶部"+ 添加"按钮 → 父组件回调（通常会 window.open 场景工厂）
 * - 每张卡片悬浮显示 ✎ 编辑按钮 → 触发 onEditScene 回调
 * - 缩略图区域展示 image（来自工厂）；缺失时显示场景类型 icon
 *
 * v3 扩展展示字段（与后端 Scene 实体对齐）：
 *   - type（场景类型）  - lighting（光照）  - time_of_day（时段）  - weather（天气）
 *   - usage_count（引用次数） + version（工厂版本号）
 */

import { useState } from 'react'
import { Film, Plus, Search, Trash2, ExternalLink, MapPin, Sun, Moon, Cloud, Eye } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { truncateDesc } from '@/lib/text-utils'
import { SceneDetailModal, type SceneDetailMerged } from './modals/SceneDetailModal'
import { toast } from '@/components/common/toast'
import { notify } from '@/lib/notify'

interface SceneAsset {
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
}

interface ScenePanelProps {
  scenes: SceneAsset[]
  onAddScene: () => void
  onSelectScene: (scene: SceneAsset) => void
  onEditScene?: (scene: SceneAsset) => void
  onDeleteScene: (id: string) => void
  /**
   * 可选：点击"眼睛"按钮查看详情时由父组件注入的回调。
   * 父组件负责：返回保存上下文 + 写剧本中心 + 刷本地 state。
   */
  onViewSceneDetail?: (
    scene: SceneAsset,
  ) => Promise<{
    onSaveAsAsset: (merged: SceneDetailMerged) => Promise<void> | void
    onSyncToFactory?: (merged: SceneDetailMerged) => Promise<void> | void
    projectId: string
    scriptId?: string
    analyzePreviewScene?: any | null
  } | null>
  /** 当前项目 ID（详情弹框需要） */
  projectId?: string
  /** 当前剧本 ID（详情弹框需要） */
  scriptId?: string
}

/** 场景类型 → 中文标签 */
const TYPE_LABELS: Record<string, string> = {
  indoor: '内景',
  outdoor: '外景',
  virtual: '虚拟',
}

/** 时段 → 图标 + 标签 */
const TIME_OF_DAY_META: Record<string, { label: string; icon: typeof Sun; color: string }> = {
  day: { label: '日', icon: Sun, color: 'text-amber-400' },
  night: { label: '夜', icon: Moon, color: 'text-indigo-300' },
  dawn: { label: '晨', icon: Sun, color: 'text-orange-300' },
  dusk: { label: '黄昏', icon: Sun, color: 'text-rose-300' },
}

/**
 * ScenePanel - 场景资产面板组件
 * @param {ScenePanelProps} props - 组件属性
 * @param {SceneAsset[]} props.scenes - 场景列表数据
 * @param {Function} props.onAddScene - 添加场景回调
 * @param {Function} props.onSelectScene - 选中场景回调
 * @param {Function} props.onDeleteScene - 删除场景回调
 * @param {Function} props.onViewSceneDetail - 查看详情回调
 * @param {string} props.projectId - 项目ID
 * @param {string} props.scriptId - 剧本ID
 * @returns {JSX.Element} 渲染的场景面板界面
 */
export function ScenePanel({
  scenes,
  onAddScene,
  onSelectScene,
  onDeleteScene,
  onViewSceneDetail,
  projectId,
  scriptId,
}: ScenePanelProps) {
  const [searchQuery, setSearchQuery] = useState('')
  // 详情弹框：当前选中的场景 + 上下文
  const [detailScene, setDetailScene] = useState<SceneAsset | null>(null)
  const [detailContext, setDetailContext] = useState<{
    onSaveAsAsset: (merged: SceneDetailMerged) => Promise<void> | void
    onSyncToFactory?: (merged: SceneDetailMerged) => Promise<void> | void
    projectId: string
    scriptId?: string
    analyzePreviewScene?: any | null
  } | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)

  // 搜索：按 name / location / description / tags 过滤
  const filteredScenes = scenes.filter((scene) => {
    const q = searchQuery.toLowerCase()
    if (!q) return true
    return (
      scene.name?.toLowerCase().includes(q) ||
      scene.location?.toLowerCase().includes(q) ||
      scene.description?.toLowerCase().includes(q) ||
      scene.tags?.some((t) => t.toLowerCase().includes(q))
    )
  })

  /**
   * 打开场景详情弹框
   * - 父组件（page.tsx）通过 onViewSceneDetail 注入"保存上下文"
   * - 不依赖工厂；保存时只走剧本中心
   */
  const handleViewDetail = async (scene: SceneAsset) => {
    if (!onViewSceneDetail) {
      notify.warn('未配置场景详情回调')
      return
    }
    setDetailLoading(true)
    try {
      const ctx = await onViewSceneDetail(scene)
      if (!ctx) {
        notify.warn('该场景无法打开详情')
        return
      }
      setDetailScene(scene)
      setDetailContext(ctx)
    } catch (err) {
      toast.error('打开详情失败：' + (err as Error).message)
    } finally {
      setDetailLoading(false)
    }
  }

  const closeDetail = () => {
    setDetailScene(null)
    setDetailContext(null)
  }

  return (
    <div className="scene-panel bg-[#1a1a1a] h-full overflow-y-auto">
      {/* 标题和搜索 */}
      <div className="p-3 border-b border-white/10 sticky top-0 bg-[#1a1a1a] z-10">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-medium text-white flex items-center gap-1.5">
            <span className="text-emerald-400">●</span>
            场景资产
            <span className="text-[10px] text-[#666]">· {scenes.length} · 来自剧本中心</span>
          </h3>
          <Button
            variant="ghost"
            size="sm"
            onClick={onAddScene}
            className="h-6 text-[10px] px-1.5"
            title="在场景工厂中添加（新标签页）"
          >
            <Plus className="h-3 w-3 mr-0.5" />
            添加
          </Button>
        </div>
        <div className="relative">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-[#888]" />
          <Input
            placeholder="搜索场景名 / 地点 / 标签..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="h-8 pl-7 text-sm"
          />
        </div>
      </div>

      {/* 场景列表 */}
      <div className="p-2">
        {filteredScenes.length === 0 ? (
          <div className="text-center py-8 text-[#666] text-sm">
            {searchQuery ? '未找到匹配的场景' : '暂无场景资产'}
            {!searchQuery && (
              <Button
                variant="ghost"
                size="sm"
                onClick={onAddScene}
                className="mt-2"
              >
                <ExternalLink className="h-3 w-3 mr-1" />
                在场景工厂中添加
              </Button>
            )}
          </div>
        ) : (
          <div className="grid gap-2">
            {filteredScenes.map((scene) => {
              const timeMeta = scene.time_of_day ? TIME_OF_DAY_META[scene.time_of_day] : null
              const TimeIcon = timeMeta?.icon
              return (
                <div
                  key={scene.id}
                  className="group relative p-2 rounded bg-white/5 hover:bg-white/10 transition-colors border border-transparent hover:border-white/10 cursor-pointer"
                  onClick={() => onSelectScene(scene)}
                >
                  {/* 缩略图（16:9 横幅）—— 仅在有图时渲染；无图时改为紧凑元信息行 */}
                  {scene.image || scene.thumbnail ? (
                    <div className="relative w-full aspect-video rounded overflow-hidden mb-2 bg-[#232326]">
                      <img
                        src={scene.image || scene.thumbnail}
                        alt={scene.name}
                        className="w-full h-full object-cover"
                      />
                      {/* 右上角：场景类型徽章 */}
                      {scene.type && TYPE_LABELS[scene.type] && (
                        <span className="absolute top-1 right-1 text-[9px] px-1.5 py-0.5 rounded bg-black/60 text-emerald-300 backdrop-blur-sm">
                          {TYPE_LABELS[scene.type]}
                        </span>
                      )}
                      {/* 左下角：时段 + 天气 */}
                      <div className="absolute bottom-1 left-1 flex items-center gap-1">
                        {timeMeta && TimeIcon && (
                          <span
                            className={`flex items-center gap-0.5 text-[9px] px-1.5 py-0.5 rounded bg-black/60 backdrop-blur-sm ${timeMeta.color}`}
                          >
                            <TimeIcon className="h-2.5 w-2.5" />
                            {timeMeta.label}
                          </span>
                        )}
                        {scene.weather && (
                          <span className="flex items-center gap-0.5 text-[9px] px-1.5 py-0.5 rounded bg-black/60 text-sky-300 backdrop-blur-sm">
                            <Cloud className="h-2.5 w-2.5" />
                            {scene.weather}
                          </span>
                        )}
                      </div>
                    </div>
                  ) : (
                    /* 无图时：紧凑行（不占 16:9 高度） */
                    <div className="flex items-center gap-1.5 mb-1.5 text-[10px] text-[#666]">
                      <Film className="h-3 w-3 text-emerald-400/40 flex-shrink-0" />
                      <span>暂无场景图</span>
                      {scene.type && TYPE_LABELS[scene.type] && (
                        <span className="px-1.5 py-0.5 rounded bg-white/5 text-emerald-300">
                          {TYPE_LABELS[scene.type]}
                        </span>
                      )}
                      {timeMeta && TimeIcon && (
                        <span className={`flex items-center gap-0.5 ${timeMeta.color}`}>
                          <TimeIcon className="h-2.5 w-2.5" />
                          {timeMeta.label}
                        </span>
                      )}
                      {scene.weather && (
                        <span className="flex items-center gap-0.5 text-sky-300/80">
                          <Cloud className="h-2.5 w-2.5" />
                          {scene.weather}
                        </span>
                      )}
                    </div>
                  )}

                  {/* 标题行 */}
                  <div className="flex items-center gap-1.5">
                    <MapPin className="h-3 w-3 text-emerald-400 flex-shrink-0" />
                    <span className="font-medium text-white text-sm truncate flex-1">
                      {scene.name || scene.location || '未命名场景'}
                    </span>
                  </div>

                  {/* 光照 */}
                  {scene.lighting && (
                    <div className="text-[10px] text-[#888] mt-0.5 truncate">
                      <span className="text-amber-400/80">光照:</span> {scene.lighting}
                    </div>
                  )}

                  {/* 描述（最多 12 字 + ...） */}
                  {scene.description && (
                    <div
                      className="text-xs text-[#888] truncate mt-1"
                      title={scene.description}
                    >
                      {truncateDesc(scene.description)}
                    </div>
                  )}

                  {/* 标签 */}
                  {scene.tags && scene.tags.length > 0 && (
                    <div className="flex gap-1 mt-1 flex-wrap">
                      {scene.tags.slice(0, 3).map((tag, i) => (
                        <span
                          key={i}
                          className="text-[9px] px-1 py-0.5 rounded bg-white/5 text-[#999]"
                        >
                          {tag}
                        </span>
                      ))}
                      {scene.tags.length > 3 && (
                        <span className="text-[9px] text-[#666]">+{scene.tags.length - 3}</span>
                      )}
                    </div>
                  )}

                  {/* 工厂元数据：引用次数 + 版本号 */}
                  <div className="flex items-center gap-2 mt-1 text-[9px] text-[#666]">
                    {scene.usage_count != null && (
                      <span className="text-purple-400/80">引用 {scene.usage_count} 次</span>
                    )}
                    {scene.version != null && (
                      <span className="px-1 rounded bg-white/5">v{scene.version}</span>
                    )}
                    {scene.assetId && (
                      <span className="text-emerald-400/70">● 工厂同步</span>
                    )}
                  </div>

                  {/* 操作按钮（悬浮显示） */}
                  <div className="absolute top-1 right-1 flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity bg-[#1a1a1a]/80 backdrop-blur-sm rounded px-0.5">
                    {onViewSceneDetail && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation()
                          handleViewDetail(scene)
                        }}
                        className="h-6 w-6 p-0"
                        title="查看详情（可编辑，保存到剧本中心）"
                        disabled={detailLoading}
                      >
                        <Eye className="h-3 w-3 text-emerald-400" />
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation()
                        onDeleteScene(scene.id)
                      }}
                      className="h-6 w-6 p-0"
                      title="从剧本移除（不会删除工厂资产）"
                    >
                      <Trash2 className="h-3 w-3 text-red-400" />
                    </Button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* === 场景详情弹框（编辑后写剧本中心） === */}
      {detailScene && detailContext && (
        <SceneDetailModal
          scene={detailScene as any}
          analyzePreviewScene={detailContext.analyzePreviewScene}
          projectId={detailContext.projectId}
          scriptId={detailContext.scriptId}
          onClose={closeDetail}
          onSaveAsAsset={detailContext.onSaveAsAsset}
          onSyncToFactory={detailContext.onSyncToFactory}
        />
      )}
    </div>
  )
}
