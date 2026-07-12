'use client'

/**
 * VersionHistoryModal —— 版本历史弹窗
 *
 * 设计原则：
 * - 单一职责：仅封装版本历史的展示、恢复、预览、对比、删除等 UI 逻辑
 * - 可测试：内部全部为 props 回调，便于纯组件测试
 * - 复用基座：基于 DraggableModal 实现，统一拖拽/关闭体验
 */

import { lazy, Suspense } from 'react'
import { Button } from '@/components/ui/button'
import { DraggableModal } from './DraggableModal'
import { createLogger } from '@/lib/logger'

// 模块级 logger
const log = createLogger('version-history-modal')

// 懒加载：版本历史组件较大，避免首屏加载
const VersionHistory = lazy(() =>
  import('../VersionHistory').then((mod) => ({ default: mod.VersionHistory })),
)

// 类型：来自 script-store
type ScriptVersion = {
  id: string
  version: number
  timestamp: string
  changes: string
  author?: string
  content: any
}

export interface VersionHistoryModalProps {
  /** 关闭弹窗 */
  onClose: () => void
  /** 版本列表 */
  versions: ScriptVersion[]
  /** 恢复到指定版本 */
  onRestore: (versionId: string) => Promise<void>
  /** 查看指定版本（外层打开预览弹窗） */
  onView: (versionId: string) => void
  /** 删除指定版本 */
  onDelete: (versionId: string) => Promise<void>
  /** 对比两个版本 */
  onCompare: (v1: string, v2: string) => Promise<any>
}

/**
 * 版本历史弹窗组件
 */
export function VersionHistoryModal({
  onClose,
  versions,
  onRestore,
  onView,
  onDelete,
  onCompare,
}: VersionHistoryModalProps) {
  log.debug('open', { count: versions.length })

  return (
    <DraggableModal title="版本历史" onClose={onClose} width={500} maxHeight={600}>
      <div className="p-3">
        <Suspense fallback={<div className="p-4 text-center text-gray-400">加载中...</div>}>
          <VersionHistory
            versions={versions as any}
            onRestore={async (versionId) => {
              log.info('restore', { versionId })
              await onRestore(versionId)
              onClose()
            }}
            onView={(versionId) => {
              log.debug('view', { versionId })
              onView(versionId)
            }}
            onDelete={async (versionId) => {
              log.info('delete', { versionId })
              await onDelete(versionId)
            }}
            onCompare={onCompare}
          />
        </Suspense>
        <Button variant="ghost" onClick={onClose} className="mt-2 w-full">
          关闭
        </Button>
      </div>
    </DraggableModal>
  )
}
