# ComicCanvas Studio UI/UX Design System

> Status: project-wide frontend design source of truth.
> Audience: canvas-agent and every agent that creates or changes renderer UI.
> Source references: `AURA AI Canvas 设计系统语言规范指南.pdf`, `ai (2).html`, and the historical `hjwall/global/design/DESIGN.md`.

## 1. Visual Theme And Atmosphere

ComicCanvas Studio uses a **quiet luxury multimodal canvas** language: an AIGC comic-drama workspace that feels precise, spatial, and restrained. The product is not a marketing page and not a generic SaaS dashboard. It is a dense creative tool where text, image, and video nodes live on a deep canvas, connect through visible flow lines, and report generation state through refined motion.

The signature is **Obsidian Midnight + Champagne Gold**:

- A near-black spatial canvas (`#06070A`) with fine gold-tinted grid lines.
- Frosted, high-contrast node cards with thin metallic borders.
- Champagne gold as the primary interaction signal for active nodes, running jobs, selected edges, focus rings, and premium controls.
- Calm typography, generous line height for Chinese copy, and compact but readable tool surfaces.
- Micro-interactions that imply computation: orbiting node borders, flowing edge dashes, and soft state transitions.

The default app theme should be dark. The light theme is supported as **Alabaster Paper**, but it is secondary and must keep the same layout, hierarchy, and motion semantics.

**Core qualities**

- **Quiet luxury**: no loud gradients, no neon cyberpunk wash, no decorative clutter.
- **Spatial depth**: canvas, grid, cards, connectors, overlays, and side panels each occupy a clear depth layer.
- **Production tool density**: controls are compact and repeatable, not landing-page scale.
- **Comic drama orientation**: text -> image -> video is the main workflow; UI copy and node affordances should reinforce that production chain.
- **Token discipline**: colors, radii, shadows, spacing, and motion curves must come from design tokens or local semantic aliases.

---

## 2. Color Palette And Roles

### 2.1 Dark Theme: Obsidian Midnight

Dark theme is the primary design language.

| Token | Value | Role |
|------|------|------|
| `--cc-bg-canvas` | `#06070A` | Infinite canvas base; deepest work surface |
| `--cc-bg-surface` | `#0D0F14` | App chrome, sidebars, elevated panel base |
| `--cc-bg-card` | `rgba(13, 15, 20, 0.94)` | Frosted node cards and floating controls |
| `--cc-bg-input` | `#101116` | Inputs, textareas, selects, recessed controls |
| `--cc-grid-fine` | `rgba(197, 168, 128, 0.02)` | 20px fine canvas grid |
| `--cc-grid-coarse` | `rgba(197, 168, 128, 0.07)` | 100px major canvas grid |
| `--cc-axis-color` | `rgba(197, 168, 128, 0.15)` | Canvas origin axes and absolute guides |
| `--cc-border-card` | `rgba(197, 168, 128, 0.16)` | Default metallic node/card border |
| `--cc-border-card-hover` | `rgba(197, 168, 128, 0.52)` | Hovered or targetable card border |
| `--cc-border-input` | `rgba(197, 168, 128, 0.22)` | Input and select border |
| `--cc-text-primary` | `#F3F4F6` | Main text |
| `--cc-text-secondary` | `#9CA3AF` | Descriptions, metadata, inactive labels |
| `--cc-text-muted` | `#6B7280` | Disabled, counters, secondary timestamps |
| `--cc-accent-gold` | `#C5A880` | Main highlight, selected edges, running state |
| `--cc-accent-gold-hover` | `#B5976F` | Hover and pressed gold state |
| `--cc-shadow-glow` | `rgba(197, 168, 128, 0.03)` | Card ambient glow |
| `--cc-active-glow` | `rgba(197, 168, 128, 0.24)` | Active node glow |
| `--cc-line-inactive` | `rgba(197, 168, 128, 0.14)` | Idle connector lines |
| `--cc-line-active` | `#C5A880` | Running or selected connector lines |
| `--cc-vignette` | `radial-gradient(circle, transparent 40%, rgba(3, 4, 6, 0.65) 100%)` | Canvas viewport edge depth |

