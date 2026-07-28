import React, { type ComponentType } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    refresh: vi.fn(),
  }),
}));

vi.mock("@/lib/stores/project-store", () => {
  const state = {
    selectedProjectId: "",
    setSelectedProjectId: vi.fn(),
  };
  const useProjectStore = (selector: (value: typeof state) => unknown) => selector(state);
  useProjectStore.getState = () => state;
  return { useProjectStore };
});

vi.mock("@/lib/stores/factory-selection-store", () => ({
  useFactorySelection: () => new Set<string>(),
}));

vi.mock("@/lib/stores/storyboard-expanded-store", () => ({
  useStoryboardExpandedIds: () => new Set<string>(),
  useStoryboardExpandedStore: (selector: (value: { toggle: () => void }) => unknown) =>
    selector({ toggle: vi.fn() }),
}));

vi.mock("@/hooks/use-name-lookup", () => ({
  useNameLookup: () => ({}),
}));

vi.mock("@/components/factory", async () => {
  const ReactModule = await import("react");
  return {
    FactoryCRUDPage: ({ title }: { title: string }) =>
      ReactModule.createElement("main", { "data-factory": title }, title),
    flattenUsageReferences: () => [],
    getEntityLabel: (entity: { name?: string; title?: string }) =>
      entity.name ?? entity.title ?? "",
  };
});

import { CharacterFactoryPage } from "@/components/modules/character-factory";
import { SceneFactoryPage } from "@/components/modules/scene-factory";
import { PropFactoryPage } from "@/components/modules/prop-factory";
import { StoryboardDirectorPage } from "@/components/modules/storyboard-director";
import { AudioCenterPage } from "@/components/modules/audio-center";

const factories: Array<[string, ComponentType]> = [
  ["角色工厂", CharacterFactoryPage],
  ["场景工厂", SceneFactoryPage],
  ["道具工厂", PropFactoryPage],
  ["分镜导演台", StoryboardDirectorPage],
  ["音频中心", AudioCenterPage],
];

describe("核心工厂组件", () => {
  it.each(factories)("%s 可以完成烟雾渲染", (title, FactoryPage) => {
    expect(() => renderToStaticMarkup(<FactoryPage />)).not.toThrow();
    expect(renderToStaticMarkup(<FactoryPage />)).toContain(title);
  });
});
