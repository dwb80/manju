"use client";

/**
 * 导入剧本对话框（入口组件）
 *
 * 流程（对齐需求文档 Feature 4.5）：
 * 1. 用户选择格式 + 输入/上传剧本内容  —— ImportFormPanel
 * 2. 点击"解析预览" → 本地解析展示识别结果（剧集/场景/对白 + 资产匹配）—— PreviewDialog
 * 3. 用户确认或调整后点击"确认导入" → 写入数据库
 *
 * 状态机和导入逻辑封装在 useScriptImport 中。
 */

import { useEffect } from "react";
import { DialogOverlay } from "../ScriptsCenterPage";
import { ImportFormPanel } from "./ImportFormPanel";
import { PreviewDialog } from "./PreviewDialog";
import { useScriptImport } from "./useScriptImport";
import { ErrorBoundary } from "@/components/common/ErrorBoundary";

export function ScriptImportDialog({
  isOpen,
  onClose,
  projectId,
  onImported,
}: {
  isOpen: boolean;
  onClose: () => void;
  projectId: string | null;
  onImported: () => void | Promise<void>;
}) {
  const {
    importFormat, setImportFormat,
    importText, setImportText,
    importFileName,
    isImporting,
    isAnalyzingScript,
    analysisStatus,
    preview,
    showPreview,
    fileInputRef,
    handleFileSelect,
    handleParsePreview,
    handleConfirmImport,
    handleCancelPreview,
    handleClose: handleCloseWithConfirm,
    updatePreviewTitle,
    chatModels,
    selectedModelId,
    setSelectedModelId,
    isLoadingModels,
    reloadChatModels,
  } = useScriptImport({ projectId, onImported });

  // 键盘快捷键
  // - Esc：关闭对话框（loading 时会二次确认）
  // - Cmd/Ctrl + Enter：触发解析预览
  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        // 与右上角 X 按钮共用同一条路径，保持三处行为一致
        if (isAnalyzingScript || isImporting) {
          const action = isImporting ? "导入" : "AI 解析";
          const ok = window.confirm(
            `${action}正在进行中，确定要中断并关闭吗？\n已输入的内容将被丢弃。`
          );
          if (!ok) return;
        }
        onClose();
      } else if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
        // 仅在表单阶段生效，预览阶段不重复触发
        if (!showPreview && !isAnalyzingScript && importText.trim()) {
          e.preventDefault();
          handleParsePreview();
        }
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [
    isOpen,
    showPreview,
    isAnalyzingScript,
    isImporting,
    importText,
    handleParsePreview,
    onClose,
  ]);

  if (!isOpen) return null;

  /**
   * 统一的关闭请求：先弹二次确认（仅在 AI 解析/导入 进行中时），
   * 用户确认后再重置内部状态 + 调用父组件的 onClose 把 isOpen 设为 false。
   * 这样右上角 X 按钮、Esc 键、底部"取消"按钮三处行为完全一致。
   */
  const handleRequestClose = () => {
    if (isAnalyzingScript || isImporting) {
      const action = isImporting ? "导入" : "AI 解析";
      const ok = window.confirm(
        `${action}正在进行中，确定要中断并关闭吗？\n已输入的内容将被丢弃。`
      );
      if (!ok) return;
    }
    // 重置内部状态（与 hook 内 handleClose 行为一致）
    handleCloseWithConfirm();
    onClose();
  };

  return (
    <DialogOverlay title="导入剧本" onClose={handleRequestClose} wide>
      {!showPreview && (
        <ImportFormPanel
          importFormat={importFormat}
          setImportFormat={setImportFormat}
          importText={importText}
          setImportText={setImportText}
          importFileName={importFileName}
          fileInputRef={fileInputRef}
          onFileSelect={handleFileSelect}
          onParse={handleParsePreview}
          onClose={() => {
            handleCancelPreview();
            onClose();
          }}
          isAnalyzingScript={isAnalyzingScript}
          analysisStatus={analysisStatus}
          chatModels={chatModels}
          selectedModelId={selectedModelId}
          setSelectedModelId={setSelectedModelId}
          isLoadingModels={isLoadingModels}
          onReloadModels={reloadChatModels}
        />
      )}

      {showPreview && preview && (
        <ErrorBoundary scope="PreviewDialog">
          <PreviewDialog
            preview={preview}
            isImporting={isImporting}
            onTitleChange={updatePreviewTitle}
            onConfirm={handleConfirmImport}
            onCancel={handleCancelPreview}
          />
        </ErrorBoundary>
      )}
    </DialogOverlay>
  );
}
