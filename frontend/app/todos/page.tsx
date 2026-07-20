"use client";

/**
 * 我的待办一级页面（评审优化 P1）
 *
 * 设计原则：
 * - 复用新公共组件（StandalonePageHeader / StatsOverview / Alert）
 * - 模块化 logger：createLogger("todos-page")
 * - notify 工具代替 toast.success 误用
 * - 增删改查 + 软删除 + 还原 + 优先级 / 状态筛选
 */

import { useEffect, useMemo, useState } from "react";
import {
  ListChecks,
  Plus,
  CheckCircle2,
  Clock,
  AlertCircle,
  Trash2,
  RotateCcw,
  Pencil,
  Calendar,
  X,
  Flag,
} from "lucide-react";
import {
  StandalonePageHeader,
  StatsOverview,
  Alert,
} from "@/components/layout";
import { createLogger } from "@/lib/logger";
import { notify } from "@/lib/notify";
import {
  listTodos,
  createTodo,
  updateTodo,
  deleteTodo,
  restoreTodo,
  type Todo,
  type TodoStatus,
  type TodoPriority,
} from "@/services/todo.service";

// 模块级 logger
const log = createLogger("todos-page");

const STATUS_LABEL: Record<TodoStatus, string> = {
  pending: "待处理",
  doing: "进行中",
  done: "已完成",
};

const STATUS_COLOR: Record<TodoStatus, string> = {
  pending: "bg-amber-500/20 text-amber-300",
  doing: "bg-blue-500/20 text-blue-300",
  done: "bg-emerald-500/20 text-emerald-300",
};

const PRIORITY_LABEL: Record<TodoPriority, string> = {
  low: "低",
  medium: "中",
  high: "高",
};

const PRIORITY_COLOR: Record<TodoPriority, string> = {
  low: "bg-gray-500/20 text-gray-300",
  medium: "bg-blue-500/20 text-blue-300",
  high: "bg-red-500/20 text-red-300",
};

