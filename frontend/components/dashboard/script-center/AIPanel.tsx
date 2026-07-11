'use client'

import { useState, useEffect, useMemo } from 'react'
import type { Editor } from '@tiptap/react'
import {
  Sparkles,
  MessageSquare,
  Wand2,
  FileText,
  Send,
  Loader2,
  Check,
  X,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'

interface AIPanelProps {
  editor: Editor | null
  /** 是否已选中文字（由调用方传入，避免面板内重新订阅） */
  hasSelection?: boolean
  onGenerateScript: (params: { prompt: string; style?: string }) => Promise<void>
  onOptimizeScript: (params: { target: string; content?: string; script_id?: string }) => Promise<{ optimizedContent: string }>
  onGenerateScene: (params: { location: string; time: string }) => Promise<void>
  onGenerateDialogue: (params: { character: string; emotion: string }) => Promise<void>
}

type DiffData = { original: string; newText: string; from: number; to: number } | null

const TARGET_LABELS: Record<string, string> = {
  dialogue: '对话流畅度',
  description: '场景描述',
  pacing: '节奏张力',
  grammar: '语法表达',
  style: '整体风格',
  structure: '剧本结构',
}

// 兜底去重（与 AIBubbleMenu 一致）
function stripOriginalPrefix(newText: string, original: string): string {
  if (!newText || !original) return newText
  const o = original.trim()
  if (!o) return newText
  if (newText.startsWith(o)) return newText.slice(o.length).replace(/^\s*/, '')
  const head = o.slice(0, Math.min(8, o.length))
  if (head && newText.startsWith(head)) {
    const idx = newText.indexOf(o.slice(8))
    if (idx > 0 && idx <= 16) {
      return newText.slice(idx + o.length - 8).replace(/^\s*/, '')
    }
  }
  return newText
}

function toInsertableContent(content: string): any {
  if (!content) return null
  const lines = content.split('\n').filter((l) => l.trim())
  if (lines.length === 0) return null
  return lines.map((line) => ({
    type: 'paragraph',
    content: [{ type: 'text', text: line }],
  }))
}

export function AIPanel({
  editor,
  hasSelection = false,
  onGenerateScript,
  onOptimizeScript,
  onGenerateScene,
  onGenerateDialogue,
}: AIPanelProps) {
  const [activeTab, setActiveTab] = useState<'assistant' | 'generate' | 'optimize'>('assistant')
  const [prompt, setPrompt] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [diff, setDiff] = useState<DiffData>(null)
  const [currentAction, setCurrentAction] = useState<string>('')

  // 切换 tab 时关闭未确认的 diff
  useEffect(() => {
    setDiff(null)
  }, [activeTab])

  // 当编辑器选区变化时关闭 diff（避免位置错乱）
  useEffect(() => {
    if (!editor || !diff) return
    const handler = () => setDiff(null)
    editor.on('selectionUpdate', handler)
    return () => {
      editor.off('selectionUpdate', handler)
    }
  }, [editor, diff])

  const handleGenerate = async () => {
    if (!prompt.trim()) return
    setIsLoading(true)
    try {
      await onGenerateScript({ prompt })
      setPrompt('')
    } finally {
      setIsLoading(false)
    }
  }

  // 优化入口：选区存在则优化选区，否则优化全篇
  const handleOptimize = async (target: string) => {
    if (!editor || editor.isDestroyed) {
      // 无编辑器或编辑器已销毁：走全篇（依赖 script_id）
      setIsLoading(true)
      setCurrentAction('全篇' + (TARGET_LABELS[target] || target))
      try {
        const result = await onOptimizeScript({ target, content: '' })
        if (result.optimizedContent && editor && !editor.isDestroyed) {
          editor.commands.setContent(result.optimizedContent)
        }
      } finally {
        setIsLoading(false)
        setCurrentAction('')
      }
      return
    }

    const { from, to } = editor.state.selection
    const selectedText = from !== to ? editor.state.doc.textBetween(from, to, '') : ''

    if (selectedText) {
      // 选区模式：弹出 diff 面板
      setIsLoading(true)
      setCurrentAction('选区-' + (TARGET_LABELS[target] || target))
      try {
        const result = await onOptimizeScript({ target, content: selectedText })
        const cleaned = stripOriginalPrefix(result.optimizedContent || '', selectedText)
        if (cleaned && cleaned !== selectedText) {
          setDiff({ original: selectedText, newText: cleaned, from, to })
        } else if (result.optimizedContent && result.optimizedContent !== selectedText) {
          setDiff({ original: selectedText, newText: result.optimizedContent, from, to })
        }
      } finally {
        setIsLoading(false)
        setCurrentAction('')
      }
    } else {
      // 无选区：优化全篇，直接替换
      if (!confirm('当前未选中文字，将对整篇剧本进行优化。是否继续？')) return
      setIsLoading(true)
      setCurrentAction('全篇-' + (TARGET_LABELS[target] || target))
      try {
        const result = await onOptimizeScript({ target, content: '' })
        if (result.optimizedContent) {
          editor.commands.setContent(result.optimizedContent)
        }
      } finally {
        setIsLoading(false)
        setCurrentAction('')
      }
    }
  }

  // 接受 diff 修改
  const handleAccept = () => {
    if (!diff || !editor || editor.isDestroyed) {
      setDiff(null)
      return
    }
    const content = toInsertableContent(diff.newText)
    if (content) {
      editor.chain().focus().deleteRange({ from: diff.from, to: diff.to }).insertContent(content).run()
    }
    setDiff(null)
  }

  const handleReject = () => setDiff(null)

  return (
    <div className="ai-panel bg-[#1a1a1a] border-l border-white/10 h-full overflow-hidden flex flex-col relative">
      {/* 标题 */}
      <div className="p-3 border-b border-white/10">
        <h3 className="text-sm font-medium text-white flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-emerald-400" />
          AI 助手
        </h3>
      </div>

      {/* 标签页 */}
      <div className="border-b border-white/10">
        <div className="flex gap-1 p-1">
          <Button
            variant={activeTab === 'assistant' ? 'secondary' : 'ghost'}
            size="sm"
            onClick={() => setActiveTab('assistant')}
            className="flex-1"
          >
            <MessageSquare className="h-3 w-3 mr-1" />
            对话助手
          </Button>
          <Button
            variant={activeTab === 'generate' ? 'secondary' : 'ghost'}
            size="sm"
            onClick={() => setActiveTab('generate')}
            className="flex-1"
          >
            <Wand2 className="h-3 w-3 mr-1" />
            生成内容
          </Button>
          <Button
            variant={activeTab === 'optimize' ? 'secondary' : 'ghost'}
            size="sm"
            onClick={() => setActiveTab('optimize')}
            className="flex-1"
          >
            <FileText className="h-3 w-3 mr-1" />
            优化剧本
          </Button>
        </div>
      </div>

      {/* 内容区域 */}
      <div className="flex-1 overflow-y-auto p-3">
        {activeTab === 'assistant' && (
          <div className="space-y-3">
            <div className="text-sm text-[#888]">
              AI助手可以帮助您：
              <ul className="mt-2 space-y-1 list-disc list-inside">
                <li>生成剧本大纲</li>
                <li>编写场景描述</li>
                <li>创作角色对话</li>
                <li>优化文本内容</li>
              </ul>
            </div>
            <Textarea
              placeholder="输入您的需求或问题..."
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              className="min-h-[100px]"
            />
            <Button
              onClick={handleGenerate}
              disabled={isLoading || !prompt.trim()}
              className="w-full"
            >
              {isLoading ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Send className="h-4 w-4 mr-2" />
              )}
              发送
            </Button>
          </div>
        )}

        {activeTab === 'generate' && (
          <div className="space-y-3">
            <div className="grid gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onGenerateScript({ prompt: '生成一个悬疑剧本' })}
                className="justify-start"
              >
                <Wand2 className="h-4 w-4 mr-2" />
                生成完整剧本
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onGenerateScene({ location: '室内', time: '夜晚' })}
                className="justify-start"
              >
                <Wand2 className="h-4 w-4 mr-2" />
                生成场景描述
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onGenerateDialogue({ character: '主角', emotion: '紧张' })}
                className="justify-start"
              >
                <Wand2 className="h-4 w-4 mr-2" />
                生成角色对话
              </Button>
            </div>
            <Textarea
              placeholder="自定义生成提示..."
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              className="min-h-[80px]"
            />
            <Button
              onClick={handleGenerate}
              disabled={isLoading || !prompt.trim()}
              className="w-full"
            >
              {isLoading ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Sparkles className="h-4 w-4 mr-2" />
              )}
              生成
            </Button>
          </div>
        )}

        {activeTab === 'optimize' && (
          <div className="space-y-3">
            <div className="text-xs text-[#888] bg-white/5 rounded p-2">
              {hasSelection
                ? '✓ 已选中文字，将只优化选区内容'
                : '未选中文本，将对整篇剧本优化（点击前请先在编辑器中选中目标段落）'}
            </div>
            <div className="text-sm text-[#888]">选择优化目标：</div>
            <div className="grid gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleOptimize('dialogue')}
                disabled={isLoading}
                className="justify-start"
              >
                优化对话流畅度
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleOptimize('description')}
                disabled={isLoading}
                className="justify-start"
              >
                增强场景描述
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleOptimize('pacing')}
                disabled={isLoading}
                className="justify-start"
              >
                调整节奏和张力
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleOptimize('grammar')}
                disabled={isLoading}
                className="justify-start"
              >
                修正语法和表达
              </Button>
            </div>
            {isLoading && (
              <div className="text-xs text-emerald-400 flex items-center gap-2">
                <Loader2 className="h-3 w-3 animate-spin" />
                {currentAction}中...
              </div>
            )}
          </div>
        )}
      </div>

      {/* 浮动 diff 面板（覆盖在面板上方） */}
      {diff && (
        <div className="absolute inset-0 z-10 bg-[#1a1a1a] flex flex-col">
          <div className="flex items-center justify-between p-3 border-b border-white/10">
            <div className="text-sm font-medium text-white">AI 修改对比</div>
            <button
              type="button"
              onClick={handleReject}
              className="text-gray-400 hover:text-white"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-3 text-xs leading-relaxed whitespace-pre-wrap break-words">
            <div className="mb-2 text-[#888]">原文：</div>
            <div className="bg-red-500/10 text-red-300 line-through rounded p-2 mb-3">
              {diff.original}
            </div>
            <div className="mb-2 text-[#888]">改写后：</div>
            <div className="bg-green-500/10 text-green-300 rounded p-2">
              {diff.newText}
            </div>
          </div>
          <div className="flex items-center justify-end gap-2 p-3 border-t border-white/10">
            <Button variant="ghost" size="sm" onClick={handleReject}>
              <X className="h-3 w-3 mr-1" />
              拒绝
            </Button>
            <Button variant="default" size="sm" onClick={handleAccept}>
              <Check className="h-3 w-3 mr-1" />
              接受
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
