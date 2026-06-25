# DESIGN_SELF.md — 工作流画布 UI 设计规范

> 本文档从 `src/styles/design-tokens.css`、`src/modules/workflow-canvas/styles.css`、`tailwind.config.ts` 中抽象而来。
> 所有改动必须以此文档为准，禁止硬编码颜色值或随意新增 token。

---

## 一、主题架构概览

画布页面采用**双层主题叠加**机制：

```
全局基础层          → design-tokens.css (:root / html.light)
  └── 工作流画布层  → workflow-canvas/styles.css (html.dark .wf-neo / html.light)
```

| 主题 | 根 class 条件 | 视觉风格 |
|:---|:---|:---|
| **夜间（默认）** | `html.dark .wf-neo` | 深蓝黑 + 霓虹青描边，科技感深空 |
| **日间** | `html.light` | 浅灰底 + 纯白节点卡片，柔光玻璃 |

> ⚠️ 画布页根节点挂 `wf-mono wf-neo` 两个 class。
> 使用 `createPortal` 渲染到 `document.body` 的弹窗必须手动加 `dark wf-neo` 才能继承 token。

---

## 二、夜间模式（wf-neo）完整色板

### 2.1 背景层级（由深到浅）

| Token | Tailwind class | 值 | 用途 |
|:---|:---|:---|:---|
| `--color-bg-base` | `bg-bg-base` | `#06090e` | 画布最底层（React Flow 背景） |
| `--color-bg-topbar` | `bg-bg-topbar` | `#080d13` | 顶部导航栏 |
| `--color-bg-rail` | `bg-bg-rail` | `#0a1016` | 左侧工具轨道 |
| `--color-bg-input` | `bg-bg-input` | `#070f17` | 输入框、最深凹陷区域 |
| `--color-bg-mid` | `bg-bg-mid` | `#0a141b` | 中间层面 |
| `--color-bg-surface` | `bg-bg-surface` | `#0a1118` | 通用 surface |
| `--color-bg-card` | `bg-bg-card` | `#0c141c` | 卡片默认 |
| `--color-bg-panel` | `bg-bg-panel` | `#0d161e` | 面板、弹出层（**Portal 首选**） |
| `--color-bg-elevated` | `bg-bg-elevated` | `#101b24` | 浮起面板 |
| `--color-bg-hover` | `bg-bg-hover` | `#102029` | hover 态 |
| `--color-bg-card-active` | `bg-bg-card-active` | `#13242e` | 卡片选中/激活 |
| `--color-bg-highlight` | `bg-bg-highlight` | `#14242e` | 高亮 |
| `--color-bg-action-btn` | `bg-bg-action-btn` | `#16262f` | 普通操作按钮 |
| `--color-canvas-surface` | `bg-canvas-surface` | `#1a1a1a`* | 节点主卡片/工具栏面板 |

> *`canvas-surface` 在 wf-neo 作用域内由于 CSS 变量继承，保持全局 dark 的 `#1a1a1a`，而其他 bg-* token 被 wf-neo 全部覆盖为蓝黑系。节点外层卡片用 `bg-canvas-surface`，弹出层/抽屉用 `bg-bg-panel`。

### 2.2 强调色（霓虹青）

| Token | Tailwind class | 值 | 用途 |
|:---|:---|:---|:---|
| `--color-brand` | `text-brand / border-brand / bg-brand` | `#46d9e6` | 主强调色（霓虹青） |
| `--color-brand-hover` | — | `#74e7f1` | 悬浮态 |
| `--color-brand-pressed` | — | `#2db6c4` | 按下态 |
| `--color-bg-brand-subtle` | `bg-success-subtle` | `rgba(70,217,230,0.12)` | 选中行背景、品牌色淡底 |
| `--color-success-subtle-border` | — | `rgba(70,217,230,0.40)` | 选中行边框 |

### 2.3 描边（青色氛围光）

| Token | Tailwind class | 值 |
|:---|:---|:---|
| `--color-border-subtle` | `border-border-subtle` | `rgba(70,217,230, 0.10)` |
| `--color-border-standard` | `border-border-standard` | `rgba(70,217,230, 0.18)` |
| `--color-border-primary` | `border-border-primary` | `rgba(70,217,230, 0.26)` |
| `--color-border-secondary` | `border-border-secondary` | `rgba(70,217,230, 0.38)` |
| `--color-input-border` | — | `rgba(70,217,230, 0.24)` |

### 2.4 文字（冷青调）

| Token | Tailwind class | 值 |
|:---|:---|:---|
| `--color-text-base` | `text-text-base` | `#e8f6f8`（主文字，带轻微青调）|
| `--color-text-secondary` | `text-text-secondary` | `#9cbec6` |
| `--color-text-muted` | `text-text-muted` | `#6d8d96` |
| `--color-text-silver` | `text-text-silver` | `#c5dde2` |

### 2.5 投影

```css
--shadow-float: 0 10px 35px rgba(0, 0, 0, 0.55);  /* 浮层 */
--shadow-pop:   0 18px 50px rgba(0, 0, 0, 0.65);  /* 弹窗 */
```

---

