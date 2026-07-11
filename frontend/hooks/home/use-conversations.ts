"use client";

import { useState, useCallback, useRef } from "react";
import { api } from "@/lib/api-client";
import type { Conversation } from "@/lib/app-types";

export function useConversations({
  projectScope,
  showNotice,
}: {
  projectScope: string;
  showNotice: (message: string) => void;
}) {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [conversationId, setConversationId] = useState("");
  const [conversationMenuId, setConversationMenuId] = useState("");
  const [conversationRenameDraft, setConversationRenameDraft] = useState<{ conversation: Conversation; title: string } | null>(null);
  const conversationIdRef = useRef("");

  /** 按当前项目范围加载会话列表，没有会话时自动创建一个。 */
  const loadConversations = useCallback(
    async (preferredId = "", scope = projectScope) => {
      try {
        let items = await api<Conversation[]>(`/api/conversations?projectId=${encodeURIComponent(scope)}`);
        if (!items.length) {
          const created = await api<Conversation>("/api/conversations", {
            method: "POST",
            body: JSON.stringify({ project_id: scope === "all" ? "" : scope }),
          });
          items = [created];
        }
        const sharedId = typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("conversationId") ?? "" : "";
        setConversations(items);
        setConversationId((current) => {
          const candidate = preferredId || current || sharedId || items[0]?.id || "";
          return items.some((item) => item.id === candidate) ? candidate : items[0]?.id || "";
        });
      } catch (error) {
        showNotice((error as Error).message || "会话列表加载失败");
      }
    },
    [projectScope, showNotice]
  );

  /** 切换当前会话，并同步加载消息、图片和视频内容。 */
  const selectConversation = useCallback(
    async (id: string, callbacks?: { onLoadMessages?: (id: string) => Promise<void>; onLoadImages?: (id: string) => Promise<void>; onLoadVideos?: (id: string) => Promise<void>; onSetMode?: (mode: import("@/lib/app-types").Mode) => void }) => {
      setConversationId(id);
      conversationIdRef.current = id;
      if (callbacks) {
        const [nextMessages, nextImages, nextVideos] = await Promise.all([
          callbacks.onLoadMessages?.(id) ?? Promise.resolve([]),
          callbacks.onLoadImages?.(id) ?? Promise.resolve([]),
          callbacks.onLoadVideos?.(id) ?? Promise.resolve([]),
        ]);
        // modeFromConversationContent 需要在外部计算
      }
    },
    []
  );

  /** 切换历史会话的置顶状态。 */
  const togglePinConversation = useCallback(
    async (conversation: Conversation) => {
      await api<Conversation>(`/api/conversations/${conversation.id}`, {
        method: "PUT",
        body: JSON.stringify({ is_pinned: !conversation.is_pinned }),
      });
      setConversationMenuId("");
      await loadConversations(conversationId, projectScope);
      showNotice(conversation.is_pinned ? "已取消置顶" : "已置顶");
    },
    [conversationId, projectScope, loadConversations, showNotice]
  );

  /** 复制当前会话的分享链接。 */
  const shareConversation = useCallback(async (conversation: Conversation) => {
    const url = `${window.location.origin}/?conversationId=${encodeURIComponent(conversation.id)}`;
    await navigator.clipboard.writeText(url);
    setConversationMenuId("");
    showNotice("会话链接已复制");
  }, [showNotice]);

  /** 打开会话重命名弹层。 */
  const renameConversation = useCallback((conversation: Conversation) => {
    setConversationRenameDraft({ conversation, title: conversation.title });
    setConversationMenuId("");
  }, []);

  /** 提交会话重命名弹层。 */
  const submitConversationRename = useCallback(async () => {
    if (!conversationRenameDraft) return;
    const { conversation } = conversationRenameDraft;
    const title = conversationRenameDraft.title.trim();
    if (!title || title === conversation.title) {
      setConversationRenameDraft(null);
      return;
    }
    await api<Conversation>(`/api/conversations/${conversation.id}`, {
      method: "PUT",
      body: JSON.stringify({ title }),
    });
    setConversationRenameDraft(null);
    await loadConversations(conversationId, projectScope);
    showNotice("已重命名");
  }, [conversationRenameDraft, conversationId, projectScope, loadConversations, showNotice]);

  /** 删除会话以及它关联的消息、图片、视频和收藏记录。 */
  const deleteConversationItem = useCallback(
    async (conversation: Conversation, onAfterDelete?: (nextId: string) => void) => {
      await api(`/api/conversations/${conversation.id}`, { method: "DELETE" });
      setConversationMenuId("");
      const nextId = conversation.id === conversationId ? conversations.find((item) => item.id !== conversation.id)?.id ?? "" : conversationId;
      if (!nextId) {
        onAfterDelete?.("");
      }
      setConversationId(nextId);
      await loadConversations(nextId, projectScope);
      showNotice("已删除会话");
    },
    [conversationId, conversations, projectScope, loadConversations, showNotice]
  );

  /** 在指定项目下创建新会话。 */
  const createConversationInProject = useCallback(
    async (projectId: string) => {
      const created = await api<Conversation>("/api/conversations", {
        method: "POST",
        body: JSON.stringify({ title: "新的创作会话", project_id: projectId }),
      });
      setConversationMenuId("");
      setConversationId(created.id);
      conversationIdRef.current = created.id;
      await loadConversations(created.id, projectScope);
      showNotice("已创建新会话");
      return created;
    },
    [projectScope, loadConversations, showNotice]
  );

  return {
    conversations,
    setConversations,
    conversationId,
    setConversationId,
    conversationMenuId,
    setConversationMenuId,
    conversationRenameDraft,
    setConversationRenameDraft,
    conversationIdRef,
    loadConversations,
    selectConversation,
    togglePinConversation,
    shareConversation,
    renameConversation,
    submitConversationRename,
    deleteConversationItem,
    createConversationInProject,
  };
}
