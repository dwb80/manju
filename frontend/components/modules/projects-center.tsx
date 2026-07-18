"use client";

/**
 * 项目中心模块
 *
 * 功能：
 * - 项目管理（连接后端 API）
 * - 新建/编辑项目对话框（含必填验证）
 * - 删除项目确认
 * - 跳转到剧本中心（显示已有剧本或创建新剧本）
 * - 操作栏增加"剧本"按钮
 */

import { useState, useMemo, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Plus, FileText, Pencil, Trash2, Eye, RefreshCw, Loader2, X } from "lucide-react";
import { PageContainer, PageCard } from "@/components/layout/page-container";
import { ModuleToolbar, SearchInput, FilterSelect, EmptyState, Pagination } from "@/components/shared";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { FormDialog, type FormFieldConfig } from "@/components/ui/form-dialog";
import { ConfirmDialog } from "@/components/common/confirm-dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useProjectStore } from "@/lib/stores/project-store";
import { listProjects, createProject as createProjectApi, updateProject as updateProjectApi, deleteProject as deleteProjectApi } from "@/services/project.service";
import { scriptCenterService } from "@/services/script-center.service";
import { clearApiCache } from "@/lib/api-client";
import type { Project } from "@/lib/app-types";

/** 项目表单字段配置 */
const projectFields: FormFieldConfig[] = [
  { name: "name", label: "项目名称", type: "text", required: true, placeholder: "请输入项目名称" },
  {
    name: "category",
    label: "项目类型",
    type: "select",
    required: true,
    options: [
      { value: "科幻冒险漫剧", label: "科幻冒险漫剧" },
      { value: "古风武侠剧", label: "古风武侠剧" },
      { value: "现代都市爱情剧", label: "现代都市爱情剧" },
      { value: "奇幻儿童剧", label: "奇幻儿童剧" },
      { value: "悬疑推理剧", label: "悬疑推理剧" },
      { value: "青春校园剧", label: "青春校园剧" },
      { value: "历史古装剧", label: "历史古装剧" },
      { value: "搞笑喜剧剧", label: "搞笑喜剧剧" },
      { value: "恐怖惊悚剧", label: "恐怖惊悚剧" },
      { value: "运动竞技剧", label: "运动竞技剧" },
      { value: "音乐励志剧", label: "音乐励志剧" },
    ],
    defaultValue: "科幻冒险漫剧",
  },
  {
    name: "status",
    label: "项目状态",
    type: "select",
    required: true,
    options: [
      { value: "active", label: "进行中" },
      { value: "completed", label: "已完成" },
      { value: "archived", label: "已归档" },
    ],
    defaultValue: "active",
  },
  { name: "owner", label: "负责人", type: "text", required: true, placeholder: "请输入负责人姓名" },
  { name: "episode_count", label: "集数", type: "number", placeholder: "0", min: 0 },
  { name: "due_date", label: "截止日期", type: "text", placeholder: "YYYY-MM-DD" },
  { name: "description", label: "项目描述", type: "textarea", placeholder: "请输入项目简介", rows: 3 },
];

