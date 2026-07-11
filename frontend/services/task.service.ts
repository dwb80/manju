/** 任务相关的业务服务 */
import { api } from "./api-client";
import type { ProjectTask, ProjectTaskStatus } from "@/lib/app-types";

/** 任务服务接口 */
export interface TaskService {
    /** 获取任务列表 */
    list(projectId: string): Promise<ProjectTask[]>;
    /** 创建任务 */
    create(projectId: string, draft: Partial<ProjectTask>): Promise<ProjectTask>;
    /** 更新任务 */
    update(projectId: string, taskId: string, patch: Partial<ProjectTask>): Promise<ProjectTask>;
    /** 删除任务 */
    delete(projectId: string, taskId: string): Promise<void>;
}

/** 获取任务列表 */
export async function listTasks(projectId: string): Promise<ProjectTask[]> {
    return api<ProjectTask[]>(`/api/projects/${projectId}/tasks`);
}

/** 创建任务 */
export async function createTask(
    projectId: string,
    draft: Partial<ProjectTask>
): Promise<ProjectTask> {
    return api<ProjectTask>(`/api/projects/${projectId}/tasks`, {
        method: "POST",
        body: JSON.stringify(draft),
    });
}

/** 更新任务 */
export async function updateTask(
    projectId: string,
    taskId: string,
    patch: Partial<ProjectTask>
): Promise<ProjectTask> {
    return api<ProjectTask>(`/api/projects/${projectId}/tasks/${taskId}`, {
        method: "PUT",
        body: JSON.stringify(patch),
    });
}

/** 删除任务 */
export async function deleteTask(projectId: string, taskId: string): Promise<void> {
    await api(`/api/projects/${projectId}/tasks/${taskId}`, { method: "DELETE" });
}