/**
 * 我的待办 API（评审优化 P1）
 *
 * 对应后端 /api/todos：
 * - listTodos(status, includeDeleted)，owner 始终来自服务端登录会话
 * - createTodo / updateTodo / deleteTodo(soft) / restoreTodo
 * - permanentDeleteTodo(hard)
 */

export type TodoStatus = "pending" | "doing" | "done";
export type TodoPriority = "low" | "medium" | "high";

export interface Todo {
  id: string;
  owner: string;
  title: string;
  description?: string;
  status: TodoStatus;
  priority: TodoPriority;
  due_date?: string;
  link_type?: string;
  link_id?: string;
  link_url?: string;
  created_at: string;
  updated_at: string;
  deleted_at?: string;
}

export interface TodoInput {
  title: string;
  description?: string;
  status?: TodoStatus;
  priority?: TodoPriority;
  due_date?: string;
  link_type?: string;
  link_id?: string;
  link_url?: string;
}

const BASE = "/api/todos";

export async function listTodos(params?: {
  status?: TodoStatus;
  includeDeleted?: boolean;
}): Promise<Todo[]> {
  const search = new URLSearchParams();
  if (params?.status) search.set("status", params.status);
  if (params?.includeDeleted) search.set("includeDeleted", "true");
  const q = search.toString();
  const res = await fetch(`${BASE}${q ? `?${q}` : ""}`);
  const data = await res.json();
  if (data?.code !== 0) throw new Error(data?.message ?? "load todos failed");
  return data.data as Todo[];
}

export async function createTodo(input: TodoInput): Promise<Todo> {
  const res = await fetch(BASE, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input),
  });
  const data = await res.json();
  if (data?.code !== 0) throw new Error(data?.message ?? "create todo failed");
  return data.data as Todo;
}

export async function updateTodo(id: string, patch: Partial<TodoInput>): Promise<Todo> {
  const res = await fetch(`${BASE}/${id}`, {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(patch),
  });
  const data = await res.json();
  if (data?.code !== 0) throw new Error(data?.message ?? "update todo failed");
  return data.data as Todo;
}

export async function deleteTodo(id: string, hard = false): Promise<void> {
  const res = await fetch(`${BASE}/${id}${hard ? "?hard=true" : ""}`, { method: "DELETE" });
  const data = await res.json();
  if (data?.code !== 0) throw new Error(data?.message ?? "delete todo failed");
}

export async function restoreTodo(id: string): Promise<void> {
  const res = await fetch(`${BASE}/${id}/restore`, { method: "POST" });
  const data = await res.json();
  if (data?.code !== 0) throw new Error(data?.message ?? "restore todo failed");
}
