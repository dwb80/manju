"use client";

/**
 * 项目中心模块
 *
 * 功能：
 * - 项目列表展示
 * - 新建/编辑项目对话框（含必填验证）
 * - 删除项目确认
 * - 跳转到剧本中心（显示已有剧本或创建新剧本）
 */

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Plus, FileText, Pencil, Trash2, Eye } from "lucide-react";
import { PageContainer, PageCard } from "@/components/layout/page-container";
import { ModuleToolbar, SearchInput, FilterSelect, EmptyState, Pagination } from "@/components/shared";
import { Button } from "@/components/ui/button";
import { FormDialog, type FormFieldConfig } from "@/components/ui/form-dialog";
import { ConfirmDialog } from "@/components/common/confirm-dialog";
import { useProjectStore } from "@/lib/stores/project-store";
import { projects as initialProjects } from "@/lib/mock-data";
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
  const router = useRouter();
  const { setSelectedProjectId } = useProjectStore();

  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  // 项目列表状态（支持本地增删改）
  const [projects, setProjects] = useState<Project[]>(initialProjects);

  // 对话框状态
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // 删除确认状态
  const [deleteConfirm, setDeleteConfirm] = useState<{ id: string; name: string } | null>(null);

  // 查看详情状态
  const [viewingProject, setViewingProject] = useState<Project | null>(null);

  // 分页状态
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const statusOptions = [
    { value: "active", label: "进行中" },
    { value: "completed", label: "已完成" },
    { value: "archived", label: "已归档" },
  ];

  const filteredProjects = useMemo(() => {
    return projects.filter((project) => {
      const matchesSearch =
        project.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        project.category.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesStatus = !statusFilter || project.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [projects, searchQuery, statusFilter]);

  // 分页后的项目列表
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
  const handleOpenScripts = (project: Project) => {
    // 设置全局选中的项目ID
    setSelectedProjectId(project.id);
    // 跳转到剧本中心（/scripts 会根据已有剧本情况重定向）
    // - 如果该项目已有剧本，跳转到第一个剧本的编辑器（显示已有剧本信息）
    // - 如果没有剧本，显示剧本中心列表页（可创建新剧本）
    router.push("/scripts");
  };

  // 保存项目（新建或编辑） - 本地模拟操作
  const handleSave = async (values: Record<string, string | number | string[]>) => {
    setIsSaving(true);
    try {
      await new Promise((resolve) => setTimeout(resolve, 500));

      if (editingProject) {
        // 编辑模式：更新现有项目
        setProjects((prev) =>
          prev.map((p) =>
            p.id === editingProject.id
              ? {
                  ...p,
                  name: String(values.name || p.name),
                  category: String(values.category || p.category),
                  status: String(values.status || p.status),
                  owner: String(values.owner || p.owner),
                  episode_count: Number(values.episode_count || 0),
                  due_date: String(values.due_date || p.due_date),
                  description: String(values.description || p.description),
                  updated_at: new Date().toISOString(),
                }
              : p
          )
        );
      } else {
        // 新建模式：创建新项目
        const newProject: Project = {
          id: `proj-${Date.now()}`,
          name: String(values.name || ""),
          category: String(values.category || ""),
          status: String(values.status || "active"),
          description: String(values.description || ""),
          episode_count: Number(values.episode_count || 0),
          owner: String(values.owner || ""),
          due_date: String(values.due_date || ""),
          is_default: false,
          is_pinned: false,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          storage_path: `/projects/${Date.now()}`,
          storage_mode: "managed",
          archived_at: "",
        };
        setProjects((prev) => [newProject, ...prev]);
      }

      setIsFormOpen(false);
      setEditingProject(null);
    } finally {
      setIsSaving(false);
    }
  };

  // 确认删除 - 本地模拟操作
  const handleDeleteConfirm = async () => {
    if (!deleteConfirm) return;
    await new Promise((resolve) => setTimeout(resolve, 500));
    setProjects((prev) => prev.filter((p) => p.id !== deleteConfirm.id));
    setDeleteConfirm(null);
  };

  return (
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
          </>
        }
        right={
          <Button size="sm" onClick={handleCreate}>
            <Plus className="mr-2 h-4 w-4" />
            新建项目
          </Button>
        }
      />

      {/* 项目列表 - 移除标题文字 */}
      <PageCard>
        {filteredProjects.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-white/10">
                  <th className="px-4 py-3 text-left text-sm font-medium text-[#888]">项目名称</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-[#888] hidden md:table-cell">类型</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-[#888]">状态</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-[#888] hidden lg:table-cell">负责人</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-[#888] hidden sm:table-cell">集数</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-[#888] hidden md:table-cell">截止日期</th>
                  <th className="px-4 py-3 text-right text-sm font-medium text-[#888]">操作</th>
                </tr>
              </thead>
              <tbody>
                {paginatedProjects.map((project) => (
                  <tr key={project.id} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        {project.is_pinned && (
                          <span className="px-1.5 py-0.5 rounded text-xs bg-yellow-500/20 text-yellow-400">
                            置顶
                          </span>
                        )}
                        <span className="font-medium text-white">{project.name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-[#888] hidden md:table-cell">{project.category}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded text-xs ${project.status === 'active' ? 'bg-emerald-500/20 text-emerald-400' :
                        project.status === 'completed' ? 'bg-blue-500/20 text-blue-400' :
                          'bg-gray-500/20 text-gray-400'
                        }`}>
                        {project.status === 'active' ? '进行中' : project.status === 'completed' ? '已完成' : '已归档'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-[#888] hidden lg:table-cell">{project.owner}</td>
                    <td className="px-4 py-3 text-sm text-[#888] hidden sm:table-cell">{project.episode_count}集</td>
                    <td className="px-4 py-3 text-sm text-[#888] hidden md:table-cell">
                      {project.due_date ? new Date(project.due_date).toLocaleDateString() : "-"}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center gap-1 justify-end">
                        <Button variant="ghost" size="sm" onClick={() => handleOpenScripts(project)} title="剧本">
                          <FileText className="h-4 w-4 text-emerald-400" />
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => handleView(project)} title="查看">
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => handleEdit(project)} title="编辑">
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => setDeleteConfirm({ id: project.id, name: project.name })} title="删除">
                          <Trash2 className="h-4 w-4 text-red-400" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState
            type="no-results"
            title="未找到项目"
            description="尝试调整搜索条件或创建新项目"
            action={{
              label: "新建项目",
              onClick: handleCreate,
            }}
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
              onPageSizeChange={setPageSize}
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
      {viewingProject && (
        <div
          className="fixed inset-0 z-[90] grid place-items-center bg-black/60 px-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-label="项目详情"
          onClick={() => setViewingProject(null)}
        >
          <div
            className="w-full max-w-2xl rounded-2xl border border-white/10 bg-[#202020] p-5 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-semibold text-white">项目详情</h2>
              <button
                type="button"
                onClick={() => setViewingProject(null)}
                className="h-8 w-8 rounded-md hover:bg-white/10 flex items-center justify-center"
                aria-label="关闭"
              >
                <span className="text-[#888] text-lg">×</span>
              </button>
            </div>
            {/* 详情内容 - 两列布局 */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-3">
              <DetailRow label="项目名称" value={viewingProject.name} />
              <DetailRow label="项目类型" value={viewingProject.category} />
              <DetailRow label="项目状态" value={
                viewingProject.status === 'active' ? '进行中' :
                viewingProject.status === 'completed' ? '已完成' : '已归档'
              } />
              <DetailRow label="负责人" value={viewingProject.owner} />
              <DetailRow label="集数" value={`${viewingProject.episode_count}集`} />
              <DetailRow label="截止日期" value={
                viewingProject.due_date ? new Date(viewingProject.due_date).toLocaleDateString() : "-"
              } />
              <DetailRow label="创建时间" value={new Date(viewingProject.created_at).toLocaleString()} />
              <DetailRow label="更新时间" value={new Date(viewingProject.updated_at).toLocaleString()} />
              <div className="md:col-span-2">
                <DetailRow label="项目描述" value={viewingProject.description || "-"} />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-4 mt-4 border-t border-white/10">
              <Button size="sm" variant="secondary" onClick={() => setViewingProject(null)}>
                关闭
              </Button>
              <Button size="sm" onClick={() => {
                handleEdit(viewingProject);
                setViewingProject(null);
              }}>
                编辑
              </Button>
            </div>
          </div>
        </div>
      )}
    </PageContainer>
  );
}

/** 详情行组件 */
function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs text-[#888]">{label}</span>
      <span className="text-sm text-white break-words">{value}</span>
    </div>
  );
}