export default function TodosPage() {
  const [todos, setTodos] = useState<Todo[]>([]);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState<"all" | TodoStatus>("all");
  const [editing, setEditing] = useState<Todo | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [showRecycle, setShowRecycle] = useState(false);

  async function reload() {
    setLoading(true);
    try {
      const data = await listTodos({
        includeDeleted: showRecycle,
      });
      setTodos(data);
      log.info("load todos success", { count: data.length });
    } catch (err) {
      log.error("load todos failed", { error: (err as Error).message });
      notify.error("加载失败", (err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showRecycle]);

  const stats = useMemo(() => {
    const active = todos.filter((t) => !t.deleted_at);
    return {
      total: active.length,
      pending: active.filter((t) => t.status === "pending").length,
      doing: active.filter((t) => t.status === "doing").length,
      done: active.filter((t) => t.status === "done").length,
    };
  }, [todos]);

  const visible = useMemo(() => {
    if (filter === "all") return todos.filter((t) => !t.deleted_at);
    return todos.filter((t) => !t.deleted_at && t.status === filter);
  }, [todos, filter]);

  const handleSave = async (input: {
    title: string;
    description: string;
    priority: TodoPriority;
    status: TodoStatus;
    due_date: string;
    link_type: string;
    link_id: string;
    link_url: string;
  }) => {
    try {
      if (editing) {
        await updateTodo(editing.id, input);
        log.info("update todo", { id: editing.id });
        notify.success("已更新", input.title);
      } else {
        await createTodo(input);
        log.info("create todo", { title: input.title });
        notify.success("已添加", input.title);
      }
      setShowForm(false);
      setEditing(null);
      await reload();
    } catch (err) {
      log.error("save todo failed", { error: (err as Error).message });
      notify.error("保存失败", (err as Error).message);
    }
  };

  const handleToggleStatus = async (t: Todo) => {
    const next: TodoStatus = t.status === "done" ? "pending" : "done";
    try {
      await updateTodo(t.id, { status: next });
      log.info("toggle todo status", { id: t.id, from: t.status, to: next });
      await reload();
    } catch (err) {
      notify.error("状态切换失败", (err as Error).message);
    }
  };

  const handleDelete = async (t: Todo) => {
    if (!confirm(`确定删除待办「${t.title}」？可在回收站恢复。`)) return;
    try {
      await deleteTodo(t.id, false);
      log.info("soft delete todo", { id: t.id });
      notify.success("已移入回收站", t.title);
      await reload();
    } catch (err) {
      notify.error("删除失败", (err as Error).message);
    }
  };

  const handleRestore = async (t: Todo) => {
    try {
      await restoreTodo(t.id);
      log.info("restore todo", { id: t.id });
      notify.success("已恢复", t.title);
      await reload();
    } catch (err) {
      notify.error("恢复失败", (err as Error).message);
    }
  };

  const handlePermanentDelete = async (t: Todo) => {
    if (!confirm(`永久删除待办「${t.title}」？此操作不可撤销。`)) return;
    try {
      await deleteTodo(t.id, true);
      log.info("permanent delete todo", { id: t.id });
      notify.warn("已永久删除", t.title);
      await reload();
    } catch (err) {
      notify.error("删除失败", (err as Error).message);
    }
  };

  return (
    <main className="min-h-screen bg-[#181818] text-[#ececec]">
      <StandalonePageHeader
        title="我的待办"
        description="跨项目汇总需要处理的事项，支持优先级、状态、关联资产跳转"
        breadcrumbs={["首页", "我的待办"]}
        extraRight={
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                setShowRecycle(!showRecycle);
                log.debug("toggle recycle view", { to: !showRecycle });
              }}
              className={`inline-flex h-7 items-center gap-1 rounded-md border px-2 text-xs transition-colors ${
                showRecycle
                  ? "border-amber-500/50 bg-amber-500/10 text-amber-300"
                  : "border-white/10 bg-[#1a1a1a] text-[#aaa] hover:text-white"
              }`}
            >
              <RotateCcw className="h-3 w-3" />
              {showRecycle ? "退出回收站" : "回收站"}
            </button>
            <button
              type="button"
              onClick={() => {
                setEditing(null);
                setShowForm(true);
              }}
              className="inline-flex h-7 items-center gap-1 rounded-md bg-emerald-500 px-2 text-xs text-white hover:bg-emerald-400"
            >
              <Plus className="h-3 w-3" />
              新建待办
            </button>
          </div>
        }
      />

      <div className="px-6 py-4">
        <StatsOverview
          columns={4}
          cards={[
            {
              tone: "blue",
              icon: <ListChecks className="h-4 w-4" />,
              title: "总待办",
              value: stats.total,
              sub: "全部",
            },
            {
              tone: "amber",
              icon: <Clock className="h-4 w-4" />,
              title: "待处理",
              value: stats.pending,
              sub: "需要开始",
            },
            {
              tone: "purple",
              icon: <AlertCircle className="h-4 w-4" />,
              title: "进行中",
              value: stats.doing,
              sub: "在跑",
            },
            {
              tone: "emerald",
              icon: <CheckCircle2 className="h-4 w-4" />,
              title: "已完成",
              value: stats.done,
              sub: "已结清",
            },
          ]}
        />
      </div>

      {!showRecycle && (
        <div className="px-6">
          <div className="mb-3 inline-flex h-9 items-center rounded-md border border-white/10 bg-[#1a1a1a] p-0.5 text-xs">
            {(["all", "pending", "doing", "done"] as const).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => {
                  setFilter(s);
                  log.debug("switch filter", { to: s });
                }}
                className={`inline-flex items-center gap-1.5 rounded-sm px-3 py-1 transition-colors ${
                  filter === s
                    ? "bg-emerald-500/15 text-emerald-200"
                    : "text-[#aaa] hover:text-white"
                }`}
              >
                {s === "all" ? "全部" : STATUS_LABEL[s]}
                <span className="text-[10px] text-[#666]">
                  （{s === "all" ? stats.total : stats[s]}）
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      <section className="px-6 py-4">
        {showRecycle && (
          <div className="mb-3">
            <Alert tone="warn" title="回收站">
              已软删除的待办。可以恢复，或永久删除（不可撤销）。
            </Alert>
          </div>
        )}

        {visible.length === 0 ? (
          <div className="rounded-lg border border-white/10 bg-[#1a1a1a] p-12 text-center">
            <ListChecks className="mx-auto h-10 w-10 text-[#444]" />
            <h3 className="mt-3 text-sm font-medium text-white">
              {showRecycle ? "回收站为空" : filter === "all" ? "暂无待办" : `暂无「${STATUS_LABEL[filter as TodoStatus]}」的待办`}
            </h3>
            <p className="mt-1 text-xs text-[#888]">
              {showRecycle ? "已删除的待办会出现在这里" : "点击右上角「新建待办」开始记录"}
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {visible.map((t) => (
              <TodoItem
                key={t.id}
                todo={t}
                onToggle={() => handleToggleStatus(t)}
                onEdit={() => {
                  setEditing(t);
                  setShowForm(true);
                }}
                onDelete={() => handleDelete(t)}
                onRestore={() => handleRestore(t)}
                onPermanentDelete={() => handlePermanentDelete(t)}
                isRecycle={!!t.deleted_at}
              />
            ))}
          </div>
        )}
      </section>

      {showForm && (
        <TodoFormDialog
          initial={editing}
          onClose={() => {
            setShowForm(false);
            setEditing(null);
          }}
          onSave={handleSave}
        />
      )}
    </main>
  );
}

interface TodoItemProps {
  todo: Todo;
  onToggle: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onRestore: () => void;
  onPermanentDelete: () => void;
  isRecycle: boolean;
}

function TodoItem({
  todo: t,
  onToggle,
  onEdit,
  onDelete,
  onRestore,
  onPermanentDelete,
  isRecycle,
}: TodoItemProps) {
  return (
    <div
      className={`group flex items-center gap-3 rounded-lg border bg-[#1a1a1a] px-4 py-3 transition-colors ${
        t.status === "done" ? "border-emerald-500/30 opacity-60" : "border-white/10 hover:border-emerald-500/30"
      }`}
    >
      <button
        type="button"
        onClick={onToggle}
        className={`grid h-5 w-5 shrink-0 place-items-center rounded border transition-colors ${
          t.status === "done"
            ? "border-emerald-500 bg-emerald-500"
            : "border-white/40 hover:border-emerald-400"
        }`}
        aria-label={t.status === "done" ? "标记为未完成" : "标记为完成"}
      >
        {t.status === "done" && <CheckCircle2 className="h-3 w-3 text-white" />}
      </button>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1 flex-wrap">
          <h3
            className={`text-sm font-medium ${
              t.status === "done" ? "text-[#888] line-through" : "text-white"
            }`}
          >
            {t.title}
          </h3>
          <span className={`rounded px-1.5 py-0.5 text-[10px] ${STATUS_COLOR[t.status]}`}>
            {STATUS_LABEL[t.status]}
          </span>
          <span className={`inline-flex items-center gap-0.5 rounded px-1.5 py-0.5 text-[10px] ${PRIORITY_COLOR[t.priority]}`}>
            <Flag className="h-2.5 w-2.5" />
            {PRIORITY_LABEL[t.priority]}
          </span>
          {t.due_date && (
            <span className="inline-flex items-center gap-0.5 text-[10px] text-[#888]">
              <Calendar className="h-2.5 w-2.5" />
              {t.due_date}
            </span>
          )}
          {t.link_url && (
            <a
              href={t.link_url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[10px] text-emerald-300 hover:underline"
            >
              {t.link_type ? `跳转 ${t.link_type}` : "跳转关联"}
            </a>
          )}
        </div>
        {t.description && (
          <p className="text-xs text-[#888] line-clamp-1">{t.description}</p>
        )}
      </div>

      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        {!isRecycle ? (
          <>
            <button
              type="button"
              onClick={onEdit}
              className="grid h-7 w-7 place-items-center rounded text-[#888] hover:bg-white/5 hover:text-white"
              aria-label="编辑"
            >
              <Pencil className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={onDelete}
              className="grid h-7 w-7 place-items-center rounded text-[#888] hover:bg-red-500/10 hover:text-red-300"
              aria-label="删除"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </>
        ) : (
          <>
            <button
              type="button"
              onClick={onRestore}
              className="grid h-7 w-7 place-items-center rounded text-[#888] hover:bg-emerald-500/10 hover:text-emerald-300"
              aria-label="恢复"
            >
              <RotateCcw className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={onPermanentDelete}
              className="grid h-7 w-7 place-items-center rounded text-[#888] hover:bg-red-500/10 hover:text-red-300"
              aria-label="永久删除"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </>
        )}
      </div>
    </div>
  );
}

interface TodoFormDialogProps {
  initial: Todo | null;
  onClose: () => void;
  onSave: (input: {
    title: string;
    description: string;
    priority: TodoPriority;
    status: TodoStatus;
    due_date: string;
    link_type: string;
    link_id: string;
    link_url: string;
  }) => void | Promise<void>;
}

function TodoFormDialog({ initial, onClose, onSave }: TodoFormDialogProps) {
  const [title, setTitle] = useState(initial?.title ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [priority, setPriority] = useState<TodoPriority>(initial?.priority ?? "medium");
  const [status, setStatus] = useState<TodoStatus>(initial?.status ?? "pending");
  const [dueDate, setDueDate] = useState(initial?.due_date ?? "");
  const [linkType, setLinkType] = useState(initial?.link_type ?? "");
  const [linkId, setLinkId] = useState(initial?.link_id ?? "");
  const [linkUrl, setLinkUrl] = useState(initial?.link_url ?? "");
  const [busy, setBusy] = useState(false);

  const handleSubmit = async () => {
    if (!title.trim()) {
      notify.warn("请填写标题");
      return;
    }
    setBusy(true);
    try {
      await onSave({
        title: title.trim(),
        description: description.trim(),
        priority,
        status,
        due_date: dueDate,
        link_type: linkType,
        link_id: linkId,
        link_url: linkUrl,
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4" onClick={onClose}>
      <div
        className="w-full max-w-lg overflow-hidden rounded-lg border border-white/10 bg-[#1a1a1a] shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-white/10 px-5 py-3">
          <h2 className="text-sm font-medium text-white">
            {initial ? "编辑待办" : "新建待办"}
          </h2>
          <button type="button" onClick={onClose} className="text-[#888] hover:text-white" aria-label="关闭">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-3 p-5">
          <div>
            <label className="mb-1 block text-xs text-[#888]">标题</label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full rounded-md border border-white/10 bg-[#0f0f0f] px-3 py-2 text-sm text-white focus:border-emerald-500/50 focus:outline-none"
              placeholder="例如：完成第 3 集分镜"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs text-[#888]">描述（可选）</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className="w-full rounded-md border border-white/10 bg-[#0f0f0f] px-3 py-2 text-sm text-white focus:border-emerald-500/50 focus:outline-none"
              placeholder="补充说明、拆解步骤..."
            />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="mb-1 block text-xs text-[#888]">状态</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as TodoStatus)}
                className="w-full rounded-md border border-white/10 bg-[#0f0f0f] px-2 py-2 text-sm text-white"
              >
                <option value="pending">待处理</option>
                <option value="doing">进行中</option>
                <option value="done">已完成</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs text-[#888]">优先级</label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value as TodoPriority)}
                className="w-full rounded-md border border-white/10 bg-[#0f0f0f] px-2 py-2 text-sm text-white"
              >
                <option value="low">低</option>
                <option value="medium">中</option>
                <option value="high">高</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs text-[#888]">截止日期</label>
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="w-full rounded-md border border-white/10 bg-[#0f0f0f] px-2 py-2 text-sm text-white"
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="mb-1 block text-xs text-[#888]">关联类型</label>
              <select
                value={linkType}
                onChange={(e) => setLinkType(e.target.value)}
                className="w-full rounded-md border border-white/10 bg-[#0f0f0f] px-2 py-2 text-sm text-white"
              >
                <option value="">无</option>
                <option value="project">项目</option>
                <option value="script">剧本</option>
                <option value="storyboard">分镜</option>
                <option value="audio">音频</option>
                <option value="video">视频</option>
                <option value="clip">剪辑</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs text-[#888]">关联 ID</label>
              <input
                value={linkId}
                onChange={(e) => setLinkId(e.target.value)}
                className="w-full rounded-md border border-white/10 bg-[#0f0f0f] px-3 py-2 text-sm text-white"
                placeholder="可选"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-[#888]">跳转 URL</label>
              <input
                value={linkUrl}
                onChange={(e) => setLinkUrl(e.target.value)}
                className="w-full rounded-md border border-white/10 bg-[#0f0f0f] px-3 py-2 text-sm text-white"
                placeholder="如 /scripts/xxx"
              />
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-white/10 px-5 py-3">
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="rounded-md px-3 py-1.5 text-sm text-[#888] hover:text-white"
          >
            取消
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={busy}
            className="inline-flex items-center gap-1 rounded-md bg-emerald-500 px-3 py-1.5 text-sm text-white hover:bg-emerald-400 disabled:opacity-50"
          >
            {initial ? "保存" : "添加"}
          </button>
        </div>
      </div>
    </div>
  );
}
