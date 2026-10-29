import '@testing-library/jest-dom/vitest'

// jsdom has no matchMedia; tests run in light mode.
window.matchMedia ??= (query: string) =>
  ({
    matches: false,
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
  }) as unknown as MediaQueryList
