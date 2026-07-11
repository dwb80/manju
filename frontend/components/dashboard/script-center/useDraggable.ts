'use client'

import { useState, useEffect, useRef, useCallback } from 'react'

/**
 * 可拖拽 hook —— 用于弹出窗口的标题栏拖拽
 *
 * @param initialX 初始 X 坐标（默认居中计算用 -1）
 * @param initialY 初始 Y 坐标
 * @returns { position, onDragStart, isDragging, reset }
 */
export function useDraggable(initialX: number = -1, initialY: number = 80) {
  const [position, setPosition] = useState({ x: initialX, y: initialY })
  const [isDragging, setIsDragging] = useState(false)
  const dragStart = useRef({ mouseX: 0, mouseY: 0, posX: 0, posY: 0 })

  // 首次挂载时，若 initialX === -1 则水平居中
  useEffect(() => {
    if (initialX === -1) {
      const w = typeof window !== 'undefined' ? Math.min(window.innerWidth - 32, 768) : 768
      setPosition({ x: (window.innerWidth - w) / 2, y: initialY })
    }
  }, [initialX, initialY])

  /** 鼠标按下标题栏时开始拖拽 */
  const onDragStart = useCallback(
    (e: React.MouseEvent) => {
      // 不拦截标题栏内的按钮点击
      const target = e.target as HTMLElement
      if (target.closest('button')) return

      setIsDragging(true)
      dragStart.current = {
        mouseX: e.clientX,
        mouseY: e.clientY,
        posX: position.x,
        posY: position.y,
      }
      e.preventDefault()
    },
    [position]
  )

  // 拖拽中：监听全局 mousemove / mouseup
  useEffect(() => {
    if (!isDragging) return

    const handleMouseMove = (e: MouseEvent) => {
      const dx = e.clientX - dragStart.current.mouseX
      const dy = e.clientY - dragStart.current.mouseY
      const newX = dragStart.current.posX + dx
      const newY = Math.max(0, dragStart.current.posY + dy) // 不超出顶部
      setPosition({ x: newX, y: newY })
    }

    const handleMouseUp = () => setIsDragging(false)

    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)
    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }
  }, [isDragging])

  /** 重置到指定位置 */
  const reset = useCallback((x?: number, y?: number) => {
    if (typeof window !== 'undefined' && x === undefined) {
      const w = Math.min(window.innerWidth - 32, 768)
      setPosition({ x: (window.innerWidth - w) / 2, y: y ?? 80 })
    } else {
      setPosition({ x: x ?? 0, y: y ?? 80 })
    }
  }, [])

  return { position, onDragStart, isDragging, reset }
}
