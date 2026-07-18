'use client'

/**
 * @file BackupManager.tsx
 * @description 数据备份和恢复管理组件，支持手动/自动备份的创建、恢复、下载和删除
 */

import { useState, useEffect, useCallback } from 'react'
import {
  Database,
  Save,
  RotateCcw,
  Download,
  Trash2,
  Clock,
  CheckCircle,
  AlertCircle,
  Plus,
  RefreshCw,
  X,
  Info,
} from 'lucide-react'
import { Button } from '@/components/ui/button'

interface Backup {
  id: string
  timestamp: string
  type: 'auto' | 'manual'
  size: number
  description?: string
  status: 'completed' | 'creating' | 'failed'
  version?: number
}

interface BackupManagerProps {
  scriptId: string
  backups: Backup[]
  onCreateBackup: (description?: string) => Promise<void>
  onRestoreBackup: (backupId: string) => Promise<void>
  onDownloadBackup: (backupId: string) => Promise<void>
  onDeleteBackup: (backupId: string) => Promise<void>
  onLoadBackups: () => Promise<void>
}

/**
 * BackupManager - 数据备份和恢复管理组件
 * @param {BackupManagerProps} props - 组件属性
 * @param {string} props.scriptId - 剧本ID
 * @param {Backup[]} props.backups - 备份列表
 * @param {Function} props.onCreateBackup - 创建备份回调
 * @param {Function} props.onRestoreBackup - 恢复备份回调
 * @param {Function} props.onDownloadBackup - 下载备份回调
 * @param {Function} props.onDeleteBackup - 删除备份回调
 * @param {Function} props.onLoadBackups - 加载备份列表回调
 * @returns {JSX.Element} 渲染的备份管理界面
 */
