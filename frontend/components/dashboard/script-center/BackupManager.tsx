'use client'

/**
 * @file BackupManager.tsx
 * @description 数据备份和恢复管理组件，支持手动/自动备份的创建、恢复、下载和删除
 */

import { useState, useEffect, useCallback } from 'react'
import { notify } from '@/lib/notify'
import { ConfirmDialog } from '@/components/common/confirm-dialog'
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
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null)
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
      notify.error('创建备份失败', '请稍后重试')
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
        notify.success('恢复成功')
      } catch (error) {
        console.error('Failed to restore backup:', error)
        notify.error('恢复失败', '请稍后重试')
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
        notify.error('下载失败', '请稍后重试')
      }
    },
    [onDownloadBackup]
  )

  const handleDeleteBackup = useCallback(
    async (backupId: string) => {
      try {
        await onDeleteBackup(backupId)
      } catch (error) {
        console.error('Failed to delete backup:', error)
        notify.error('删除失败', '请稍后重试')
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
      <div className="backup-manager bg-card rounded-lg border border-border overflow-hidden p-8">
        <div className="text-center text-muted-foreground">加载备份列表...</div>
      </div>
    )
  }

  return (
    <div className="backup-manager bg-card rounded-lg border border-border overflow-hidden">
      {/* 标题 */}
      <div className="p-3 border-b border-border flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Database className="h-4 w-4 text-muted-foreground" />
          <h3 className="text-sm font-medium text-foreground">数据备份和恢复</h3>
          <span className="text-xs text-muted-foreground">({completedBackups.length})</span>
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
      <div className="p-3 border-b border-border bg-info/5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Info className="h-4 w-4 text-info" />
            <div>
              <div className="text-xs font-medium text-foreground">自动备份</div>
              <div className="text-xs text-muted-foreground">
                每次保存时自动创建备份
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              role="switch"
              aria-checked={autoBackupEnabled}
              onClick={() => setAutoBackupEnabled(!autoBackupEnabled)}
              className={`w-10 h-5 rounded-full transition-colors ${autoBackupEnabled ? 'bg-primary' : 'bg-muted'
                }`}
            >
              <div
                aria-hidden="true"
                className={`w-4 h-4 rounded-full bg-secondary transition-transform ${autoBackupEnabled ? 'translate-x-5' : 'translate-x-0.5'
                  }`}
              />
            </button>
          </div>
        </div>
      </div>

      {/* 创建备份对话框 */}
      {showCreateDialog && (
        <div className="p-3 border-b border-border bg-primary/5">
          <div className="flex items-center justify-between mb-2">
            <div className="text-xs font-medium text-foreground">创建新备份</div>
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
              className="w-full bg-muted/50 border border-border rounded px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground"
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
          <div className="text-center py-8 text-muted-foreground text-sm">
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
              <div className="p-2 bg-muted/50">
                <div className="text-xs font-medium text-foreground mb-2 flex items-center gap-1">
                  <Save className="h-3 w-3" />
                  手动备份 ({manualBackups.length})
                </div>
                {manualBackups.map((backup) => (
                  <BackupItem
                    key={backup.id}
                    backup={backup}
                    onRestore={() => setShowRestoreConfirm(backup.id)}
                    onDownload={() => handleDownloadBackup(backup.id)}
                    onDelete={() => setPendingDeleteId(backup.id)}
                    isRestoring={isRestoring && showRestoreConfirm === backup.id}
                    formatFileSize={formatFileSize}
                  />
                ))}
              </div>
            )}

            {/* 自动备份 */}
            {autoBackups.length > 0 && (
              <div className="p-2">
                <div className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  自动备份 ({autoBackups.length})
                </div>
                {autoBackups.slice(0, 5).map((backup) => (
                  <BackupItem
                    key={backup.id}
                    backup={backup}
                    onRestore={() => setShowRestoreConfirm(backup.id)}
                    onDownload={() => handleDownloadBackup(backup.id)}
                    onDelete={() => setPendingDeleteId(backup.id)}
                    isRestoring={isRestoring && showRestoreConfirm === backup.id}
                    formatFileSize={formatFileSize}
                  />
                ))}
                {autoBackups.length > 5 && (
                  <div className="text-xs text-muted-foreground text-center py-2">
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
          <div
            className="bg-card rounded-lg border border-border p-4 w-full max-w-md"
            role="dialog"
            aria-modal="true"
            aria-label="确认恢复备份"
          >
            <div className="flex items-center justify-between mb-3">
              <div className="text-sm font-medium text-foreground">确认恢复</div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowRestoreConfirm(null)}
                className="h-6 w-6 p-0"
                aria-label="取消恢复"
              >
                <X className="h-3 w-3" aria-hidden="true" />
              </Button>
            </div>
            <div className="text-sm text-foreground mb-2">
              确定要恢复到此备份吗？
            </div>
            <div className="text-xs text-chart-5 mb-4 flex items-start gap-2">
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

      {pendingDeleteId && (
        <ConfirmDialog
          title="删除备份"
          description="确定要删除这个备份吗？此操作不可撤销。"
          confirmLabel="确认删除"
          onClose={() => setPendingDeleteId(null)}
          onConfirm={async () => {
            if (pendingDeleteId) await handleDeleteBackup(pendingDeleteId);
            setPendingDeleteId(null);
          }}
        />
      )}

      {/* 统计信息 */}
      <div className="p-3 border-t border-border bg-muted/50">
        <div className="grid grid-cols-3 gap-2 text-center">
          <div>
            <div className="text-xs text-muted-foreground">总备份</div>
            <div className="text-sm font-bold text-foreground">{backups.length}</div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground">手动备份</div>
            <div className="text-sm font-bold text-primary">{manualBackups.length}</div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground">自动备份</div>
            <div className="text-sm font-bold text-info">{autoBackups.length}</div>
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
      className={`p-2 hover:bg-muted/50 transition-colors ${backup.status === 'creating'
        ? 'bg-primary/10'
        : backup.status === 'failed'
          ? 'bg-destructive/10'
          : ''
        }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            {backup.status === 'completed' ? (
              <CheckCircle className="h-3 w-3 text-primary" />
            ) : backup.status === 'creating' ? (
              <RefreshCw className="h-3 w-3 text-primary animate-spin" />
            ) : (
              <AlertCircle className="h-3 w-3 text-destructive" />
            )}
            <span className="text-xs text-foreground">
              {new Date(backup.timestamp).toLocaleString()}
            </span>
            {backup.version && (
              <span className="text-xs px-1.5 py-0.5 rounded bg-muted/50 text-muted-foreground">
                V{backup.version}
              </span>
            )}
          </div>
          {backup.description && (
            <div className="text-xs text-muted-foreground truncate mb-1">{backup.description}</div>
          )}
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span>{formatFileSize(backup.size)}</span>
            <span>•</span>
            <span>{backup.type === 'auto' ? '自动' : '手动'}</span>
            {backup.status === 'creating' && (
              <>
                <span>•</span>
                <span className="text-primary">创建中...</span>
              </>
            )}
            {backup.status === 'failed' && (
              <>
                <span>•</span>
                <span className="text-destructive">创建失败</span>
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
              aria-label="下载备份"
              title="下载备份"
            >
              <Download className="h-3 w-3" aria-hidden="true" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={onRestore}
              disabled={isRestoring}
              className="h-6 w-6 p-0"
              aria-label="恢复到此备份"
              title="恢复到此备份"
            >
              <RotateCcw className="h-3 w-3" aria-hidden="true" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={onDelete}
              className="h-6 w-6 p-0 text-destructive hover:text-destructive"
              aria-label="删除备份"
              title="删除备份"
            >
              <Trash2 className="h-3 w-3" aria-hidden="true" />
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}
