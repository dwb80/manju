"use client";

/**
 * 剧本工作台：制作任务（tasks）tab
 *
 * 任务表单（标题/状态/负责人/截止/备注）+ 看板视图（按状态分列展示）。
 */

import { Check, Pencil, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ShadcnSelect } from "@/components/ui/select";
import type { ProjectTaskStatus } from "@/lib/app-types";
import type { ProjectWorkbenchTabsProps } from "./types";

export function TasksTab(props: Pick<
  ProjectWorkbenchTabsProps,
  "editingTaskId" | "taskDraft" | "setTaskDraft" | "submitProjectTaskForm" | "resetProjectTaskForm" |
  "projectTaskColumns" | "projectMembers" | "pagedProjectTasks" | "editProjectTaskItem" | "deleteProjectTaskItem"
>) {
  const {
    editingTaskId, taskDraft, setTaskDraft, submitProjectTaskForm, resetProjectTaskForm,
    projectTaskColumns, projectMembers, pagedProjectTasks, editProjectTaskItem, deleteProjectTaskItem,
  } = props;

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-border bg-muted p-5">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-base font-semibold text-foreground">{editingTaskId ? "编辑制作任务" : "新增制作任务"}</div>
            <div className="mt-1 text-sm text-muted-foreground">维护任务标题、状态、负责人、截止日期和备注；下方看板按状态展示。</div>
          </div>
          {editingTaskId && <Button size="sm" variant="secondary" onClick={resetProjectTaskForm}>取消编辑</Button>}
        </div>
        <div className="grid grid-cols-4 gap-3 max-lg:grid-cols-2 max-md:grid-cols-1">
          <label className="space-y-1.5 lg:col-span-2">
            <span className="block text-sm font-medium text-foreground/80">任务名称</span>
            <input
              className="h-11 w-full rounded-xl border border-border bg-secondary px-3 text-sm text-foreground outline-none transition-colors focus:border-primary"
              value={taskDraft.title ?? ""}
              placeholder="任务名称"
              onChange={(event) => setTaskDraft((draft) => ({ ...draft, title: event.target.value }))}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  void submitProjectTaskForm();
                }
              }}
            />
          </label>
          <label className="space-y-1.5">
            <span className="block text-sm font-medium text-foreground/80">状态</span>
            <select
              className="h-11 w-full rounded-xl border border-border bg-secondary px-3 text-sm text-foreground outline-none transition-colors focus:border-primary"
              value={taskDraft.status ?? "todo"}
              onChange={(event) => setTaskDraft((draft) => ({ ...draft, status: event.target.value as ProjectTaskStatus }))}
            >
              {projectTaskColumns.map((column) => <option key={column.key} value={column.key}>{column.label}</option>)}
            </select>
          </label>
          <label className="space-y-1.5">
            <span className="block text-sm font-medium text-foreground/80">负责人</span>
            <ShadcnSelect
              options={[
                { value: "", label: "未分配" },
                ...projectMembers.map((member) => ({ value: member.name, label: `${member.name} · ${member.role}` })),
              ]}
              value={taskDraft.owner ?? ""}
              onChange={(value) => setTaskDraft((draft) => ({ ...draft, owner: value }))}
              className="h-11 w-full text-sm"
            />
          </label>
          <label className="space-y-1.5">
            <span className="block text-sm font-medium text-foreground/80">截止日期</span>
            <input
              className="h-11 w-full rounded-xl border border-border bg-secondary px-3 text-sm text-foreground outline-none transition-colors focus:border-primary"
              type="date"
              value={taskDraft.due_date ?? ""}
              onChange={(event) => setTaskDraft((draft) => ({ ...draft, due_date: event.target.value }))}
            />
          </label>
        </div>
        <label className="mt-3 block space-y-1.5">
          <span className="block text-sm font-medium text-foreground/80">任务备注</span>
          <textarea
            className="min-h-20 w-full resize-y rounded-xl border border-border bg-secondary px-3 py-3 text-sm leading-6 text-foreground outline-none transition-colors focus:border-primary"
            value={taskDraft.notes ?? ""}
            placeholder="任务备注、验收标准、依赖事项"
            onChange={(event) => setTaskDraft((draft) => ({ ...draft, notes: event.target.value }))}
          />
        </label>
        <div className="mt-5 flex justify-end">
          <Button size="sm" onClick={() => void submitProjectTaskForm()}>
            {editingTaskId ? <Check className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
            {editingTaskId ? "保存任务" : "新增任务"}
          </Button>
        </div>
      </div>
      <div className="grid grid-cols-7 gap-2 overflow-x-auto pb-1 max-lg:grid-cols-[repeat(7,minmax(150px,1fr))]">
        {projectTaskColumns.map((column) => {
          const columnTasks = pagedProjectTasks.filter((task) => task.status === column.key);
          return (
            <div key={column.key} className="min-h-28 rounded-lg border border-border bg-muted p-2">
              <div className="mb-2 flex items-center justify-between text-xs text-muted-foreground">
                <span>{column.label}</span>
                <span>{columnTasks.length}</span>
              </div>
              <div className="space-y-2">
                {columnTasks.map((task) => (
                  <div key={task.id} className="space-y-2 rounded-md border border-border bg-secondary p-2 text-xs">
                    <div className="font-medium text-foreground">{task.title}</div>
                    {(task.owner || task.due_date) && (
                      <div className="truncate text-muted-foreground">{[task.owner, task.due_date].filter(Boolean).join(" · ")}</div>
                    )}
                    {task.notes && <div className="line-clamp-2 text-muted-foreground">{task.notes}</div>}
                    <div className="flex gap-1">
                      <button className="inline-flex h-7 flex-1 items-center justify-center gap-1 rounded-md bg-muted px-2 text-foreground/90 hover:bg-muted" onClick={() => editProjectTaskItem(task)}>
                        <Pencil className="h-3.5 w-3.5" />编辑
                      </button>
                      <button className="grid h-7 w-7 place-items-center rounded-md text-destructive hover:bg-destructive/10" onClick={() => void deleteProjectTaskItem(task)} aria-label="删除任务">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
