'use client'

/**
 * @file ClassificationView.tsx
 * @description 剧本分类视图组件，支持按类型、状态、进度对剧本进行分类展示和筛选
 */

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
  Loader
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
  { value: 'draft', label: '草稿', icon: FileText, color: 'text-muted-foreground' },
  { value: 'review', label: '审核中', icon: AlertCircle, color: 'text-warning' },
  { value: 'approved', label: '已通过', icon: CheckCircle, color: 'text-success' },
  { value: 'rejected', label: '已拒绝', icon: AlertCircle, color: 'text-destructive' },
  { value: 'completed', label: '已完成', icon: CheckCircle, color: 'text-info' },
]

const PROGRESS_TYPES = [
  { value: 'not_started', label: '未开始', range: [0, 0] },
  { value: 'in_progress', label: '进行中', range: [1, 99] },
  { value: 'completed', label: '已完成', range: [100, 100] },
]

/**
 * ClassificationView - 剧本分类视图组件
 * @param {ClassificationViewProps} props - 组件属性
 * @param {ScriptItem[]} props.scripts - 剧本列表
 * @param {Function} [props.onScriptSelect] - 选择剧本回调
 * @param {Function} [props.onFilterChange] - 筛选条件变更回调
 * @returns {JSX.Element} 渲染的分类视图界面
 */
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
      className="flex items-center gap-2 p-2 rounded bg-muted/50 hover:bg-muted cursor-pointer transition-colors"
      onClick={() => onScriptSelect?.(script.id)}
    >
      <Film className="h-4 w-4 text-primary flex-shrink-0" />
      <div className="flex-1 min-w-0">
        <div className="text-sm text-foreground truncate">{script.title}</div>
        <div className="text-xs text-muted-foreground">{new Date(script.updatedAt).toLocaleDateString()}</div>
      </div>
      {script.progress !== undefined && (
        <div className="flex items-center gap-2">
          <div className="w-16 bg-muted rounded-full h-1.5">
            <div
              className="bg-info h-1.5 rounded-full"
              style={{ width: `${script.progress}%` }}
            />
          </div>
          <span className="text-xs text-muted-foreground">{script.progress}%</span>
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
        className={`flex items-center gap-2 p-2 rounded cursor-pointer transition-colors ${isActive ? 'bg-info/10 border border-info/20' : 'hover:bg-muted/50'
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
          <category.icon className={`h-4 w-4 ${category.color}`} />
        ) : (
          <FolderOpen className="h-4 w-4 text-muted-foreground" />
        )}
        <div className="flex-1">
          <span className="text-sm text-foreground">{category.label}</span>
        </div>
        <span className="text-xs text-muted-foreground">{category.scripts.length}</span>
      </div>
    )
  }

  return (
    <div className="classification-view bg-card rounded-lg border border-border overflow-hidden">
      {/* 标题 */}
      <div className="p-3 border-b border-border flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FolderOpen className="h-4 w-4 text-muted-foreground" />
          <h3 className="text-sm font-medium text-foreground">剧本分类</h3>
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
            <div className="border border-border rounded-lg overflow-hidden">
              <div
                className="flex items-center justify-between p-2 bg-muted/50 cursor-pointer hover:bg-muted"
                onClick={() => toggleCategory('genre')}
              >
                <div className="flex items-center gap-2">
                  <span className="text-lg">🎭</span>
                  <span className="text-sm font-medium text-foreground">按类型</span>
                </div>
                {expandedCategories.has('genre') ? (
                  <ChevronDown className="h-4 w-4 text-muted-foreground" />
                ) : (
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                )}
              </div>
              {expandedCategories.has('genre') && (
                <div className="divide-y divide-white/5">
                  {groupedScripts.genre.map(renderCategoryItem)}
                </div>
              )}
            </div>

            {/* 按状态分类 */}
            <div className="border border-border rounded-lg overflow-hidden">
              <div
                className="flex items-center justify-between p-2 bg-muted/50 cursor-pointer hover:bg-muted"
                onClick={() => toggleCategory('status')}
              >
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-info" />
                  <span className="text-sm font-medium text-foreground">按状态</span>
                </div>
                {expandedCategories.has('status') ? (
                  <ChevronDown className="h-4 w-4 text-muted-foreground" />
                ) : (
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                )}
              </div>
              {expandedCategories.has('status') && (
                <div className="divide-y divide-white/5">
                  {groupedScripts.status.map(renderCategoryItem)}
                </div>
              )}
            </div>

            {/* 按进度分类 */}
            <div className="border border-border rounded-lg overflow-hidden">
              <div
                className="flex items-center justify-between p-2 bg-muted/50 cursor-pointer hover:bg-muted"
                onClick={() => toggleCategory('progress')}
              >
                <div className="flex items-center gap-2">
                  <Loader className="h-4 w-4 text-primary" />
                  <span className="text-sm font-medium text-foreground">按进度</span>
                </div>
                {expandedCategories.has('progress') ? (
                  <ChevronDown className="h-4 w-4 text-muted-foreground" />
                ) : (
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
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
              <div className="text-center py-8 text-muted-foreground text-sm">
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
      <div className="p-3 border-t border-border bg-muted/50">
        <div className="text-xs text-muted-foreground mb-1">总计</div>
        <div className="text-sm text-foreground">
          {scripts.length} 个剧本
          {Object.keys(selectedFilters).length > 0 && (
            <span className="ml-2 text-info">
              (已筛选 {getFilteredScripts().length} 个)
            </span>
          )}
        </div>
      </div>
    </div>
  )
}
