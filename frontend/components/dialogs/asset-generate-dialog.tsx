/**
 * @file asset-generate-dialog.tsx
 * @description 资产生成对话框组件，用于AI生成资产图片
 */

"use client";

import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { ImageTask, ProjectAssetKind } from "@/lib/app-types";
import { projectAssetKinds } from "@/lib/project-workflow";

interface GeneratedAssetDialog {
    task: ImageTask;
    imageUrl: string;
    projectId: string;
    kind: ProjectAssetKind;
    name: string;
}

interface AssetGenerateDialogProps {
    generatedAssetDialog: GeneratedAssetDialog | null;
    onSubmit: () => Promise<void>;
    onClose: () => void;
    onFieldChange: (key: string, value: ProjectAssetKind | string) => void;
}

/**
 * 生成图归档到项目资产的弹窗。
 *
 * 基于 shadcn Dialog 封装，保留旧 API 接口，调用方零迁移成本。
 */
export function AssetGenerateDialog({
    generatedAssetDialog,
    onSubmit,
    onClose,
    onFieldChange,
}: AssetGenerateDialogProps) {
    if (!generatedAssetDialog) return null;

    return (
        <Dialog open onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="border-border">
                <DialogHeader>
                    <DialogTitle>加入资产库</DialogTitle>
                    <DialogDescription>
                        把这张生成图归档到项目资产，后续可作为参考图或分镜底图复用。
                    </DialogDescription>
                </DialogHeader>

                <form
                    onSubmit={(e) => {
                        e.preventDefault();
                        void onSubmit();
                    }}
                    className="space-y-3"
                >
                    <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-[96px_1fr] sm:items-center sm:gap-3">
                        <label
                            htmlFor="asset-generate-kind"
                            className="text-xs font-medium text-muted-foreground sm:text-right"
                        >
                            资产类型
                        </label>
                        <select
                            id="asset-generate-kind"
                            value={generatedAssetDialog.kind}
                            onChange={(event) =>
                                onFieldChange("kind", event.target.value as ProjectAssetKind)
                            }
                            className="h-10 w-full rounded-md border border-border bg-muted px-3 text-sm text-foreground outline-none focus:border-emerald-500"
                        >
                            {projectAssetKinds.map((kind) => (
                                <option key={kind.key} value={kind.key}>
                                    {kind.label}
                                </option>
                            ))}
                        </select>
                    </div>

                    <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-[96px_1fr] sm:items-center sm:gap-3">
                        <label
                            htmlFor="asset-generate-name"
                            className="text-xs font-medium text-muted-foreground sm:text-right"
                        >
                            资产名称
                        </label>
                        <Input
                            id="asset-generate-name"
                            value={generatedAssetDialog.name}
                            placeholder="请输入资产名称"
                            onChange={(event) => onFieldChange("name", event.target.value)}
                        />
                    </div>

                    <DialogFooter className="pt-2">
                        <Button size="sm" variant="secondary" type="button" onClick={onClose}>
                            取消
                        </Button>
                        <Button size="sm" type="submit">
                            <Check className="mr-1 h-3.5 w-3.5" />
                            加入资产库
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
