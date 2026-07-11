'use client'

import { useState } from 'react'
import {
  FolderOpen,
  ChevronDown,
  ChevronRight,
  Film,
  Clock,
  FileText,
  CheckCircle,
  AlertCircle,
  Loader,
  Archive,
} from 'lucide-react'
import { Button } from '@/components/ui/button'

interface ScriptItem {
  id: string
  title: string
  status: 'draft' | 'review' | 'approved' | 'rejected' | 'completed'
  genre?: string
  progress?: number
  updatedAt: string
}

interface ClassificationViewProps {
  scripts: ScriptItem[]
  onScriptSelect?: (scriptId: string) => void
  onFilterChange?: (filters: { type?: string; status?: string; progress?: string }) => void
}

const GENRE_TYPES = [
  { value: 'ancient', label: '古装剧', icon: '🏛️' },
  { value: 'modern', label: '现代剧', icon: '🏙️' },
  { value: 'scifi', label: '科幻剧', icon: '🚀' },
  { value: 'fantasy', label: '奇幻剧', icon: '✨' },
  { value: 'suspense', label: '悬疑剧', icon: '🔍' },
  { value: 'comedy', label: '喜剧', icon: '😄' },
  { value: 'romance', label: '言情剧', icon: '💕' },
]

const STATUS_TYPES = [
  { value: 'draft', label: '草稿', icon: FileText, color: 'gray' },
  { value: 'review', label: '审核中', icon: AlertCircle, color: 'yellow' },
  { value: 'approved', label: '已通过', icon: CheckCircle, color: 'green' },
  { value: 'rejected', label: '已拒绝', icon: AlertCircle, color: 'red' },
  { value: 'completed', label: '已完成', icon: CheckCircle, color: 'blue' },
]

const PROGRESS_TYPES = [
  { value: 'not_started', label: '未开始', range: [0, 0] },
  { value: 'in_progress', label: '进行中', range: [1, 99] },
  { value: 'completed', label: '已完成', range: [100, 100] },
]

