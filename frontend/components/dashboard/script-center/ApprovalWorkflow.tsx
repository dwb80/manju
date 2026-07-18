'use client'

/**
 * @file ApprovalWorkflow.tsx
 * @description 审批流程组件，展示剧本审批的多步骤流程状态，支持通过/拒绝操作
 */

import { useState, useEffect } from 'react'
import {
  GitBranch,
  CheckCircle,
  AlertCircle,
  Clock,
  User,
  MessageSquare,
  ArrowRight,
  Loader,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { scriptCenterService } from '@/services/script-center.service'

interface WorkflowStep {
  id: string
  name: string
  order: number
  status: 'pending' | 'approved' | 'rejected'
  approver?: string
  comment?: string
  timestamp?: string
}

interface ApprovalWorkflowProps {
  scriptId: string
  onWorkflowUpdate?: () => void
}

/**
 * ApprovalWorkflow - 审批流程组件
 * @param {ApprovalWorkflowProps} props - 组件属性
 * @param {string} props.scriptId - 剧本ID
 * @param {Function} [props.onWorkflowUpdate] - 流程更新回调
 * @returns {JSX.Element} 渲染的审批流程界面
 */
export function ApprovalWorkflow({ scriptId, onWorkflowUpdate }: ApprovalWorkflowProps) {
  const [workflow, setWorkflow] = useState<{
    steps: WorkflowStep[]
    currentStep: number
  } | null>(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [selectedAction, setSelectedAction] = useState<'approve' | 'reject' | null>(null)
  const [comment, setComment] = useState('')
  const [showCommentInput, setShowCommentInput] = useState(false)

  useEffect(() => {
    loadWorkflow()
  }, [scriptId])

  const loadWorkflow = async () => {
    try {
      const result = await scriptCenterService.getApprovalWorkflow(scriptId)
      setWorkflow(result)
    } catch (error) {
      console.error('Failed to load workflow:', error)
    } finally {
      setLoading(false)
    }
  }

  const performAction = async (stepId: string, action: 'approve' | 'reject') => {
    if (action === 'reject' && !comment.trim()) {
      setShowCommentInput(true)
      setSelectedAction(action)
      return
    }

    setSubmitting(true)
    try {
      await scriptCenterService.performApprovalAction(scriptId, stepId, action, comment)
      await loadWorkflow()
      onWorkflowUpdate?.()
      setComment('')
      setShowCommentInput(false)
      setSelectedAction(null)
    } catch (error) {
      console.error('Failed to perform action:', error)
    } finally {
      setSubmitting(false)
    }
  }

  const getStepStatusIcon = (status: string) => {
    switch (status) {
      case 'approved':
        return <CheckCircle className="h-5 w-5 text-emerald-400" />
      case 'rejected':
        return <AlertCircle className="h-5 w-5 text-red-400" />
      case 'pending':
        return <Clock className="h-5 w-5 text-yellow-400" />
      default:
        return <Clock className="h-5 w-5 text-[#888]" />
    }
  }

  const getStepStatusColor = (status: string) => {
    switch (status) {
      case 'approved':
        return 'bg-emerald-500/10 border-emerald-500/20'
      case 'rejected':
        return 'bg-red-500/10 border-red-500/20'
      case 'pending':
        return 'bg-yellow-500/10 border-yellow-500/20'
      default:
        return 'bg-white/5 border-white/10'
    }
  }

  if (loading) {
    return (
      <div className="approval-workflow bg-[#1a1a1a] rounded-lg border border-white/10 overflow-hidden p-8">
        <div className="text-center text-[#666]">加载中...</div>
      </div>
    )
  }

  if (!workflow) {
    return (
      <div className="approval-workflow bg-[#1a1a1a] rounded-lg border border-white/10 overflow-hidden p-8">
        <div className="text-center">
          <AlertCircle className="h-12 w-12 text-[#888] mx-auto mb-2" />
          <div className="text-sm text-white mb-1">未设置审批流程</div>
          <div className="text-xs text-[#666]">请先配置审批流程</div>
        </div>
      </div>
    )
  }

  return (
    <div className="approval-workflow bg-[#1a1a1a] rounded-lg border border-white/10 overflow-hidden">
      {/* 标题 */}
      <div className="p-3 border-b border-white/10 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <GitBranch className="h-4 w-4 text-[#888]" />
          <h3 className="text-sm font-medium text-white">审批流程</h3>
        </div>
        <div className="text-xs text-[#888]">
          当前步骤: {workflow.currentStep + 1}/{workflow.steps.length}
        </div>
      </div>

      {/* 流程步骤 */}
      <div className="p-4">
        <div className="space-y-2">
          {workflow.steps.map((step, index) => {
            const isCurrentStep = index === workflow.currentStep
            const isCompleted = step.status === 'approved' || step.status === 'rejected'

            return (
              <div key={step.id} className="relative">
                {/* 连接线 */}
                {index < workflow.steps.length - 1 && (
                  <div className="absolute left-6 top-12 bottom-0 w-0.5 bg-white/10" />
                )}

                {/* 步骤卡片 */}
                <div
                  className={`border rounded-lg p-3 ${getStepStatusColor(step.status)} ${isCurrentStep ? 'ring-2 ring-blue-500/50' : ''
                    }`}
                >
                  <div className="flex items-start gap-3">
                    {/* 状态图标 */}
                    {getStepStatusIcon(step.status)}

                    {/* 步骤信息 */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-sm font-medium text-white">{step.name}</span>
                        {isCurrentStep && step.status === 'pending' && (
                          <span className="text-xs px-2 py-0.5 rounded bg-blue-500/20 text-blue-400">
                            当前
                          </span>
                        )}
                      </div>

                      {step.approver && (
                        <div className="flex items-center gap-1 text-xs text-[#888] mb-1">
                          <User className="h-3 w-3" />
                          {step.approver}
                        </div>
                      )}

                      {step.timestamp && (
                        <div className="text-xs text-[#666]">
                          {new Date(step.timestamp).toLocaleString()}
                        </div>
                      )}

                      {step.comment && (
                        <div className="mt-2 p-2 bg-white/5 rounded">
                          <div className="flex items-center gap-1 text-xs text-[#888] mb-1">
                            <MessageSquare className="h-3 w-3" />
                            审批意见
                          </div>
                          <div className="text-sm text-white">{step.comment}</div>
                        </div>
                      )}
                    </div>

                    {/* 操作按钮 (仅当前步骤且状态为pending) */}
                    {isCurrentStep && step.status === 'pending' && (
                      <div className="flex gap-1">
                        <Button
                          variant="default"
                          size="sm"
                          onClick={() => performAction(step.id, 'approve')}
                          disabled={submitting}
                          className="h-7"
                        >
                          {submitting ? (
                            <Loader className="h-3 w-3 animate-spin" />
                          ) : (
                            <CheckCircle className="h-3 w-3 mr-1" />
                          )}
                          通过
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => performAction(step.id, 'reject')}
                          disabled={submitting}
                          className="h-7 text-red-400 hover:text-red-300"
                        >
                          <AlertCircle className="h-3 w-3 mr-1" />
                          拒绝
                        </Button>
                      </div>
                    )}
                  </div>
                </div>

                {/* 评论输入框 (拒绝时) */}
                {showCommentInput && selectedAction === 'reject' && isCurrentStep && (
                  <div className="mt-2 p-3 bg-white/5 rounded-lg border border-white/10">
                    <div className="text-xs text-[#888] mb-2">请填写拒绝原因</div>
                    <Input
                      value={comment}
                      onChange={(e) => setComment(e.target.value)}
                      placeholder="输入拒绝原因..."
                      className="h-8 text-sm mb-2"
                    />
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        onClick={() => performAction(step.id, 'reject')}
                        disabled={!comment.trim() || submitting}
                        className="h-7"
                      >
                        确认拒绝
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setShowCommentInput(false)
                          setSelectedAction(null)
                          setComment('')
                        }}
                        className="h-7"
                      >
                        取消
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* 流程进度 */}
      <div className="p-3 border-t border-white/10 bg-white/5">
        <div className="flex items-center gap-2 mb-2">
          <div className="flex-1">
            <div className="flex items-center justify-between text-xs text-[#888] mb-1">
              <span>审批进度</span>
              <span>
                {workflow.steps.filter((s) => s.status === 'approved').length}/
                {workflow.steps.length}
              </span>
            </div>
            <div className="w-full bg-white/10 rounded-full h-2">
              <div
                className="bg-emerald-400 h-2 rounded-full transition-all"
                style={{
                  width: `${(workflow.steps.filter((s) => s.status === 'approved').length / workflow.steps.length) * 100}%`,
                }}
              />
            </div>
          </div>
        </div>
        <div className="flex items-center justify-between text-xs">
          <div className="flex items-center gap-1 text-emerald-400">
            <CheckCircle className="h-3 w-3" />
            {workflow.steps.filter((s) => s.status === 'approved').length} 已通过
          </div>
          <div className="flex items-center gap-1 text-yellow-400">
            <Clock className="h-3 w-3" />
            {workflow.steps.filter((s) => s.status === 'pending').length} 待处理
          </div>
          <div className="flex items-center gap-1 text-red-400">
            <AlertCircle className="h-3 w-3" />
            {workflow.steps.filter((s) => s.status === 'rejected').length} 已拒绝
          </div>
        </div>
      </div>
    </div>
  )
}