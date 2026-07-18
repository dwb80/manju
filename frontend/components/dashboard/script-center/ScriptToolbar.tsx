'use client'

import { Editor } from '@tiptap/react'
import { Button } from '@/components/ui/button'
import { Tip } from '@/components/ui/tip'

interface ScriptToolbarProps {
  editor: Editor | null
  onAnalyze?: () => void
}

interface ToolbarButtonProps {
  onClick: () => void
  disabled?: boolean
  active?: boolean
  label: string
  tooltip?: string
}

function ToolbarButton({ onClick, disabled, active, label, tooltip }: ToolbarButtonProps) {
  return (
    <Tip label={tooltip ?? label} side="bottom">
      <Button
        variant={active ? 'default' : 'ghost'}
        size="sm"
        onClick={onClick}
        disabled={disabled}
        className="h-7 w-7 p-0 text-xs font-medium"
      >
        {label}
      </Button>
    </Tip>
  )
}

/**
 * ScriptToolbar - 剧本编辑器工具栏组件
 * @param {ScriptToolbarProps} props - 组件属性
 * @param {Editor | null} props.editor - TipTap 编辑器实例
 * @param {Function} props.onAnalyze - AI分析回调
 * @returns {JSX.Element | null} 渲染的工具栏界面
 */
export function ScriptToolbar({ editor, onAnalyze }: ScriptToolbarProps) {
  // 编辑器为 null 或被销毁时返回 null，避免访问 editor.can() 崩溃
  if (!editor || editor.isDestroyed) {
    return null
  }

  // 安全访问 editor.can()，避免编辑器初始化过程中崩溃
  const can = () => {
    try {
      return editor?.can?.() ?? null
    } catch {
      return null
    }
  }
  const safeRun = (fn: () => void) => {
    try {
      if (!editor?.isDestroyed) fn()
    } catch (err) {
      console.warn('编辑器命令执行失败:', err)
    }
  }

  return (
    <div className="script-toolbar border-b border-white/10 bg-[#252525] p-2 flex items-center gap-1 flex-wrap">
      {/* 文本格式化 */}
      <div className="flex items-center gap-1 border-r border-white/10 pr-2">
        <ToolbarButton
          onClick={() => safeRun(() => editor.chain().focus().toggleBold().run())}
          disabled={!can()?.chain().focus().toggleBold().run()}
          active={editor.isActive('bold')}
          label="B"
          tooltip="粗体"
        />
        <ToolbarButton
          onClick={() => safeRun(() => editor.chain().focus().toggleItalic().run())}
          disabled={!can()?.chain().focus().toggleItalic().run()}
          active={editor.isActive('italic')}
          label="I"
          tooltip="斜体"
        />
        <ToolbarButton
          onClick={() => safeRun(() => editor.chain().focus().toggleUnderline().run())}
          disabled={!can()?.chain().focus().toggleUnderline().run()}
          active={editor.isActive('underline')}
          label="U"
          tooltip="下划线"
        />
        <ToolbarButton
          onClick={() => safeRun(() => editor.chain().focus().toggleStrike().run())}
          disabled={!can()?.chain().focus().toggleStrike().run()}
          active={editor.isActive('strike')}
          label="S"
          tooltip="删除线"
        />
        <ToolbarButton
          onClick={() => safeRun(() => editor.chain().focus().toggleHighlight().run())}
          active={editor.isActive('highlight')}
          label="H"
          tooltip="高亮"
        />
      </div>

      {/* 标题 */}
      <div className="flex items-center gap-1 border-r border-white/10 pr-2">
        <ToolbarButton
          onClick={() => safeRun(() => editor.chain().focus().toggleHeading({ level: 1 }).run())}
          active={editor.isActive('heading', { level: 1 })}
          label="H1"
          tooltip="标题1"
        />
        <ToolbarButton
          onClick={() => safeRun(() => editor.chain().focus().toggleHeading({ level: 2 }).run())}
          active={editor.isActive('heading', { level: 2 })}
          label="H2"
          tooltip="标题2"
        />
        <ToolbarButton
          onClick={() => safeRun(() => editor.chain().focus().toggleHeading({ level: 3 }).run())}
          active={editor.isActive('heading', { level: 3 })}
          label="H3"
          tooltip="标题3"
        />
      </div>

      {/* 列表和引用 */}
      <div className="flex items-center gap-1 border-r border-white/10 pr-2">
        <ToolbarButton
          onClick={() => safeRun(() => editor.chain().focus().toggleBulletList().run())}
          active={editor.isActive('bulletList')}
          label="•"
          tooltip="无序列表"
        />
        <ToolbarButton
          onClick={() => safeRun(() => editor.chain().focus().toggleOrderedList().run())}
          active={editor.isActive('orderedList')}
          label="1."
          tooltip="有序列表"
        />
        <ToolbarButton
          onClick={() => safeRun(() => editor.chain().focus().toggleBlockquote().run())}
          active={editor.isActive('blockquote')}
          label="❝"
          tooltip="引用"
        />
        <ToolbarButton
          onClick={() => safeRun(() => editor.chain().focus().toggleCodeBlock().run())}
          active={editor.isActive('codeBlock')}
          label="</>"
          tooltip="代码块"
        />
      </div>

      {/* 对齐 */}
      <div className="flex items-center gap-1 border-r border-white/10 pr-2">
        <ToolbarButton
          onClick={() => safeRun(() => editor.chain().focus().setTextAlign('left').run())}
          active={editor.isActive({ textAlign: 'left' })}
          label="≡"
          tooltip="左对齐"
        />
        <ToolbarButton
          onClick={() => safeRun(() => editor.chain().focus().setTextAlign('center').run())}
          active={editor.isActive({ textAlign: 'center' })}
          label="≡"
          tooltip="居中"
        />
        <ToolbarButton
          onClick={() => safeRun(() => editor.chain().focus().setTextAlign('right').run())}
          active={editor.isActive({ textAlign: 'right' })}
          label="≡"
          tooltip="右对齐"
        />
      </div>

      {/* 剧本元素插入 */}
      <div className="flex items-center gap-1 border-r border-white/10 pr-2">
        <ToolbarButton
          onClick={() => safeRun(() => editor.chain().focus().insertContent({
            type: 'episode',
            attrs: { episodeNo: 1, title: '', status: 'draft' },
            content: [{ type: 'paragraph' }],
          }).run())}
          label="集"
          tooltip="插入剧集"
        />
        <ToolbarButton
          onClick={() => safeRun(() => editor.chain().focus().insertContent({
            type: 'scene',
            attrs: { location: '', time: 'day' },
            content: [{ type: 'paragraph' }],
          }).run())}
          label="景"
          tooltip="插入场景"
        />
        <ToolbarButton
          onClick={() => safeRun(() => editor.chain().focus().insertContent({
            type: 'character',
            attrs: { name: '角色名', color: '#4A90E2' },
            content: [{ type: 'text', text: '角色名' }],
          }).run())}
          label="人"
          tooltip="插入角色"
        />
        <ToolbarButton
          onClick={() => safeRun(() => editor.chain().focus().insertContent({
            type: 'dialogue',
            attrs: { character: '角色名' },
            content: [{ type: 'text', text: '对话内容' }],
          }).run())}
          label="话"
          tooltip="插入对话"
        />
        <ToolbarButton
          onClick={() => safeRun(() => editor.chain().focus().insertContent({
            type: 'action',
            content: [{ type: 'text', text: '动作描述' }],
          }).run())}
          label="动"
          tooltip="插入动作"
        />
      </div>

      {/* AI功能 */}
      <div className="flex items-center gap-1">
        <ToolbarButton
          onClick={() => safeRun(() => editor.chain().focus().insertContent('/').run())}
          label="AI"
          tooltip="AI辅助"
        />
        {onAnalyze && (
          <ToolbarButton
            onClick={onAnalyze}
            label="分析"
            tooltip="AI分析剧本（识别角色/场景/道具）"
          />
        )}
      </div>

      {/* 撤销/重做 */}
      <div className="flex items-center gap-1 ml-auto">
        <ToolbarButton
          onClick={() => safeRun(() => editor.chain().focus().undo().run())}
          disabled={!can()?.chain().focus().undo().run()}
          label="↶"
          tooltip="撤销"
        />
        <ToolbarButton
          onClick={() => safeRun(() => editor.chain().focus().redo().run())}
          disabled={!can()?.chain().focus().redo().run()}
          label="↷"
          tooltip="重做"
        />
      </div>
    </div>
  )
}