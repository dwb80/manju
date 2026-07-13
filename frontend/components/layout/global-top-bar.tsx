"use client";

import { useEffect, useMemo, useState } from "react";
import { Select } from "@/components/ui/select";
import type { Project } from "@/lib/app-types";
import { api } from "@/lib/api-client";
import { createLogger } from "@/lib/logger";
import { useProjectStore } from "@/lib/stores/project-store";

const log = createLogger("global-top-bar");

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
    <header className="flex h-16 shrink-0 items-center justify-between border-b border-white/10 bg-[#202020] px-6">
      <div className="flex min-w-0 items-center gap-4">
        <h2 className="shrink-0 text-lg font-semibold text-white">当前项目</h2>
        <Select
          value={selectedProjectId}
          onChange={(e) => setSelectedProjectId(e.target.value)}
          options={projectOptions}
          placeholder={projectsLoading ? "加载项目中" : "选择项目"}
          disabled={projectsLoading || projectOptions.length === 0}
          className="w-64"
        />
      </div>
    </header>
  );
}
