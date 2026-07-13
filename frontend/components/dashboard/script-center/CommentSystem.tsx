'use client'

import { useState, useCallback, useEffect, useMemo } from 'react'
import {
  MessageSquare,
  Reply,
  CheckCircle,
  Trash2,
  User,
  Plus,
  X,
  Send,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { scriptCenterService, type ScriptComment as ApiComment } from '@/services/script-center.service'
import { toast } from '@/components/common/toast'

/** 编辑器 UI 用的评论（包含子级回复）。 */
interface Comment {
  id: string
  text: string
  selectedText: string
  position: {
    from: number
    to: number
  }
  author: string
  authorId: string
  timestamp: string
  status: 'active' | 'resolved'
  replies: Reply[]
}

/** 编辑器 UI 用的回复。 */
interface Reply {
  id: string
  text: string
  author: string
  authorId: string
  timestamp: string
}

interface CommentSystemProps {
  scriptId: string
  selectedText?: string
  selectionPosition?: { from: number; to: number }
}

/** 把后端 ScriptComment 拍平为 UI 用的树（顶层 + replies）。 */
function groupApiCommentsToTree(list: ApiComment[]): Comment[] {
  const byId = new Map<string, Comment>()
  for (const c of list) {
    byId.set(c.id, {
      id: c.id,
      text: c.content,
      selectedText: c.selected_text,
      position: { from: c.position_from, to: c.position_to },
      author: c.user_name,
      authorId: c.user_name,
      timestamp: c.created_at,
      status: c.resolved ? 'resolved' : 'active',
      replies: [],
    })
  }
  const roots: Comment[] = []
  for (const c of list) {
    const node = byId.get(c.id)!
    if (c.parent_id && byId.has(c.parent_id)) {
      byId.get(c.parent_id)!.replies.push(node as unknown as Reply)
    } else {
      roots.push(node)
    }
  }
  return roots
}

export function CommentSystem({
  scriptId,
  selectedText,
  selectionPosition,
}: CommentSystemProps) {
  const [comments, setComments] = useState<Comment[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [showAddComment, setShowAddComment] = useState(false)
  const [newCommentText, setNewCommentText] = useState('')
  const [replyingTo, setReplyingTo] = useState<string | null>(null)
  const [replyText, setReplyText] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [filter, setFilter] = useState<'all' | 'active' | 'resolved'>('all')

  // 加载评论列表（任务8：刷新不丢失）
  useEffect(() => {
    if (!scriptId) return
    let cancelled = false
    const load = async () => {
      setIsLoading(true)
      try {
        const list = await scriptCenterService.getComments(scriptId)
        if (!cancelled) {
          setComments(groupApiCommentsToTree(list))
        }
      } catch (err) {
        if (!cancelled) {
          toast.error('加载评论失败', (err as Error).message)
        }
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [scriptId])

  // 添加顶层评论
  const handleAddComment = useCallback(async () => {
    if (!newCommentText.trim() || !selectedText || !selectionPosition) return
    if (!scriptId) return

    setIsSubmitting(true)
    try {
      await scriptCenterService.createComment({
        script_id: scriptId,
        content: newCommentText,
        user_name: '当前用户',
        selected_text: selectedText,
        position_from: selectionPosition.from,
        position_to: selectionPosition.to,
      })
      // 重新拉取以保证后端权威字段一致
      const list = await scriptCenterService.getComments(scriptId)
      setComments(groupApiCommentsToTree(list))
      setNewCommentText('')
      setShowAddComment(false)
      toast.success('评论已添加')
    } catch (err) {
      toast.error('添加评论失败', (err as Error).message)
    } finally {
      setIsSubmitting(false)
    }
  }, [newCommentText, selectedText, selectionPosition, scriptId])

  // 添加回复
  const handleAddReply = useCallback(
    async (commentId: string) => {
      if (!replyText.trim() || !scriptId) return
      setIsSubmitting(true)
      try {
        await scriptCenterService.createComment({
          script_id: scriptId,
          content: replyText,
          user_name: '当前用户',
          parent_id: commentId,
        })
        const list = await scriptCenterService.getComments(scriptId)
        setComments(groupApiCommentsToTree(list))
        setReplyText('')
        setReplyingTo(null)
        toast.success('回复已添加')
      } catch (err) {
        toast.error('添加回复失败', (err as Error).message)
      } finally {
        setIsSubmitting(false)
      }
    },
    [replyText, scriptId]
  )

  // 标记为已解决
  const handleResolveComment = useCallback(
    async (commentId: string) => {
      if (!scriptId) return
      try {
        await scriptCenterService.updateComment(commentId, { resolved: true })
        const list = await scriptCenterService.getComments(scriptId)
        setComments(groupApiCommentsToTree(list))
        toast.success('评论已解决')
      } catch (err) {
        toast.error('操作失败', (err as Error).message)
      }
    },
    [scriptId]
  )

  // 删除评论（带确认）
  const handleDeleteComment = useCallback(
    async (commentId: string) => {
      if (!scriptId) return
      const ok = typeof window === 'undefined' || window.confirm('确定要删除这条评论吗？回复也会一并删除。')
      if (!ok) return
      try {
        await scriptCenterService.deleteComment(commentId)
        // 顺带清理孤儿回复（前端兜底）
        const list = await scriptCenterService.getComments(scriptId)
        setComments(groupApiCommentsToTree(list))
        toast.success('评论已删除')
      } catch (err) {
        toast.error('删除失败', (err as Error).message)
      }
    },
    [scriptId]
  )

  const filteredComments = useMemo(
    () => comments.filter((c) => (filter === 'all' ? true : c.status === filter)),
    [comments, filter]
  )

  const activeCount = comments.filter((c) => c.status === 'active').length
  const resolvedCount = comments.filter((c) => c.status === 'resolved').length

  return (
    <div className="comment-system bg-[#1a1a1a] rounded-lg border border-white/10 overflow-hidden h-full flex flex-col">
      {/* 标题 */}
      <div className="p-3 border-b border-white/10 flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-2">
          <MessageSquare className="h-4 w-4 text-[#888]" />
          <h3 className="text-sm font-medium text-white">评论与批注</h3>
          <span className="text-xs text-[#666]">({comments.length})</span>
        </div>
        {selectedText && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowAddComment(true)}
            className="h-7"
          >
            <Plus className="h-3 w-3 mr-1" />
            添加评论
          </Button>
        )}
      </div>

      {/* 过滤器 */}
      <div className="p-2 border-b border-white/10 flex gap-2 flex-shrink-0">
        <button
          onClick={() => setFilter('all')}
          className={`text-xs px-2 py-1 rounded ${
            filter === 'all'
              ? 'bg-white/10 text-white'
              : 'text-[#888] hover:text-white'
          }`}
        >
          全部 ({comments.length})
        </button>
        <button
          onClick={() => setFilter('active')}
          className={`text-xs px-2 py-1 rounded ${
            filter === 'active'
              ? 'bg-blue-500/20 text-blue-400'
              : 'text-[#888] hover:text-white'
          }`}
        >
          活跃 ({activeCount})
        </button>
        <button
          onClick={() => setFilter('resolved')}
          className={`text-xs px-2 py-1 rounded ${
            filter === 'resolved'
              ? 'bg-emerald-500/20 text-emerald-400'
              : 'text-[#888] hover:text-white'
          }`}
        >
          已解决 ({resolvedCount})
        </button>
      </div>

      {/* 添加评论对话框 */}
      {showAddComment && selectedText && (
        <div className="p-3 border-b border-white/10 bg-blue-500/5 flex-shrink-0">
          <div className="flex items-center justify-between mb-2">
            <div className="text-xs text-[#888]">选中文字：</div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowAddComment(false)}
              className="h-5 w-5 p-0"
            >
              <X className="h-3 w-3" />
            </Button>
          </div>
          <div className="bg-white/5 p-2 rounded mb-2 text-xs text-white border border-white/10">
            {selectedText}
          </div>
          <textarea
            value={newCommentText}
            onChange={(e) => setNewCommentText(e.target.value)}
            placeholder="输入评论内容..."
            className="w-full bg-white/5 border border-white/10 rounded p-2 text-sm text-white resize-none"
            rows={3}
          />
          <div className="flex justify-end gap-2 mt-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowAddComment(false)}
              className="h-7"
            >
              取消
            </Button>
            <Button
              size="sm"
              onClick={handleAddComment}
              disabled={isSubmitting || !newCommentText.trim()}
              className="h-7"
            >
              <Send className="h-3 w-3 mr-1" />
              提交
            </Button>
          </div>
        </div>
      )}

      {/* 评论列表 */}
      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="text-center py-8 text-[#666] text-sm">加载中...</div>
        ) : filteredComments.length === 0 ? (
          <div className="text-center py-8 text-[#666] text-sm">
            {filter === 'all' ? '暂无评论' : `暂无${filter === 'active' ? '活跃' : '已解决'}评论`}
          </div>
        ) : (
          <div className="divide-y divide-white/5">
            {filteredComments.map((comment) => (
              <div
                key={comment.id}
                className={`p-3 ${
                  comment.status === 'resolved' ? 'opacity-60' : ''
                }`}
              >
                {/* 选中的文本 */}
                <div className="bg-white/5 p-2 rounded mb-2 text-xs text-white border-l-2 border-blue-500">
                  {comment.selectedText}
                </div>

                {/* 评论内容 */}
                <div className="flex items-start gap-2 mb-2">
                  <div className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-500/20 flex items-center justify-center">
                    <User className="h-3 w-3 text-blue-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm font-medium text-white">
                        {comment.author}
                      </span>
                      <span className="text-xs text-[#666]">
                        {new Date(comment.timestamp).toLocaleString()}
                      </span>
                    </div>
                    <div className="text-sm text-white">{comment.text}</div>
                  </div>
                </div>

                {/* 回复列表 */}
                {comment.replies.length > 0 && (
                  <div className="ml-8 space-y-2 mb-2">
                    {comment.replies.map((reply) => (
                      <div key={reply.id} className="flex items-start gap-2">
                        <div className="flex-shrink-0 w-5 h-5 rounded-full bg-white/5 flex items-center justify-center">
                          <User className="h-2.5 w-2.5 text-[#888]" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-xs font-medium text-white">
                              {reply.author}
                            </span>
                            <span className="text-xs text-[#666]">
                              {new Date(reply.timestamp).toLocaleString()}
                            </span>
                          </div>
                          <div className="text-xs text-white">{reply.text}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* 回复输入框 */}
                {replyingTo === comment.id && (
                  <div className="ml-8 mb-2">
                    <textarea
                      value={replyText}
                      onChange={(e) => setReplyText(e.target.value)}
                      placeholder="输入回复..."
                      className="w-full bg-white/5 border border-white/10 rounded p-2 text-xs text-white resize-none"
                      rows={2}
                    />
                    <div className="flex justify-end gap-2 mt-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setReplyingTo(null)
                          setReplyText('')
                        }}
                        className="h-6 text-xs"
                      >
                        取消
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => handleAddReply(comment.id)}
                        disabled={isSubmitting || !replyText.trim()}
                        className="h-6 text-xs"
                      >
                        回复
                      </Button>
                    </div>
                  </div>
                )}

                {/* 操作按钮 */}
                <div className="flex items-center gap-2 ml-8">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setReplyingTo(comment.id)}
                    disabled={replyingTo === comment.id}
                    className="h-6 text-xs"
                  >
                    <Reply className="h-3 w-3 mr-1" />
                    回复
                  </Button>
                  {comment.status === 'active' && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleResolveComment(comment.id)}
                      className="h-6 text-xs text-emerald-400 hover:text-emerald-300"
                    >
                      <CheckCircle className="h-3 w-3 mr-1" />
                      解决
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDeleteComment(comment.id)}
                    className="h-6 text-xs text-red-400 hover:text-red-300"
                  >
                    <Trash2 className="h-3 w-3 mr-1" />
                    删除
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
