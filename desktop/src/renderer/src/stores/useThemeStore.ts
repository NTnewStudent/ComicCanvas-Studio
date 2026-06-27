import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'

/** User-facing theme choice; `system` follows OS `prefers-color-scheme`. */
export type ThemePreference = 'light' | 'dark' | 'system'

const STORAGE_KEY = 'cc-theme'

/**
 * Reads OS dark-mode preference via `prefers-color-scheme` media query.
 * @returns `true` when the OS reports a dark colour scheme.
 */
function getSystemDark(): boolean {
  if (typeof window === 'undefined') return false
  return window.matchMedia('(prefers-color-scheme: dark)').matches
}

/**
 * Resolves a user preference to a concrete `'light' | 'dark'` value,
 * consulting the OS media query when the preference is `'system'`.
 * @param pref - The stored or in-memory preference.
 * @returns The resolved concrete theme.
 */
export function resolveTheme(pref: ThemePreference): 'light' | 'dark' {
  if (pref === 'dark') return 'dark'
  if (pref === 'light') return 'light'
  return getSystemDark() ? 'dark' : 'light'
}

/**
 * Toggles `dark` / `light` classes on `<html>` so that CSS custom-property
 * selectors and Tailwind's `dark:` variant stay in sync.
 * @param resolved - The concrete theme to apply.
 */
export function applyThemeClass(resolved: 'light' | 'dark'): void {
  const root = document.documentElement
  root.classList.toggle('dark', resolved === 'dark')
  root.classList.toggle('light', resolved === 'light')
}

interface ThemeState {
  /** The user's stored preference. */
  preference: ThemePreference
  /** The concrete theme currently active on the page. */
  resolved: 'light' | 'dark'
  /**
   * Updates the preference, immediately applies the corresponding class,
   * and persists the choice via Zustand `persist`.
   * @param p - New preference value.
   */
  setPreference: (p: ThemePreference) => void
  /**
   * Recomputes the resolved theme when the OS colour-scheme changes while
   * the preference is `'system'`. No-op for explicit `'light'` / `'dark'`.
   */
  syncFromSystem: () => void
}

/**
 * Global theme store.
 * Persisted to `localStorage` under the key `cc-theme`.
 * Only `preference` is serialised; `resolved` is recomputed on hydration.
 */
export const useThemeStore = create<ThemeState>()(
  persist(
    (set, get) => ({
      preference: 'system',
      /** Dark-first default — matches Obsidian Midnight primary theme. */
      resolved: 'dark',
      setPreference: (preference) => {
        const resolved = resolveTheme(preference)
        applyThemeClass(resolved)
        set({ preference, resolved })
      },
      syncFromSystem: () => {
        if (get().preference !== 'system') return
        const resolved = resolveTheme('system')
        applyThemeClass(resolved)
        set({ resolved })
      },
    }),
    {
      name: STORAGE_KEY,
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => ({ preference: s.preference }),
      merge: (persisted, current) => {
        const p = persisted as Partial<Pick<ThemeState, 'preference'>> | undefined
        const preference = (p?.preference ?? current.preference)
        const resolved = resolveTheme(preference)
        if (typeof document !== 'undefined') applyThemeClass(resolved)
        return { ...current, preference, resolved }
      },
    },
  ),
)
