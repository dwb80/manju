"use client";

/**
 * 模板库对话框
 */

import { TemplateLibrary } from "@/components/dashboard/script-center";
import { DialogOverlay } from "./ScriptsCenterPage";

export function TemplateLibraryDialog({
  isOpen,
  onClose,
  onCreateFromTemplate,
}: {
  isOpen: boolean;
  onClose: () => void;
  onCreateFromTemplate: (template: any) => Promise<void>;
}) {
  if (!isOpen) return null;

  return (
    <DialogOverlay title="剧本模板库" onClose={onClose}>
      <TemplateLibrary
        onSelectTemplate={() => {}}
        onCreateFromTemplate={onCreateFromTemplate}
      />
    </DialogOverlay>
  );
}
