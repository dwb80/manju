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

import { DialogOverlay } from "../ScriptsCenterPage";
import { ImportFormPanel } from "./ImportFormPanel";
import { PreviewDialog } from "./PreviewDialog";
import { useScriptImport } from "./useScriptImport";

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
    updatePreviewTitle,
  } = useScriptImport({ projectId, onImported });

  if (!isOpen) return null;

  return (
    <DialogOverlay title="导入剧本" onClose={onClose} wide>
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
        />
      )}

      {showPreview && preview && (
        <PreviewDialog
          preview={preview}
          isImporting={isImporting}
          onTitleChange={updatePreviewTitle}
          onConfirm={handleConfirmImport}
          onCancel={handleCancelPreview}
        />
      )}
    </DialogOverlay>
  );
}
