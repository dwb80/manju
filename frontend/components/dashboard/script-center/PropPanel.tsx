'use client'

/**
 * PropPanel —— 道具资产面板（v3）
 *
 * 与道具工厂联动：
 * - 顶部"+ 添加"按钮 → 父组件回调（通常会 window.open 道具工厂）
 * - 每张卡片悬浮显示 👁 详情按钮 + 🗑 删除按钮
 * - 缩略图区域展示 image（来自工厂）；缺失时显示道具类型 icon
 *
 * v3 扩展展示字段（与后端 Prop 实体对齐）：
 *   - category（类别）  - appearance（外观）  - material（材质）
 *   - size（尺寸）  - color（主色调）
 *   - usage_count（引用次数） + version（工厂版本号）
 */

import { useState } from 'react'
import { Package, Plus, Search, Trash2, ExternalLink, Eye } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { truncateDesc } from '@/lib/text-utils'
import { PropDetailModal, type PropDetailMerged } from './modals/PropDetailModal'
import { toast } from '@/components/common/toast'
import { notify } from '@/lib/notify'

interface PropAsset {
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
}

interface PropPanelProps {
  props: PropAsset[]
  onAddProp: () => void
  onSelectProp: (prop: PropAsset) => void
  onEditProp?: (prop: PropAsset) => void
  onDeleteProp: (id: string) => void
  /**
   * 可选：点击"眼睛"按钮查看详情时由父组件注入的回调。
   * 父组件负责：返回保存上下文 + 写剧本中心 + 刷本地 state。
   */
  onViewPropDetail?: (
    prop: PropAsset,
  ) => Promise<{
    onSaveAsAsset: (merged: PropDetailMerged) => Promise<void> | void
    onSyncToFactory?: (merged: PropDetailMerged) => Promise<void> | void
    projectId: string
    scriptId?: string
    analyzePreviewProp?: any | null
  } | null>
  /** 当前项目 ID（详情弹框需要） */
  projectId?: string
  /** 当前剧本 ID（详情弹框需要） */
  scriptId?: string
}

/** 道具类别 → 中文标签 + emoji */
const CATEGORY_META: Record<string, { label: string; emoji: string }> = {
  weapon: { label: '武器', emoji: '⚔️' },
  tool: { label: '工具', emoji: '🔧' },
  clothing: { label: '服饰', emoji: '👕' },
  food: { label: '食物', emoji: '🍱' },
  vehicle: { label: '载具', emoji: '🚗' },
  artifact: { label: '神器', emoji: '💎' },
  furniture: { label: '家具', emoji: '🪑' },
  other: { label: '其他', emoji: '📦' },
}

/**
 * PropPanel - 道具资产面板组件
 * @param {PropPanelProps} props - 组件属性
 * @param {PropAsset[]} props.props - 道具列表数据
 * @param {Function} props.onAddProp - 添加道具回调
 * @param {Function} props.onSelectProp - 选中道具回调
 * @param {Function} props.onDeleteProp - 删除道具回调
 * @param {Function} props.onViewPropDetail - 查看详情回调
 * @param {string} props.projectId - 项目ID
 * @param {string} props.scriptId - 剧本ID
 * @returns {JSX.Element} 渲染的道具面板界面
 */