export function ClassificationView({
  scripts,
  onScriptSelect,
  onFilterChange,
}: ClassificationViewProps) {
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set(['genre', 'status']))
  const [selectedFilters, setSelectedFilters] = useState<{
    type?: string
    status?: string
    progress?: string
  }>({})
  const [viewMode, setViewMode] = useState<'category' | 'list'>('category')

  const toggleCategory = (category: string) => {
    setExpandedCategories((prev) => {
      const newSet = new Set(prev)
      if (newSet.has(category)) {
        newSet.delete(category)
      } else {
        newSet.add(category)
      }
      return newSet
    })
  }

  const toggleFilter = (filterType: string, value: string) => {
    setSelectedFilters((prev) => {
      const newFilters = { ...prev }
      if (newFilters[filterType as keyof typeof newFilters] === value) {
        delete newFilters[filterType as keyof typeof newFilters]
      } else {
        (newFilters as any)[filterType] = value
      }
      onFilterChange?.(newFilters)
      return newFilters
    })
  }

  const getFilteredScripts = () => {
    let filtered = scripts

    if (selectedFilters.type) {
      filtered = filtered.filter((script) => script.genre === selectedFilters.type)
    }

    if (selectedFilters.status) {
      filtered = filtered.filter((script) => script.status === selectedFilters.status)
    }

    if (selectedFilters.progress) {
      const progressType = PROGRESS_TYPES.find((p) => p.value === selectedFilters.progress)
      if (progressType) {
        filtered = filtered.filter(
          (script) =>
            script.progress !== undefined &&
            script.progress >= progressType.range[0] &&
            script.progress <= progressType.range[1]
        )
      }
    }

    return filtered
  }

  const groupedScripts = {
    genre: GENRE_TYPES.map((genre) => ({
      label: genre.label,
      value: genre.value,
      icon: genre.icon,
      scripts: scripts.filter((script) => script.genre === genre.value),
    })),
    status: STATUS_TYPES.map((status) => ({
      label: status.label,
      value: status.value,
      icon: status.icon,
      color: status.color,
      scripts: scripts.filter((script) => script.status === status.value),
    })),
    progress: PROGRESS_TYPES.map((progress) => ({
      label: progress.label,
      value: progress.value,
      scripts: scripts.filter((script) => {
        if (script.progress === undefined) return false
        return script.progress >= progress.range[0] && script.progress <= progress.range[1]
      }),
    })),
  }

  const renderScriptItem = (script: ScriptItem) => (
    <div
      key={script.id}
      className="flex items-center gap-2 p-2 rounded bg-white/5 hover:bg-white/10 cursor-pointer transition-colors"
      onClick={() => onScriptSelect?.(script.id)}
    >
      <Film className="h-4 w-4 text-emerald-400 flex-shrink-0" />
      <div className="flex-1 min-w-0">
        <div className="text-sm text-white truncate">{script.title}</div>
        <div className="text-xs text-[#888]">{new Date(script.updatedAt).toLocaleDateString()}</div>
      </div>
      {script.progress !== undefined && (
        <div className="flex items-center gap-2">
          <div className="w-16 bg-white/10 rounded-full h-1.5">
            <div
              className="bg-blue-400 h-1.5 rounded-full"
              style={{ width: `${script.progress}%` }}
            />
          </div>
          <span className="text-xs text-[#888]">{script.progress}%</span>
        </div>
      )}
    </div>
  )

  const renderCategoryItem = (
    category: { label: string; value: string; icon?: any; color?: string; scripts: ScriptItem[] }
  ) => {
    const isActive =
      selectedFilters.type === category.value ||
      selectedFilters.status === category.value ||
      selectedFilters.progress === category.value

    return (
      <div
        key={category.value}
        className={`flex items-center gap-2 p-2 rounded cursor-pointer transition-colors ${
          isActive ? 'bg-blue-500/10 border border-blue-500/20' : 'hover:bg-white/5'
        }`}
        onClick={() => {
          const filterType = expandedCategories.has('genre') ? 'type' :
                            expandedCategories.has('status') ? 'status' : 'progress'
          toggleFilter(filterType, category.value)
        }}
      >
        {typeof category.icon === 'string' ? (
          <span className="text-lg">{category.icon}</span>
        ) : category.icon ? (
          <category.icon className={`h-4 w-4 text-${category.color}-400`} />
        ) : (
          <FolderOpen className="h-4 w-4 text-[#888]" />
        )}
        <div className="flex-1">
          <span className="text-sm text-white">{category.label}</span>
        </div>
        <span className="text-xs text-[#888]">{category.scripts.length}</span>
      </div>
    )
  }

  return (
    <div className="classification-view bg-[#1a1a1a] rounded-lg border border-white/10 overflow-hidden">
      {/* 标题 */}
      <div className="p-3 border-b border-white/10 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FolderOpen className="h-4 w-4 text-[#888]" />
          <h3 className="text-sm font-medium text-white">剧本分类</h3>
        </div>
        <div className="flex gap-1">
          <Button
            variant={viewMode === 'category' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setViewMode('category')}
            className="h-7"
          >
            分类视图
          </Button>
          <Button
            variant={viewMode === 'list' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setViewMode('list')}
            className="h-7"
          >
            列表视图
          </Button>
        </div>
      </div>

      {/* 内容 */}
      <div className="overflow-y-auto max-h-[400px]">
        {viewMode === 'category' ? (
          <div className="p-2 space-y-3">
            {/* 按类型分类 */}
            <div className="border border-white/10 rounded-lg overflow-hidden">
              <div
                className="flex items-center justify-between p-2 bg-white/5 cursor-pointer hover:bg-white/10"
                onClick={() => toggleCategory('genre')}
              >
                <div className="flex items-center gap-2">
                  <span className="text-lg">🎭</span>
                  <span className="text-sm font-medium text-white">按类型</span>
                </div>
                {expandedCategories.has('genre') ? (
                  <ChevronDown className="h-4 w-4 text-[#888]" />
                ) : (
                  <ChevronRight className="h-4 w-4 text-[#888]" />
                )}
              </div>
              {expandedCategories.has('genre') && (
                <div className="divide-y divide-white/5">
                  {groupedScripts.genre.map(renderCategoryItem)}
                </div>
              )}
            </div>

            {/* 按状态分类 */}
            <div className="border border-white/10 rounded-lg overflow-hidden">
              <div
                className="flex items-center justify-between p-2 bg-white/5 cursor-pointer hover:bg-white/10"
                onClick={() => toggleCategory('status')}
              >
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-blue-400" />
                  <span className="text-sm font-medium text-white">按状态</span>
                </div>
                {expandedCategories.has('status') ? (
                  <ChevronDown className="h-4 w-4 text-[#888]" />
                ) : (
                  <ChevronRight className="h-4 w-4 text-[#888]" />
                )}
              </div>
              {expandedCategories.has('status') && (
                <div className="divide-y divide-white/5">
                  {groupedScripts.status.map(renderCategoryItem)}
                </div>
              )}
            </div>

            {/* 按进度分类 */}
            <div className="border border-white/10 rounded-lg overflow-hidden">
              <div
                className="flex items-center justify-between p-2 bg-white/5 cursor-pointer hover:bg-white/10"
                onClick={() => toggleCategory('progress')}
              >
                <div className="flex items-center gap-2">
                  <Loader className="h-4 w-4 text-emerald-400" />
                  <span className="text-sm font-medium text-white">按进度</span>
                </div>
                {expandedCategories.has('progress') ? (
                  <ChevronDown className="h-4 w-4 text-[#888]" />
                ) : (
                  <ChevronRight className="h-4 w-4 text-[#888]" />
                )}
              </div>
              {expandedCategories.has('progress') && (
                <div className="divide-y divide-white/5">
                  {groupedScripts.progress.map(renderCategoryItem)}
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="p-2">
            {getFilteredScripts().length === 0 ? (
              <div className="text-center py-8 text-[#666] text-sm">
                {scripts.length === 0 ? '暂无剧本' : '未找到匹配的剧本'}
              </div>
            ) : (
              <div className="space-y-1.5">
                {getFilteredScripts().map(renderScriptItem)}
              </div>
            )}
          </div>
        )}
      </div>

      {/* 统计信息 */}
      <div className="p-3 border-t border-white/10 bg-white/5">
        <div className="text-xs text-[#888] mb-1">总计</div>
        <div className="text-sm text-white">
          {scripts.length} 个剧本
          {Object.keys(selectedFilters).length > 0 && (
            <span className="ml-2 text-blue-400">
              (已筛选 {getFilteredScripts().length} 个)
            </span>
          )}
        </div>
      </div>
    </div>
  )
}