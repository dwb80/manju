"use client";

import { ChatPanel } from "@/components/layout/workspace-panels";
import type { Message } from "@/lib/app-types";

export type ChatViewProps = {
  messages: Message[];
  lastAssistantMessageIndex: number;
  currentConversationSubmitting: boolean;
  onStopChat: () => void;
  onRegenerateChat: () => void;
};

/** 渲染聊天视图 */
export function ChatView({
  messages,
  lastAssistantMessageIndex,
  currentConversationSubmitting,
  onStopChat,
  onRegenerateChat,
}: ChatViewProps) {
  return (
    <ChatPanel
      messages={messages}
      lastAssistantMessageIndex={lastAssistantMessageIndex}
      currentConversationSubmitting={currentConversationSubmitting}
      onStopChat={onStopChat}
      onRegenerateChat={onRegenerateChat}
    />
  );
}