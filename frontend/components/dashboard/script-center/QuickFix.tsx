'use client'

/**
 * @file QuickFix.tsx
 * @description 一键修复建议组件，检测剧本中的连续性、语法、风格等问题并提供修复建议
 */

import { useState, useEffect, useCallback } from 'react'
import {
  Wrench,
  AlertCircle,
  AlertTriangle,
  CheckCircle,
  RefreshCw,
  ChevronDown,
  ChevronRight,
  Zap,
  Check,
  Wand2,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { scriptCenterService } from '@/services/script-center.service'

interface FixIssue {
  id: string
  type: 'continuity' | 'grammar' | 'style' | 'formatting' | 'logic'
  severity: 'error' | 'warning' | 'info'
  message: string
  location: string
  originalText?: string
  suggestedFix: string
  autoFixAvailable: boolean
}

interface QuickFixProps {
  scriptId: string
  onApplyFix?: (fix: FixIssue) => void
  onBatchFix?: (fixes: FixIssue[]) => void
}

/**
 * QuickFix - 一键修复建议组件
 * @param {QuickFixProps} props - 组件属性
 * @param {string} props.scriptId - 剧本ID
 * @param {Function} [props.onApplyFix] - 应用单个修复回调
 * @param {Function} [props.onBatchFix] - 批量修复回调
 * @returns {JSX.Element} 渲染的问题修复界面
 */
export function QuickFix({ scriptId, onApplyFix, onBatchFix }: QuickFixProps) {
  const [issues, setIssues] = useState<FixIssue[]>([])
  const [loading, setLoading] = useState(true)
  const [checking, setChecking] = useState(false)
  const [expandedTypes, setExpandedTypes] = useState<Set<string>>(
    new Set(['continuity', 'grammar'])
  )
  const [selectedIssues, setSelectedIssues] = useState<Set<string>>(new Set())
  const [batchFixMode, setBatchFixMode] = useState(false)
  const [fixingAll, setFixingAll] = useState(false)

  useEffect(() => {
    checkForIssues()
  }, [scriptId])

  const checkForIssues = async () => {
    setChecking(true)
    try {
      // 获取连续性检查结果
      const continuityResult = await scriptCenterService.checkContinuity(scriptId)

      // 将连续性问题转换为修复问题格式
      const continuityIssues: FixIssue[] = continuityResult.issues.map((issue, index) => ({
        id: `continuity-${index}`,
        type: 'continuity',
        severity: issue.severity,
        message: issue.message,
        location: issue.location,
        suggestedFix: issue.suggestion || '建议手动检查和修改',
        autoFixAvailable: false,
      }))

      // 模拟添加其他类型的问题（语法、风格等）
      const grammarIssues: FixIssue[] = [
        {
          id: 'grammar-1',
          type: 'grammar',
          severity: 'warning',
          message: '句子过长，建议拆分',
          location: '第3页，第12段',
          originalText: '这是一段很长很长的句子...',
          suggestedFix: '这是一段句子。后面是另一部分。',
          autoFixAvailable: true,
        },
        {
          id: 'grammar-2',
          type: 'grammar',
          severity: 'info',
          message: '标点符号使用不规范',
          location: '第5页，第8行',
          originalText: '他问:"是什么"？',
          suggestedFix: '他问："是什么？"',
          autoFixAvailable: true,
        },
      ]

      const styleIssues: FixIssue[] = [
        {
          id: 'style-1',
          type: 'style',
          severity: 'info',
          message: '对话风格不够自然',
          location: '第10页，场景3',
          originalText: '我觉得这个事情很重要。',
          suggestedFix: '这事挺重要的。',
          autoFixAvailable: false,
        },
        {
          id: 'style-2',
          type: 'style',
          severity: 'warning',
          message: '描述过于冗长',
          location: '第15页，场景5',
          originalText: '房间里的光线很明亮...',
          suggestedFix: '房间光线明亮。',
          autoFixAvailable: true,
        },
      ]

      setIssues([...continuityIssues, ...grammarIssues, ...styleIssues])
    } catch (error) {
      console.error('Failed to check for issues:', error)
      setIssues([])
    } finally {
      setLoading(false)
      setChecking(false)
    }
  }

  const toggleType = (type: string) => {
    setExpandedTypes((prev) => {
      const newSet = new Set(prev)
      if (newSet.has(type)) {
        newSet.delete(type)
      } else {
        newSet.add(type)
      }
      return newSet
    })
  }

  const toggleIssueSelection = useCallback((issueId: string) => {
    setSelectedIssues((prev) => {
      const newSet = new Set(prev)
      if (newSet.has(issueId)) {
        newSet.delete(issueId)
      } else {
        newSet.add(issueId)
      }
      return newSet
    })
  }, [])

  const selectAllAutoFixable = useCallback(() => {
    const autoFixableIds = issues
      .filter((issue) => issue.autoFixAvailable)
      .map((issue) => issue.id)
    setSelectedIssues(new Set(autoFixableIds))
  }, [issues])

  const clearSelection = useCallback(() => {
    setSelectedIssues(new Set())
  }, [])

  const applyFix = useCallback(
    async (issue: FixIssue) => {
      if (!issue.autoFixAvailable) {
        // 对于不可自动修复的问题，提示用户手动修改
        alert('此问题需要手动修改')
        return
      }

      try {
        // 应用修复
        if (onApplyFix) {
          onApplyFix(issue)
        }

        // 从列表中移除已修复的问题
        setIssues((prev) => prev.filter((i) => i.id !== issue.id))
        setSelectedIssues((prev) => {
          const newSet = new Set(prev)
          newSet.delete(issue.id)
          return newSet
        })
      } catch (error) {
        console.error('Failed to apply fix:', error)
      }
    },
    [onApplyFix]
  )

  const batchApplyFixes = useCallback(async () => {
    if (selectedIssues.size === 0) return

    const selectedFixes = issues.filter((issue) => selectedIssues.has(issue.id))
    const autoFixableIssues = selectedFixes.filter((issue) => issue.autoFixAvailable)

    if (autoFixableIssues.length === 0) {
      alert('所选问题中没有可自动修复的')
      return
    }

    setFixingAll(true)
    try {
      if (onBatchFix) {
        await onBatchFix(autoFixableIssues)
      }

      // 模拟批量修复
      await new Promise((resolve) => setTimeout(resolve, 1000))

      // 移除已修复的问题
      setIssues((prev) => prev.filter((i) => !selectedIssues.has(i.id)))
      setSelectedIssues(new Set())
      setBatchFixMode(false)
    } catch (error) {
      console.error('Failed to batch apply fixes:', error)
    } finally {
      setFixingAll(false)
    }
  }, [selectedIssues, issues, onBatchFix])

  const getIssueTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      continuity: '连续性问题',
      grammar: '语法问题',
      style: '风格问题',
      formatting: '格式问题',
      logic: '逻辑问题',
    }
    return labels[type] || type
  }

  const getIssueTypeIcon = (type: string) => {
    const icons: Record<string, any> = {
      continuity: '🔗',
      grammar: '📝',
      style: '🎨',
      formatting: '📄',
      logic: '🧠',
    }
    return icons[type] || '⚠️'
  }

  const groupedIssues = issues.reduce((acc, issue) => {
    if (!acc[issue.type]) {
      acc[issue.type] = []
    }
    acc[issue.type].push(issue)
    return acc
  }, {} as Record<string, FixIssue[]>)

  const errorCount = issues.filter((i) => i.severity === 'error').length
  const warningCount = issues.filter((i) => i.severity === 'warning').length
  const infoCount = issues.filter((i) => i.severity === 'info').length
  const autoFixableCount = issues.filter((i) => i.autoFixAvailable).length

  if (loading) {
    return (
      <div className="quick-fix bg-[#1a1a1a] rounded-lg border border-white/10 overflow-hidden p-8">
        <div className="text-center text-[#666]">加载问题列表...</div>
      </div>
    )
  }

  return (
    <div className="quick-fix bg-[#1a1a1a] rounded-lg border border-white/10 overflow-hidden">
      {/* 标题 */}
      <div className="p-3 border-b border-white/10 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Wrench className="h-4 w-4 text-[#888]" />
          <h3 className="text-sm font-medium text-white">一键修复建议</h3>
          {issues.length > 0 && (
            <div className="flex items-center gap-2 ml-2">
              {errorCount > 0 && (
                <span className="text-xs px-2 py-0.5 rounded bg-red-500/20 text-red-400">
                  {errorCount} 错误
                </span>
              )}
              {warningCount > 0 && (
                <span className="text-xs px-2 py-0.5 rounded bg-yellow-500/20 text-yellow-400">
                  {warningCount} 警告
                </span>
              )}
              {infoCount > 0 && (
                <span className="text-xs px-2 py-0.5 rounded bg-blue-500/20 text-blue-400">
                  {infoCount} 建议
                </span>
              )}
            </div>
          )}
        </div>
        <div className="flex items-center gap-2">
          {issues.length > 0 && (
            <Button
              variant={batchFixMode ? 'default' : 'ghost'}
              size="sm"
              onClick={() => {
                setBatchFixMode(!batchFixMode)
                setSelectedIssues(new Set())
              }}
              className="h-7"
            >
              <Zap className="h-3 w-3 mr-1" />
              {batchFixMode ? '取消批量' : '批量修复'}
            </Button>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={checkForIssues}
            disabled={checking}
            className="h-7"
          >
            <RefreshCw className={`h-3 w-3 mr-1 ${checking ? 'animate-spin' : ''}`} />
            {checking ? '检查中...' : '重新检查'}
          </Button>
        </div>
      </div>

      {/* 批量修复工具栏 */}
      {batchFixMode && (
        <div className="p-3 border-b border-white/10 bg-purple-500/10">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="text-xs text-purple-400">
                已选择 {selectedIssues.size} 个问题
              </div>
              <div className="text-xs text-[#888]">
                (可自动修复: {autoFixableCount} 个)
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={selectAllAutoFixable}
                className="h-7 text-xs"
              >
                全选可修复
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={clearSelection}
                className="h-7 text-xs"
              >
                清空选择
              </Button>
              {selectedIssues.size > 0 && (
                <Button
                  size="sm"
                  onClick={batchApplyFixes}
                  disabled={fixingAll}
                  className="h-7"
                >
                  <Wand2 className="h-3 w-3 mr-1" />
                  {fixingAll ? '修复中...' : '批量修复'}
                </Button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 问题列表 */}
      <div className="p-4">
        {issues.length === 0 ? (
          <div className="text-center py-8">
            <CheckCircle className="h-12 w-12 text-emerald-400 mx-auto mb-2" />
            <div className="text-sm text-white mb-1">未发现问题</div>
            <div className="text-xs text-[#666]">剧本的自动检查已全部通过</div>
          </div>
        ) : (
          <div className="space-y-3">
            {Object.entries(groupedIssues).map(([type, typeIssues]) => (
              <div key={type} className="border border-white/10 rounded-lg overflow-hidden">
                {/* 类型标题 */}
                <div
                  className="flex items-center justify-between p-3 bg-white/5 cursor-pointer hover:bg-white/10 transition-colors"
                  onClick={() => toggleType(type)}
                >
                  <div className="flex items-center gap-2">
                    <span>{getIssueTypeIcon(type)}</span>
                    <span className="text-sm font-medium text-white">
                      {getIssueTypeLabel(type)}
                    </span>
                    <span className="text-xs text-[#888]">({typeIssues.length})</span>
                  </div>
                  {expandedTypes.has(type) ? (
                    <ChevronDown className="h-4 w-4 text-[#888]" />
                  ) : (
                    <ChevronRight className="h-4 w-4 text-[#888]" />
                  )}
                </div>

                {/* 问题列表 */}
                {expandedTypes.has(type) && (
                  <div className="divide-y divide-white/5">
                    {typeIssues.map((issue) => (
                      <div
                        key={issue.id}
                        className={`p-3 ${
                          issue.severity === 'error'
                            ? 'bg-red-500/5'
                            : issue.severity === 'warning'
                            ? 'bg-yellow-500/5'
                            : 'bg-blue-500/5'
                        } ${selectedIssues.has(issue.id) ? 'ring-1 ring-purple-500' : ''}`}
                      >
                        <div className="flex items-start gap-2">
                          {batchFixMode && (
                            <div
                              className={`w-4 h-4 rounded border flex items-center justify-center cursor-pointer ${
                                selectedIssues.has(issue.id)
                                  ? 'bg-purple-500 border-purple-500'
                                  : 'border-[#666]'
                              }`}
                              onClick={() => toggleIssueSelection(issue.id)}
                            >
                              {selectedIssues.has(issue.id) && (
                                <Check className="h-3 w-3 text-white" />
                              )}
                            </div>
                          )}
                          <div className="flex-shrink-0 mt-0.5">
                            {issue.severity === 'error' ? (
                              <AlertCircle className="h-4 w-4 text-red-400" />
                            ) : issue.severity === 'warning' ? (
                              <AlertTriangle className="h-4 w-4 text-yellow-400" />
                            ) : (
                              <AlertCircle className="h-4 w-4 text-blue-400" />
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="text-sm text-white mb-1">{issue.message}</div>
                            <div className="text-xs text-[#888] mb-2">{issue.location}</div>

                            {/* 原文和修复建议 */}
                            {issue.originalText && (
                              <div className="mb-2 space-y-1">
                                <div className="text-xs text-[#888]">原文：</div>
                                <div className="p-2 bg-white/5 rounded text-xs text-red-400 border-l-2 border-red-400">
                                  {issue.originalText}
                                </div>
                              </div>
                            )}

                            <div className="space-y-1">
                              <div className="text-xs text-emerald-400">
                                {issue.autoFixAvailable ? '建议修复：' : '建议：'}
                              </div>
                              <div className="p-2 bg-white/5 rounded text-xs text-emerald-400 border-l-2 border-emerald-400">
                                {issue.suggestedFix}
                              </div>
                            </div>

                            {/* 自动修复标签 */}
                            {issue.autoFixAvailable && (
                              <div className="inline-block mt-2 px-2 py-0.5 rounded text-xs bg-emerald-500/20 text-emerald-400">
                                可自动修复
                              </div>
                            )}
                          </div>

                          {/* 操作按钮 */}
                          {!batchFixMode && (
                            <Button
                              variant={issue.autoFixAvailable ? 'default' : 'ghost'}
                              size="sm"
                              onClick={() => applyFix(issue)}
                              className="h-7"
                            >
                              <Wrench className="h-3 w-3 mr-1" />
                              {issue.autoFixAvailable ? '一键修复' : '查看'}
                            </Button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 统计信息 */}
      <div className="p-3 border-t border-white/10 bg-white/5">
        <div className="grid grid-cols-5 gap-2 text-center">
          <div>
            <div className="text-xs text-[#888]">总问题</div>
            <div className="text-sm font-bold text-white">{issues.length}</div>
          </div>
          <div>
            <div className="text-xs text-[#888]">错误</div>
            <div className="text-sm font-bold text-red-400">{errorCount}</div>
          </div>
          <div>
            <div className="text-xs text-[#888]">警告</div>
            <div className="text-sm font-bold text-yellow-400">{warningCount}</div>
          </div>
          <div>
            <div className="text-xs text-[#888]">建议</div>
            <div className="text-sm font-bold text-blue-400">{infoCount}</div>
          </div>
          <div>
            <div className="text-xs text-[#888]">可自动修复</div>
            <div className="text-sm font-bold text-emerald-400">{autoFixableCount}</div>
          </div>
        </div>
      </div>
    </div>
  )
}