'use client'

import { useState, useCallback } from 'react'
import { History, RotateCcw, Eye, Trash2, GitCompare, X, Check } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface Version {
  id: string
  version: number
  timestamp: string
  changes: string
  author?: string
}

interface VersionHistoryProps {
  versions: Version[]
  onRestore: (versionId: string) => Promise<void>
  onView: (versionId: string) => void
  onDelete: (versionId: string) => Promise<void>
  onCompare?: (versionId1: string, versionId2: string) => Promise<{ diff: any }>
}

export function VersionHistory({
  versions,
  onRestore,
  onView,
  onDelete,
  onCompare,
}: VersionHistoryProps) {
  const [isRestoring, setIsRestoring] = useState(false)
  const [compareMode, setCompareMode] = useState(false)
  const [selectedVersions, setSelectedVersions] = useState<string[]>([])
  const [compareResult, setCompareResult] = useState<any>(null)
  const [showCompareDialog, setShowCompareDialog] = useState(false)

  const handleRestore = async (versionId: string) => {
    setIsRestoring(true)
    try {
      await onRestore(versionId)
    } finally {
      setIsRestoring(false)
    }
  }

  const toggleCompareMode = useCallback(() => {
    setCompareMode((prev) => !prev)
    setSelectedVersions([])
    setCompareResult(null)
  }, [])

  const toggleVersionSelection = useCallback((versionId: string) => {
    setSelectedVersions((prev) => {
      if (prev.includes(versionId)) {
        return prev.filter((id) => id !== versionId)
      }
      if (prev.length >= 2) {
        return [prev[1], versionId]
      }
      return [...prev, versionId]
    })
  }, [])

  const handleCompare = useCallback(async () => {
    if (selectedVersions.length !== 2 || !onCompare) return

    try {
      const result = await onCompare(selectedVersions[0], selectedVersions[1])
      setCompareResult(result.diff)
      setShowCompareDialog(true)
    } catch (error) {
      console.error('Failed to compare versions:', error)
    }
  }, [selectedVersions, onCompare])

  return (
    <div className="version-history bg-[#1a1a1a] rounded-lg border border-white/10 overflow-hidden">
      {/* 标题 */}
      <div className="p-3 border-b border-white/10 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <History className="h-4 w-4 text-[#888]" />
          <h3 className="text-sm font-medium text-white">版本历史</h3>
        </div>
        {onCompare && versions.length >= 2 && (
          <Button
            variant={compareMode ? 'default' : 'ghost'}
            size="sm"
            onClick={toggleCompareMode}
            className="h-7"
          >
            <GitCompare className="h-3 w-3 mr-1" />
            {compareMode ? '取消对比' : '版本对比'}
          </Button>
        )}
      </div>

      {/* 对比模式工具栏 */}
      {compareMode && (
        <div className="p-3 border-b border-white/10 bg-blue-500/10">
          <div className="flex items-center justify-between">
            <div className="text-xs text-blue-400">
              已选择 {selectedVersions.length}/2 个版本
            </div>
            {selectedVersions.length === 2 && (
              <Button
                variant="default"
                size="sm"
                onClick={handleCompare}
                className="h-7"
              >
                开始对比
              </Button>
            )}
          </div>
        </div>
      )}

      {/* 版本列表 */}
      <div className="overflow-y-auto max-h-[400px]">
        {versions.length === 0 ? (
          <div className="text-center py-8 text-[#666] text-sm">
            暂无历史版本
          </div>
        ) : (
          <div className="divide-y divide-white/5">
            {versions.map((version) => (
              <div
                key={version.id}
                className={`p-3 hover:bg-white/5 transition-colors ${selectedVersions.includes(version.id) ? 'bg-blue-500/10' : ''
                  }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      {compareMode && (
                        <div
                          className={`w-4 h-4 rounded border flex items-center justify-center cursor-pointer ${selectedVersions.includes(version.id)
                            ? 'bg-blue-500 border-blue-500'
                            : 'border-[#666]'
                            }`}
                          onClick={() => toggleVersionSelection(version.id)}
                        >
                          {selectedVersions.includes(version.id) && (
                            <Check className="h-3 w-3 text-white" />
                          )}
                        </div>
                      )}
                      <span className="text-sm font-medium text-white">
                        V{version.version}
                      </span>
                      <span className="text-xs text-[#888]">
                        {new Date(version.timestamp).toLocaleString()}
                      </span>
                    </div>
                    <div className="text-xs text-[#888] truncate">
                      {version.changes}
                    </div>
                    {version.author && (
                      <div className="text-xs text-[#666] mt-1">
                        作者: {version.author}
                      </div>
                    )}
                  </div>

                  {/* 操作按钮 */}
                  {!compareMode && (
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onView(version.id)}
                        className="h-7 w-7 p-0"
                        title="查看版本"
                      >
                        <Eye className="h-3 w-3" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleRestore(version.id)}
                        disabled={isRestoring}
                        className="h-7 w-7 p-0"
                        title="恢复版本"
                      >
                        <RotateCcw className="h-3 w-3" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onDelete(version.id)}
                        className="h-7 w-7 p-0 text-red-400 hover:text-red-300"
                        title="删除版本"
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 版本对比对话框 */}
      {showCompareDialog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-[#1a1a1a] rounded-lg border border-white/10 p-4 w-[640px] max-h-[80vh] overflow-hidden flex flex-col">
            <div className="flex items-center justify-between mb-3">
              <div className="text-sm font-medium text-white">版本对比</div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowCompareDialog(false)}
                className="h-6 w-6 p-0"
              >
                <X className="h-3 w-3" />
              </Button>
            </div>
            <div className="flex-1 overflow-y-auto">
              {compareResult ? (
                <div className="space-y-4">
                  {/* 这里应该显示diff结果，简化实现 */}
                  <div className="bg-green-500/10 p-3 rounded border border-green-500/20">
                    <div className="text-sm font-medium text-green-400 mb-2">新增内容</div>
                    <pre className="text-xs text-[#888] whitespace-pre-wrap">
                      {JSON.stringify(compareResult, null, 2)}
                    </pre>
                  </div>
                  <div className="bg-red-500/10 p-3 rounded border border-red-500/20">
                    <div className="text-sm font-medium text-red-400 mb-2">删除内容</div>
                    <pre className="text-xs text-[#888] whitespace-pre-wrap">
                      {/* 显示删除的内容 */}
                    </pre>
                  </div>
                  <div className="bg-yellow-500/10 p-3 rounded border border-yellow-500/20">
                    <div className="text-sm font-medium text-yellow-400 mb-2">修改内容</div>
                    <pre className="text-xs text-[#888] whitespace-pre-wrap">
                      {/* 显示修改的内容 */}
                    </pre>
                  </div>
                </div>
              ) : (
                <div className="text-center py-8 text-[#666]">加载中...</div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}