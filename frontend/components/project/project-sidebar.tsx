import type { Project, WorkbenchPage, WorkbenchTab } from "@/lib/app-types";

interface ProjectSidebarProps {
    selectedProject: Project;
    projectWorkbenchTab: WorkbenchTab;
    workbenchPages: WorkbenchPage[];
    supportWorkbenchPages: WorkbenchPage[];
    currentWorkbenchPage: WorkbenchPage | undefined;
    onOpenWorkbenchPage: (tab: WorkbenchTab) => void;
}

export function ProjectSidebar({
    selectedProject,
    projectWorkbenchTab,
    workbenchPages,
    supportWorkbenchPages,
    currentWorkbenchPage,
    onOpenWorkbenchPage,
}: ProjectSidebarProps) {
    return (
        <aside className="sticky top-3 h-fit overflow-hidden rounded-2xl border border-white/10 bg-[#171717] shadow-[0_18px_60px_rgba(0,0,0,0.22)] max-lg:static">
            <div className="border-b border-white/10 p-4">
                <div className="min-w-0">
                    <button className="mb-2 text-xs font-medium text-emerald-200 hover:text-white" onClick={() => onOpenWorkbenchPage("overview")}>
                        项目工作台
                    </button>
                    <div className="truncate text-base font-semibold text-white">{selectedProject.name}</div>
                    <div className="mt-1 truncate text-xs font-medium text-[#a8a8a8]">{currentWorkbenchPage?.label} · {currentWorkbenchPage?.metric || "项目首页"}</div>
                </div>
            </div>
            <div className="space-y-5 p-3">
                <div className="space-y-1">
                    <div className="px-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-[#777]">制作流程</div>
                    {workbenchPages.map((tab) => (
                        <button
                            key={tab.key}
                            className={`group flex w-full items-center justify-between gap-3 rounded-lg px-2.5 py-2 text-left transition-colors ${projectWorkbenchTab === tab.key ? "bg-white/10 text-white" : "text-[#cfcfcf] hover:bg-white/[0.06] hover:text-white"}`}
                            onClick={() => onOpenWorkbenchPage(tab.key)}
                        >
                            <span className="text-sm font-medium">{tab.label}</span>
                            <span className="max-w-[82px] truncate text-right text-[11px] text-[#8c8c8c] group-hover:text-[#bdbdbd]">{tab.metric}</span>
                        </button>
                    ))}
                </div>
                <div className="space-y-1">
                    <div className="px-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-[#777]">项目管理</div>
                    {supportWorkbenchPages.map((tab) => (
                        <button
                            key={tab.key}
                            className={`group flex w-full items-center justify-between gap-3 rounded-lg px-2.5 py-2 text-left transition-colors ${projectWorkbenchTab === tab.key ? "bg-white/10 text-white" : "text-[#cfcfcf] hover:bg-white/[0.06] hover:text-white"}`}
                            onClick={() => onOpenWorkbenchPage(tab.key)}
                        >
                            <span className="text-sm font-medium">{tab.label}</span>
                            <span className="max-w-[82px] truncate text-right text-[11px] text-[#8c8c8c] group-hover:text-[#bdbdbd]">{tab.metric}</span>
                        </button>
                    ))}
                </div>
            </div>
        </aside>
    );
}