export function BackupManager({
  scriptId,
  backups,
  onCreateBackup,
  onRestoreBackup,
  onDownloadBackup,
  onDeleteBackup,
  onLoadBackups,
}: BackupManagerProps) {
  const [isCreating, setIsCreating] = useState(false)
  const [isRestoring, setIsRestoring] = useState(false)
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [backupDescription, setBackupDescription] = useState('')
  const [showRestoreConfirm, setShowRestoreConfirm] = useState<string | null>(null)
  const [autoBackupEnabled, setAutoBackupEnabled] = useState(true)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadBackups()
  }, [scriptId])

  const loadBackups = async () => {
    setLoading(true)
    try {
      await onLoadBackups()
    } catch (error) {
      console.error('Failed to load backups:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleCreateBackup = useCallback(async () => {
    setIsCreating(true)
    try {
      await onCreateBackup(backupDescription)
      setBackupDescription('')
      setShowCreateDialog(false)
    } catch (error) {
      console.error('Failed to create backup:', error)
      alert('创建备份失败')
    } finally {
      setIsCreating(false)
    }
  }, [backupDescription, onCreateBackup])

  const handleRestoreBackup = useCallback(
    async (backupId: string) => {
      setIsRestoring(true)
      try {
        await onRestoreBackup(backupId)
        setShowRestoreConfirm(null)
        alert('恢复成功！')
      } catch (error) {
        console.error('Failed to restore backup:', error)
        alert('恢复失败')
      } finally {
        setIsRestoring(false)
      }
    },
    [onRestoreBackup]
  )

  const handleDownloadBackup = useCallback(
    async (backupId: string) => {
      try {
        await onDownloadBackup(backupId)
      } catch (error) {
        console.error('Failed to download backup:', error)
        alert('下载失败')
      }
    },
    [onDownloadBackup]
  )

  const handleDeleteBackup = useCallback(
    async (backupId: string) => {
      if (!confirm('确定要删除这个备份吗？')) return

      try {
        await onDeleteBackup(backupId)
      } catch (error) {
        console.error('Failed to delete backup:', error)
        alert('删除失败')
      }
    },
    [onDeleteBackup]
  )

  const formatFileSize = (size: number) => {
    if (size < 1024) return `${size}B`
    if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)}KB`
    return `${(size / (1024 * 1024)).toFixed(1)}MB`
  }

  const autoBackups = backups.filter((b) => b.type === 'auto')
  const manualBackups = backups.filter((b) => b.type === 'manual')
  const completedBackups = backups.filter((b) => b.status === 'completed')

  if (loading) {
    return (
      <div className="backup-manager bg-[#1a1a1a] rounded-lg border border-white/10 overflow-hidden p-8">
        <div className="text-center text-[#666]">加载备份列表...</div>
      </div>
    )
  }

  return (
    <div className="backup-manager bg-[#1a1a1a] rounded-lg border border-white/10 overflow-hidden">
      {/* 标题 */}
      <div className="p-3 border-b border-white/10 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Database className="h-4 w-4 text-[#888]" />
          <h3 className="text-sm font-medium text-white">数据备份和恢复</h3>
          <span className="text-xs text-[#666]">({completedBackups.length})</span>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowCreateDialog(true)}
            disabled={isCreating}
            className="h-7"
          >
            <Plus className="h-3 w-3 mr-1" />
            创建备份
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={loadBackups}
            className="h-7 w-7 p-0"
          >
            <RefreshCw className="h-3 w-3" />
          </Button>
        </div>
      </div>

      {/* 自动备份设置 */}
      <div className="p-3 border-b border-white/10 bg-blue-500/5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Info className="h-4 w-4 text-blue-400" />
            <div>
              <div className="text-xs font-medium text-white">自动备份</div>
              <div className="text-xs text-[#888]">
                每次保存时自动创建备份
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setAutoBackupEnabled(!autoBackupEnabled)}
              className={`w-10 h-5 rounded-full transition-colors ${
                autoBackupEnabled ? 'bg-emerald-500' : 'bg-white/10'
              }`}
            >
              <div
                className={`w-4 h-4 rounded-full bg-white transition-transform ${
                  autoBackupEnabled ? 'translate-x-5' : 'translate-x-0.5'
                }`}
              />
            </button>
          </div>
        </div>
      </div>

      {/* 创建备份对话框 */}
      {showCreateDialog && (
        <div className="p-3 border-b border-white/10 bg-emerald-500/5">
          <div className="flex items-center justify-between mb-2">
            <div className="text-xs font-medium text-white">创建新备份</div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowCreateDialog(false)}
              className="h-5 w-5 p-0"
            >
              <X className="h-3 w-3" />
            </Button>
          </div>
          <div className="space-y-2">
            <input
              type="text"
              value={backupDescription}
              onChange={(e) => setBackupDescription(e.target.value)}
              placeholder="备份描述（可选）"
              className="w-full bg-white/5 border border-white/10 rounded px-3 py-2 text-sm text-white placeholder-[#666]"
            />
            <div className="flex justify-end gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowCreateDialog(false)}
                className="h-7"
              >
                取消
              </Button>
              <Button
                size="sm"
                onClick={handleCreateBackup}
                disabled={isCreating}
                className="h-7"
              >
                <Save className="h-3 w-3 mr-1" />
                {isCreating ? '创建中...' : '创建'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* 备份列表 */}
      <div className="overflow-y-auto max-h-[400px]">
        {backups.length === 0 ? (
          <div className="text-center py-8 text-[#666] text-sm">
            暂无备份记录
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowCreateDialog(true)}
              className="mt-2"
            >
              创建第一个备份
            </Button>
          </div>
        ) : (
          <div className="divide-y divide-white/5">
            {/* 手动备份 */}
            {manualBackups.length > 0 && (
              <div className="p-2 bg-white/5">
                <div className="text-xs font-medium text-white mb-2 flex items-center gap-1">
                  <Save className="h-3 w-3" />
                  手动备份 ({manualBackups.length})
                </div>
                {manualBackups.map((backup) => (
                  <BackupItem
                    key={backup.id}
                    backup={backup}
                    onRestore={() => setShowRestoreConfirm(backup.id)}
                    onDownload={() => handleDownloadBackup(backup.id)}
                    onDelete={() => handleDeleteBackup(backup.id)}
                    isRestoring={isRestoring && showRestoreConfirm === backup.id}
                    formatFileSize={formatFileSize}
                  />
                ))}
              </div>
            )}

            {/* 自动备份 */}
            {autoBackups.length > 0 && (
              <div className="p-2">
                <div className="text-xs font-medium text-[#888] mb-2 flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  自动备份 ({autoBackups.length})
                </div>
                {autoBackups.slice(0, 5).map((backup) => (
                  <BackupItem
                    key={backup.id}
                    backup={backup}
                    onRestore={() => setShowRestoreConfirm(backup.id)}
                    onDownload={() => handleDownloadBackup(backup.id)}
                    onDelete={() => handleDeleteBackup(backup.id)}
                    isRestoring={isRestoring && showRestoreConfirm === backup.id}
                    formatFileSize={formatFileSize}
                  />
                ))}
                {autoBackups.length > 5 && (
                  <div className="text-xs text-[#666] text-center py-2">
                    显示最近5个自动备份
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* 恢复确认对话框 */}
      {showRestoreConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-[#1a1a1a] rounded-lg border border-white/10 p-4 w-full max-w-md">
            <div className="flex items-center justify-between mb-3">
              <div className="text-sm font-medium text-white">确认恢复</div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowRestoreConfirm(null)}
                className="h-6 w-6 p-0"
              >
                <X className="h-3 w-3" />
              </Button>
            </div>
            <div className="text-sm text-white mb-2">
              确定要恢复到此备份吗？
            </div>
            <div className="text-xs text-yellow-400 mb-4 flex items-start gap-2">
              <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
              <span>
                恢复后，当前的内容将被替换为备份时的内容，无法撤销。
              </span>
            </div>
            <div className="flex justify-end gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowRestoreConfirm(null)}
                className="h-7"
              >
                取消
              </Button>
              <Button
                size="sm"
                onClick={() => handleRestoreBackup(showRestoreConfirm)}
                disabled={isRestoring}
                className="h-7"
              >
                {isRestoring ? '恢复中...' : '确认恢复'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* 统计信息 */}
      <div className="p-3 border-t border-white/10 bg-white/5">
        <div className="grid grid-cols-3 gap-2 text-center">
          <div>
            <div className="text-xs text-[#888]">总备份</div>
            <div className="text-sm font-bold text-white">{backups.length}</div>
          </div>
          <div>
            <div className="text-xs text-[#888]">手动备份</div>
            <div className="text-sm font-bold text-emerald-400">{manualBackups.length}</div>
          </div>
          <div>
            <div className="text-xs text-[#888]">自动备份</div>
            <div className="text-sm font-bold text-blue-400">{autoBackups.length}</div>
          </div>
        </div>
      </div>
    </div>
  )
}

function BackupItem({
  backup,
  onRestore,
  onDownload,
  onDelete,
  isRestoring,
  formatFileSize,
}: {
  backup: Backup
  onRestore: () => void
  onDownload: () => void
  onDelete: () => void
  isRestoring: boolean
  formatFileSize: (size: number) => string
}) {
  return (
    <div
      className={`p-2 hover:bg-white/5 transition-colors ${
        backup.status === 'creating'
          ? 'bg-emerald-500/10'
          : backup.status === 'failed'
          ? 'bg-red-500/10'
          : ''
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            {backup.status === 'completed' ? (
              <CheckCircle className="h-3 w-3 text-emerald-400" />
            ) : backup.status === 'creating' ? (
              <RefreshCw className="h-3 w-3 text-emerald-400 animate-spin" />
            ) : (
              <AlertCircle className="h-3 w-3 text-red-400" />
            )}
            <span className="text-xs text-white">
              {new Date(backup.timestamp).toLocaleString()}
            </span>
            {backup.version && (
              <span className="text-xs px-1.5 py-0.5 rounded bg-white/5 text-[#888]">
                V{backup.version}
              </span>
            )}
          </div>
          {backup.description && (
            <div className="text-xs text-[#888] truncate mb-1">{backup.description}</div>
          )}
          <div className="flex items-center gap-2 text-xs text-[#666]">
            <span>{formatFileSize(backup.size)}</span>
            <span>•</span>
            <span>{backup.type === 'auto' ? '自动' : '手动'}</span>
            {backup.status === 'creating' && (
              <>
                <span>•</span>
                <span className="text-emerald-400">创建中...</span>
              </>
            )}
            {backup.status === 'failed' && (
              <>
                <span>•</span>
                <span className="text-red-400">创建失败</span>
              </>
            )}
          </div>
        </div>

        {/* 操作按钮 */}
        {backup.status === 'completed' && (
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={onDownload}
              className="h-6 w-6 p-0"
              title="下载备份"
            >
              <Download className="h-3 w-3" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={onRestore}
              disabled={isRestoring}
              className="h-6 w-6 p-0"
              title="恢复到此备份"
            >
              <RotateCcw className="h-3 w-3" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={onDelete}
              className="h-6 w-6 p-0 text-red-400 hover:text-red-300"
              title="删除备份"
            >
              <Trash2 className="h-3 w-3" />
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}