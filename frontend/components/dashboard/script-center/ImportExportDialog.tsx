/**
 * @file ImportExportDialog.tsx
 * @description 导入导出对话框组件，支持JSON、TXT、Markdown、HTML、FDX等格式
 */
'use client'

import { useState } from 'react'
import {
  Download,
  Upload,
  FileJson,
  FileText,
  FileCode,
  FileType,
  Film,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Tip } from '@/components/ui/tip'
import { ConfirmDialog } from '@/components/common/confirm-dialog'
import { exportScript, importScript, detectFormat } from '@/lib/script-format'
import type { ScriptFormat } from '@/lib/script-format'

interface ImportExportDialogProps {
  isOpen: boolean
  onClose: () => void
  editorJson?: any
  title?: string
  onExport?: (format: ScriptFormat, content: string, filename: string) => void
  onImport?: (editorJson: any) => void
}

/**
 * ImportExportDialog - 导入导出对话框组件
 * @param {ImportExportDialogProps} props - 组件属性
 * @param {boolean} props.isOpen - 是否打开对话框
 * @param {Function} props.onClose - 关闭回调
 * @param {any} props.editorJson - 编辑器JSON内容
 * @param {string} props.title - 剧本标题
 * @param {Function} props.onExport - 导出回调
 * @param {Function} props.onImport - 导入回调
 * @returns {JSX.Element | null} 渲染的对话框界面
 */
export function ImportExportDialog({
  isOpen,
  onClose,
  editorJson,
  title = '剧本',
  onExport,
  onImport,
}: ImportExportDialogProps) {
  const [mode, setMode] = useState<'export' | 'import'>('export')
  const [selectedFormat, setSelectedFormat] = useState<ScriptFormat>('json')
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [detectedFormat, setDetectedFormat] = useState<ScriptFormat | null>(null)

  const exportFormats: {
    format: ScriptFormat
    icon: React.ReactNode
    label: string
    description: string
  }[] = [
      {
        format: 'json',
        icon: <FileJson className="h-4 w-4" />,
        label: 'JSON 格式',
        description: '保留完整结构，可重新导入',
      },
      {
        format: 'txt',
        icon: <FileText className="h-4 w-4" />,
        label: 'TXT 纯文本',
        description: '通用纯文本格式',
      },
      {
        format: 'markdown',
        icon: <FileType className="h-4 w-4" />,
        label: 'Markdown',
        description: '带格式的轻量标记语言',
      },
      {
        format: 'html',
        icon: <FileCode className="h-4 w-4" />,
        label: 'HTML 网页',
        description: '可直接在浏览器打开预览',
      },
      {
        format: 'fdx',
        icon: <Film className="h-4 w-4" />,
        label: 'Final Draft (.fdx)',
        description: '专业剧本软件格式',
      },
    ]

  const handleExport = async () => {
    if (!editorJson) {
      setErrorMsg('没有可导出的内容')
      return
    }
    setIsLoading(true)
    setErrorMsg(null)
    try {
      const { content, filename, mimeType } = exportScript(editorJson, selectedFormat, title)

      if (onExport) {
        onExport(selectedFormat, content, filename)
      } else {
        // 直接下载
        const blob = new Blob(['\ufeff' + content], { type: mimeType })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = filename
        a.click()
        URL.revokeObjectURL(url)
      }

      onClose()
    } catch (error) {
      setErrorMsg((error as Error).message)
    } finally {
      setIsLoading(false)
    }
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      setSelectedFile(file)
      const fmt = detectFormat(file.name)
      setDetectedFormat(fmt)
      if (fmt) {
        setSelectedFormat(fmt)
      }
      setErrorMsg(null)
    }
  }

  const handleImport = async () => {
    if (!selectedFile) return

    setIsLoading(true)
    setErrorMsg(null)
    try {
      const text = await selectedFile.text()
      const doc = importScript(text, selectedFormat)

      if (onImport) {
        onImport(doc)
      }

      onClose()
    } catch (error) {
      setErrorMsg((error as Error).message)
    } finally {
      setIsLoading(false)
    }
  }

  const acceptFormats = '.json,.txt,.md,.markdown,.html,.htm,.fdx'

  if (!isOpen) return null

  return (
    <div className="import-export-dialog fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-[#1a1a1a] rounded-lg border border-white/10 w-full max-w-lg p-4">
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
            onClick={() => {
              setMode('export')
              setErrorMsg(null)
            }}
            className="flex-1"
          >
            <Download className="h-4 w-4 mr-1" />
            导出
          </Button>
          <Button
            variant={mode === 'import' ? 'secondary' : 'ghost'}
            size="sm"
            onClick={() => {
              setMode('import')
              setErrorMsg(null)
            }}
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
            <div className="grid gap-2 max-h-[320px] overflow-y-auto pr-1">
              {exportFormats.map((item) => (
                <button
                  key={item.format}
                  onClick={() => setSelectedFormat(item.format)}
                  className={`flex items-start gap-3 p-3 rounded border transition-colors text-left ${selectedFormat === item.format
                    ? 'border-emerald-500 bg-emerald-500/10'
                    : 'border-white/10 hover:bg-white/5'
                    }`}
                >
                  <div className="text-[#888] mt-0.5">{item.icon}</div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-white">{item.label}</div>
                    <div className="text-xs text-[#666] mt-0.5">{item.description}</div>
                  </div>
                  {selectedFormat === item.format && (
                    <div className="text-emerald-400 text-xs">✓</div>
                  )}
                </button>
              ))}
            </div>
            {errorMsg && (
              <div className="text-xs text-red-400">{errorMsg}</div>
            )}
            <Button
              onClick={handleExport}
              disabled={isLoading || !editorJson}
              className="w-full mt-2"
            >
              {isLoading ? '导出中...' : '导出文件'}
            </Button>
          </div>
        )}

        {/* 导入选项 */}
        {mode === 'import' && (
          <div className="space-y-3">
            <div className="text-sm text-[#888] mb-2">
              选择要导入的文件：
            </div>
            <div className="border border-white/10 rounded p-3">
              <input
                type="file"
                accept={acceptFormats}
                onChange={handleFileChange}
                className="w-full text-sm text-[#888]"
              />
              {selectedFile && (
                <div className="mt-2 text-sm text-white">
                  已选择: {selectedFile.name}
                  {detectedFormat && (
                    <span className="text-[#888] ml-2">
                      (格式: {detectedFormat.toUpperCase()})
                    </span>
                  )}
                </div>
              )}
            </div>

            <div className="text-sm text-[#888] mb-2">
              文件格式：
            </div>
            <div className="grid grid-cols-5 gap-1">
              {exportFormats.map((item) => (
                <Tip key={item.format} label={item.label} side="top">
                  <button
                    onClick={() => setSelectedFormat(item.format)}
                    className={`w-full py-2 px-1 text-xs rounded border transition-colors ${selectedFormat === item.format
                      ? 'border-emerald-500 bg-emerald-500/10 text-emerald-400'
                      : 'border-white/10 text-[#888] hover:bg-white/5'
                      }`}
                  >
                    {item.format.toUpperCase()}
                  </button>
                </Tip>
              ))}
            </div>

            <div className="text-xs text-[#666]">
              支持格式: JSON / TXT / Markdown / HTML / Final Draft (.fdx)
            </div>
            {errorMsg && (
              <div className="text-xs text-red-400">{errorMsg}</div>
            )}
            <Button
              onClick={handleImport}
              disabled={isLoading || !selectedFile}
              className="w-full mt-2"
            >
              {isLoading ? '导入中...' : '导入文件'}
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}
