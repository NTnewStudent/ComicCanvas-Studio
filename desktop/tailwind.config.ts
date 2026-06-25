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
        'canvas-surface': withAlpha('--cc-canvas-surface'),
        bg: {
          base: withAlpha('--cc-bg-canvas'),
          surface: withAlpha('--cc-bg-surface'),
          card: withAlpha('--cc-bg-card'),
          input: withAlpha('--cc-bg-input'),
          hover: withAlpha('--cc-bg-hover'),
          panel: withAlpha('--cc-bg-panel'),
          mid: withAlpha('--cc-bg-mid'),
          highlight: withAlpha('--cc-bg-highlight'),
          'action-btn': withAlpha('--cc-bg-action-btn'),
          'card-active': withAlpha('--cc-bg-card-active'),
          elevated: withAlpha('--cc-bg-elevated'),
          topbar: withAlpha('--cc-bg-topbar'),
          rail: withAlpha('--cc-bg-rail'),
          'success-subtle': withAlpha('--cc-accent-subtle')
        },
        brand: {
          DEFAULT: withAlpha('--cc-accent'),
          hover: withAlpha('--cc-accent-hover'),
          pressed: withAlpha('--cc-accent-pressed'),
          cta: withAlpha('--cc-accent')
        },
        text: {
          base: withAlpha('--cc-text-primary'),
          secondary: withAlpha('--cc-text-secondary'),
          muted: withAlpha('--cc-text-muted'),
          silver: withAlpha('--cc-text-silver'),
          white: '#ffffff'
        },
        border: {
          primary: withAlpha('--cc-border-primary'),
          secondary: withAlpha('--cc-border-secondary'),
          subtle: withAlpha('--cc-border-subtle'),
          standard: withAlpha('--cc-border-standard'),
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
        mono: ['Berkeley Mono', 'SF Mono', 'ui-monospace', 'Menlo', 'monospace']
      },
      borderRadius: {
        sm: 'var(--cc-radius-sm)',
        md: 'var(--cc-radius-md)',
        lg: 'var(--cc-radius-lg)',
        xl: 'var(--cc-radius-xl)',
        '2xl': 'var(--cc-radius-2xl)',
        '3xl': 'var(--cc-radius-3xl)',
        pill: 'var(--cc-radius-pill)'
      },
      boxShadow: {
        float: 'var(--cc-shadow-float)',
        pop: 'var(--cc-shadow-pop)',
        /* Backward-compat — map legacy names to new wf-neo tokens */
        card: 'var(--cc-shadow-float)',
        active: 'var(--cc-shadow-pop)'
      },
      transitionTimingFunction: {
        luxury: 'var(--cc-ease-luxury)'
      }
    }
  },
  plugins: []
} satisfies Config
