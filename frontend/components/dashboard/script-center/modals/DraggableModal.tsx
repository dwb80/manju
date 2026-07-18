'use client'

/**
 * DraggableModal —— 通用可拖拽弹窗基座
 *
 * 设计原则：
 * - 单一职责：仅负责"半透明遮罩 + 可拖拽容器 + 标题栏"，业务内容由 children 注入
 * - 复用：版本历史、版本预览等弹窗都基于此基座
 * - 可测试：标题栏、关闭按钮、内容区职责清晰
 *
 * 使用示例：
 *   <DraggableModal
 *     title="版本历史"
 *     onClose={...}
 *     width={500}
 *     maxHeight={600}
 *   >
 *     <VersionHistory ... />
 *   </DraggableModal>
 */

import { X, GripHorizontal } from 'lucide-react'
import { useDraggable } from '../useDraggable'
import { createLogger } from '@/lib/logger'

// 模块级 logger：便于排查拖拽与弹窗生命周期问题
const log = createLogger('draggable-modal')

export interface DraggableModalProps {
  /** 弹窗标题（同时作为 a11y label） */
  title: string
  /** 关闭回调 */
  onClose: () => void
  /** 弹窗宽度（像素） */
  width?: number
  /** 弹窗最大高度（像素） */
  maxHeight?: number
  /** 拖拽初始 Y 坐标 */
  initialY?: number
  /** 弹窗内容（可滚动） */
  children: React.ReactNode
  /** 标题栏右侧的额外操作（可选） */
  headerExtra?: React.ReactNode
  /**
   * 固定底部操作区（可选，不随内容滚动）
   * - 用于"保存/取消"等关键操作，避免被长内容挤出可视区
   */
  footer?: React.ReactNode
  /** 自定义 z-index（弹窗之间嵌套时使用） */
  zIndex?: number
}

/**
 * 通用可拖拽弹窗组件
 */
export function DraggableModal({
  title,
  onClose,
  width = 500,
  maxHeight = 600,
  initialY = 80,
  children,
  headerExtra,
  footer,
  zIndex = 50,
}: DraggableModalProps) {
  // 复用既有拖拽 hook（沿用项目内的拖拽实现，不重复造轮子）
  const { position, onDragStart } = useDraggable(-1, initialY)

  // 关闭事件埋点（便于排查"为什么弹窗消失了"类问题）
  const handleClose = () => {
    log.debug('modal closed', { title })
    onClose()
  }

  return (
    <div
      className="fixed inset-0 bg-black/50"
      style={{ zIndex }}
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <div
        className="absolute bg-[#1a1a1a] rounded-lg border border-white/10 shadow-2xl overflow-hidden flex flex-col"
        style={{
          left: position.x,
          top: position.y,
          width,
          maxHeight,
        }}
      >
        {/* 标题栏 —— 拖拽手柄 */}
        <div
          className="flex items-center justify-between px-4 py-2.5 border-b border-white/10 bg-[#252525] cursor-move select-none"
          onMouseDown={onDragStart}
        >
          <div className="flex items-center gap-2">
            <GripHorizontal className="h-4 w-4 text-gray-500" />
            <span className="text-sm font-medium text-gray-200">{title}</span>
          </div>
          <div className="flex items-center gap-2">
            {headerExtra}
            <button
              type="button"
              onClick={handleClose}
              className="text-gray-400 hover:text-white transition-colors"
              aria-label={`关闭${title}`}
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* 内容区（可滚动） */}
        <div className="flex-1 overflow-y-auto">{children}</div>

        {/* 底部固定操作区（不随内容滚动，确保关键按钮始终可达） */}
        {footer && (
          <div className="flex-shrink-0 border-t border-white/10 bg-[#1a1a1a]">
            {footer}
          </div>
        )}
      </div>
    </div>
  )
}