### 2.2 Light Theme: Alabaster Paper

Light theme must feel like printed stone paper with warm metallic guide lines. It is not a plain white SaaS theme.

| Token | Value | Role |
|------|------|------|
| `--cc-bg-canvas` | `#F4F4F6` | Warm paper canvas |
| `--cc-bg-surface` | `#FFFFFF` | App chrome and panels |
| `--cc-bg-card` | `rgba(255, 255, 255, 0.99)` | Solid paper node cards |
| `--cc-bg-input` | `#F4F5F7` | Inputs and recessed controls |
| `--cc-grid-fine` | `rgba(130, 96, 51, 0.04)` | 20px fine canvas grid |
| `--cc-grid-coarse` | `rgba(130, 96, 51, 0.13)` | 100px major canvas grid |
| `--cc-axis-color` | `rgba(130, 96, 51, 0.26)` | Canvas origin axes |
| `--cc-border-card` | `rgba(130, 96, 51, 0.32)` | Warm metallic card border |
| `--cc-border-card-hover` | `rgba(130, 96, 51, 0.75)` | Hovered or active border |
| `--cc-border-input` | `rgba(130, 96, 51, 0.22)` | Input and select border |
| `--cc-text-primary` | `#111827` | Main text |
| `--cc-text-secondary` | `#374151` | Descriptions and metadata |
| `--cc-text-muted` | `#5A6A80` | Muted labels and counters |
| `--cc-accent-gold` | `#826033` | Main highlight and selected state |
| `--cc-accent-gold-hover` | `#694D26` | Hover and pressed gold state |
| `--cc-shadow-glow` | `rgba(130, 96, 51, 0.12)` | Paper-card ambient shadow |
| `--cc-active-glow` | `rgba(130, 96, 51, 0.24)` | Active node glow |
| `--cc-line-inactive` | `rgba(130, 96, 51, 0.22)` | Idle connector lines |
| `--cc-line-active` | `#826033` | Running or selected connector lines |
| `--cc-vignette` | `radial-gradient(circle, transparent 65%, rgba(130, 96, 51, 0.07) 100%)` | Light canvas edge depth |

### 2.3 Semantic Status Colors

Use status colors sparingly and never let them replace the gold interaction language.

| Token | Value | Role |
|------|------|------|
| `--cc-success` | `#10B981` | Completed generation, validated plan |
| `--cc-info` | `#06B6D4` | Informational or image-generation accents |
| `--cc-warning` | `#F59E0B` | User attention, quota, recoverable issue |
| `--cc-danger` | `#EF4444` | Failed job, invalid destructive action |
| `--cc-focus-ring` | `rgba(197, 168, 128, 0.45)` | Keyboard focus and accessible outlines |

---

## 3. Engineering Token Contract

The renderer should expose these variables through the global stylesheet before component work begins. Component code should consume semantic tokens, Tailwind aliases, or CSS variables. Avoid hardcoded hex/RGBA values inside React components.

