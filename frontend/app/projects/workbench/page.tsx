"use client";

/**
 * 项目工作台独立路由：/projects/workbench
 *
 * 设计动机：
 * - 原 /studio 路由承载的是智能问答 / 图片 / 视频 / 收藏的聊天页，不具备"工作台模式"
 *   的状态派生（无 useProjectWorkbench 调用），无法独立渲染 ProjectWorkbenchSection。
 * - 因此在侧栏"智能助手"组下挂一个独立工作台入口，直接调 hook 派生 50+ props，
 *   渲染嵌入式 ProjectWorkbenchSection。
 *
 * URL 约定：
 * - /projects/workbench              → 使用全局 store 的 selectedProjectId
 * - /projects/workbench?projectId=xx → 优先使用 URL 指定的 projectId
 * - /projects/workbench?tab=overview → 切到指定 tab（默认 overview）
 *
 * 兜底：未选项目 → 跳 /projects 提示先选。
 */

import { Suspense, useEffect, useMemo, useState, type ComponentProps } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useProjectStore } from "@/lib/stores/project-store";
import { useProjectWorkbench } from "@/hooks/home/use-project-workbench";
import { ProjectWorkbenchSection } from "@/components/project/project-workbench-section";
import { ConfirmDialog } from "@/components/common/confirm-dialog";
import { toast } from "@/components/common/toast";
import { CqrsSyncStatus } from "@/components/shared";
import { CollaborationStatePanel, DependencyImpactPanel } from "@/components/governance";

export default function ProjectWorkbenchPage() {
  return (
    <Suspense fallback={null}>
      <ProjectWorkbenchPageInner />
    </Suspense>
  );
}

function ProjectWorkbenchPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const urlProjectId = searchParams.get("projectId") || undefined;

  // 全局当前项目：URL 优先，否则用顶部导航的当前项目
  const storeProjectId = useProjectStore((s) => s.selectedProjectId);
  const setStoreProjectId = useProjectStore((s) => s.setSelectedProjectId);
  const projectId = urlProjectId || storeProjectId || undefined;

  // 把 URL 上的 projectId 同步到全局 store，方便其它模块也能感知
  useEffect(() => {
    if (urlProjectId && urlProjectId !== storeProjectId) {
      setStoreProjectId(urlProjectId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [urlProjectId]);

  // 确认对话框状态（桥接给 hook 的 requestConfirm）
  const [pendingConfirm, setPendingConfirm] = useState<{
    title: string;
    description: string;
    confirmLabel: string;
    onConfirm: () => Promise<void> | void;
  } | null>(null);

  // toast 包装
  const showNotice = useMemo(
    () => (message: string) => {
      toast.success(message);
    },
    [],
  );
  const requestConfirm = useMemo(
    () =>
      (title: string, description: string, confirmLabel: string, action: () => Promise<void> | void) => {
        setPendingConfirm({ title, description, confirmLabel, onConfirm: action });
      },
    [],
  );

  const workbench = useProjectWorkbench({ showNotice, requestConfirm }) as unknown as Record<string, unknown>;

  // 未选项目 → 兜底去 /projects
  useEffect(() => {
    if (!projectId) {
      toast.error("暂未选择项目", "请先到「项目中心」选择或创建一个项目");
      router.replace("/projects");
    }
  }, [projectId, router]);

  if (!projectId) {
    return null;
  }

  // 把 hook 返回值整包展开成 projectWorkbenchProps
  const projectWorkbenchProps = {
    ...workbench,
    // ProjectWorkbenchSection 需要 selectedProject 字段，但 hook 不直接返回
    // 这里用一个最小占位对象（头部展示只读 name，CRUD 不依赖这个对象）
    selectedProject: {
      id: projectId,
      name: "当前项目",
    } as never,
    mode: "project" as const,
  };

  return (
    <>
      {/* CQRS 同步状态指示器 —— 待接入真实投影状态数据 */}
      <div className="fixed right-4 top-16 z-50">
        <CqrsSyncStatus state="fresh" />
      </div>
      <div className="mx-auto grid max-w-7xl gap-4 px-4 pt-4 lg:grid-cols-2">
        <DependencyImpactPanel projectId={projectId} />
        <CollaborationStatePanel targetType="project" targetId={projectId} />
      </div>
      <ProjectWorkbenchSection {...(projectWorkbenchProps as unknown as ComponentProps<typeof ProjectWorkbenchSection>)} />
      {pendingConfirm && (
        <ConfirmDialog
          title={pendingConfirm.title}
          description={pendingConfirm.description}
          confirmLabel={pendingConfirm.confirmLabel}
          onClose={() => setPendingConfirm(null)}
          onConfirm={async () => {
            const action = pendingConfirm.onConfirm;
            setPendingConfirm(null);
            await action();
          }}
        />
      )}
    </>
  );
}
