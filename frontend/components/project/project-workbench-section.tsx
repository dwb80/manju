"use client";

import type {
    Project,
    ProjectSummary,
    ProjectTask,
    ProjectTaskStatus,
    ProjectMember,
    ProjectEpisode,
    ProjectIssue,
    ProjectIssueSeverity,
    ProjectIssueStatus,
    ProjectMilestone,
    ProjectMilestoneStatus,
    ProjectScript,
    ProjectStoryboard,
    ProjectStoryboardStatus,
    ProjectClip,
    ProjectClipStatus,
    ProjectReview,
    ProjectAsset,
    ProjectAssetKind,
    WorkbenchTab,
    ProjectHealth,
} from "@/lib/app-types";
import { ProjectSidebar } from "@/components/project/project-sidebar";
import { ProjectHeader } from "@/components/project/project-header";
import { ProjectToolbar } from "@/components/project/project-toolbar";
import { ProjectWorkbenchTabs } from "@/components/project/project-workbench-tabs";
import { ProjectListView } from "@/components/project/project-list-view";
import {
    clipStatuses,
    clipStatusText,
    projectAssetKinds,
    projectTaskColumns,
    scriptStatusText,
    storyboardStatuses,
    storyboardStatusText,
} from "@/lib/project-workflow";

export interface ProjectWorkbenchSectionProps {
    mode: "chat" | "image" | "video" | "favorites" | "project";
    selectedProject: Project | undefined;
    projectSummary: ProjectSummary | null;
    projectWorkbenchTab: WorkbenchTab;
    workbenchPages: any;
    supportWorkbenchPages: any;
    currentWorkbenchPage: any;
    projectDraft: Partial<Project>;
    projectHealth: ProjectHealth | null;
    productionProgress: number;
    productionProgressItems: any[];
    productionStageRows: any[];
    openIssueCount: number;
    pendingReviewCount: number;
    completedTaskCount: number;
    nextMilestone: ProjectMilestone | undefined;
    projectTasks: ProjectTask[];
    assetKindCounts: Record<string, number>;
    workbenchSearch: string;
    workbenchStatusFilter: string;
    workbenchOwnerFilter: string;
    currentWorkbenchStatusOptions: any;
    workbenchOwnerOptions: any;
    currentWorkbenchPageNumber: number;
    workbenchPageSize: number;
    workbenchFilteredCountByTab: Record<string, number>;
    currentWorkbenchPageLabel: string;
    // Members
    projectMembers: ProjectMember[];
    filteredProjectMembers: ProjectMember[];
    pagedProjectMembers: ProjectMember[];
    memberDraft: Partial<ProjectMember>;
    editingMemberId: string;
    // Episodes
    projectEpisodes: ProjectEpisode[];
    filteredProjectEpisodes: ProjectEpisode[];
    pagedProjectEpisodes: ProjectEpisode[];
    episodeDraft: Partial<ProjectEpisode>;
    editingEpisodeId: string;
    // Issues
    projectIssues: ProjectIssue[];
    filteredProjectIssues: ProjectIssue[];
    pagedProjectIssues: ProjectIssue[];
    issueDraft: Partial<ProjectIssue>;
    editingIssueId: string;
    // Milestones
    projectMilestones: ProjectMilestone[];
    filteredProjectMilestones: ProjectMilestone[];
    pagedProjectMilestones: ProjectMilestone[];
    milestoneDraft: Partial<ProjectMilestone>;
    editingMilestoneId: string;
    // Scripts
    projectScripts: ProjectScript[];
    filteredProjectScripts: ProjectScript[];
    pagedProjectScripts: ProjectScript[];
    scriptForm: any;
    editingScriptId: string;
    // Storyboards
    projectStoryboards: ProjectStoryboard[];
    filteredProjectStoryboards: ProjectStoryboard[];
    pagedProjectStoryboards: ProjectStoryboard[];
    storyboardDraft: any;
    editingStoryboardId: string;
    selectedStoryboardIds: string[];
    characterAssets: ProjectAsset[];
    sceneAssets: ProjectAsset[];
    // Reviews
    projectReviews: ProjectReview[];
    reviewDrafts: Record<string, string>;
    scriptDraft: string;
    // Clips
    projectClips: ProjectClip[];
    filteredProjectClips: ProjectClip[];
    pagedProjectClips: ProjectClip[];
    clipDraft: Partial<ProjectClip>;
    editingClipId: string;
    // Reviews (already defined above)
    filteredProjectReviews: ProjectReview[];
    pagedProjectReviews: ProjectReview[];
    // Tasks
    filteredProjectTasks: ProjectTask[];
    pagedProjectTasks: ProjectTask[];
    taskDraft: Partial<ProjectTask>;
    editingTaskId: string;
    // Assets
    projectAssets: ProjectAsset[];
    filteredProjectAssets: ProjectAsset[];
    pagedProjectAssets: ProjectAsset[];
    assetDrafts: Record<ProjectAssetKind, any>;
    editingAssetId: string;
    assetComposerKind: ProjectAssetKind;
    assetSearch: string;
    assetKindFilter: ProjectAssetKind | "all";
    assetTagFilter: string;
    assetFavoriteOnly: boolean;
    currentAssetDraft: any | null;
    // Callbacks
    openWorkbenchPage: (tab: WorkbenchTab, page?: number) => void;
    createProjectConversation: () => Promise<void>;
    openProjectFolder: (project: Project) => Promise<void>;
    downloadProjectExport: (file: "scripts.txt" | "edit-list.csv" | "manifest.json") => void;
    refreshProjectWorkbench: () => Promise<void>;
    saveProjectPlan: () => Promise<void>;
    setCurrentWorkbenchPage: (page: number) => void;
    setProjectDraft: (draft: Partial<Project> | ((draft: Partial<Project>) => Partial<Project>)) => void;
    setWorkbenchSearch: (search: string) => void;
    setWorkbenchStatusFilter: (filter: string) => void;
    setWorkbenchOwnerFilter: (filter: string) => void;
    // Members callbacks
    resetProjectMemberForm: () => void;
    editProjectMemberItem: (member: ProjectMember) => void;
    deleteProjectMemberItem: (member: ProjectMember) => Promise<void>;
    submitProjectMemberForm: () => Promise<void>;
    setMemberDraft: (draft: Partial<ProjectMember> | ((draft: Partial<ProjectMember>) => Partial<ProjectMember>)) => void;
    // Episodes callbacks
    resetProjectEpisodeForm: () => void;
    editProjectEpisodeItem: (episode: ProjectEpisode) => void;
    deleteProjectEpisodeItem: (episode: ProjectEpisode) => Promise<void>;
    submitProjectEpisodeForm: () => Promise<void>;
    setEpisodeDraft: (draft: Partial<ProjectEpisode> | ((draft: Partial<ProjectEpisode>) => Partial<ProjectEpisode>)) => void;
    // Issues callbacks
    resetProjectIssueForm: () => void;
    editProjectIssueItem: (issue: ProjectIssue) => void;
    deleteProjectIssueItem: (issue: ProjectIssue) => Promise<void>;
    submitProjectIssueForm: () => Promise<void>;
    setIssueDraft: (draft: Partial<ProjectIssue> | ((draft: Partial<ProjectIssue>) => Partial<ProjectIssue>)) => void;
    // Milestones callbacks
    resetProjectMilestoneForm: () => void;
    editProjectMilestoneItem: (milestone: ProjectMilestone) => void;
    deleteProjectMilestoneItem: (milestone: ProjectMilestone) => Promise<void>;
    submitProjectMilestoneForm: () => Promise<void>;
    setMilestoneDraft: (draft: Partial<ProjectMilestone> | ((draft: Partial<ProjectMilestone>) => Partial<ProjectMilestone>)) => void;
    // Scripts callbacks
    resetProjectScriptForm: () => void;
    editProjectScriptItem: (script: ProjectScript) => void;
    deleteProjectScriptItem: (script: ProjectScript) => Promise<void>;
    submitProjectScriptForm: () => Promise<void>;
    breakdownSavedScript: (script: ProjectScript) => Promise<void>;
    setScriptForm: (form: any | ((form: any) => any)) => void;
    // Storyboards callbacks
    createProjectStoryboardItem: () => Promise<void>;
    editProjectStoryboard: (storyboard: ProjectStoryboard) => void;
    deleteProjectStoryboardItem: (storyboard: ProjectStoryboard) => Promise<void>;
    breakdownScriptToStoryboards: () => Promise<void>;
    batchUpdateStoryboards: (status: ProjectStoryboardStatus) => Promise<void>;
    toggleStoryboardSelection: (storyboardId: string) => void;
    useStoryboardForGeneration: (storyboard: ProjectStoryboard, targetMode: "image" | "video") => void;
    createStoryboardReview: (storyboard: ProjectStoryboard) => Promise<void>;
    updateProjectReviewItem: (review: ProjectReview, patch: Partial<ProjectReview>) => Promise<void>;
    deleteProjectReviewItem: (review: ProjectReview) => Promise<void>;
    setStoryboardDraft: (draft: any | ((draft: any) => any)) => void;
    setScriptDraft: (draft: string | ((draft: string) => string)) => void;
    setReviewDrafts: (drafts: Record<string, string> | ((drafts: Record<string, string>) => Record<string, string>)) => void;
    setSelectedStoryboardIds: (ids: string[] | ((ids: string[]) => string[])) => void;
    setEditingStoryboardId: (id: string) => void;
    // Clips callbacks
    resetProjectClipForm: () => void;
    editProjectClipItem: (clip: ProjectClip) => void;
    deleteProjectClipItem: (clip: ProjectClip) => Promise<void>;
    submitProjectClipForm: () => Promise<void>;
    syncProjectClips: () => Promise<void>;
    setClipDraft: (draft: Partial<ProjectClip> | ((draft: Partial<ProjectClip>) => Partial<ProjectClip>)) => void;
    // Tasks callbacks
    resetProjectTaskForm: () => void;
    editProjectTaskItem: (task: ProjectTask) => void;
    deleteProjectTaskItem: (task: ProjectTask) => Promise<void>;
    submitProjectTaskForm: () => Promise<void>;
    setTaskDraft: (draft: Partial<ProjectTask> | ((draft: Partial<ProjectTask>) => Partial<ProjectTask>)) => void;
    // Assets callbacks
    resetProjectAssetForm: (kind: ProjectAssetKind) => void;
    editProjectAssetItem: (asset: ProjectAsset) => void;
    deleteProjectAssetItem: (asset: ProjectAsset) => Promise<void>;
    submitProjectAssetForm: () => Promise<void>;
    reuseProjectAsset: (asset: ProjectAsset, targetMode?: "image" | "video") => Promise<void>;
    toggleProjectAssetFavorite: (asset: ProjectAsset) => Promise<void>;
    projectAssetReferenceUrls: (asset: ProjectAsset) => string[];
    continueEditImage: (url: string) => void;
    setAssetDrafts: (drafts: Record<ProjectAssetKind, any> | ((drafts: Record<ProjectAssetKind, any>) => Record<ProjectAssetKind, any>)) => void;
    setAssetComposerKind: (kind: ProjectAssetKind) => void;
    setAssetSearch: (search: string) => void;
    setAssetKindFilter: (filter: ProjectAssetKind | "all") => void;
    setAssetTagFilter: (filter: string) => void;
    setAssetFavoriteOnly: (favorite: boolean | ((favorite: boolean) => boolean)) => void;
    // Export callbacks
    downloadStoryboardCsv: () => void;
    generateProjectPackageIndex: () => Promise<void>;
    // Utils
    copy: (text: string) => Promise<void>;
    reviewTargetLabel: (review: ProjectReview) => string;
}

