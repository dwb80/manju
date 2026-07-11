'use client'

import { useState } from 'react'
import {
  Download,
  Upload,
  FileJson,
  FileText,
  Film,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ConfirmDialog } from '@/components/common/confirm-dialog'

interface ImportExportDialogProps {
  isOpen: boolean
  onClose: () => void
  onExport: (format: 'json' | 'markdown' | 'fdx') => Promise<void>
  onImport: (projectId: string, jsonData: string) => Promise<void>
  projectId?: string
}

export function ImportExportDialog({
  isOpen,
  onClose,
  onExport,
  onImport,
  projectId,
}: ImportExportDialogProps) {
  const [mode, setMode] = useState<'export' | 'import'>('export')
  const [selectedFormat, setSelectedFormat] = useState<'json' | 'markdown' | 'fdx'>('json')
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [importError, setImportError] = useState<string | null>(null)

  const handleExport = async () => {
    setIsLoading(true)
    setImportError(null)
    try {
      // 目前只支持JSON格式
      if (selectedFormat !== 'json') {
        setImportError('目前仅支持JSON格式导出')
        return
      }
      await onExport('json')
      onClose()
    } catch (error) {
      setImportError((error as Error).message)
    } finally {
      setIsLoading(false)
    }
  }

  const handleImport = async () => {
    if (!selectedFile) return
    if (!projectId) {
      setImportError('缺少项目ID，无法导入')
      return
    }

    setIsLoading(true)
    setImportError(null)
    try {
      // 只支持JSON格式导入
      if (!selectedFile.name.endsWith('.json')) {
        setImportError('目前仅支持JSON格式导入')
        return
      }

      // 读取文件内容
      const reader = new FileReader()
      reader.onload = async (e) => {
        try {
          const jsonData = e.target?.result as string
          await onImport(projectId, jsonData)
          onClose()
        } catch (error) {
          setImportError((error as Error).message)
        }
      }
      reader.readAsText(selectedFile)
    } catch (error) {
      setImportError((error as Error).message)
    } finally {
      setIsLoading(false)
    }
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      setSelectedFile(file)
    }
  }

  if (!isOpen) return null

  return (
    <div className="import-export-dialog fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-[#1a1a1a] rounded-lg border border-white/10 w-full max-w-md p-4">
        {/* 标题 */}
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-medium text-white">
            {mode === 'export' ? '导出剧本' : '导入剧本'}
          </h2>
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            className="h-6 w-6 p-0"
          >
            ×
          </Button>
        </div>

        {/* 模式切换 */}
        <div className="flex gap-2 mb-4">
          <Button
            variant={mode === 'export' ? 'secondary' : 'ghost'}
            size="sm"
            onClick={() => setMode('export')}
            className="flex-1"
          >
            <Download className="h-4 w-4 mr-1" />
            导出
          </Button>
          <Button
            variant={mode === 'import' ? 'secondary' : 'ghost'}
            size="sm"
            onClick={() => setMode('import')}
            className="flex-1"
          >
            <Upload className="h-4 w-4 mr-1" />
            导入
          </Button>
        </div>

        {/* 导出选项 */}
        {mode === 'export' && (
          <div className="space-y-3">
            <div className="text-sm text-[#888] mb-2">选择导出格式：</div>
            <div className="grid gap-2">
              <FormatButton
                format="json"
                selected={selectedFormat === 'json'}
                onClick={() => setSelectedFormat('json')}
                icon={<FileJson className="h-4 w-4" />}
                label="JSON 格式"
                description="保留完整结构信息"
              />
              <FormatButton
                format="markdown"
                selected={selectedFormat === 'markdown'}
                onClick={() => setSelectedFormat('markdown')}
                icon={<FileText className="h-4 w-4" />}
                label="Markdown 格式"
                description="易于阅读和编辑"
              />
              <FormatButton
                format="fdx"
                selected={selectedFormat === 'fdx'}
                onClick={() => setSelectedFormat('fdx')}
                icon={<Film className="h-4 w-4" />}
                label="Final Draft 格式"
                description="专业剧本格式"
              />
            </div>
            <Button
              onClick={handleExport}
              disabled={isLoading}
              className="w-full mt-4"
            >
              {isLoading ? '导出中...' : '导出'}
            </Button>
          </div>
        )}

        {/* 导入选项 */}
        {mode === 'import' && (
          <div className="space-y-3">
            <div className="text-sm text-[#888] mb-2">
              选择要导入的JSON文件：
            </div>
            <div className="border border-white/10 rounded p-3">
              <input
                type="file"
                accept=".json"
                onChange={handleFileChange}
                className="w-full text-sm text-[#888]"
              />
              {selectedFile && (
                <div className="mt-2 text-sm text-white">
                  已选择: {selectedFile.name}
                </div>
              )}
            </div>
            <div className="text-xs text-[#666]">
              目前仅支持JSON格式导入
            </div>
            {importError && (
              <div className="text-xs text-red-400">
                {importError}
              </div>
            )}
            <Button
              onClick={handleImport}
              disabled={isLoading || !selectedFile || !projectId}
              className="w-full mt-4"
            >
              {isLoading ? '导入中...' : '导入'}
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}

function FormatButton({
  format,
  selected,
  onClick,
  icon,
  label,
  description,
}: {
  format: string
  selected: boolean
  onClick: () => void
  icon: React.ReactNode
  label: string
  description: string
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-start gap-3 p-2 rounded border transition-colors ${selected
        ? 'border-emerald-500 bg-emerald-500/10'
        : 'border-white/10 hover:bg-white/5'
        }`}
    >
      <div className="text-[#888]">{icon}</div>
      <div className="flex-1 text-left">
        <div className="text-sm font-medium text-white">{label}</div>
        <div className="text-xs text-[#666]">{description}</div>
      </div>
    </button>
  )
}