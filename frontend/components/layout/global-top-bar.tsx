"use client";

import { useEffect, useMemo, useState } from "react";
import { ShadcnSelect } from "@/components/ui/select";
import type { Project } from "@/lib/app-types";
import { api } from "@/lib/api-client";
import { createLogger } from "@/lib/logger";
import { useProjectStore } from "@/lib/stores/project-store";
import { UserAccountMenu } from "@/components/auth/user-account-menu";
import { ThemeToggle } from "./theme-toggle";
import { Breadcrumb } from "./breadcrumb";
import { Search } from "lucide-react";
import { openCommandPalette } from "./command-palette";

const log = createLogger("global-top-bar");

/**
 * GlobalTopBar - 全局顶部导航栏
 * @returns {JSX.Element} 渲染的顶部导航栏元素
 */
export function GlobalTopBar() {
  const { selectedProjectId, setSelectedProjectId } = useProjectStore();
  const [projects, setProjects] = useState<Project[]>([]);
  const [projectsLoading, setProjectsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function loadProjects() {
      try {
        setProjectsLoading(true);
        const data = await api<Project[]>("/api/projects");
        if (!cancelled) setProjects(data);
      } catch (err) {
        log.error("load projects failed", { error: (err as Error).message });
      } finally {
        if (!cancelled) setProjectsLoading(false);
      }
    }

    loadProjects();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!selectedProjectId && projects.length > 0) {
      // 默认项目优先级：置顶 → 进行中 → 任意第一个。
      // 与"项目中心"侧栏保持一致的选择逻辑，让首次进入的人能看到自己常用的项目。
      const activeProjects = projects.filter((p) => p.status === "active");
      const defaultProject =
        activeProjects.find((p) => p.is_pinned) ||
        activeProjects[0] ||
        projects[0];
      if (defaultProject) setSelectedProjectId(defaultProject.id);
    }
  }, [projects, selectedProjectId, setSelectedProjectId]);

  /**
   * 下拉框选项：与"项目中心"侧栏保持一致——展示所有项目（不过滤 status），
   * 但给非 active 的项目加 [已归档]/[已暂停] 后缀提示，避免用户误选已下线的项目。
   */
  const projectOptions = useMemo(
    () =>
      projects.map((p) => {
        let suffix = "";
        if (p.status === "archived") suffix = "（已归档）";
        else if (p.status === "paused") suffix = "（已暂停）";
        else if (p.status === "completed") suffix = "（已完成）";
        return {
          value: p.id,
          label: `${p.name}${suffix}`,
        };
      }),
    [projects]
  );

  return (
    <header className="flex h-14 shrink-0 items-center justify-between border-b border-border bg-topbar px-4">
      <div className="flex min-w-0 flex-1 items-center gap-4">
        <ShadcnSelect
          value={selectedProjectId ?? ""}
          onChange={(value) => setSelectedProjectId(value)}
          options={projectOptions}
          placeholder={projectsLoading ? "加载项目中" : "选择项目"}
          disabled={projectsLoading || projectOptions.length === 0}
          className="w-56"
        />
        <Breadcrumb />
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <button
          type="button"
          onClick={openCommandPalette}
          className="flex h-8 items-center gap-2 rounded-md border border-border bg-muted/50 px-2.5 text-caption text-muted-foreground transition-colors hover:border-primary/40 hover:bg-muted hover:text-foreground"
          aria-label="打开全局搜索"
          title="全局搜索（Ctrl+K）"
        >
          <Search className="h-3.5 w-3.5" />
          <span className="hidden lg:inline">搜索</span>
          <kbd className="hidden rounded bg-background px-1.5 py-0.5 text-micro xl:inline">Ctrl K</kbd>
        </button>
        <ThemeToggle />
        <UserAccountMenu />
      </div>
    </header>
  );
}