export function ProjectWorkbenchSection(props: ProjectWorkbenchSectionProps) {
    const {
        mode,
        selectedProject,
        projectSummary,
        projectWorkbenchTab,
        workbenchPages,
        supportWorkbenchPages,
        currentWorkbenchPage,
        projectDraft,
        projectHealth,
        productionProgress,
        productionProgressItems,
        productionStageRows,
        openIssueCount,
        pendingReviewCount,
        completedTaskCount,
        nextMilestone,
        projectTasks,
        assetKindCounts,
        workbenchSearch,
        workbenchStatusFilter,
        workbenchOwnerFilter,
        currentWorkbenchStatusOptions,
        workbenchOwnerOptions,
        currentWorkbenchPageNumber,
        workbenchPageSize,
        workbenchFilteredCountByTab,
        currentWorkbenchPageLabel,
        projectMembers,
        filteredProjectMembers,
        pagedProjectMembers,
        memberDraft,
        editingMemberId,
        projectEpisodes,
        filteredProjectEpisodes,
        pagedProjectEpisodes,
        episodeDraft,
        editingEpisodeId,
        projectIssues,
        filteredProjectIssues,
        pagedProjectIssues,
        issueDraft,
        editingIssueId,
        projectMilestones,
        filteredProjectMilestones,
        pagedProjectMilestones,
        milestoneDraft,
        editingMilestoneId,
        projectScripts,
        filteredProjectScripts,
        pagedProjectScripts,
        scriptForm,
        editingScriptId,
        projectStoryboards,
        filteredProjectStoryboards,
        pagedProjectStoryboards,
        storyboardDraft,
        editingStoryboardId,
        selectedStoryboardIds,
        characterAssets,
        sceneAssets,
        projectReviews,
        reviewDrafts,
        scriptDraft,
        projectClips,
        filteredProjectClips,
        pagedProjectClips,
        clipDraft,
        editingClipId,
        filteredProjectReviews,
        pagedProjectReviews,
        filteredProjectTasks,
        pagedProjectTasks,
        taskDraft,
        editingTaskId,
        projectAssets,
        filteredProjectAssets,
        pagedProjectAssets,
        assetDrafts,
        editingAssetId,
        assetComposerKind,
        assetSearch,
        assetKindFilter,
        assetTagFilter,
        assetFavoriteOnly,
        currentAssetDraft,
        openWorkbenchPage,
        createProjectConversation,
        openProjectFolder,
        downloadProjectExport,
        refreshProjectWorkbench,
        saveProjectPlan,
        setCurrentWorkbenchPage,
        setProjectDraft,
        setWorkbenchSearch,
        setWorkbenchStatusFilter,
        setWorkbenchOwnerFilter,
        resetProjectMemberForm,
        editProjectMemberItem,
        deleteProjectMemberItem,
        submitProjectMemberForm,
        setMemberDraft,
        resetProjectEpisodeForm,
        editProjectEpisodeItem,
        deleteProjectEpisodeItem,
        submitProjectEpisodeForm,
        setEpisodeDraft,
        resetProjectIssueForm,
        editProjectIssueItem,
        deleteProjectIssueItem,
        submitProjectIssueForm,
        setIssueDraft,
        resetProjectMilestoneForm,
        editProjectMilestoneItem,
        deleteProjectMilestoneItem,
        submitProjectMilestoneForm,
        setMilestoneDraft,
        resetProjectScriptForm,
        editProjectScriptItem,
        deleteProjectScriptItem,
        submitProjectScriptForm,
        breakdownSavedScript,
        setScriptForm,
        createProjectStoryboardItem,
        editProjectStoryboard,
        deleteProjectStoryboardItem,
        breakdownScriptToStoryboards,
        batchUpdateStoryboards,
        toggleStoryboardSelection,
        useStoryboardForGeneration,
        createStoryboardReview,
        updateProjectReviewItem,
        deleteProjectReviewItem,
        setStoryboardDraft,
        setScriptDraft,
        setReviewDrafts,
        setSelectedStoryboardIds,
        setEditingStoryboardId,
        resetProjectClipForm,
        editProjectClipItem,
        deleteProjectClipItem,
        submitProjectClipForm,
        syncProjectClips,
        setClipDraft,
        resetProjectTaskForm,
        editProjectTaskItem,
        deleteProjectTaskItem,
        submitProjectTaskForm,
        setTaskDraft,
        resetProjectAssetForm,
        editProjectAssetItem,
        deleteProjectAssetItem,
        submitProjectAssetForm,
        reuseProjectAsset,
        toggleProjectAssetFavorite,
        projectAssetReferenceUrls,
        continueEditImage,
        setAssetDrafts,
        setAssetComposerKind,
        setAssetSearch,
        setAssetKindFilter,
        setAssetTagFilter,
        setAssetFavoriteOnly,
        downloadStoryboardCsv,
        generateProjectPackageIndex,
        copy,
        reviewTargetLabel,
    } = props;

    return (
        <>
            {mode === "project" && !selectedProject && <ProjectListView />}

            {mode === "project" && selectedProject && projectSummary && (
                <div className="grid grid-cols-[224px_minmax(0,1fr)] gap-4 max-lg:grid-cols-1">
                    <ProjectSidebar
                        selectedProject={selectedProject}
                        projectWorkbenchTab={projectWorkbenchTab}
                        workbenchPages={workbenchPages}
                        supportWorkbenchPages={supportWorkbenchPages}
                        currentWorkbenchPage={currentWorkbenchPage}
                        onOpenWorkbenchPage={openWorkbenchPage}
                    />
                    <div className="min-w-0 space-y-4">
                        <ProjectHeader
                            selectedProject={selectedProject}
                            projectDraft={projectDraft}
                            projectHealth={projectHealth}
                            productionProgress={productionProgress}
                            productionProgressItems={productionProgressItems}
                            openIssueCount={openIssueCount}
                            pendingReviewCount={pendingReviewCount}
                            completedTaskCount={completedTaskCount}
                            nextMilestone={nextMilestone}
                            projectTasks={projectTasks}
                            onCreateConversation={createProjectConversation}
                            onOpenFolder={() => openProjectFolder(selectedProject)}
                            onExportManifest={() => downloadProjectExport("manifest.json")}
                            onRefresh={refreshProjectWorkbench}
                            onSave={saveProjectPlan}
                        />
                        {!["overview", "assets", "exports"].includes(projectWorkbenchTab) && (
                            <ProjectToolbar
                                projectWorkbenchTab={projectWorkbenchTab}
                                workbenchSearch={workbenchSearch}
                                workbenchStatusFilter={workbenchStatusFilter}
                                workbenchOwnerFilter={workbenchOwnerFilter}
                                currentWorkbenchStatusOptions={currentWorkbenchStatusOptions}
                                workbenchOwnerOptions={workbenchOwnerOptions}
                                currentWorkbenchPageNumber={currentWorkbenchPageNumber}
                                workbenchPageSize={workbenchPageSize}
                                workbenchFilteredCount={workbenchFilteredCountByTab[projectWorkbenchTab]}
                                currentWorkbenchPageLabel={currentWorkbenchPageLabel}
                                onSearchChange={setWorkbenchSearch}
                                onStatusFilterChange={setWorkbenchStatusFilter}
                                onOwnerFilterChange={setWorkbenchOwnerFilter}
                                onResetFilters={() => {
                                    setWorkbenchSearch("");
                                    setWorkbenchStatusFilter("all");
                                    setWorkbenchOwnerFilter("all");
                                }}
                                onPageChange={setCurrentWorkbenchPage}
                            />
                        )}
                        {["overview", "members", "episodes", "issues", "milestones", "scripts", "storyboards", "clips", "reviews", "tasks", "assets", "exports"].includes(projectWorkbenchTab) && (
                            <ProjectWorkbenchTabs
                                projectWorkbenchTab={projectWorkbenchTab}
                                selectedProject={selectedProject}
                                currentWorkbenchPageNumber={currentWorkbenchPageNumber}
                                workbenchPageSize={workbenchPageSize}
                                projectSummary={projectSummary}
                                projectDraft={projectDraft}
                                projectHealth={projectHealth}
                                productionProgress={productionProgress}
                                productionStageRows={productionStageRows}
                                openIssueCount={openIssueCount}
                                pendingReviewCount={pendingReviewCount}
                                completedTaskCount={completedTaskCount}
                                projectTasks={projectTasks}
                                projectMembers={projectMembers}
                                filteredProjectMembers={filteredProjectMembers}
                                pagedProjectMembers={pagedProjectMembers}
                                memberDraft={memberDraft}
                                editingMemberId={editingMemberId}
                                projectEpisodes={projectEpisodes}
                                filteredProjectEpisodes={filteredProjectEpisodes}
                                pagedProjectEpisodes={pagedProjectEpisodes}
                                episodeDraft={episodeDraft}
                                editingEpisodeId={editingEpisodeId}
                                projectIssues={projectIssues}
                                filteredProjectIssues={filteredProjectIssues}
                                pagedProjectIssues={pagedProjectIssues}
                                issueDraft={issueDraft}
                                editingIssueId={editingIssueId}
                                projectMilestones={projectMilestones}
                                filteredProjectMilestones={filteredProjectMilestones}
                                pagedProjectMilestones={pagedProjectMilestones}
                                milestoneDraft={milestoneDraft}
                                editingMilestoneId={editingMilestoneId}
                                projectScripts={projectScripts}
                                filteredProjectScripts={filteredProjectScripts}
                                pagedProjectScripts={pagedProjectScripts}
                                scriptForm={scriptForm}
                                editingScriptId={editingScriptId}
                                scriptStatusText={scriptStatusText}
                                projectStoryboards={projectStoryboards}
                                filteredProjectStoryboards={filteredProjectStoryboards}
                                pagedProjectStoryboards={pagedProjectStoryboards}
                                storyboardDraft={storyboardDraft}
                                editingStoryboardId={editingStoryboardId}
                                selectedStoryboardIds={selectedStoryboardIds}
                                characterAssets={characterAssets}
                                sceneAssets={sceneAssets}
                                projectReviews={projectReviews}
                                reviewDrafts={reviewDrafts}
                                scriptDraft={scriptDraft}
                                storyboardStatuses={storyboardStatuses}
                                storyboardStatusText={storyboardStatusText}
                                projectClips={projectClips}
                                filteredProjectClips={filteredProjectClips}
                                pagedProjectClips={pagedProjectClips}
                                clipDraft={clipDraft}
                                editingClipId={editingClipId}
                                clipStatuses={clipStatuses}
                                clipStatusText={clipStatusText}
                                filteredProjectReviews={filteredProjectReviews}
                                pagedProjectReviews={pagedProjectReviews}
                                reviewTargetLabel={reviewTargetLabel}
                                filteredProjectTasks={filteredProjectTasks}
                                pagedProjectTasks={pagedProjectTasks}
                                taskDraft={taskDraft}
                                editingTaskId={editingTaskId}
                                projectTaskColumns={projectTaskColumns}
                                projectAssets={projectAssets}
                                filteredProjectAssets={filteredProjectAssets}
                                pagedProjectAssets={pagedProjectAssets}
                                assetDrafts={assetDrafts}
                                editingAssetId={editingAssetId}
                                assetComposerKind={assetComposerKind}
                                assetSearch={assetSearch}
                                assetKindFilter={assetKindFilter}
                                assetTagFilter={assetTagFilter}
                                assetFavoriteOnly={assetFavoriteOnly}
                                projectAssetKinds={projectAssetKinds}
                                assetKindCounts={assetKindCounts}
                                currentAssetDraft={currentAssetDraft}
                                setCurrentWorkbenchPage={setCurrentWorkbenchPage}
                                openWorkbenchPage={openWorkbenchPage}
                                saveProjectPlan={saveProjectPlan}
                                setProjectDraft={setProjectDraft}
                                resetProjectMemberForm={resetProjectMemberForm}
                                editProjectMemberItem={editProjectMemberItem}
                                deleteProjectMemberItem={deleteProjectMemberItem}
                                submitProjectMemberForm={submitProjectMemberForm}
                                setMemberDraft={setMemberDraft}
                                resetProjectEpisodeForm={resetProjectEpisodeForm}
                                editProjectEpisodeItem={editProjectEpisodeItem}
                                deleteProjectEpisodeItem={deleteProjectEpisodeItem}
                                submitProjectEpisodeForm={submitProjectEpisodeForm}
                                setEpisodeDraft={setEpisodeDraft}
                                resetProjectIssueForm={resetProjectIssueForm}
                                editProjectIssueItem={editProjectIssueItem}
                                deleteProjectIssueItem={deleteProjectIssueItem}
                                submitProjectIssueForm={submitProjectIssueForm}
                                setIssueDraft={setIssueDraft}
                                resetProjectMilestoneForm={resetProjectMilestoneForm}
                                editProjectMilestoneItem={editProjectMilestoneItem}
                                deleteProjectMilestoneItem={deleteProjectMilestoneItem}
                                submitProjectMilestoneForm={submitProjectMilestoneForm}
                                setMilestoneDraft={setMilestoneDraft}
                                resetProjectScriptForm={resetProjectScriptForm}
                                editProjectScriptItem={editProjectScriptItem}
                                deleteProjectScriptItem={deleteProjectScriptItem}
                                submitProjectScriptForm={submitProjectScriptForm}
                                breakdownSavedScript={breakdownSavedScript}
                                setScriptForm={setScriptForm}
                                createProjectStoryboardItem={createProjectStoryboardItem}
                                editProjectStoryboard={editProjectStoryboard}
                                deleteProjectStoryboardItem={deleteProjectStoryboardItem}
                                breakdownScriptToStoryboards={breakdownScriptToStoryboards}
                                batchUpdateStoryboards={batchUpdateStoryboards}
                                toggleStoryboardSelection={toggleStoryboardSelection}
                                useStoryboardForGeneration={useStoryboardForGeneration}
                                createStoryboardReview={createStoryboardReview}
                                updateProjectReviewItem={updateProjectReviewItem}
                                deleteProjectReviewItem={deleteProjectReviewItem}
                                setStoryboardDraft={setStoryboardDraft}
                                setScriptDraft={setScriptDraft}
                                setReviewDrafts={setReviewDrafts}
                                setSelectedStoryboardIds={setSelectedStoryboardIds}
                                setEditingStoryboardId={setEditingStoryboardId}
                                resetProjectClipForm={resetProjectClipForm}
                                editProjectClipItem={editProjectClipItem}
                                deleteProjectClipItem={deleteProjectClipItem}
                                submitProjectClipForm={submitProjectClipForm}
                                syncProjectClips={syncProjectClips}
                                setClipDraft={setClipDraft}
                                resetProjectTaskForm={resetProjectTaskForm}
                                editProjectTaskItem={editProjectTaskItem}
                                deleteProjectTaskItem={deleteProjectTaskItem}
                                submitProjectTaskForm={submitProjectTaskForm}
                                setTaskDraft={setTaskDraft}
                                resetProjectAssetForm={resetProjectAssetForm}
                                editProjectAssetItem={editProjectAssetItem}
                                deleteProjectAssetItem={deleteProjectAssetItem}
                                submitProjectAssetForm={submitProjectAssetForm}
                                reuseProjectAsset={reuseProjectAsset}
                                toggleProjectAssetFavorite={toggleProjectAssetFavorite}
                                projectAssetReferenceUrls={projectAssetReferenceUrls}
                                continueEditImage={continueEditImage}
                                setAssetDrafts={setAssetDrafts}
                                setAssetComposerKind={setAssetComposerKind}
                                setAssetSearch={setAssetSearch}
                                setAssetKindFilter={setAssetKindFilter}
                                setAssetTagFilter={setAssetTagFilter}
                                setAssetFavoriteOnly={setAssetFavoriteOnly}
                                downloadProjectExport={downloadProjectExport}
                                downloadStoryboardCsv={downloadStoryboardCsv}
                                generateProjectPackageIndex={generateProjectPackageIndex}
                                openProjectFolder={openProjectFolder}
                                refreshProjectWorkbench={refreshProjectWorkbench}
                                copy={copy}
                            />
                        )}
                    </div>
                </div>
            )}
        </>
    );
}