```css
:root {
  --cc-bg-canvas: #F4F4F6;
  --cc-bg-surface: #FFFFFF;
  --cc-bg-card: rgba(255, 255, 255, 0.99);
  --cc-bg-input: #F4F5F7;
  --cc-grid-fine: rgba(130, 96, 51, 0.04);
  --cc-grid-coarse: rgba(130, 96, 51, 0.13);
  --cc-axis-color: rgba(130, 96, 51, 0.26);
  --cc-border-card: rgba(130, 96, 51, 0.32);
  --cc-border-card-hover: rgba(130, 96, 51, 0.75);
  --cc-border-input: rgba(130, 96, 51, 0.22);
  --cc-text-primary: #111827;
  --cc-text-secondary: #374151;
  --cc-text-muted: #5A6A80;
  --cc-accent-gold: #826033;
  --cc-accent-gold-hover: #694D26;
  --cc-shadow-glow: rgba(130, 96, 51, 0.12);
  --cc-active-glow: rgba(130, 96, 51, 0.24);
  --cc-line-inactive: rgba(130, 96, 51, 0.22);
  --cc-line-active: #826033;
  --cc-vignette: radial-gradient(circle, transparent 65%, rgba(130, 96, 51, 0.07) 100%);
  --cc-bezier-luxury: cubic-bezier(0.16, 1, 0.3, 1);
}

.theme-dark {
  --cc-bg-canvas: #06070A;
  --cc-bg-surface: #0D0F14;
  --cc-bg-card: rgba(13, 15, 20, 0.94);
  --cc-bg-input: #101116;
  --cc-grid-fine: rgba(197, 168, 128, 0.02);
  --cc-grid-coarse: rgba(197, 168, 128, 0.07);
  --cc-axis-color: rgba(197, 168, 128, 0.15);
  --cc-border-card: rgba(197, 168, 128, 0.16);
  --cc-border-card-hover: rgba(197, 168, 128, 0.52);
  --cc-border-input: rgba(197, 168, 128, 0.22);
  --cc-text-primary: #F3F4F6;
  --cc-text-secondary: #9CA3AF;
  --cc-text-muted: #6B7280;
  --cc-accent-gold: #C5A880;
  --cc-accent-gold-hover: #B5976F;
  --cc-shadow-glow: rgba(197, 168, 128, 0.03);
  --cc-active-glow: rgba(197, 168, 128, 0.24);
  --cc-line-inactive: rgba(197, 168, 128, 0.14);
  --cc-line-active: #C5A880;
  --cc-vignette: radial-gradient(circle, transparent 40%, rgba(3, 4, 6, 0.65) 100%);
}
```

### Radius, Shadow, And Motion Tokens

| Token | Value | Use |
|------|------|-----|
| `--cc-radius-xs` | `4px` | Tags, tiny indicators |
| `--cc-radius-sm` | `7px` | Inputs, compact buttons |
| `--cc-radius-md` | `8px` | Tool buttons, small panels |
| `--cc-radius-lg` | `12px` | Selects, compact floating controls |
| `--cc-radius-xl` | `16px` | Standard node cards |
| `--cc-radius-pill` | `9999px` | Badges, segmented controls, bottom bars |
| `--cc-shadow-card` | `0 12px 48px -10px var(--cc-shadow-glow)` | Node card elevation |
| `--cc-shadow-active` | `0 20px 50px -5px var(--cc-active-glow)` | Selected/running node |
| `--cc-shadow-pop` | `0 18px 50px rgba(0, 0, 0, 0.45)` | Modals and command panels |
| `--cc-bezier-luxury` | `cubic-bezier(0.16, 1, 0.3, 1)` | Main transitions |

---

## 4. Typography Rules

### Font Family

- **Primary UI**: `Inter`, `PingFang SC`, `Microsoft YaHei`, `system-ui`, `sans-serif`
- **Monospace**: `JetBrains Mono`, `Fira Code`, `Menlo`, `Monaco`, `Consolas`, `monospace`

Chinese UI copy must be tested in Windows rendering. Avoid ultra-small and ultra-bold Chinese text because it turns dense canvas controls into gray blocks.

### Hierarchy

| Role | Size | Weight | Line Height | Letter Spacing | Use |
|------|------|--------|-------------|----------------|-----|
| Workspace Title | 24px | 700 | 1.25 | 0 | App view title |
| Panel Title | 18px | 600 | 1.35 | 0 | Sidebar and inspector sections |
| Node Title | 16px | 600 | 1.35 | 0 | Node card title |
| Body | 14px | 400 | 1.625 | 0 | Descriptions, generated text previews |
| Control Text | 13px | 500 | 1.4 | 0 | Buttons, labels, select values |
| Caption | 12px | 400-500 | 1.4 | 0 | Metadata and counters |
| Mono Label | 11-12px | 600 | 1.3 | 0.08em-0.2em | English-only node codes and IDs |

**Rules**

- Minimum normal UI text is `12px`; use `11px` only for short English/number monospace tags.
- Do not use negative letter spacing.
- Use `leading-relaxed` or equivalent for long Chinese generated text.
- Use uppercase tracking only for English node category labels, model IDs, and compact metadata.
- Avoid pure white body text in dark mode unless it is inside a primary action button.

