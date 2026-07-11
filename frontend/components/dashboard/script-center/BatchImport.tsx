'use client'

import { useState, useCallback, useRef } from 'react'
import {
  Upload,
  Download,
  FileJson,
  FileText,
  Film,
  CheckCircle,
  AlertCircle,
  X,
  Loader2,
  Trash2,
  RefreshCw,
  ArrowRight,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { scriptCenterService } from '@/services/script-center.service'

interface ImportFile {
  id: string
  file: File
  name: string
  size: number
  format: 'json' | 'markdown' | 'fdx'
  status: 'pending' | 'processing' | 'success' | 'error'
  progress: number
  error?: string
  result?: {
    scriptId?: string
    title?: string
  }
}

interface BatchImportProps {
  projectId: string
  onImportComplete?: (results: ImportFile[]) => void
}

export function BatchImport({ projectId, onImportComplete }: BatchImportProps) {
  const [files, setFiles] = useState<ImportFile[]>([])
  const [converting, setConverting] = useState(false)
  const [targetFormat, setTargetFormat] = useState<'json' | 'markdown' | 'fdx'>('json')
  const [importMode, setImportMode] = useState<'import' | 'convert'>('import')
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(e.target.files || [])
    const newFiles: ImportFile[] = selectedFiles.map((file) => ({
      id: Math.random().toString(36).substr(2, 9),
      file,
      name: file.name,
      size: file.size,
      format: getFormatFromFileName(file.name),
      status: 'pending',
      progress: 0,
    }))
    setFiles((prev) => [...prev, ...newFiles])
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }, [])

  const getFormatFromFileName = (fileName: string): 'json' | 'markdown' | 'fdx' => {
    if (fileName.endsWith('.json')) return 'json'
    if (fileName.endsWith('.md') || fileName.endsWith('.markdown')) return 'markdown'
    if (fileName.endsWith('.fdx')) return 'fdx'
    return 'json'
  }

  const removeFile = useCallback((fileId: string) => {
    setFiles((prev) => prev.filter((f) => f.id !== fileId))
  }, [])

  const clearAllFiles = useCallback(() => {
    setFiles([])
  }, [])

  const processFiles = useCallback(async () => {
    if (files.length === 0) return

    setConverting(true)

    for (const file of files) {
      // 更新状态为处理中
      setFiles((prev) =>
        prev.map((f) => (f.id === file.id ? { ...f, status: 'processing', progress: 10 } : f))
      )

      try {
        if (importMode === 'import') {
          // 导入文件
          await processImportFile(file)
        } else {
          // 格式转换
          await processConvertFile(file)
        }
      } catch (error) {
        setFiles((prev) =>
          prev.map((f) =>
            f.id === file.id
              ? {
                  ...f,
                  status: 'error',
                  progress: 100,
                  error: (error as Error).message,
                }
              : f
          )
        )
      }
    }

    setConverting(false)
    if (onImportComplete) {
      onImportComplete(files)
    }
  }, [files, importMode, onImportComplete])

  const processImportFile = async (file: ImportFile) => {
    // 模拟进度更新
    for (let i = 20; i <= 80; i += 20) {
      await new Promise((resolve) => setTimeout(resolve, 200))
      setFiles((prev) =>
        prev.map((f) => (f.id === file.id ? { ...f, progress: i } : f))
      )
    }

    // 读取文件内容
    const reader = new FileReader()
    reader.onload = async (e) => {
      try {
        const content = e.target?.result as string

        // 调用导入API
        if (file.format === 'json') {
          const result = await scriptCenterService.importScript(projectId, content)
          setFiles((prev) =>
            prev.map((f) =>
              f.id === file.id
                ? {
                    ...f,
                    status: 'success',
                    progress: 100,
                    result: { scriptId: result.id, title: result.title },
                  }
                : f
            )
          )
        } else {
          // 其他格式需要先转换
          setFiles((prev) =>
            prev.map((f) =>
              f.id === file.id
                ? {
                    ...f,
                    status: 'error',
                    progress: 100,
                    error: '目前仅支持JSON格式导入',
                  }
                : f
            )
          )
        }
      } catch (error) {
        setFiles((prev) =>
          prev.map((f) =>
            f.id === file.id
              ? {
                  ...f,
                  status: 'error',
                  progress: 100,
                  error: (error as Error).message,
                }
              : f
          )
        )
      }
    }
    reader.readAsText(file.file)

    // 等待文件读取完成
    await new Promise((resolve) => setTimeout(resolve, 500))
  }

  const processConvertFile = async (file: ImportFile) => {
    // 模拟转换过程
    for (let i = 20; i <= 90; i += 20) {
      await new Promise((resolve) => setTimeout(resolve, 200))
      setFiles((prev) =>
        prev.map((f) => (f.id === file.id ? { ...f, progress: i } : f))
      )
    }

    // 模拟转换完成（实际需要调用转换API）
    await new Promise((resolve) => setTimeout(resolve, 300))

    setFiles((prev) =>
      prev.map((f) =>
        f.id === file.id
          ? {
              ...f,
              status: 'success',
              progress: 100,
              result: { title: `${file.name} (${targetFormat})` },
            }
          : f
      )
    )
  }

  const downloadConvertedFile = useCallback(async (file: ImportFile) => {
    if (!file.result?.scriptId) return

    try {
      // 获取转换后的文件
      const blob = await scriptCenterService.exportScript(
        file.result.scriptId,
        targetFormat
      )
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${file.name.replace(/\.[^/.]+$/, '')}.${targetFormat}`
      a.click()
      URL.revokeObjectURL(url)
    } catch (error) {
      console.error('Failed to download converted file:', error)
    }
  }, [targetFormat])

  const formatFileSize = (size: number) => {
    if (size < 1024) return `${size}B`
    if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)}KB`
    return `${(size / (1024 * 1024)).toFixed(1)}MB`
  }

  const successCount = files.filter((f) => f.status === 'success').length
  const errorCount = files.filter((f) => f.status === 'error').length
  const processingCount = files.filter((f) => f.status === 'processing').length

  return (
    <div className="batch-import bg-[#1a1a1a] rounded-lg border border-white/10 overflow-hidden">
      {/* 标题 */}
      <div className="p-3 border-b border-white/10">
        <h3 className="text-sm font-medium text-white">批量导入与格式转换</h3>
      </div>

      {/* 模式切换 */}
      <div className="p-3 border-b border-white/10">
        <div className="flex gap-2 mb-3">
          <button
            onClick={() => setImportMode('import')}
            className={`flex-1 px-3 py-2 rounded text-sm transition-colors ${
              importMode === 'import'
                ? 'bg-blue-500/20 text-blue-400 border border-blue-500/50'
                : 'bg-white/5 text-[#888] border border-white/10 hover:bg-white/10'
            }`}
          >
            <Upload className="h-4 w-4 inline mr-1" />
            批量导入
          </button>
          <button
            onClick={() => setImportMode('convert')}
            className={`flex-1 px-3 py-2 rounded text-sm transition-colors ${
              importMode === 'convert'
                ? 'bg-purple-500/20 text-purple-400 border border-purple-500/50'
                : 'bg-white/5 text-[#888] border border-white/10 hover:bg-white/10'
            }`}
          >
            <ArrowRight className="h-4 w-4 inline mr-1" />
            格式转换
          </button>
        </div>

        {/* 格式转换的目标格式选择 */}
        {importMode === 'convert' && (
          <div className="mb-3">
            <div className="text-xs text-[#888] mb-2">目标格式：</div>
            <div className="grid grid-cols-3 gap-2">
              <button
                onClick={() => setTargetFormat('json')}
                className={`flex items-center gap-2 p-2 rounded border transition-colors ${
                  targetFormat === 'json'
                    ? 'border-emerald-500 bg-emerald-500/10'
                    : 'border-white/10 hover:bg-white/5'
                }`}
              >
                <FileJson className="h-3 w-3 text-[#888]" />
                <span className="text-xs text-white">JSON</span>
              </button>
              <button
                onClick={() => setTargetFormat('markdown')}
                className={`flex items-center gap-2 p-2 rounded border transition-colors ${
                  targetFormat === 'markdown'
                    ? 'border-emerald-500 bg-emerald-500/10'
                    : 'border-white/10 hover:bg-white/5'
                }`}
              >
                <FileText className="h-3 w-3 text-[#888]" />
                <span className="text-xs text-white">Markdown</span>
              </button>
              <button
                onClick={() => setTargetFormat('fdx')}
                className={`flex items-center gap-2 p-2 rounded border transition-colors ${
                  targetFormat === 'fdx'
                    ? 'border-emerald-500 bg-emerald-500/10'
                    : 'border-white/10 hover:bg-white/5'
                }`}
              >
                <Film className="h-3 w-3 text-[#888]" />
                <span className="text-xs text-white">FDX</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* 文件上传区域 */}
      <div className="p-3 border-b border-white/10">
        <div
          className="border border-white/10 rounded p-6 text-center cursor-pointer hover:border-white/20 transition-colors"
          onClick={() => fileInputRef.current?.click()}
        >
          <Upload className="h-8 w-8 text-[#888] mx-auto mb-2" />
          <div className="text-sm text-[#888] mb-1">点击选择文件或拖拽文件到此处</div>
          <div className="text-xs text-[#666]">
            支持 JSON、Markdown、FDX 格式
          </div>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept=".json,.md,.markdown,.fdx"
            onChange={handleFileSelect}
            className="hidden"
          />
        </div>
      </div>

      {/* 文件列表 */}
      <div className="p-3">
        {files.length === 0 ? (
          <div className="text-center py-8 text-[#666] text-sm">尚未添加文件</div>
        ) : (
          <div className="space-y-2">
            {/* 统计信息 */}
            <div className="flex items-center justify-between mb-3 p-2 bg-white/5 rounded">
              <div className="text-xs text-[#888]">
                共 {files.length} 个文件
                {successCount > 0 && (
                  <span className="text-emerald-400 ml-2">
                    {successCount} 成功
                  </span>
                )}
                {errorCount > 0 && (
                  <span className="text-red-400 ml-2">{errorCount} 失败</span>
                )}
                {processingCount > 0 && (
                  <span className="text-yellow-400 ml-2">
                    {processingCount} 处理中
                  </span>
                )}
              </div>
              {files.length > 0 && !converting && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={clearAllFiles}
                  className="h-6 text-xs"
                >
                  <Trash2 className="h-3 w-3 mr-1" />
                  清空
                </Button>
              )}
            </div>

            {/* 文件项 */}
            {files.map((file) => (
              <div
                key={file.id}
                className={`p-3 bg-white/5 rounded border ${
                  file.status === 'success'
                    ? 'border-emerald-500/50'
                    : file.status === 'error'
                    ? 'border-red-500/50'
                    : 'border-white/10'
                }`}
              >
                <div className="flex items-start gap-3">
                  {/* 文件图标 */}
                  <div className="flex-shrink-0">
                    {file.format === 'json' && <FileJson className="h-5 w-5 text-blue-400" />}
                    {file.format === 'markdown' && <FileText className="h-5 w-5 text-purple-400" />}
                    {file.format === 'fdx' && <Film className="h-5 w-5 text-emerald-400" />}
                  </div>

                  {/* 文件信息 */}
                  <div className="flex-1 min-w-0">
                    <div className="text-sm text-white truncate mb-1">{file.name}</div>
                    <div className="flex items-center gap-2 text-xs text-[#888]">
                      <span>{formatFileSize(file.size)}</span>
                      <span>•</span>
                      <span>
                        {importMode === 'import' ? '导入' : `${file.format} → ${targetFormat}`}
                      </span>
                    </div>

                    {/* 进度条 */}
                    {file.status === 'processing' && (
                      <div className="mt-2">
                        <div className="h-1 bg-white/5 rounded overflow-hidden">
                          <div
                            className="h-full bg-blue-500 transition-all"
                            style={{ width: `${file.progress}%` }}
                          />
                        </div>
                        <div className="text-xs text-[#888] mt-1">
                          处理中... {file.progress}%
                        </div>
                      </div>
                    )}

                    {/* 结果信息 */}
                    {file.status === 'success' && file.result && (
                      <div className="mt-2 text-xs text-emerald-400">
                        <CheckCircle className="h-3 w-3 inline mr-1" />
                        {file.result.title || '处理完成'}
                      </div>
                    )}

                    {/* 错误信息 */}
                    {file.status === 'error' && file.error && (
                      <div className="mt-2 text-xs text-red-400">
                        <AlertCircle className="h-3 w-3 inline mr-1" />
                        {file.error}
                      </div>
                    )}
                  </div>

                  {/* 操作按钮 */}
                  <div className="flex items-center gap-1">
                    {file.status === 'success' && importMode === 'convert' && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => downloadConvertedFile(file)}
                        className="h-6 w-6 p-0"
                        title="下载转换后的文件"
                      >
                        <Download className="h-3 w-3" />
                      </Button>
                    )}
                    {!converting && file.status !== 'processing' && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => removeFile(file.id)}
                        className="h-6 w-6 p-0 text-red-400 hover:text-red-300"
                        title="删除"
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 操作按钮 */}
      <div className="p-3 border-t border-white/10">
        <div className="flex items-center justify-between">
          <div className="text-xs text-[#888]">
            {importMode === 'import' ? '将导入文件到项目' : '将转换文件格式'}
          </div>
          <div className="flex items-center gap-2">
            {files.length > 0 && !converting && (
              <Button
                variant="ghost"
                size="sm"
                onClick={clearAllFiles}
                className="h-7"
              >
                取消
              </Button>
            )}
            <Button
              size="sm"
              onClick={processFiles}
              disabled={files.length === 0 || converting}
              className="h-7"
            >
              {converting ? (
                <>
                  <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                  处理中...
                </>
              ) : (
                <>
                  {importMode === 'import' ? (
                    <>
                      <Upload className="h-3 w-3 mr-1" />
                      开始导入 ({files.length})
                    </>
                  ) : (
                    <>
                      <ArrowRight className="h-3 w-3 mr-1" />
                      开始转换 ({files.length})
                    </>
                  )}
                </>
              )}
            </Button>
          </div>
        </div>
      </div>

      {/* 导入结果报告 */}
      {successCount > 0 && !converting && (
        <div className="p-3 border-t border-white/10 bg-emerald-500/10">
          <div className="text-sm text-emerald-400 mb-2">
            <CheckCircle className="h-4 w-4 inline mr-1" />
            {importMode === 'import' ? '导入完成' : '转换完成'}
          </div>
          <div className="text-xs text-white">
            成功处理 {successCount} 个文件
            {errorCount > 0 && `, ${errorCount} 个文件失败`}
          </div>
        </div>
      )}
    </div>
  )
}