# Agnes AI Studio Design System

Agnes AI Studio is an AI comic-drama production workspace. Its interface should feel like a professional creation console for small teams: cinematic when reviewing media, precise when managing projects, and familiar when chatting with AI.

This document is the design contract for future frontend work. When UI decisions are unclear, prefer the rules here over one-off visual choices.

## Design Direction

Agnes should not copy a single external product. It combines three references:

- Runway-style media focus: cinematic dark surfaces, strong image/video preview, clear generation states.
- Linear-style project management: compact information, precise status, fast scanning, low decorative noise.
- VoltAgent-style AI tool console: dark professional base, green accent, technical confidence.

Do not copy another brand's colors, typography, spacing, marketing copy, or component shapes. Use references only to clarify product behavior and interface hierarchy.

## Product Personality

- Professional, calm, production-ready.
- Creative, but not decorative.
- Dense enough for real work, but never crowded.
- Media-first when showing generated images or videos.
- Workflow-first when showing scripts, storyboards, assets, edits, reviews, and delivery.

Avoid:

- Warm beige/coral document-assistant style.
- Marketing-page hero layouts inside the app.
- Decorative gradients, floating orbs, bokeh blobs, and visual filler.
- Oversized cards for operational screens.
- One-color palettes dominated by a single hue family.

## Layout Model

The product has two major modes:

1. Chat and generation pages
   - Keep the ChatGPT-like conversation rhythm.
   - The input composer stays fixed at the bottom.
   - Uploaded attachments preview inside the composer before sending and move into the message area after sending.
   - Generated images and videos appear in the message/result area, bound to the current conversation.

2. Project workbench
   - Use a management-tool layout.
   - Split production into independent pages: script, storyboard, assets, edit, review, delivery.
   - The project home page is a production command center, not a marketing dashboard.
   - Use left-label forms for project metadata and operational forms where scan speed matters.

## Page Structure

### Global Shell

- Left sidebar: projects, conversations, favorites, project workbench entry.
- Main header: current mode or workspace page.
- Main content: scrollable work area.
- Footer composer: only for chat/image/video modes, not project management pages.

### Project Home

Project home must show:

- Project name, production stage, owner, deadline, storage location.
- Production progress.
- Project health.
- Pending issues, reviews, and tasks.
- Next milestone.
- Today action suggestions.
- Risk panel.
- Production pipeline: script -> storyboard -> assets -> edit -> review -> delivery.
- Project management modules: team, episodes, issues, milestones, tasks.

### Independent Work Pages

Each work page should have:

- Breadcrumb-like return path to project home.
- Page title and metric.
- Production module navigation.
- Project management navigation.
- Page-specific filters where useful.
- Empty state with a useful next action.
- Clear primary action in the upper working area.

## Visual Tokens

These are semantic directions, not a requirement to hardcode exact values everywhere.

### Color

- App background: near-black charcoal.
- Sidebar: deeper black-charcoal.
- Surface: layered dark gray.
- Surface elevated: slightly lighter dark gray.
- Border: subtle white alpha.
- Primary text: near-white.
- Secondary text: muted gray.
- Accent: emerald/green for active AI/workflow actions.
- Warning: amber.
- Error/destructive: red.
- Info: blue/cyan, used sparingly.

Rules:

- Keep media previews on neutral dark backgrounds.
- Do not put vivid colored backgrounds behind image/video previews unless they communicate status.
- Use accent color for action and state, not decoration.
- Status colors must be consistent across pages.

### Typography

- Use the existing system font stack.
- Page titles should be clear but not oversized in tool surfaces.
- Operational cards use compact headings.
- Body text should favor readability over drama.
- Do not use negative letter spacing.
- Do not scale font size directly with viewport width.

### Spacing

- Common compact gap: 8px.
- Default section gap: 12px to 16px.
- Large dashboard separation: 20px to 24px.
- Composer/result vertical gap should stay close to 10px unless media needs more breathing room.

### Radius

- Buttons and inputs: 8px or below unless an existing component already defines a larger shape.
- Repeated item cards: 8px.
- Large shell panels may use 12px to 16px if they are not nested inside another card.
- Do not put cards inside cards for decoration.

