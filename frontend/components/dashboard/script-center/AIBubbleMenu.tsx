/**
 * @file AIBubbleMenu.tsx
 * @description AI气泡菜单组件，选中文本时显示AI优化、扩写、缩写等快捷操作
 */
'use client'

import { useState } from 'react'
import { BubbleMenu } from '@tiptap/react'
import type { Editor } from '@tiptap/react'
import { scriptCenterService } from '@/services/script-center.service'
import { createCharacter, createScene } from '@/services/module.service'
import { toast } from '@/components/common/toast'
import { AIDiffView } from './AIDiffView'

interface AIBubbleMenuProps {
  editor: Editor | null
}

// 将 AI 返回内容（字符串/数组/doc 对象）转换为可插入编辑器的内容
function toInsertableContent(content: any): any {
  if (!content) return null
  if (typeof content === 'string') {
    const lines = content.split('\n').filter((l) => l.trim())
    if (lines.length === 0) return null
    // 始终返回段落节点数组，确保 insertContent 能正确插入
    return lines.map((line) => ({
      type: 'paragraph',
      content: [{ type: 'text', text: line }],
    }))
  }
  if (Array.isArray(content)) return content
  if (content.type === 'doc' && Array.isArray(content.content)) return content.content
  return content
}

/**
 * 兜底去重：AI 有时会复读原文再继续写（"原文 + 续写"）。
 * 检测 newText 是否以 original 开头，是则去除该前缀，避免替换选区后出现重复。
 * 允许最多 8 个字符的容差（应对空格/标点差异）。
 */
function stripOriginalPrefix(newText: string, original: string): string {
  if (!newText || !original) return newText
  const o = original.trim()
  if (!o) return newText
  if (newText.startsWith(o)) return newText.slice(o.length).replace(/^\s*/, '')
  // 容差匹配：前 8 个字符命中即视为以原文开头
  const head = o.slice(0, Math.min(8, o.length))
  if (head && newText.startsWith(head)) {
    const idx = newText.indexOf(o.slice(8))
    if (idx > 0 && idx <= 16) {
      return newText.slice(idx + o.length - 8).replace(/^\s*/, '')
    }
  }
  return newText
}

// 将 AI 返回内容（字符串/数组/doc 对象）转换为纯文本，用于 diff 对比
function nodeToText(node: any): string {
  if (!node) return ''
  if (typeof node.text === 'string') return node.text
  if (Array.isArray(node.content)) {
    return node.content.map((child: any) => nodeToText(child)).join('')
  }
  return ''
}

function contentToText(content: any): string {
  if (!content) return ''
  if (typeof content === 'string') return content
  let blocks: any[]
  if (Array.isArray(content)) {
    blocks = content
  } else if (content.type === 'doc' && Array.isArray(content.content)) {
    blocks = content.content
  } else {
    blocks = [content]
  }
  return blocks.map((block: any) => nodeToText(block)).join('\n')
}

