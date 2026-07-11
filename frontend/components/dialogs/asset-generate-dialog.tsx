import { X, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
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
    onFieldChange: (key: string, value: any) => void;
}

export function AssetGenerateDialog({
    generatedAssetDialog,
    onSubmit,
    onClose,
    onFieldChange,
}: AssetGenerateDialogProps) {
    if (!generatedAssetDialog) return null;

    return (
        <div className="fixed inset-0 z-[92] grid place-items-center bg-black/60 px-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label="加入资产库">
            <div className="w-full max-w-lg overflow-hidden rounded-2xl border border-white/10 bg-[#202020] shadow-2xl">
                <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
                    <div>
                        <div className="text-base font-semibold text-white">加入资产库</div>
                        <div className="mt-1 text-xs text-[#b4b4b4]">把这张生成图归档到项目资产，后续可作为参考图或分镜底图复用。</div>
                    </div>
                    <button className="grid h-8 w-8 place-items-center rounded-lg text-[#d8d8d8] hover:bg-white/10 hover:text-white" onClick={onClose} aria-label="关闭加入资产库">
                        <X className="h-4 w-4" />
                    </button>
                </div>
                <div className="space-y-3 p-5">
                    <label className="grid grid-cols-[96px_1fr] items-center gap-3 max-sm:grid-cols-1 max-sm:gap-1">
                        <span className="text-right text-xs font-medium text-[#d8d8d8] max-sm:text-left">资产类型</span>
                        <select
                            className="h-10 rounded-lg border border-white/10 bg-[#2f2f2f] px-3 text-sm text-white outline-none focus:border-emerald-500"
                            value={generatedAssetDialog.kind}
                            onChange={(event) => onFieldChange("kind", event.target.value as ProjectAssetKind)}
                        >
                            {projectAssetKinds.map((kind) => <option key={kind.key} value={kind.key}>{kind.label}</option>)}
                        </select>
                    </label>
                    <label className="grid grid-cols-[96px_1fr] items-center gap-3 max-sm:grid-cols-1 max-sm:gap-1">
                        <span className="text-right text-xs font-medium text-[#d8d8d8] max-sm:text-left">资产名称</span>
                        <input
                            className="h-10 rounded-lg border border-white/10 bg-[#2f2f2f] px-3 text-sm text-white outline-none focus:border-emerald-500"
                            value={generatedAssetDialog.name}
                            placeholder="请输入资产名称"
                            onChange={(event) => onFieldChange("name", event.target.value)}
                        />
                    </label>
                </div>
                <div className="flex justify-end gap-2 border-t border-white/10 px-5 py-4">
                    <Button size="sm" variant="secondary" onClick={onClose}>取消</Button>
                    <Button size="sm" onClick={() => void onSubmit()}><Check className="h-4 w-4" />加入资产库</Button>
                </div>
            </div>
        </div>
    );
}