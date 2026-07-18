"use client";

import { useState, useRef, useCallback } from "react";
import { api, apiCandidates, getCsrfToken, uploadImages } from "@/lib/api-client";
import type { Attachment, ChatSettings, Message } from "@/lib/app-types";
import { defaultChatSettings } from "@/lib/project-workflow";

export function useChat({
  conversationId,
  showNotice,
  onLoadConversations,
}: {
  conversationId: string;
  showNotice: (message: string) => void;
  onLoadConversations: (preferredId?: string, scope?: string) => Promise<void>;
}) {
  const [prompt, setPrompt] = useState("");
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [chatSettings, setChatSettings] = useState<ChatSettings>(defaultChatSettings);
  const [messages, setMessages] = useState<Message[]>([]);
  const [submittingConversationIds, setSubmittingConversationIds] = useState<string[]>([]);
  const [enhancingPrompt, setEnhancingPrompt] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const conversationIdRef = useRef("");

  const currentConversationSubmitting = submittingConversationIds.includes(conversationId);

  /** 加载指定会话的聊天消息。 */
  const loadMessages = useCallback(
    async (id = conversationId) => {
      if (!id) return [];
      try {
        const next = await api<Message[]>(`/api/conversations/${id}/messages`);
        setMessages(next);
        return next;
      } catch (error) {
        showNotice((error as Error).message || "消息加载失败");
        return [];
      }
    },
    [conversationId, showNotice]
  );

  /** 消费聊天 SSE 流，并把片段追加到当前会话最后一条助手消息。 */
  const streamChat = useCallback(
    async (path: string, body: Record<string, unknown>, targetConversationId: string) => {
      let response: Response | null = null;
      let networkError: unknown = null;
      const headers = new Headers({ "content-type": "application/json" });
      const csrfToken = getCsrfToken();
      if (csrfToken) headers.set("x-csrf-token", csrfToken);
      for (const url of apiCandidates(path)) {
        try {
          response = await fetch(url, {
            method: "POST",
            headers,
            body: JSON.stringify(body),
            credentials: "include",
          });
          break;
        } catch (error) {
          networkError = error;
        }
      }
      if (!response) {
        throw new Error(
          `无法连接后端服务，请确认 start-all.bat 已启动后端。${networkError instanceof Error ? ` ${networkError.message}` : ""}`.trim()
        );
      }
      if (!response.ok) {
        const text = await response.text();
        let errorMessage = text || response.statusText;
        try {
          const parsed = JSON.parse(text) as { message?: string };
          errorMessage = parsed.message || response.statusText;
        } catch {
          errorMessage = text || response.statusText;
        }
        throw new Error(errorMessage);
      }
      const reader = response.body?.getReader();
      if (!reader) return;
      const decoder = new TextDecoder();
      let buffer = "";
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const events = buffer.split("\n\n");
        buffer = events.pop() || "";
        for (const event of events) {
          const line = event.split("\n").find((part) => part.startsWith("data: "));
          if (!line) continue;
          const chunk = JSON.parse(line.slice(6));
          if (conversationIdRef.current !== targetConversationId) continue;
          setMessages((items) => {
            const next = [...items];
            const last = next[next.length - 1];
            if (!last || last.role !== "assistant") return items;
            const meta = { ...(last.meta ?? {}) };
            if (chunk.reasoning) meta.reasoning = `${meta.reasoning ?? ""}${chunk.reasoning}`;
            if (chunk.tool_calls) {
              const buffer = new Map<string, import("@/lib/app-types").ChatToolCall>();
              const existing = Array.isArray(meta.tool_calls) ? (meta.tool_calls as import("@/lib/app-types").ChatToolCall[]) : [];
              for (const toolCall of existing) buffer.set(toolCall.id, toolCall);
              for (const delta of chunk.tool_calls as import("@/lib/app-types").ChatToolCall[]) {
                const current = buffer.get(delta.id) ?? { id: delta.id, type: "function" as const, function: { name: "", arguments: "" } };
                if (delta.function.name) current.function.name = delta.function.name;
                current.function.arguments += delta.function.arguments;
                buffer.set(delta.id, current);
              }
              meta.tool_calls = Array.from(buffer.values());
            }
            next[next.length - 1] = {
              ...last,
              content: chunk.content ? `${last.content}${chunk.content}` : last.content,
              meta,
            };
            return next;
          });
        }
      }
      if (conversationIdRef.current === targetConversationId) await loadMessages(targetConversationId);
    },
    [loadMessages]
  );

  /** 发送聊天消息，并消费 SSE 流式响应更新最后一条助手消息。 */
  const sendChat = useCallback(
    async (text: string, readyAttachments: Attachment[] = []) => {
      const targetConversationId = conversationId;
      if (!targetConversationId) return;
      const messageFiles = readyAttachments.map((attachment) => ({
        name: attachment.name,
        size: attachment.size,
        url: attachment.url,
      }));
      if (conversationIdRef.current === targetConversationId) {
        setMessages((items) => [
          ...items,
          { role: "user", content: text, meta: { attachments: messageFiles } },
          { role: "assistant", content: "" },
        ]);
      }
      const body: Record<string, unknown> = {
        conversationId: targetConversationId,
        message: text,
        attachments: messageFiles,
        model: chatSettings.model,
        temperature: chatSettings.temperature,
        top_p: chatSettings.top_p,
      };
      if (typeof chatSettings.max_tokens === "number") body.max_tokens = chatSettings.max_tokens;
      if (chatSettings.enableThinking) body.chat_template_kwargs = { enable_thinking: true };
      await streamChat("/api/chat", body, targetConversationId);
    },
    [conversationId, chatSettings, streamChat]
  );

  /** 停止当前会话正在进行的聊天生成。 */
  const stopChat = useCallback(async () => {
    const targetConversationId = conversationId;
    if (!targetConversationId) return;
    try {
      await api("/api/chat/stop", { method: "POST", body: JSON.stringify({ conversationId: targetConversationId }) });
      setSubmittingConversationIds((items) => items.filter((id) => id !== targetConversationId));
      showNotice("已停止生成");
    } catch (error) {
      showNotice((error as Error).message || "停止生成失败");
    }
  }, [conversationId, showNotice]);

  /** 重新生成最后一条助手回复，不重复写入用户消息。 */
  const regenerateChat = useCallback(async () => {
    const targetConversationId = conversationId;
    if (!targetConversationId || submittingConversationIds.includes(targetConversationId)) return;
    if (!messages.some((message) => message.role === "user")) {
      showNotice("还没有可重新生成的用户消息");
      return;
    }
    setSubmittingConversationIds((items) => (items.includes(targetConversationId) ? items : [...items, targetConversationId]));
    showNotice("");
    setMessages((items) => {
      const next = [...items];
      const lastAssistantIndex = next.map((message) => message.role).lastIndexOf("assistant");
      if (lastAssistantIndex >= 0) next.splice(lastAssistantIndex, 1);
      next.push({ role: "assistant", content: "" });
      return next;
    });
    try {
      const body: Record<string, unknown> = { conversationId: targetConversationId };
      if (chatSettings.model) body.model = chatSettings.model;
      if (typeof chatSettings.temperature === "number") body.temperature = chatSettings.temperature;
      if (typeof chatSettings.top_p === "number") body.top_p = chatSettings.top_p;
      if (typeof chatSettings.max_tokens === "number") body.max_tokens = chatSettings.max_tokens;
      if (chatSettings.enableThinking) body.chat_template_kwargs = { enable_thinking: true };
      await streamChat("/api/chat/regenerate", body, targetConversationId);
    } catch (error) {
      showNotice((error as Error).message || "重新生成失败");
      await loadMessages(targetConversationId);
    } finally {
      setSubmittingConversationIds((items) => items.filter((id) => id !== targetConversationId));
      await onLoadConversations("", "");
    }
  }, [conversationId, submittingConversationIds, messages, chatSettings, streamChat, loadMessages, onLoadConversations, showNotice]);

  /** 校验并上传图片附件，然后在输入框上方显示预览。 */
  const addFiles = useCallback(
    async (files: FileList | File[]) => {
      const validFiles: File[] = [];
      for (const file of Array.from(files)) {
        if (!file.type.startsWith("image/")) {
          showNotice("只支持图片附件");
          continue;
        }
        if (file.size > 10 * 1024 * 1024) {
          showNotice("单张图片不能超过 10MB");
          continue;
        }
        validFiles.push(file);
      }
      const remaining = Math.max(0, 8 - attachments.length);
      const nextFiles = validFiles.slice(0, remaining);
      if (nextFiles.length === 0) return;
      const pendingAttachments = nextFiles.map((file) => ({
        id: crypto.randomUUID(),
        name: file.name,
        size: file.size,
        url: "",
        previewUrl: URL.createObjectURL(file),
        status: "uploading" as const,
      }));
      setAttachments((items) => [...items, ...pendingAttachments].slice(0, 8));
      showNotice("正在上传图片...");
      try {
        const uploaded = await uploadImages(nextFiles);
        setAttachments((items) =>
          items.map((item) => {
            const index = pendingAttachments.findIndex((pending) => pending.id === item.id);
            if (index < 0) return item;
            const file = uploaded[index];
            if (!file) return { ...item, status: "failed", error: "上传失败" };
            URL.revokeObjectURL(item.previewUrl);
            return {
              ...item,
              name: file.name,
              size: file.size,
              url: file.url,
              previewUrl: file.url,
              status: "success",
              error: undefined,
            };
          })
        );
        showNotice("图片已上传");
      } catch (error) {
        setAttachments((items) =>
          items.map((item) =>
            pendingAttachments.some((pending) => pending.id === item.id)
              ? { ...item, status: "failed", error: (error as Error).message || "上传失败" }
              : item
          )
        );
        showNotice((error as Error).message || "上传失败");
      }
    },
    [attachments.length, showNotice]
  );

  /** 使用 AI 把当前输入优化成更稳定的图片或视频生成提示词。 */
  const enhancePrompt = useCallback(
    async (currentPrompt: string, mode: "image" | "video") => {
      const text = currentPrompt.trim();
      if (!text) {
        showNotice("请先输入一个初步想法");
        return "";
      }
      setEnhancingPrompt(true);
      try {
        const result = await api<{ enhanced: string }>("/api/prompts/enhance", {
          method: "POST",
          body: JSON.stringify({ prompt: text, mode }),
        });
        showNotice("提示词已增强");
        return result.enhanced;
      } catch (error) {
        showNotice((error as Error).message || "提示词增强失败");
        return "";
      } finally {
        setEnhancingPrompt(false);
      }
    },
    [showNotice]
  );

  return {
    prompt,
    setPrompt,
    attachments,
    setAttachments,
    chatSettings,
    setChatSettings,
    messages,
    setMessages,
    submittingConversationIds,
    setSubmittingConversationIds,
    enhancingPrompt,
    fileInputRef,
    conversationIdRef,
    currentConversationSubmitting,
    loadMessages,
    sendChat,
    stopChat,
    regenerateChat,
    addFiles,
    enhancePrompt,
  };
}