export function PropPanel({
  props: propAssets,
  onAddProp,
  onSelectProp,
  onDeleteProp,
  onViewPropDetail,
  projectId,
  scriptId,
}: PropPanelProps) {
  const [searchQuery, setSearchQuery] = useState('')
  // 详情弹框：当前选中的道具 + 上下文
  const [detailProp, setDetailProp] = useState<PropAsset | null>(null)
  const [detailContext, setDetailContext] = useState<{
    onSaveAsAsset: (merged: PropDetailMerged) => Promise<void> | void
    onSyncToFactory?: (merged: PropDetailMerged) => Promise<void> | void
    projectId: string
    scriptId?: string
    analyzePreviewProp?: any | null
  } | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)

  /**
   * 打开道具详情弹框
   * - 父组件（page.tsx）通过 onViewPropDetail 注入"保存上下文"
   * - 不依赖工厂；保存时只走剧本中心
   */
  const handleViewDetail = async (prop: PropAsset) => {
    if (!onViewPropDetail) {
      notify.warn('未配置道具详情回调')
      return
    }
    setDetailLoading(true)
    try {
      const ctx = await onViewPropDetail(prop)
      if (!ctx) {
        notify.warn('该道具无法打开详情')
        return
      }
      setDetailProp(prop)
      setDetailContext(ctx)
    } catch (err) {
      toast.error('打开详情失败：' + (err as Error).message)
    } finally {
      setDetailLoading(false)
    }
  }

  const closeDetail = () => {
    setDetailProp(null)
    setDetailContext(null)
  }

  // 搜索：按 name / description / category / tags 过滤
  const filteredProps = propAssets.filter((prop) => {
    const q = searchQuery.toLowerCase()
    if (!q) return true
    if (prop.name?.toLowerCase().includes(q)) return true
    if (prop.description?.toLowerCase().includes(q)) return true
    if (prop.category?.toLowerCase().includes(q)) return true
    if (prop.tags?.some((t) => t.toLowerCase().includes(q))) return true
    return false
  })

  return (
    <div className="prop-panel bg-[#1a1a1a] h-full overflow-y-auto">
      {/* 标题和搜索 */}
      <div className="p-3 border-b border-white/10 sticky top-0 bg-[#1a1a1a] z-10">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-medium text-white flex items-center gap-1.5">
            <span className="text-amber-400">●</span>
            道具资产
            <span className="text-[10px] text-[#666]">· {propAssets.length} · 来自剧本中心</span>
          </h3>
          <Button
            variant="ghost"
            size="sm"
            onClick={onAddProp}
            className="h-6 text-[10px] px-1.5"
            title="在道具工厂中添加（新标签页）"
          >
            <Plus className="h-3 w-3 mr-0.5" />
            添加
          </Button>
        </div>
        <div className="relative">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-[#888]" />
          <Input
            placeholder="搜索道具名 / 类别 / 标签..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="h-8 pl-7 text-sm"
          />
        </div>
      </div>

      {/* 道具列表 */}
      <div className="p-2">
        {filteredProps.length === 0 ? (
          <div className="text-center py-8 text-[#666] text-sm">
            {searchQuery ? '未找到匹配的道具' : '暂无道具资产'}
            {!searchQuery && (
              <Button
                variant="ghost"
                size="sm"
                onClick={onAddProp}
                className="mt-2"
              >
                <ExternalLink className="h-3 w-3 mr-1" />
                在道具工厂中添加
              </Button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            {filteredProps.map((prop) => {
              const catMeta = prop.category ? CATEGORY_META[prop.category] : null
              return (
                <div
                  key={prop.id}
                  className="group relative p-2 rounded bg-white/5 hover:bg-white/10 transition-colors border border-transparent hover:border-white/10 cursor-pointer"
                  onClick={() => onSelectProp(prop)}
                >
                  {/* 缩略图（1:1 方形）—— 仅在有图时渲染；无图时改为紧凑元信息行 */}
                  {prop.image || prop.thumbnail ? (
                    <div className="relative w-full aspect-square rounded overflow-hidden mb-2 bg-[#232326]">
                      <img
                        src={prop.image || prop.thumbnail}
                        alt={prop.name}
                        className="w-full h-full object-cover"
                      />
                      {/* 右上角：类别徽章 */}
                      {catMeta && (
                        <span className="absolute top-1 right-1 text-[9px] px-1.5 py-0.5 rounded bg-black/60 text-amber-300 backdrop-blur-sm">
                          {catMeta.label}
                        </span>
                      )}
                      {/* 左下角：主色色块 */}
                      {prop.color && (
                        <span
                          className="absolute bottom-1 left-1 w-3 h-3 rounded-sm border border-white/30"
                          style={{ backgroundColor: prop.color }}
                          title={`主色: ${prop.color}`}
                        />
                      )}
                    </div>
                  ) : (
                    /* 无图时：紧凑行（不占 1:1 高度） */
                    <div className="flex items-center gap-1.5 mb-1.5 text-[10px] text-[#666]">
                      <Package className="h-3 w-3 text-amber-400/40 flex-shrink-0" />
                      <span>暂无道具图</span>
                      {catMeta && (
                        <span className="px-1.5 py-0.5 rounded bg-white/5 text-amber-300">
                          {catMeta.label}
                        </span>
                      )}
                      {prop.color && (
                        <span
                          className="w-2.5 h-2.5 rounded-sm border border-white/30 flex-shrink-0"
                          style={{ backgroundColor: prop.color }}
                          title={`主色: ${prop.color}`}
                        />
                      )}
                    </div>
                  )}

                  {/* 名称 */}
                  <div className="font-medium text-white text-sm truncate">
                    {prop.name || '未命名道具'}
                  </div>

                  {/* 外观 */}
                  {prop.appearance && (
                    <div className="text-[10px] text-[#888] mt-0.5 truncate">
                      <span className="text-amber-400/80">外观:</span> {prop.appearance}
                    </div>
                  )}

                  {/* 材质 / 尺寸 */}
                  {(prop.material || prop.size) && (
                    <div className="text-[10px] text-[#888] mt-0.5 flex items-center gap-2 truncate">
                      {prop.material && <span>材质: {prop.material}</span>}
                      {prop.size && <span>尺寸: {prop.size}</span>}
                    </div>
                  )}

                  {/* 描述（最多 12 字 + ...） */}
                  {prop.description && (
                    <div
                      className="text-xs text-[#888] truncate mt-1"
                      title={prop.description}
                    >
                      {truncateDesc(prop.description)}
                    </div>
                  )}

                  {/* 标签 */}
                  {prop.tags && prop.tags.length > 0 && (
                    <div className="flex gap-1 mt-1 flex-wrap">
                      {prop.tags.slice(0, 3).map((tag, i) => (
                        <span
                          key={i}
                          className="text-[9px] px-1 py-0.5 rounded bg-white/5 text-[#999]"
                        >
                          {tag}
                        </span>
                      ))}
                      {prop.tags.length > 3 && (
                        <span className="text-[9px] text-[#666]">+{prop.tags.length - 3}</span>
                      )}
                    </div>
                  )}

                  {/* 工厂元数据：引用次数 + 版本号 */}
                  <div className="flex items-center gap-2 mt-1 text-[9px] text-[#666]">
                    {prop.usage_count != null && (
                      <span className="text-purple-400/80">引用 {prop.usage_count} 次</span>
                    )}
                    {prop.version != null && (
                      <span className="px-1 rounded bg-white/5">v{prop.version}</span>
                    )}
                    {prop.assetId && (
                      <span className="text-emerald-400/70">● 工厂同步</span>
                    )}
                  </div>

                  {/* 操作按钮（悬浮显示） */}
                  <div className="absolute top-1 right-1 flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity bg-[#1a1a1a]/80 backdrop-blur-sm rounded px-0.5">
                    {onViewPropDetail && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation()
                          handleViewDetail(prop)
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
                        onDeleteProp(prop.id)
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

      {/* === 道具详情弹框（编辑后写剧本中心） === */}
      {detailProp && detailContext && (
        <PropDetailModal
          prop={detailProp as any}
          analyzePreviewProp={detailContext.analyzePreviewProp}
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