export function AIBubbleMenu({ editor }: AIBubbleMenuProps) {
  const [loadingAction, setLoadingAction] = useState<string | null>(null)
  const [diffView, setDiffView] = useState<{
    original: string
    newText: string
    from: number
    to: number
  } | null>(null)

  if (!editor) return null

  const getSelectionText = () => {
    const { from, to } = editor.state.selection
    return {
      from,
      to,
      selectedText: editor.state.doc.textBetween(from, to, ''),
    }
  }

  const replaceRange = (from: number, to: number, content: any) => {
    editor.chain().focus().deleteRange({ from, to }).insertContent(content).run()
  }

  // 接受 AI 修改：替换选区为新内容
  const handleAccept = () => {
    if (!diffView) return
    // 兜底：若 AI 复读了原文，去除 newText 头部重复部分
    const cleaned = stripOriginalPrefix(diffView.newText, diffView.original)
    const content = toInsertableContent(cleaned)
    if (content && !editor.isDestroyed) {
      editor
        .chain()
        .focus()
        .deleteRange({ from: diffView.from, to: diffView.to })
        .insertContent(content)
        .run()
    }
    setDiffView(null)
  }

  // 拒绝 AI 修改：原文未改动，直接关闭 diff 视图
  const handleReject = () => setDiffView(null)

  // 1. AI优化
  const handleOptimize = async () => {
    const { from, to, selectedText } = getSelectionText()
    if (!selectedText || from === to) {
      toast.error('请先选中内容')
      return
    }
    setLoadingAction('optimize')
    try {
      const result = await scriptCenterService.optimizeScript({
        content: selectedText,
        optimization_type: 'style',
      })
      const newText = contentToText(result.optimizedContent)
      if (newText && !editor.isDestroyed) {
        setDiffView({ original: selectedText, newText, from, to })
      } else {
        toast.error('优化结果为空')
      }
    } catch (e) {
      toast.error('优化失败：' + (e instanceof Error ? e.message : '未知错误'))
    } finally {
      setLoadingAction(null)
    }
  }

  // 2. AI扩写
  const handleExpand = async () => {
    const { from, to, selectedText } = getSelectionText()
    if (!selectedText || from === to) {
      toast.error('请先选中内容')
      return
    }
    setLoadingAction('expand')
    try {
      const result = await scriptCenterService.generateScript({
        prompt: `请扩写以下剧本内容，保持原有风格并丰富细节：\n\n${selectedText}`,
        style: 'detailed',
      })
      const newText = contentToText(result.content)
      if (newText && !editor.isDestroyed) {
        setDiffView({ original: selectedText, newText, from, to })
      } else {
        toast.error('扩写结果为空')
      }
    } catch (e) {
      toast.error('扩写失败：' + (e instanceof Error ? e.message : '未知错误'))
    } finally {
      setLoadingAction(null)
    }
  }

  // 3. AI缩写
  const handleShrink = async () => {
    const { from, to, selectedText } = getSelectionText()
    if (!selectedText || from === to) {
      toast.error('请先选中内容')
      return
    }
    setLoadingAction('shrink')
    try {
      const result = await scriptCenterService.generateScript({
        prompt: `请缩写以下剧本内容，保留核心情节：\n\n${selectedText}`,
        style: 'concise',
        length: Math.floor(selectedText.length * 0.5),
      })
      const newText = contentToText(result.content)
      if (newText && !editor.isDestroyed) {
        setDiffView({ original: selectedText, newText, from, to })
      } else {
        toast.error('缩写结果为空')
      }
    } catch (e) {
      toast.error('缩写失败：' + (e instanceof Error ? e.message : '未知错误'))
    } finally {
      setLoadingAction(null)
    }
  }

  // 4. 生成提示词
  const handleGeneratePrompt = async () => {
    const { from, to, selectedText } = getSelectionText()
    if (!selectedText || from === to) {
      toast.error('请先选中内容')
      return
    }
    setLoadingAction('prompt')
    try {
      const result = await scriptCenterService.generateScript({
        prompt: `为以下剧本内容生成AI图片/视频提示词，输出英文提示词：\n\n${selectedText}`,
      })
      const newText = contentToText(result.content)
      if (newText && !editor.isDestroyed) {
        setDiffView({ original: selectedText, newText, from, to })
      } else {
        toast.error('生成结果为空')
      }
    } catch (e) {
      toast.error('生成提示词失败：' + (e instanceof Error ? e.message : '未知错误'))
    } finally {
      setLoadingAction(null)
    }
  }

  // 5. 生成分镜
  const handleSplitStoryboard = async () => {
    const { from, to, selectedText } = getSelectionText()
    if (!selectedText || from === to) {
      toast.error('请先选中内容')
      return
    }
    setLoadingAction('storyboard')
    try {
      const result = await scriptCenterService.splitStoryboard({
        content: selectedText,
      })
      if (result.storyboards && result.storyboards.length && !editor.isDestroyed) {
        const nodes = result.storyboards.map((sb: string, idx: number) => ({
          type: 'camera',
          attrs: { shotSize: 'medium' },
          content: [
            {
              type: 'text',
              text: `镜头${idx + 1}: ${typeof sb === 'string' ? sb : JSON.stringify(sb)}`,
            },
          ],
        }))
        replaceRange(from, to, nodes)
        toast.success('分镜生成完成')
      } else {
        toast.error('未生成分镜内容')
      }
    } catch (e) {
      toast.error('生成分镜失败：' + (e instanceof Error ? e.message : '未知错误'))
    } finally {
      setLoadingAction(null)
    }
  }

  // 6. 加入角色资产
  const handleAddCharacter = async () => {
    const { selectedText } = getSelectionText()
    const name = window.prompt('请输入角色名称')
    if (!name) return
    setLoadingAction('addCharacter')
    try {
      await createCharacter({
        name,
        description: selectedText || undefined,
      })
      toast.success('角色已加入资产库')
    } catch {
      toast.error('加入角色资产失败')
    } finally {
      setLoadingAction(null)
    }
  }

  // 7. 加入场景资产
  const handleAddScene = async () => {
    const { selectedText } = getSelectionText()
    const name = window.prompt('请输入场景名称')
    if (!name) return
    setLoadingAction('addScene')
    try {
      await createScene({
        name,
        description: selectedText || undefined,
      })
      toast.success('场景已加入资产库')
    } catch {
      toast.error('加入场景资产失败')
    } finally {
      setLoadingAction(null)
    }
  }

  const btnClass =
    'text-xs px-2 py-1 rounded text-gray-200 hover:bg-white/10 transition-colors disabled:opacity-40 disabled:cursor-not-allowed whitespace-nowrap'

  return (
    <>
      <BubbleMenu
        editor={editor}
        tippyOptions={{ placement: 'top', offset: [0, 8] }}
        shouldShow={({ editor: e, state }) => {
          if (diffView) return false
          const { from, to } = state.selection
          return from !== to && !e.isActive('codeBlock')
        }}
      >
        <div className="bg-[#252525] border border-white/10 rounded-lg shadow-xl p-1 flex flex-col gap-1">
          {/* 第1行：AI优化 | AI扩写 | AI缩写 */}
          <div className="flex gap-1">
            <button
              type="button"
              className={btnClass}
              onClick={handleOptimize}
              disabled={loadingAction !== null}
            >
              {loadingAction === 'optimize' ? '处理中...' : 'AI优化'}
            </button>
            <button
              type="button"
              className={btnClass}
              onClick={handleExpand}
              disabled={loadingAction !== null}
            >
              {loadingAction === 'expand' ? '处理中...' : 'AI扩写'}
            </button>
            <button
              type="button"
              className={btnClass}
              onClick={handleShrink}
              disabled={loadingAction !== null}
            >
              {loadingAction === 'shrink' ? '处理中...' : 'AI缩写'}
            </button>
          </div>
          {/* 第2行：生成提示词 | 生成分镜 */}
          <div className="flex gap-1">
            <button
              type="button"
              className={btnClass}
              onClick={handleGeneratePrompt}
              disabled={loadingAction !== null}
            >
              {loadingAction === 'prompt' ? '处理中...' : '生成提示词'}
            </button>
            <button
              type="button"
              className={btnClass}
              onClick={handleSplitStoryboard}
              disabled={loadingAction !== null}
            >
              {loadingAction === 'storyboard' ? '处理中...' : '生成分镜'}
            </button>
          </div>
          {/* 第3行：加入角色资产 | 加入场景资产 */}
          <div className="flex gap-1">
            <button
              type="button"
              className={btnClass}
              onClick={handleAddCharacter}
              disabled={loadingAction !== null}
            >
              {loadingAction === 'addCharacter' ? '处理中...' : '加入角色资产'}
            </button>
            <button
              type="button"
              className={btnClass}
              onClick={handleAddScene}
              disabled={loadingAction !== null}
            >
              {loadingAction === 'addScene' ? '处理中...' : '加入场景资产'}
            </button>
          </div>
        </div>
      </BubbleMenu>
      {diffView && (
        <AIDiffView
          originalText={diffView.original}
          newText={diffView.newText}
          onAccept={handleAccept}
          onReject={handleReject}
        />
      )}
    </>
  )
}
