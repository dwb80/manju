'use client'

import { useMemo } from 'react'
import { Button } from '@/components/ui/button'
import { Check, X, GripHorizontal } from 'lucide-react'
import { useDraggable } from './useDraggable'

interface AIDiffViewProps {
  originalText: string // 原文
  newText: string // AI 生成的新文本
  onAccept: () => void // 接受：替换选区为新文本
  onReject: () => void // 拒绝：恢复原文
}

type DiffOp = { type: 'same' | 'add' | 'del'; text: string }

/**
 * 基于 LCS（最长公共子序列）的逐词 diff 算法。
 * 按词切分文本（保留空白），通过 DP 表求出 LCS，
 * 再回溯生成 same/add/del 操作序列，最后合并相邻同类型片段。
 */
function computeDiff(original: string, newText: string): DiffOp[] {
  // 按词切分，保留空白字符
  const oldWords = original.split(/(\s+)/).filter((w) => w.length > 0)
  const newWords = newText.split(/(\s+)/).filter((w) => w.length > 0)

  // 对于超长文本，回退到整体对比以避免性能问题
  const MAX_WORDS = 2000
  if (oldWords.length > MAX_WORDS || newWords.length > MAX_WORDS) {
    const result: DiffOp[] = []
    if (original) result.push({ type: 'del', text: original })
    if (newText) result.push({ type: 'add', text: newText })
    return result
  }

  const m = oldWords.length
  const n = newWords.length

  // 构建 LCS DP 表
  const dp: number[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0))
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (oldWords[i - 1] === newWords[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1] + 1
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1])
      }
    }
  }

  // 回溯构建 diff 序列
  const result: DiffOp[] = []
  let i = m
  let j = n
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && oldWords[i - 1] === newWords[j - 1]) {
      result.push({ type: 'same', text: oldWords[i - 1] })
      i--
      j--
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      result.push({ type: 'add', text: newWords[j - 1] })
      j--
    } else {
      result.push({ type: 'del', text: oldWords[i - 1] })
      i--
    }
  }
  result.reverse()

  // 合并相邻的同类型操作，减少 DOM 节点数量
  const merged: DiffOp[] = []
  for (const op of result) {
    const last = merged[merged.length - 1]
    if (last && last.type === op.type) {
      last.text += op.text
    } else {
      merged.push({ ...op })
    }
  }

  return merged
}

/**
 * AI Diff 对比视图（Feature 2.8）
 *
 * AI 操作完成后以浮动面板形式显示原文与新文的 diff 对比：
 * - 红色删除线：原文中被替换的内容
 * - 绿色高亮：AI 新生成的内容
 * - 正常显示：未修改的内容
 *
 * 用户可点击"接受"替换选区，或"拒绝"恢复原文。
 */
export function AIDiffView({ originalText, newText, onAccept, onReject }: AIDiffViewProps) {
  const diff = useMemo(() => computeDiff(originalText, newText), [originalText, newText])
  const { position, onDragStart } = useDraggable(-1, 80)

  return (
    <div className="fixed inset-0 z-[60]">
      {/* 半透明遮罩，防止编辑器交互导致选区位置失效 */}
      <div className="absolute inset-0 bg-black/40" onClick={onReject} />

      {/* 浮动 diff 面板（可拖拽） */}
      <div
        className="absolute w-[min(768px,calc(100vw-32px)] bg-[#1f1f1f] border border-white/10 rounded-xl shadow-2xl overflow-hidden"
        style={{ left: position.x, top: position.y }}
      >
        {/* 标题栏 —— 拖拽手柄 */}
        <div
          className="flex items-center justify-between px-4 py-2.5 border-b border-white/10 bg-[#252525] cursor-move select-none"
          onMouseDown={onDragStart}
        >
          <div className="flex items-center gap-2">
            <GripHorizontal className="h-4 w-4 text-gray-500" />
            <span className="text-sm font-medium text-gray-200">AI 修改对比</span>
            <span className="text-xs text-gray-500">请确认是否接受修改</span>
          </div>
          <button
            type="button"
            onClick={onReject}
            className="text-gray-400 hover:text-white transition-colors"
            aria-label="关闭"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Diff 内容区（最大高度限制 + 滚动） */}
        <div className="max-h-[50vh] overflow-y-auto p-4 text-sm leading-relaxed whitespace-pre-wrap break-words">
          {diff.map((op, idx) => {
            if (op.type === 'same') {
              return (
                <span key={idx} className="text-gray-300">
                  {op.text}
                </span>
              )
            }
            if (op.type === 'del') {
              return (
                <span
                  key={idx}
                  className="bg-red-500/20 text-red-400 line-through rounded px-0.5"
                >
                  {op.text}
                </span>
              )
            }
            return (
              <span
                key={idx}
                className="bg-green-500/20 text-green-400 rounded px-0.5"
              >
                {op.text}
              </span>
            )
          })}
        </div>

        {/* 操作按钮 */}
        <div className="flex items-center justify-end gap-2 px-4 py-3 border-t border-white/10 bg-[#252525]">
          <Button variant="ghost" size="sm" onClick={onReject}>
            <X className="h-4 w-4" />
            拒绝
          </Button>
          <Button variant="default" size="sm" onClick={onAccept}>
            <Check className="h-4 w-4" />
            接受
          </Button>
        </div>
      </div>
    </div>
  )
}