## Components

### Buttons

- Use icon + text for clear commands.
- Use icon-only buttons for compact repeated actions, with accessible labels.
- Primary buttons are for the one main action in a local area.
- Secondary buttons are for supporting actions.
- Destructive actions must be red and require clear intent.
- Disabled buttons must visibly look disabled and use disabled cursor behavior.

### Forms

- Use left labels for management/workbench forms.
- Use placeholder text for hints, not as the only label.
- Inputs should have focus-visible styling.
- Numeric fields should use numeric inputs.
- Long prompts use textareas with stable min-height.

### Cards and Panels

- Cards are for repeated records, result items, or framed tools.
- Page sections should be full-width panels or unframed layouts.
- Do not create card-in-card stacks unless the inner card is a repeated record.
- Operational cards should show title, status/metric, short description, and action.

### Status

Use concise state labels:

- Ready: `已就绪`
- Incomplete: `待完善`
- Processing: `处理中`
- Review: `审核中`
- Done: `完成`
- Failed: `失败`

Every status should have:

- Text label.
- Color treatment.
- Optional next action.

### Empty States

Empty states must say what is missing and what to do next.

Good:

- `暂无分镜。先从剧本页生成分镜，或手动新增第一条镜头。`

Bad:

- `暂无数据`

## Media Rules

- Images must preserve original aspect ratio.
- Portrait 9:16 images should display as portrait, not stretched into landscape.
- Use `object-contain` for detail/preview where correctness matters.
- Use `object-cover` only for thumbnails where cropping is acceptable.
- Video previews need visible controls, duration/status where available, and download/open actions.
- Generated media should be stored locally and bound to its conversation/project/asset record.

## Project Workbench Rules

The AI comic-drama workflow is:

Project -> Script -> Storyboard -> Storyboard Base Image -> Image-to-Video -> Edit -> Review -> Export

Workbench modules:

- Script: episode scripts, script status, storyboard generation.
- Storyboard: shot number, scene, role binding, scene binding, prompt, base image, video.
- Assets: image, video, character, scene, style, prompt, project, storyboard base image.
- Edit: clip list, source video, in/out point, order, notes.
- Review: review target, reviewer, status, comments, resolution.
- Delivery: script document, storyboard table, edit list, manifest, local package.

Project home should show production state, not all detailed editing controls at once.

## Sidebar Rules

- Projects must stay visible when a new conversation is created.
- Conversation list items show title based on the first user request when possible.
- Hover actions reveal overflow menu.
- Deleting a conversation must delete bound messages, generated images/videos, and task records according to product rules.

## Interaction Rules

- Hover states are required for clickable cards, list items, and icon buttons.
- Clicked actions must show feedback through toast/notice, state change, or loading indicator.
- Long-running generation must not block other conversations.
- Stop/regenerate controls must be tied to the active conversation/task.
- Opening detail for images/videos should use a dedicated detail page or new tab when appropriate.

## Accessibility

- Text contrast should remain readable on dark surfaces.
- Icon-only controls need `aria-label`.
- Buttons should be actual `button` elements.
- Images need meaningful `alt` text where possible.
- Keyboard focus must be visible.

## Implementation Rules

- Prefer existing Tailwind patterns in the repo.
- Use lucide-react icons for buttons and actions.
- Keep design constants semantic in code comments and docs.
- Avoid adding new visual libraries unless there is a clear need.
- Before finishing visual work, run:

```bat
cd frontend
npm run build
```

If `frontend/next-env.d.ts` changes from `.next` to `.next-build` after build, restore it to:

```ts
/// <reference path="./.next/types/routes.d.ts" />
```

## Design Review Checklist

- Does the page support the AI comic-drama workflow?
- Is media displayed without distortion?
- Can a small team understand the next action quickly?
- Are project pages split instead of crowded into one screen?
- Are left-label forms used for management data?
- Are hover, active, disabled, loading, and empty states covered?
- Are generated assets bound to the correct conversation/project?
- Is the UI professional without copying another product's brand?
