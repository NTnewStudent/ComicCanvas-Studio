import { useEffect } from 'react'
import { applyThemeClass, resolveTheme, useThemeStore } from '../stores/useThemeStore'

/**
 * Keeps `<html>` classes in sync with the persisted preference, Zustand
 * hydration lifecycle, and OS `prefers-color-scheme` changes.
 *
 * Render nothing — this is a side-effect-only component.
 * Mount once at the application root (inside `QueryClientProvider`).
 */
export function ThemeSync(): null {
  const preference = useThemeStore((s) => s.preference)
  const syncFromSystem = useThemeStore((s) => s.syncFromSystem)

  // Apply immediately on mount and whenever the preference changes.
  useEffect(() => {
    const resolved = resolveTheme(preference)
    applyThemeClass(resolved)
    useThemeStore.setState({ resolved })
  }, [preference])

  // Listen for OS colour-scheme changes and delegate to the store.
  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const onChange = (): void => syncFromSystem()
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [syncFromSystem])

  // Re-apply after Zustand `persist` finishes hydration from localStorage.
  useEffect(() => {
    return useThemeStore.persist.onFinishHydration(() => {
      const pref = useThemeStore.getState().preference
      const resolved = resolveTheme(pref)
      applyThemeClass(resolved)
      useThemeStore.setState({ resolved })
    })
  }, [])

  return null
}