---

## 5. Layout Principles

### Workspace Composition

The first screen is the usable canvas. Avoid landing-page hero sections, marketing cards, or explanatory onboarding blocks unless a feature specifically requires an empty state.

Standard workspace structure:

- **Canvas viewport**: full available area, behind all node and edge layers.
- **Top floating control bar**: compact, centered or aligned to workflow controls, never a tall marketing header.
- **Node layer**: React Flow nodes with fixed minimum dimensions and stable resize behavior.
- **Edge layer**: connectors below cards but above grid.
- **Inspector / side panels**: dense, task-focused, fixed or docked on desktop.
- **Bottom agent composer**: prompt input and recent interaction drawer; should not occlude selected node controls.

### Spacing System

- Base unit: `4px`.
- Primary scale: `4, 8, 12, 16, 20, 24, 32, 48`.
- Node card padding: `20-24px` desktop, `16px` compact.
- Control gaps: `8-12px`.
- Panel section spacing: `16-24px`.
- Do not use viewport-width font scaling.

### Canvas Grid

The canvas grid is part of the brand. Use fine and coarse lines plus optional origin axes.

```css
.cc-canvas-grid {
  background-color: var(--cc-bg-canvas);
  background-image:
    linear-gradient(to right, var(--cc-axis-color) 2px, transparent 2px),
    linear-gradient(to bottom, var(--cc-axis-color) 2px, transparent 2px),
    linear-gradient(to right, var(--cc-grid-coarse) 1px, transparent 1px),
    linear-gradient(to bottom, var(--cc-grid-coarse) 1px, transparent 1px),
    linear-gradient(to right, var(--cc-grid-fine) 1px, transparent 1px),
    linear-gradient(to bottom, var(--cc-grid-fine) 1px, transparent 1px);
  background-repeat: no-repeat, no-repeat, repeat, repeat, repeat, repeat;
  background-size: 2px 100%, 100% 2px, 100px 100px, 100px 100px, 20px 20px, 20px 20px;
}
```

### Spatial Depth

| Layer | Treatment | Use |
|------|-----------|-----|
| 0 | `--cc-bg-canvas` + grid | Canvas ground |
| 1 | Low-opacity particles or vignette | Optional deep-space atmosphere, dark theme only |
| 2 | Edge paths | Graph relationships |
| 3 | Node cards | Editable creative units |
| 4 | Floating controls | Toolbars, context menus |
| 5 | Modal or command palette | Blocking flows |

If using parallax, keep it subtle: upper cards move at `1.0x`, grid at about `0.6x`, and background particles at about `0.35x`. Honor reduced motion.

---

## 6. Component Styling

### Node Cards

Node cards are the core component of the product. They must feel like precise creative instruments, not generic dashboard cards.

**Default node**

- Background: `var(--cc-bg-card)`
- Border: `1px solid var(--cc-border-card)`
- Radius: `16px`
- Shadow: `var(--cc-shadow-card)`
- Backdrop: `blur(24px) saturate(140%)` when performance allows
- Header: compact draggable area, bottom divider `rgba(255,255,255,0.08)` in dark mode or `rgba(0,0,0,0.08)` in light mode
- Width: define stable widths per node type; do not let content or buttons resize the node unpredictably

**Selected node**

- Border: `1px solid var(--cc-border-card-hover)`
- Shadow: `var(--cc-shadow-active)`
- Optional orbiting border if the node is running

**Node categories**

- Text node: semantic accent may use success/emerald for writing state, but shell remains gold.
- Image node: semantic accent may use cyan/info for image generation state.
- Video node: semantic accent may use amber/gold for cinematic output.
- Do not create a separate color theme per node type; node type color is a small label/icon signal only.

### Running Node Border

Use a self-contained SVG overlay so the animation follows card radius and does not distort layout.

