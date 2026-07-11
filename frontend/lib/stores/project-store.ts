/**
 * 全局项目选择状态管理
 *
 * 功能：
 * - 管理当前选中的项目ID
 * - 在驾驶舱、AI生产中心、剧本中心等页面间共享项目选择状态
 */

import { create } from "zustand";
import { persist } from "zustand/middleware";

interface ProjectState {
  /** 当前选中的项目ID */
  selectedProjectId: string;
  /** 设置选中的项目ID */
  setSelectedProjectId: (projectId: string) => void;
  /** 清除选中的项目ID */
  clearSelectedProjectId: () => void;
}

/** 全局项目选择Store */
export const useProjectStore = create<ProjectState>()(
  persist(
    (set) => ({
      selectedProjectId: "",
      setSelectedProjectId: (projectId: string) => set({ selectedProjectId: projectId }),
      clearSelectedProjectId: () => set({ selectedProjectId: "" }),
    }),
    {
      name: "project-selection-storage", // localStorage key
    }
  )
);