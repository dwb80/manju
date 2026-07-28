'use client'

/**
 * @file ContinuityCheck.tsx
 * @description 连续性检查组件，检测剧本中角色、场景、时间线、道具的连续性问题
 */

import { useState, useEffect } from 'react'
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle,
  RefreshCw,
  ChevronDown,
  ChevronRight,
  Wrench,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { scriptCenterService } from '@/services/script-center.service'

interface Issue {
  type: 'character' | 'scene' | 'timeline' | 'prop'
  severity: 'error' | 'warning'
  message: string
  location: string
  suggestion?: string
}

interface ContinuityCheckProps {
  scriptId: string
  onFixIssue?: (issue: Issue) => void
}

/**
 * ContinuityCheck - 连续性检查组件
 * @param {ContinuityCheckProps} props - 组件属性
 * @param {string} props.scriptId - 剧本ID
 * @param {Function} [props.onFixIssue] - 修复问题回调
 * @returns {JSX.Element} 渲染的连续性检查界面
 */
export function ContinuityCheck({ scriptId, onFixIssue }: ContinuityCheckProps) {
  const [issues, setIssues] = useState<Issue[]>([])
  const [loading, setLoading] = useState(true)
  const [checking, setChecking] = useState(false)
  const [expandedTypes, setExpandedTypes] = useState<Set<string>>(new Set(['character', 'scene']))

  useEffect(() => {
    checkContinuity()
  }, [scriptId])

  const checkContinuity = async () => {
    setChecking(true)
    try {
      const result = await scriptCenterService.checkContinuity(scriptId)
      setIssues(result.issues)
    } catch (error) {
      console.error('Failed to check continuity:', error)
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

  const getIssueTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      character: '角色一致性',
      scene: '场景一致性',
      timeline: '时间线',
      prop: '道具一致性',
    }
    return labels[type] || type
  }

  const getIssueTypeIcon = (type: string) => {
    const icons: Record<string, any> = {
      character: '👤',
      scene: '🎬',
      timeline: '⏱️',
      prop: '🎭',
    }
    return icons[type] || '⚠️'
  }

  const groupedIssues = issues.reduce((acc, issue) => {
    if (!acc[issue.type]) {
      acc[issue.type] = []
    }
    acc[issue.type].push(issue)
    return acc
  }, {} as Record<string, Issue[]>)

  const errorCount = issues.filter((i) => i.severity === 'error').length
  const warningCount = issues.filter((i) => i.severity === 'warning').length

  if (loading) {
    return (
      <div className="continuity-check bg-card rounded-lg border border-border overflow-hidden p-8">
        <div className="text-center text-muted-foreground">加载中...</div>
      </div>
    )
  }

  return (
    <div className="continuity-check bg-card rounded-lg border border-border overflow-hidden">
      {/* 标题 */}
      <div className="p-3 border-b border-border flex items-center justify-between">
        <div className="flex items-center gap-2">
          <AlertCircle className="h-4 w-4 text-muted-foreground" />
          <h3 className="text-sm font-medium text-foreground">连续性检查</h3>
          {issues.length > 0 && (
            <div className="flex items-center gap-2 ml-2">
              {errorCount > 0 && (
                <span className="text-xs px-2 py-0.5 rounded bg-destructive/20 text-destructive">
                  {errorCount} 错误
                </span>
              )}
              {warningCount > 0 && (
                <span className="text-xs px-2 py-0.5 rounded bg-chart-5/20 text-chart-5">
                  {warningCount} 警告
                </span>
              )}
            </div>
          )}
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={checkContinuity}
          disabled={checking}
          className="h-7"
        >
          <RefreshCw className={`h-3 w-3 mr-1 ${checking ? 'animate-spin' : ''}`} />
          {checking ? '检查中...' : '重新检查'}
        </Button>
      </div>

      {/* 问题列表 */}
      <div className="p-4">
        {issues.length === 0 ? (
          <div className="text-center py-8">
            <CheckCircle className="h-12 w-12 text-primary mx-auto mb-2" />
            <div className="text-sm text-foreground mb-1">未发现连续性问题</div>
            <div className="text-xs text-muted-foreground">剧本的连续性检查已通过</div>
          </div>
        ) : (
          <div className="space-y-3">
            {Object.entries(groupedIssues).map(([type, typeIssues]) => (
              <div key={type} className="border border-border rounded-lg overflow-hidden">
                {/* 类型标题 */}
                <div
                  className="flex items-center justify-between p-3 bg-muted/50 cursor-pointer hover:bg-muted transition-colors"
                  onClick={() => toggleType(type)}
                >
                  <div className="flex items-center gap-2">
                    <span>{getIssueTypeIcon(type)}</span>
                    <span className="text-sm font-medium text-foreground">
                      {getIssueTypeLabel(type)}
                    </span>
                    <span className="text-xs text-muted-foreground">({typeIssues.length})</span>
                  </div>
                  {expandedTypes.has(type) ? (
                    <ChevronDown className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  )}
                </div>

                {/* 问题列表 */}
                {expandedTypes.has(type) && (
                  <div className="divide-y divide-white/5">
                    {typeIssues.map((issue, index) => (
                      <div
                        key={index}
                        className={`p-3 ${issue.severity === 'error' ? 'bg-destructive/5' : 'bg-chart-5/5'
                          }`}
                      >
                        <div className="flex items-start gap-2">
                          {issue.severity === 'error' ? (
                            <AlertCircle className="h-4 w-4 text-destructive flex-shrink-0 mt-0.5" />
                          ) : (
                            <AlertTriangle className="h-4 w-4 text-chart-5 flex-shrink-0 mt-0.5" />
                          )}
                          <div className="flex-1 min-w-0">
                            <div className="text-sm text-foreground mb-1">{issue.message}</div>
                            <div className="text-xs text-muted-foreground mb-2">{issue.location}</div>
                            {issue.suggestion && (
                              <div className="flex items-start gap-2 bg-muted/50 p-2 rounded">
                                <Wrench className="h-3 w-3 text-primary flex-shrink-0 mt-0.5" />
                                <div className="text-xs text-primary">
                                  {issue.suggestion}
                                </div>
                              </div>
                            )}
                          </div>
                          {onFixIssue && issue.suggestion && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => onFixIssue(issue)}
                              className="h-6 px-2 text-xs"
                            >
                              修复
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
      <div className="p-3 border-t border-border bg-muted/50">
        <div className="grid grid-cols-4 gap-2 text-center">
          <div>
            <div className="text-xs text-muted-foreground">角色问题</div>
            <div className="text-sm font-bold text-foreground">
              {groupedIssues['character']?.length || 0}
            </div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground">场景问题</div>
            <div className="text-sm font-bold text-foreground">
              {groupedIssues['scene']?.length || 0}
            </div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground">时间线问题</div>
            <div className="text-sm font-bold text-foreground">
              {groupedIssues['timeline']?.length || 0}
            </div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground">道具问题</div>
            <div className="text-sm font-bold text-foreground">
              {groupedIssues['prop']?.length || 0}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