```css
.cc-running-border-rect {
  transition: stroke 0.3s ease, stroke-dasharray 0.3s ease;
}

.cc-running .cc-running-border-rect {
  stroke: var(--cc-accent-gold);
  stroke-dasharray: 45 2200;
  stroke-linecap: round;
  animation: cc-run-dot-orbit 2s linear infinite;
  filter: drop-shadow(0 0 6px var(--cc-accent-gold)) drop-shadow(0 0 2px var(--cc-accent-gold));
}

@keyframes cc-run-dot-orbit {
  from { stroke-dashoffset: 0; }
  to { stroke-dashoffset: -2200; }
}
```

Pause this animation under `prefers-reduced-motion: reduce`.

### Edges And Flow Lines

- Idle connector: `var(--cc-line-inactive)`, 1.5-2px.
- Active connector: `var(--cc-line-active)`, 2px, optional glow.
- Running connector: dashed flow with `stroke-dasharray: 8 12`, `2s linear infinite`.
- Fast active pulse: `stroke-dasharray: 6 8`, `0.7s linear infinite`.
- Invalid connection feedback must appear within 200ms and use a clear Chinese reason.

### Buttons

**Primary action**

- Background: `var(--cc-accent-gold)`
- Text: dark mode should use near-black text if contrast is stronger; light mode may use white or paper depending contrast.
- Radius: `7-12px` for panel buttons, `9999px` for floating composer actions.
- Include a lucide icon when the action is tool-like or repeated.

**Secondary action**

- Background: transparent or `var(--cc-bg-input)`
- Border: `1px solid var(--cc-border-input)`
- Text: `var(--cc-text-primary)`
- Hover: border changes to `var(--cc-border-card-hover)`

**Icon button**

- Stable square size: `32px`, `36px`, or `40px`.
- Icon from lucide where available.
- Tooltip required for unfamiliar icons.

### Inputs And Selects

- Background: `var(--cc-bg-input)`
- Border: `1px solid var(--cc-border-input)`
- Text: `var(--cc-text-primary)`
- Radius: `12px`
- Padding: `10-14px`
- Focus ring: `0 0 0 1px var(--cc-accent-gold), 0 0 0 4px var(--cc-focus-ring)`
- Textareas for prompt and script copy must have relaxed line height and stable height.

### Media Frames

- Preview frame width is stable; height follows orientation.
- Supported ratios for image generation: `16:9`, `9:16`, `1:1`, `4:3`, `3:2`.
- Supported ratios for video generation: `16:9`, `9:16`, `2.39:1`, `2:1`, `4:3`.
- Media uses `object-fit: contain` unless the user explicitly chooses crop.
- Empty media states must show clear action-oriented copy, not mood text.

### Badges And Status

- Use pill badges with `12px` text.
- Running: gold dot or running border.
- Complete: success dot plus concise label.
- Failed: danger border or icon plus exact recovery direction.
- Avoid status-only color; include text or icon.

---

## 7. Motion And Interaction

Motion should explain state. Do not scatter decorative animations.

| Interaction | Motion |
|------------|--------|
| Theme switch | `0.4s var(--cc-bezier-luxury)` on background, text, border |
| Node select | border/box-shadow transition in `0.25-0.3s` |
| Panel expand | max-height + opacity + margin transition, `0.45s var(--cc-bezier-luxury)` |
| Edge running | dash flow, `2s linear infinite` |
| Active generation | orbiting node border, `2s linear infinite` |
| Button press | `scale(0.97-0.98)` for direct manipulation only |
| Toast | fade + scale, around `0.2s` in, `0.25s` out |

**Reduced motion**

- Disable orbiting borders, parallax, marquee effects, and edge dash animation.
- Preserve state through static border, icon, and text.

---

## 8. UX Writing

The UI language is Chinese-first, concise, and operational. It should sound like a professional creative tool, not a sales page.

**Rules**

- Buttons use verbs: `生成图片`, `生成视频`, `保存`, `重试`, `下载`.
- Error text says what failed and what the user can do next.
- Empty states invite the next action: `输入分镜提示词后生成首帧`.
- Keep model/provider names technical and exact.
- Do not describe UI features inside the interface unless the user needs instruction at that moment.
- Avoid exaggerated luxury wording in product controls. The visual system carries the premium feel; copy stays useful.

---

## 9. Responsive Behavior

