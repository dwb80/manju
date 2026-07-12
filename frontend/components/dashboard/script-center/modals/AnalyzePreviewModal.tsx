'use client'

/**
 * AnalyzePreviewModal —— AI 剧本分析结果预览弹窗
 *
 * 设计原则：
 * - 单一职责：仅负责"展示 AI/本地正则分析结果 + 触发应用/取消"
 * - 复用样式：保持与原页面一致的两列式预览（角色/场景/道具/剧集）
 * - 可测试：纯组件，外部传入数据与回调
 */

import { X, Check } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { createLogger } from '@/lib/logger'

// 模块级 logger
const log = createLogger('analyze-preview-modal')

// AI 分析结果的最小类型（与 scriptCenterService.analyzeScript 返回值保持一致）
export interface AnalyzeResultItem {
  name: string
  description?: string
  location_name?: string
  time_of_day?: string
  episode_no?: number
  title?: string
  synopsis?: string
  category?: string
  [key: string]: any
}

export interface AnalyzePreviewData {
  characters: AnalyzeResultItem[]
  scenes: AnalyzeResultItem[]
  props: AnalyzeResultItem[]
  episodes: AnalyzeResultItem[]
  source?: 'ai' | 'local'
  warnings?: string[]
}

export interface AnalyzePreviewModalProps {
  data: AnalyzePreviewData
  onApply: () => void | Promise<void>
  onCancel: () => void
}

/**
 * AI 分析结果预览弹窗组件
 */
export function AnalyzePreviewModal({ data, onApply, onCancel }: AnalyzePreviewModalProps) {
  log.debug('open', {
    source: data.source,
    counts: {
      characters: data.characters.length,
      scenes: data.scenes.length,
      props: data.props.length,
      episodes: data.episodes.length,
    },
  })

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
      <div className="w-[640px] max-h-[80vh] bg-[#1a1a1a] rounded-lg border border-white/10 shadow-2xl flex flex-col overflow-hidden">
        {/* 标题栏 */}
        <div className="px-5 py-3 border-b border-white/10 flex items-center justify-between">
          <h3 className="text-base font-medium text-white flex items-center gap-2">
            AI 分析结果
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300">
              AI
            </span>
          </h3>
          <button
            type="button"
            onClick={onCancel}
            className="text-gray-400 hover:text-white"
            aria-label="关闭分析预览"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* 警告提示（如有） */}
        {data.warnings && data.warnings.length > 0 && (
          <div className="px-5 py-2 bg-amber-500/10 border-b border-amber-500/20 text-amber-200 text-xs">
            {data.warnings.map((w, i) => (
              <div key={i}>• {w}</div>
            ))}
          </div>
        )}

        {/* 内容区 */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4 text-sm">
          {/* 角色 */}
          <ResultSection
            title="角色"
            count={data.characters.length}
            emptyText="未识别到角色"
            items={data.characters}
            renderPrimary={(c) => c.name}
            renderSecondary={(c) => c.description}
          />

          {/* 场景 */}
          <ResultSection
            title="场景"
            count={data.scenes.length}
            emptyText="未识别到场景"
            items={data.scenes}
            renderPrimary={(s) => s.location_name || s.name || ''}
            renderSecondary={(s) => s.time_of_day}
          />

          {/* 道具 */}
          <ResultSection
            title="道具"
            count={data.props.length}
            emptyText="未识别到道具"
            items={data.props}
            renderPrimary={(p) => p.name}
            renderSecondary={(p) => p.description}
          />

          {/* 剧集 */}
          <ResultSection
            title="剧集"
            count={data.episodes.length}
            emptyText="未识别到剧集（将使用整篇内容）"
            items={data.episodes}
            renderPrimary={(e) => `第${e.episode_no}集 - ${e.title}`}
            renderSecondary={(e) => e.synopsis}
          />
        </div>

        {/* 操作栏 */}
        <div className="px-5 py-3 border-t border-white/10 flex items-center justify-end gap-2">
          <Button variant="ghost" size="sm" onClick={onCancel}>
            取消
          </Button>
          <Button
            size="sm"
            onClick={onApply}
            className="bg-emerald-500 hover:bg-emerald-600"
          >
            <Check className="mr-1 h-3 w-3" />
            应用结果
          </Button>
        </div>
      </div>
    </div>
  )
}

/**
 * 结果分组 —— 减少每段重复代码（内聚）
 */
interface ResultSectionProps<T> {
  title: string
  count: number
  emptyText: string
  items: T[]
  renderPrimary: (item: T) => string
  renderSecondary?: (item: T) => string | undefined
}

function ResultSection<T>({
  title,
  count,
  emptyText,
  items,
  renderPrimary,
  renderSecondary,
}: ResultSectionProps<T>) {
  return (
    <div>
      <div className="text-emerald-400 font-medium mb-2">
        识别出 {count} 个{title}
      </div>
      {items.length > 0 ? (
        <ul className="space-y-1 text-[#ccc]">
          {items.map((item, idx) => {
            const primary = renderPrimary(item)
            const secondary = renderSecondary?.(item)
            return (
              <li key={idx} className="px-2 py-1 rounded bg-white/5">
                <span className="text-white">{primary}</span>
                {secondary && <span className="text-[#888] ml-2">- {secondary}</span>}
              </li>
            )
          })}
        </ul>
      ) : (
        <div className="text-[#666]">{emptyText}</div>
      )}
    </div>
  )
}
