import type { Config } from 'tailwindcss'

/**
 * Wraps a CSS token so Tailwind opacity modifiers work with runtime theme values.
 * @param variable - CSS variable name including the leading `--`.
 * @returns Tailwind-compatible color value.
 */
const withAlpha = (variable: string) =>
  (({ opacityValue }: { opacityValue?: string }) =>
    opacityValue == null
      ? `var(${variable})`
      : `color-mix(in srgb, var(${variable}) calc(${opacityValue} * 100%), transparent)`) as unknown as string

export default {
  darkMode: 'class',
  content: ['./src/renderer/index.html', './src/renderer/src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        'canvas-surface': 'var(--cc-bg-canvas)',
        bg: {
          base: withAlpha('--cc-bg-canvas'),
          surface: withAlpha('--cc-bg-surface'),
          card: withAlpha('--cc-bg-card'),
          input: withAlpha('--cc-bg-input'),
          hover: withAlpha('--cc-bg-hover'),
          panel: withAlpha('--cc-bg-surface'),
          'action-btn': withAlpha('--cc-bg-input')
        },
        brand: {
          DEFAULT: withAlpha('--cc-accent-gold'),
          hover: withAlpha('--cc-accent-gold-hover'),
          cta: withAlpha('--cc-accent-gold')
        },
        text: {
          base: withAlpha('--cc-text-primary'),
          secondary: withAlpha('--cc-text-secondary'),
          muted: withAlpha('--cc-text-muted'),
          white: '#ffffff'
        },
        border: {
          primary: withAlpha('--cc-border-card-hover'),
          secondary: withAlpha('--cc-border-card'),
          input: withAlpha('--cc-border-input')
        },
        semantic: {
          negative: withAlpha('--cc-danger'),
          warning: withAlpha('--cc-warning'),
          info: withAlpha('--cc-info'),
          success: withAlpha('--cc-success')
        }
      },
      fontFamily: {
        sans: ['Inter', 'PingFang SC', 'Microsoft YaHei', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'Menlo', 'Monaco', 'Consolas', 'monospace']
      },
      borderRadius: {
        sm: 'var(--cc-radius-sm)',
        md: 'var(--cc-radius-md)',
        lg: 'var(--cc-radius-lg)',
        xl: 'var(--cc-radius-xl)',
        pill: 'var(--cc-radius-pill)'
      },
      boxShadow: {
        card: 'var(--cc-shadow-card)',
        active: 'var(--cc-shadow-active)',
        pop: 'var(--cc-shadow-pop)'
      },
      transitionTimingFunction: {
        luxury: 'var(--cc-bezier-luxury)'
      }
    }
  },
  plugins: []
} satisfies Config