## 三、日间模式完整色板

### 3.1 背景层级

| Token | 值 | 用途 |
|:---|:---|:---|
| `--color-bg-base` | `#ebebeb` | 画布背景 |
| `--color-bg-topbar` | `#ffffff` | 顶部导航栏 |
| `--color-bg-rail` | `#f0f0f0` | 左侧轨道 |
| `--color-bg-panel` | `#f8f8f8` | 面板 |
| `--color-canvas-surface` | `rgba(252,251,249,0.82)` | 节点/工具栏，暖米白半透明（配合毛玻璃） |
| `--color-bg-card` | `#ffffff` | 卡片 |
| `--color-bg-hover` | `#f2f2f2` | hover |
| `--color-bg-input` | `#f5f5f5` | 输入框 |

### 3.2 强调色（墨黑 · wf-mono 重映射 brand = text-base）

| Token | 值 | 说明 |
|:---|:---|:---|
| `--color-brand`（wf-mono 后） | `#1a1d21` | 等于 text-base，墨黑 |
| hover | `#2e3440` | 稍浅墨黑 |
| pressed | `#0d0f12` | 更深墨黑 |
| subtle bg | `rgba(26,29,33,0.10)` | 选中态淡底 |

> `wf-btn-primary` 在日间实际渲染为：`background: #1a1d21`，`color: #ebebeb`（浅灰字）

### 3.3 描边

| Token | 值 |
|:---|:---|
| `--color-border-primary` | `#d4d4d4` |
| `--color-border-secondary` | `#dedede` |

### 3.4 文字

| Token | 值 |
|:---|:---|
| `--color-text-base` | `#1a1d21` |
| `--color-text-secondary` | `#4a4f57` |
| `--color-text-muted` | `#777d87` |

### 3.5 投影

```css
--shadow-float: 0 10px 35px rgba(17, 24, 39, 0.06);
--shadow-pop:   0 18px 50px rgba(17, 24, 39, 0.14);
```

---

## 四、圆角（Border Radius）

| Token | 值 | 用途 |
|:---|:---|:---|
| `--radius-sm` | `4px` | 极小元素 |
| `--radius-md` | `7px` | 按钮、输入框 |
| `--radius-lg` | `8px` | 小卡片 |
| `--radius-xl` | `12px` | **弹出选择框、PopoverMenu** |
| `--radius-2xl` | `16px` | 节点卡片外层、大面板 |
| `--radius-3xl` | `24px` | 工具栏卡片（底部 Toolbar） |
| `--radius-pill` | `9999px` | Chip 按钮、Tag |

---

## 五、排版规范

```
字族：Inter / PingFang SC / Microsoft YaHei（--font-sans）
代码：Berkeley Mono / SF Mono（--font-mono）

节点内提示词输入框：  14px / line-height 1.7
节点控制行 Chip：     12px / font-semibold
弹出层标题：          13px / font-bold
弹出层选项：          12~13px
说明文字/描述：        11~12px
```

---

## 六、核心组件样式规范

### 6.1 Chip（芯片选择按钮）

```tsx
// 默认态
'nodrag flex h-8 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border px-3 text-[12px] font-semibold transition-all'
'border-border-secondary/50 bg-bg-input text-text-secondary hover:bg-bg-hover hover:text-text-base'

// 激活态（active）
'border-brand/30 bg-success-subtle text-brand'
```

### 6.2 PopoverMenu 弹出面板

```tsx
// ✅ 正确：portal 组件必须加 dark wf-neo 继承画布 token
<div className="dark wf-neo rounded-xl border border-border-primary bg-bg-panel shadow-[0_15px_45px_rgba(0,0,0,0.18)]">

// ❌ 错误：不加 wf-neo 导致弹出层无法获取画布主题色
<div className="rounded-xl border bg-white dark:bg-bg-panel">
```

### 6.3 节点主容器

```tsx
// 预览卡区域
'group relative w-[360px] rounded-[20px] border bg-canvas-surface shadow-card'

// 底部工具栏
'nodrag nowheel relative w-[960px] overflow-visible rounded-[24px] border border-border-secondary bg-canvas-surface shadow-card dark:border-border-primary dark:bg-bg-panel'
```

### 6.4 菜单项（menuItemBase）

```tsx
'flex w-full items-center justify-between border-none bg-transparent px-3 py-2 text-[12px] text-text-secondary transition-colors hover:bg-bg-hover hover:text-text-base'
```

### 6.5 风格选项卡（StylePresetOption）

```tsx
// 容器
'group flex w-full items-center gap-3 rounded-lg border px-2.5 py-2 text-left transition-colors'
'border-transparent bg-transparent hover:border-border-secondary hover:bg-bg-hover'
// 选中态
'border-brand/40 bg-success-subtle/60'
```

### 6.6 wf-btn-primary（主按钮）

```css
/* 通用（单色 wf-mono 作用域）*/
background: color-mix(in srgb, var(--color-text-base) 90%, transparent);
color: var(--color-bg-base);

/* wf-neo 夜间：青辉玻璃 */
background: color-mix(in srgb, var(--color-brand) 22%, #0a141c);
color: var(--color-text-base);
box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--color-brand) 45%, transparent);
```

