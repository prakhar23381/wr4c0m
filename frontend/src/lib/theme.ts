import { useSyncExternalStore } from 'react'

export type Theme = 'light' | 'dark'

const STORAGE_KEY = 'theme'
const listeners = new Set<() => void>()
const systemDark = () => window.matchMedia('(prefers-color-scheme: dark)')

function storedTheme(): Theme | null {
  try {
    const value = localStorage.getItem(STORAGE_KEY)
    return value === 'light' || value === 'dark' ? value : null
  } catch {
    return null // storage blocked: fall back to the system setting
  }
}

function apply() {
  document.documentElement.dataset.theme = storedTheme() ?? (systemDark().matches ? 'dark' : 'light')
  listeners.forEach((listener) => listener())
}

/** Applies the theme and follows the system setting until the viewer picks one. */
export function initTheme() {
  apply()
  systemDark().addEventListener('change', () => storedTheme() === null && apply())
}

export function setTheme(theme: Theme) {
  try {
    localStorage.setItem(STORAGE_KEY, theme)
  } catch {
    // Not persisted, but still applied for this visit.
    document.documentElement.dataset.theme = theme
    listeners.forEach((listener) => listener())
    return
  }
  apply()
}

const subscribe = (listener: () => void) => {
  listeners.add(listener)
  return () => listeners.delete(listener)
}
const current = (): Theme => (document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light')

export const useTheme = () => useSyncExternalStore(subscribe, current)
