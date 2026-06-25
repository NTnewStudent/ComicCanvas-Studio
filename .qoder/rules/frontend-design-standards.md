---
description: "Frontend UI 开发必须遵循 DESIGN.md wf-neo 设计规范，使用 Tailwind token class，禁止硬编码颜色"
globs: "desktop/src/renderer/**/*.tsx,desktop/src/renderer/**/*.ts,desktop/src/renderer/**/*.css"
---

# 前端设计规范（DESIGN.md 强制约束）

## 唯一设计真源

所有前端 UI 实现必须以 `global/design/DESIGN.md` 为唯一设计规范。暗色主题为 `wf-neo` 霓虹青（`#46d9e6`），亮色主题为柔光玻璃白。

## 强制规则

### 1. 只使用 Tailwind CSS Token Class

- 所有颜色必须通过 Tailwind token class 引用（`bg-bg-panel`、`text-brand`、`border-border-primary` 等）
- 禁止硬编码十六进制色值（如 `#46d9e6`、`bg-[#0d161e]`）
- 禁止内联 `style= backgroundColor: ... `
- 如需新色值，先在 `global/design/DESIGN.md` 和 `styles.css` 注册 token

### 2. Portal 弹出层必须继承主题

所有通过 `createPortal` 渲染到 `document.body` 的组件（Modal、Popover、Dropdown 等），外层容器必须添加 `dark wf-neo` class：

```tsx
<div className="dark wf-neo">
  {/* portal 内容 */}
</div>
```

### 3. 禁止的反模式

- ❌ `bg-white dark:bg-bg-panel` — 直接用 `bg-bg-panel`
- ❌ `border-border-secondary dark:border-border-primary` — 直接用 `border-border-primary`
- ❌ `text-[#06070a]` — 使用语义 token
- ❌ 在 `bg-brand` 子元素写 `text-white` — 在 `.wf-mono` 作用域中文字会自动反色

### 4. 组件样式规范

- **Chip**：pill 圆角（`rounded-full`），默认 `bg-bg-input`，激活态 `bg-success-subtle text-brand`
- **PopoverMenu**：`rounded-xl`，`bg-bg-panel`，shadow `0_15px_45px_rgba(0,0,0,0.18)`
- **节点卡片**：`rounded-[20px]`，`bg-canvas-surface`，夜间 drop-shadow 青色发光
- **Toolbar**：`rounded-[24px]`，`bg-bg-panel`，宽度 960px
- **主按钮**：使用 `cc-btn-primary` class（wf-neo 青辉玻璃）
- **Handle**：使用 `cc-handle` class（16px，品牌色，hover scale+光晕）

### 5. 动效

- 使用 `ease-luxury`（`cubic-bezier(0.16, 1, 0.3, 1)`）
- 主题切换 0.4s，节点选中 0.25-0.3s
- 画布动画：`cc-generating-ring`（呼吸）、`cc-failed-shake`（抖动）、`cc-media-reveal`（溶解）

### 6. 圆角体系

| Token | 值 | 用途 |
|-------|-----|------|
| `rounded-sm` | 4px | 极小元素 |
| `rounded-md` | 7px | 按钮、输入框 |
| `rounded-lg` | 8px | 小卡片 |
| `rounded-xl` | 12px | PopoverMenu 弹出层 |
| `rounded-2xl` | 16px | 节点卡片外层 |
| `rounded-[24px]` | 24px | 底部工具栏 Toolbar |
| `rounded-full` | pill | Chip 按钮、Tag |

### 7. 最小字号

禁止使用 10px / 11px 字号，最小 12px。

## 设计预览

参考 `global/design/preview-design.html` 查看双主题完整色板和组件示例。
