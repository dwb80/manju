/**
 * @file chat-mode-section.tsx
 * @description 聊天模式区块组件，整合聊天相关功能
 */

"use client";

import type { RefObject } from "react";
import type {
    Mode,
    Message,
    Attachment,
    ChatSettings,
    ImageSettings,
    VideoSettings,
    FavoriteView,
} from "@/lib/app-types";
import { ChatView } from "@/components/chat/chat-view";
import { FavoritesView } from "@/components/common/favorites-view";
import { ComposerPanel } from "@/components/chat/composer-panel";
import { ProjectWorkbenchSection, ProjectWorkbenchSectionProps } from "@/components/project/project-workbench-section";

export interface ChatModeSectionProps {
    mode: Mode;
    notice: string;
    scrollRef: RefObject<HTMLDivElement | null>;
    messages: Message[];
    lastAssistantMessageIndex: number;
    currentConversationSubmitting: boolean;
    favorites: FavoriteView[];
    prompt: string;
    attachments: Attachment[];
    chatSettings: ChatSettings;
    imageSettings: ImageSettings;
    videoSettings: VideoSettings;
    enhancingPrompt: boolean;
    submitting: boolean;
    fileInputRef: RefObject<HTMLInputElement | null>;
    onPromptChange: (prompt: string) => void;
    onChatSettingsChange: (updater: (draft: ChatSettings) => ChatSettings) => void;
    onImageSettingsChange: (updater: (draft: ImageSettings) => ImageSettings) => void;
    onVideoSettingsChange: (updater: (draft: VideoSettings) => VideoSettings) => void;
    onAddFiles: (files: FileList) => void;
    onRemoveAttachment: (attachment: Attachment) => void;
    onModeChange: (mode: Mode) => void;
    onEnhancePrompt: () => void;
    onSubmit: () => void;
    onStopChat: () => void;
    onRegenerateChat: () => void;
    onRefreshFavorites: () => void;
    onOpenImageDetail: (taskId: string, index: number) => void;
    onDownloadMedia: (url: string, filename: string) => void;
    onOpenRawMedia: (url: string) => void;
    onCopy: (text: string) => void;
    onContinueEditImage: (url: string) => void;
    onRemoveFavorite: (favoriteId: string) => void;
    onImageLoad: () => void;
    scrollToLatest: () => void;
    projectWorkbenchProps?: ProjectWorkbenchSectionProps;
}

export function ChatModeSection(props: ChatModeSectionProps) {
    const {
        mode,
        notice,
        scrollRef,
        messages,
        lastAssistantMessageIndex,
        currentConversationSubmitting,
        favorites,
        prompt,
        attachments,
        chatSettings,
        imageSettings,
        videoSettings,
        enhancingPrompt,
        submitting,
        fileInputRef,
        onPromptChange,
        onChatSettingsChange,
        onImageSettingsChange,
        onVideoSettingsChange,
        onAddFiles,
        onRemoveAttachment,
        onModeChange,
        onEnhancePrompt,
        onSubmit,
        onStopChat,
        onRegenerateChat,
        onRefreshFavorites,
        onOpenImageDetail,
        onDownloadMedia,
        onOpenRawMedia,
        onCopy,
        onContinueEditImage,
        onRemoveFavorite,
        onImageLoad,
        scrollToLatest,
        projectWorkbenchProps,
    } = props;

    return (
        <section className={`agnes-work-surface relative grid h-screen min-w-0 ${mode === "favorites" || mode === "project" ? "grid-rows-[56px_1fr]" : "grid-rows-[56px_1fr_auto]"} overflow-hidden`}>
            <header className="flex items-center justify-between border-b border-white/10 bg-[#181818]/80 px-5 backdrop-blur">
                <div className="text-sm font-semibold">
                    {mode === "chat" && "Agnes 2.0 Flash"}
                    {mode === "favorites" && "收藏"}
                    {mode === "project" && "项目工作台"}
                </div>
                <div className="text-xs font-medium text-[#d6d6d6]">{notice}</div>
            </header>
            {notice && (
                <div className="pointer-events-none fixed left-1/2 top-16 z-50 -translate-x-1/2 rounded-full border border-white/10 bg-[#303030] px-5 py-2.5 text-sm text-white shadow-lg transition-all duration-200">
                    {notice}
                </div>
            )}

            <div ref={scrollRef} className={`min-h-0 overflow-auto ${mode === "project" ? "px-5 pt-5" : "px-8 pt-8"} ${mode === "favorites" || mode === "project" ? "pb-12" : "pb-3"}`}>
                <div className={`mx-auto flex w-full flex-col gap-4 ${mode === "project" ? "max-w-[1480px]" : "max-w-[768px]"}`}>
                    {mode === "chat" && (
                        <ChatView
                            messages={messages}
                            lastAssistantMessageIndex={lastAssistantMessageIndex}
                            currentConversationSubmitting={currentConversationSubmitting}
                            onStopChat={onStopChat}
                            onRegenerateChat={onRegenerateChat}
                        />
                    )}

                    {mode === "favorites" && (
                        <FavoritesView
                            favorites={favorites}
                            onRefresh={onRefreshFavorites}
                            onOpenImageDetail={onOpenImageDetail}
                            onDownloadMedia={onDownloadMedia}
                            onOpenRawMedia={onOpenRawMedia}
                            onCopy={onCopy}
                            onContinueEditImage={onContinueEditImage}
                            onRemoveFavorite={onRemoveFavorite}
                            onImageLoad={onImageLoad}
                        />
                    )}

                    {mode === "project" && projectWorkbenchProps && (
                        <ProjectWorkbenchSection {...projectWorkbenchProps} />
                    )}
                </div>
            </div>

            {mode !== "favorites" && mode !== "project" && (
                <ComposerPanel
                    mode={mode}
                    prompt={prompt}
                    attachments={attachments}
                    chatSettings={chatSettings}
                    imageSettings={imageSettings}
                    videoSettings={videoSettings}
                    enhancingPrompt={enhancingPrompt}
                    submitting={submitting}
                    fileInputRef={fileInputRef}
                    onPromptChange={onPromptChange}
                    onChatSettingsChange={onChatSettingsChange}
                    onImageSettingsChange={onImageSettingsChange}
                    onVideoSettingsChange={onVideoSettingsChange}
                    onAddFiles={onAddFiles}
                    onRemoveAttachment={onRemoveAttachment}
                    onModeChange={onModeChange}
                    onEnhancePrompt={onEnhancePrompt}
                    onSubmit={onSubmit}
                />
            )}
        </section>
    );
}