export function ProjectsCenterPage() {
  const { setSelectedProjectId } = useProjectStore();

  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  // 项目数据状态
  const [projects, setProjects] = useState<Project[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  // 对话框状态
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // 删除确认状态
  const [deleteConfirm, setDeleteConfirm] = useState<{ id: string; name: string } | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // 查看详情状态
  const [viewingProject, setViewingProject] = useState<Project | null>(null);

  // 每个项目下的剧本数量缓存
  const [scriptCounts, setScriptCounts] = useState<Record<string, number>>({});

  // 分页状态
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const statusOptions = [
    { value: "", label: "全部状态" },
    { value: "active", label: "进行中" },
    { value: "completed", label: "已完成" },
    { value: "archived", label: "已归档" },
  ];

  // 加载项目
  const reloadProjects = useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const data = await listProjects();
      setProjects(data);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "加载项目失败";
      console.error("加载项目失败:", err);
      setLoadError(msg);
      setProjects([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // 初始加载
  useEffect(() => {
    reloadProjects();
  }, [reloadProjects]);

  // 加载所有项目下的剧本数量
  const reloadScriptCounts = useCallback(async () => {
    if (projects.length === 0) return;
    const counts: Record<string, number> = {};
    // 并行拉取每个项目的剧本列表
    await Promise.all(
      projects.map(async (p) => {
        try {
          const scripts = await scriptCenterService.getDocuments(p.id);
          counts[p.id] = Array.isArray(scripts) ? scripts.length : 0;
        } catch {
          counts[p.id] = 0;
        }
      })
    );
    setScriptCounts(counts);
  }, [projects]);

  useEffect(() => {
    reloadScriptCounts();
  }, [reloadScriptCounts]);

  const filteredProjects = useMemo(() => {
    return projects.filter((project) => {
      const matchesSearch =
        project.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        project.category.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesStatus = !statusFilter || project.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [projects, searchQuery, statusFilter]);

  // 分页后的项目
  const paginatedProjects = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredProjects.slice(start, start + pageSize);
  }, [filteredProjects, currentPage, pageSize]);

  // 计算总页数
  const totalPages = Math.max(1, Math.ceil(filteredProjects.length / pageSize));

  // 打开新建对话框
  const handleCreate = () => {
    setEditingProject(null);
    setIsFormOpen(true);
  };

  // 打开编辑对话框
  const handleEdit = (project: Project) => {
    setEditingProject(project);
    setIsFormOpen(true);
  };

  // 查看项目详情
  const handleView = (project: Project) => {
    setViewingProject(project);
  };

  // 跳转到剧本中心
  // 方案 A（软约束）：1 项目 = 1 主剧本
  // - 拉取该项目的剧本列表
  // - 有：取最近编辑的剧本（按 updated_at 倒序）直接进编辑器
  // - 无：跳到剧本中心列表并自动打开导入对话框
  // 行为：在新浏览器标签页打开（保留当前项目中心页面）
  const [openingScriptFor, setOpeningScriptFor] = useState<string | null>(null);
  const handleOpenScripts = async (project: Project) => {
    setSelectedProjectId(project.id);
    setOpeningScriptFor(project.id);
    try {
      const list = await scriptCenterService.getDocuments(project.id);
      const targetUrl =
        Array.isArray(list) && list.length > 0
          ? `/scripts/${[...list].sort((a: any, b: any) => {
            const ta = new Date(a.updated_at || 0).getTime();
            const tb = new Date(b.updated_at || 0).getTime();
            return tb - ta;
          })[0].id}`
          : `/scripts?projectId=${project.id}&action=import`;
      window.open(targetUrl, "_blank", "noopener,noreferrer");
    } catch (err) {
      console.error("打开剧本失败:", err);
      window.open(`/scripts?projectId=${project.id}&action=import`, "_blank", "noopener,noreferrer");
    } finally {
      setOpeningScriptFor(null);
    }
  };

  // 保存项目（新建或编辑）
  const handleSave = async (values: Record<string, string | number | string[]>) => {
    setIsSaving(true);
    try {
      const payload = {
        name: String(values.name || ""),
        category: String(values.category || ""),
        status: String(values.status || "active"),
        owner: String(values.owner || ""),
        description: String(values.description || ""),
        episode_count: Number(values.episode_count || 0),
        due_date: String(values.due_date || ""),
      };
      if (editingProject) {
        await updateProjectApi(editingProject.id, payload);
      } else {
        await createProjectApi(payload as any, "managed");
      }
      setIsFormOpen(false);
      setEditingProject(null);
      clearApiCache();
      await reloadProjects();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "保存失败";
      alert(`保存失败：${msg}`);
    } finally {
      setIsSaving(false);
    }
  };

  // 确认删除
  const handleDeleteConfirm = async () => {
    if (!deleteConfirm) return;
    setIsDeleting(true);
    try {
      await deleteProjectApi(deleteConfirm.id);
      setDeleteConfirm(null);
      clearApiCache();
      await reloadProjects();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "删除失败";
      alert(`删除失败：${msg}`);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <TooltipProvider delayDuration={200}>
      <PageContainer
        title="项目中心"
        description="管理和查看所有漫剧项目"
      >
        {/* 工具栏 */}
        <ModuleToolbar
          left={
            <>
              <SearchInput
                value={searchQuery}
                onChange={setSearchQuery}
                placeholder="搜索项目..."
              />
              <FilterSelect
                value={statusFilter}
                onChange={setStatusFilter}
                options={statusOptions}
                placeholder="状态筛选"
              />
              <Button
                variant="ghost"
                size="sm"
                onClick={reloadProjects}
                disabled={isLoading}
                title="刷新"
              >
                <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
              </Button>
            </>
          }
          right={
            <Button size="sm" onClick={handleCreate}>
              <Plus className="mr-2 h-4 w-4" />
              新建项目
            </Button>
          }
        />

        <PageCard>
          {loadError && (
            <div className="mb-4 rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-400">
              加载项目失败：{loadError}（请确认后端服务已启动）
            </div>
          )}

          {filteredProjects.length > 0 ? (
            <div className="rounded-md border border-border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>项目名称</TableHead>
                    <TableHead className="hidden md:table-cell">类型</TableHead>
                    <TableHead>状态</TableHead>
                    <TableHead className="hidden lg:table-cell">负责人</TableHead>
                    <TableHead className="hidden sm:table-cell">集数</TableHead>
                    <TableHead className="hidden md:table-cell">截止日期</TableHead>
                    <TableHead className="text-right">操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedProjects.map((project) => {
                    const scriptCount = scriptCounts[project.id] ?? 0;
                    const statusBadge =
                      project.status === "active" ? (
                        <Badge variant="success">进行中</Badge>
                      ) : project.status === "completed" ? (
                        <Badge variant="info">已完成</Badge>
                      ) : (
                        <Badge variant="muted">已归档</Badge>
                      );
                    return (
                      <TableRow key={project.id}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {project.is_pinned && (
                              <Badge variant="warning">置顶</Badge>
                            )}
                            <span className="font-medium text-white">{project.name}</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-muted-foreground hidden md:table-cell">{project.category}</TableCell>
                        <TableCell>{statusBadge}</TableCell>
                        <TableCell className="text-muted-foreground hidden lg:table-cell">{project.owner}</TableCell>
                        <TableCell className="text-muted-foreground hidden sm:table-cell">{project.episode_count}集</TableCell>
                        <TableCell className="text-muted-foreground hidden md:table-cell">
                          {project.due_date ? new Date(project.due_date).toLocaleDateString() : "-"}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center gap-1 justify-end">
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleOpenScripts(project)}
                                  disabled={openingScriptFor === project.id}
                                  className="gap-1 px-2"
                                >
                                  {openingScriptFor === project.id ? (
                                    <Loader2 className="h-4 w-4 text-emerald-400 animate-spin" />
                                  ) : (
                                    <FileText className="h-4 w-4 text-emerald-400" />
                                  )}
                                  <span className="text-xs text-emerald-400 whitespace-nowrap">
                                    {openingScriptFor === project.id ? "加载中…" : "打开剧本"}
                                  </span>
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>{scriptCount > 0 ? "打开主剧本" : "创建剧本"}</TooltipContent>
                            </Tooltip>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button variant="ghost" size="icon" onClick={() => handleView(project)} aria-label="查看">
                                  <Eye className="h-4 w-4" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>查看</TooltipContent>
                            </Tooltip>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button variant="ghost" size="icon" onClick={() => handleEdit(project)} aria-label="编辑">
                                  <Pencil className="h-4 w-4" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>编辑</TooltipContent>
                            </Tooltip>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => setDeleteConfirm({ id: project.id, name: project.name })}
                                  aria-label="删除"
                                >
                                  <Trash2 className="h-4 w-4 text-red-400" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>删除</TooltipContent>
                            </Tooltip>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          ) : (
            <EmptyState
              type="no-results"
              title={loadError ? "无法加载项目" : isLoading ? "加载中..." : "未找到项目"}
              description={loadError ? "请确认后端服务已启动" : "尝试调整搜索条件或创建新项目"}
              action={
                loadError
                  ? { label: "重试", onClick: reloadProjects }
                  : !isLoading
                    ? { label: "新建项目", onClick: handleCreate }
                    : undefined
              }
            />
          )}

          {/* 分页组件 */}
          {filteredProjects.length > 0 && (
            <div className="mt-4">
              <Pagination
                currentPage={currentPage}
                totalPages={totalPages}
                totalItems={filteredProjects.length}
                pageSize={pageSize}
                onPageChange={setCurrentPage}
                onPageSizeChange={(size) => {
                  setPageSize(size);
                  setCurrentPage(1);
                }}
              />
            </div>
          )}
        </PageCard>

        {/* 新建/编辑对话框 */}
        <FormDialog
          title={editingProject ? "编辑项目" : "新建项目"}
          fields={projectFields}
          initialValues={editingProject ? {
            name: editingProject.name,
            category: editingProject.category,
            status: editingProject.status,
            owner: editingProject.owner,
            episode_count: editingProject.episode_count,
            due_date: editingProject.due_date,
            description: editingProject.description,
          } as Record<string, string | number> : {}}
          isOpen={isFormOpen}
          onClose={() => { setIsFormOpen(false); setEditingProject(null); }}
          onSave={handleSave}
          isLoading={isSaving}
        />

        {/* 删除确认对话框 */}
        {deleteConfirm && (
          <ConfirmDialog
            title="删除项目"
            description={`确定要删除项目「${deleteConfirm.name}」吗？此操作无法撤销。`}
            confirmLabel="删除"
            onClose={() => setDeleteConfirm(null)}
            onConfirm={handleDeleteConfirm}
          />
        )}

        {/* 查看详情对话框 */}
        <Dialog open={!!viewingProject} onOpenChange={(open) => !open && setViewingProject(null)}>
          <DialogContent size="wide" className="border-border">
            {viewingProject && (
              <>
                <DialogHeader>
                  <DialogTitle>项目详情</DialogTitle>
                  <DialogDescription>查看项目 {viewingProject.name} 的完整信息</DialogDescription>
                </DialogHeader>
                {/* 详情内容 - 两列布局 */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-3 px-6">
                  <DetailRow label="项目名称" value={viewingProject.name} />
                  <DetailRow label="项目类型" value={viewingProject.category} />
                  <DetailRow
                    label="项目状态"
                    value={
                      viewingProject.status === "active"
                        ? "进行中"
                        : viewingProject.status === "completed"
                          ? "已完成"
                          : "已归档"
                    }
                  />
                  <DetailRow label="负责人" value={viewingProject.owner} />
                  <DetailRow label="集数" value={`${viewingProject.episode_count}集`} />
                  <DetailRow
                    label="截止日期"
                    value={
                      viewingProject.due_date
                        ? new Date(viewingProject.due_date).toLocaleDateString()
                        : "-"
                    }
                  />
                  <DetailRow label="剧本数量" value={`${scriptCounts[viewingProject.id] ?? 0} 个`} />
                  <DetailRow label="创建时间" value={new Date(viewingProject.created_at).toLocaleString()} />
                  <DetailRow label="更新时间" value={new Date(viewingProject.updated_at).toLocaleString()} />
                  <div className="md:col-span-2">
                    <DetailRow label="项目描述" value={viewingProject.description || "-"} />
                  </div>
                </div>
                <DialogFooter className="gap-2">
                  <Button size="sm" variant="secondary" onClick={() => setViewingProject(null)}>
                    关闭
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => {
                      handleEdit(viewingProject);
                      setViewingProject(null);
                    }}
                  >
                    编辑
                  </Button>
                </DialogFooter>
              </>
            )}
          </DialogContent>
        </Dialog>
      </PageContainer>
    </TooltipProvider>
  );
}

/** 详情行组件 */
function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="text-sm text-foreground break-words">{value}</span>
    </div>
  );
}

