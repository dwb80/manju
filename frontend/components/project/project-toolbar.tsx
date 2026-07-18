import { Button } from "@/components/ui/button";
import { WorkbenchPager } from "@/components/project/project-workbench";
import type { WorkbenchStatusOption, WorkbenchTab } from "@/lib/app-types";

interface ProjectToolbarProps {
    projectWorkbenchTab: WorkbenchTab;
    workbenchSearch: string;
    workbenchStatusFilter: string;
    workbenchOwnerFilter: string;
    currentWorkbenchStatusOptions: WorkbenchStatusOption[];
    workbenchOwnerOptions: string[];
    currentWorkbenchPageNumber: number;
    workbenchPageSize: number;
    workbenchFilteredCount: number;
    currentWorkbenchPageLabel: string;
    onSearchChange: (value: string) => void;
    onStatusFilterChange: (value: string) => void;
    onOwnerFilterChange: (value: string) => void;
    onResetFilters: () => void;
    onPageChange: (page: number) => void;
}

/**
 * ProjectToolbar - 项目工具栏组件
 * @param {ProjectToolbarProps} props - 组件属性
 * @returns {JSX.Element} 渲染的工具栏元素
 */
export function ProjectToolbar({
    projectWorkbenchTab,
    workbenchSearch,
    workbenchStatusFilter,
    workbenchOwnerFilter,
    currentWorkbenchStatusOptions,
    workbenchOwnerOptions,
    currentWorkbenchPageNumber,
    workbenchPageSize,
    workbenchFilteredCount,
    currentWorkbenchPageLabel,
    onSearchChange,
    onStatusFilterChange,
    onOwnerFilterChange,
    onResetFilters,
    onPageChange,
}: ProjectToolbarProps) {
    return (
        <div className="space-y-3">
            <div className="grid grid-cols-[1fr_170px_170px_auto] gap-3 rounded-2xl border border-white/10 bg-[#202020] p-3 max-lg:grid-cols-2 max-md:grid-cols-1">
                <input
                    className="h-11 rounded-xl border border-white/10 bg-[#2f2f2f] px-3 text-sm text-white outline-none transition-colors focus:border-emerald-500"
                    value={workbenchSearch}
                    placeholder="搜索当前页内容"
                    onChange={(event) => onSearchChange(event.target.value)}
                />
                <select
                    className="h-11 rounded-xl border border-white/10 bg-[#2f2f2f] px-3 text-sm text-white outline-none transition-colors focus:border-emerald-500"
                    value={workbenchStatusFilter}
                    disabled={currentWorkbenchStatusOptions.length === 0}
                    onChange={(event) => onStatusFilterChange(event.target.value)}
                >
                    <option value="all">{currentWorkbenchStatusOptions.length === 0 ? "无状态筛选" : "全部状态"}</option>
                    {currentWorkbenchStatusOptions.map((status) => (
                        <option key={status.key} value={status.key}>{status.label}</option>
                    ))}
                </select>
                <select
                    className="h-11 rounded-xl border border-white/10 bg-[#2f2f2f] px-3 text-sm text-white outline-none transition-colors focus:border-emerald-500"
                    value={workbenchOwnerFilter}
                    onChange={(event) => onOwnerFilterChange(event.target.value)}
                >
                    <option value="all">全部负责人</option>
                    {workbenchOwnerOptions.map((owner) => <option key={owner} value={owner}>{owner}</option>)}
                </select>
                <Button size="sm" variant="secondary" onClick={onResetFilters}>重置筛选</Button>
            </div>
            <WorkbenchPager
                total={workbenchFilteredCount}
                page={currentWorkbenchPageNumber}
                pageSize={workbenchPageSize}
                label={currentWorkbenchPageLabel}
                onPageChange={onPageChange}
            />
        </div>
    );
}