ComicCanvas is a desktop-first Electron app, but renderer UI still must tolerate narrow windows.

| Width | Behavior |
|------|----------|
| `< 768px` | Single-column, inspector becomes bottom drawer, composer remains reachable |
| `768-1024px` | Side panels collapse; canvas and selected node stay primary |
| `1024-1280px` | Standard canvas plus one docked panel |
| `> 1280px` | Full canvas, side panel, floating composer, and auxiliary list can coexist |

Canvas nodes should retain usable minimum width. Text must not overflow buttons, badges, or node headers. Prefer wrapping and stable dimensions over shrinking to unreadable sizes.

---

## 10. Accessibility And Quality Bar

- Keyboard focus must be visible on every interactive control.
- Color contrast must meet WCAG AA for text.
- Do not communicate state with color alone.
- Hit targets should be at least `32px` for dense desktop controls and `40px` where touch is plausible.
- Tooltips are required for icon-only actions that are not universally obvious.
- No text overlap at common Electron window sizes.
- No layout shift when loading labels, badges, progress states, or thumbnails.
- Canvas animations must not make the UI unusable under CPU load.
- Respect `prefers-reduced-motion`.

---

## 11. Do And Don't

### Do

- Use `--cc-*` design tokens for all UI colors.
- Make dark theme the default canvas experience.
- Use champagne gold for selected, running, focus, and primary action states.
- Keep cards compact, readable, and tool-like.
- Use the grid as a functional spatial layer.
- Keep node type colors as small semantic accents only.
- Use lucide icons for tool buttons where available.
- Verify desktop and narrow-window screenshots for overlap before claiming UI work is complete.

### Don't

- Do not use purple/blue SaaS gradients as the dominant identity.
- Do not use green as the global brand accent for new ComicCanvas UI; this project has moved to gold-on-obsidian.
- Do not hardcode component colors, radii, shadows, or font sizes when tokens exist.
- Do not create landing-page heroes for tool screens.
- Do not put cards inside cards.
- Do not use decorative orbs, bokeh blobs, or generic AI glow backgrounds.
- Do not use text below `12px` except short monospace tags.
- Do not use pure white as body text in dark mode.
- Do not use animation without a state purpose.

---

## 12. Agent Prompt Guide

Every frontend-building agent must read this file before changing renderer UI. If a task touches canvas nodes, edges, panels, inputs, generation status, navigation, or app chrome, this file is mandatory context.

### Quick Reference

- Default canvas: `#06070A`
- Dark card: `rgba(13, 15, 20, 0.94)`
- Dark primary text: `#F3F4F6`
- Gold accent: `#C5A880`
- Fine grid: `rgba(197, 168, 128, 0.02)`
- Coarse grid: `rgba(197, 168, 128, 0.07)`
- Card radius: `16px`
- Motion curve: `cubic-bezier(0.16, 1, 0.3, 1)`
- Primary font: Inter + PingFang SC + Microsoft YaHei

### Example Implementation Prompts

- "Create a text node card using `var(--cc-bg-card)`, `1px solid var(--cc-border-card)`, `16px` radius, compact header, and a stable textarea with relaxed Chinese line height. Selected state uses `var(--cc-border-card-hover)` plus `var(--cc-shadow-active)`."
- "Create a canvas background with fine 20px grid, coarse 100px grid, optional origin axes, and theme-aware gold-tinted lines. Do not use decorative gradients or blobs."
- "Create a running generation state: active connector dash flow, node orbiting SVG border, gold status dot, and reduced-motion fallback."
- "Create image/video ratio controls as segmented buttons or select menus with labels `16:9`, `9:16`, `1:1`, `4:3`, `3:2`, `2.39:1`, and `2:1` as applicable."

### Review Checklist

- Did the change consume tokens instead of hardcoded colors?
- Does it preserve the text -> image -> video comic-drama workflow?
- Are node sizes stable when content loads or status changes?
- Are selected, running, complete, failed, and disabled states visually distinct?
- Are focus rings, tooltips, and reduced-motion fallbacks present?
- Does the screen remain usable at desktop and narrow Electron widths?