---

## 七、节点 Handle（连接点）

```css
尺寸：16×16px，rounded-full
默认边框：2.5px
hover：scale(1.6) + 墨黑色光晕（日间）/ 青色光晕（夜间）

/* 夜间（wf-neo）*/
bg: #46d9e6; border: #0d161e
hover box-shadow: 0 0 0 4px rgba(70,217,230,0.22), 0 0 0 9px rgba(70,217,230,0.08)

/* 日间（wf-mono 墨黑）*/
bg: #1a1d21; border: #ffffff
hover box-shadow: 0 0 0 4px rgba(26,29,33,0.22), 0 0 0 9px rgba(26,29,33,0.08)

脉冲动画（连线中）：wf-handle-pulse-neo，0→9px 扩散青色光晕
```

---

## 八、节点视觉特效（wf-neo 夜间）

```css
/* 默认 */
filter: drop-shadow(0 0 14px rgba(70,217,230,0.10)) drop-shadow(0 14px 30px rgba(0,0,0,0.45))

/* hover */
filter: drop-shadow(0 0 18px rgba(70,217,230,0.22)) drop-shadow(0 14px 30px rgba(0,0,0,0.50))

/* 选中 */
filter: drop-shadow(0 0 22px rgba(70,217,230,0.32)) drop-shadow(0 14px 30px rgba(0,0,0,0.50))
```

---

## 九、日间模式节点特效

```css
/* 未选中：光亮玻璃边缘 */
border-color: #ffffff !important;
box-shadow: inset 0 1px 0 rgba(255,255,255,0.95),
            inset 0 0 0 1px rgba(255,255,255,0.70),
            0 0 0 1px rgba(255,255,255,0.55),
            0 8px 26px rgba(17,24,39,0.09),
            0 2px 6px rgba(17,24,39,0.05);

/* 选中：品牌绿多层光晕 */
border-color: #07af49 !important;
box-shadow: inset 0 1px 0 rgba(255,255,255,0.9),
            0 0 0 2px #07af49,
            0 0 0 6px rgba(7,175,73,0.18),
            0 10px 32px rgba(7,175,73,0.16),
            0 4px 12px rgba(17,24,39,0.10) !important;
```

---

## 十、连线（Edge）样式

| 状态 | 夜间（wf-neo） | 日间 |
|:---|:---|:---|
| 默认 | `rgba(70,217,230, 40%)` 半透明 | `rgba(text-base, 32%)` |
| 选中/悬浮 | `#46d9e6` 全亮 | `var(--color-text-base)` |
| 线宽 | 2px（选中 2.5px） | 2px（选中 2.5px） |

---

## 十一、毛玻璃（wf-glass）

```css
/* 夜间通用 */
background: color-mix(in srgb, var(--color-bg-card) 88%, transparent);
backdrop-filter: blur(14px) saturate(1.1);

/* 日间：不透明实色 */
background: #ffffff;
box-shadow: 0 8px 28px rgba(17,24,39,0.08), 0 1px 3px rgba(17,24,39,0.05);
backdrop-filter: none;
```

---

## 十二、滚动条

```css
/* 粗滚动条（wf-scroll） */
width: 8px;
thumb: color-mix(in srgb, var(--color-text-base) 16%, transparent)

/* 细滚动条（wf-style-scroll，风格面板内） */
width: 4px;
thumb: color-mix(in srgb, var(--color-text-base) 14%, transparent)
thumb:hover: color-mix(in srgb, var(--color-brand) 42%, transparent)
```

---

## 十三、强制规范（禁止事项）

| ❌ 禁止 | ✅ 正确 |
|:---|:---|
| 硬编码 `background: #1a1a1a` | 使用 `bg-bg-panel` / `bg-canvas-surface` |
| `bg-white dark:bg-bg-panel` | `bg-bg-panel`（直接用 token） |
| Portal 组件不加主题 class | `<div className="dark wf-neo ...">` |
| `border-border-secondary dark:border-border-primary` | `border-border-primary`（直接用 token） |
| 在 `bg-brand` 子元素写 `text-white` | 在 `.wf-mono` 作用域中文字会自动反色 |

---

## 十四、常用 Tailwind class 速查

```
# 夜间背景（由深到浅）
bg-bg-input       → #070f17  最深凹陷（输入框）
bg-bg-panel       → #0d161e  面板/弹出层
bg-canvas-surface → #1a1a1a  节点卡片主面（继承全局 dark token）

# 描边
border-border-primary   → rgba(70,217,230, 0.26)
border-border-secondary → rgba(70,217,230, 0.38)

# 文字
text-text-base      → #e8f6f8
text-text-secondary → #9cbec6
text-text-muted     → #6d8d96

# 强调
text-brand        → #46d9e6
bg-success-subtle → rgba(70,217,230, 0.12)

# 圆角（组件对应）
rounded-full  → Chip 按钮
rounded-xl    → PopoverMenu 弹出层（12px）
rounded-2xl   → 节点卡片（16px）
rounded-[24px]→ 底部工具栏 Toolbar（24px）
```
