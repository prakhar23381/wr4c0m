import { NavLink, Outlet, useSearchParams } from 'react-router'

import { setTheme, useTheme } from '../lib/theme'


const PAGES = [
  { to: '/', label: 'Decision view', short: 'Decision' },
  { to: '/accuracy', label: 'Forecast accuracy', short: 'Accuracy' },
  { to: '/methodology', label: 'Methodology', short: 'Method' },
]

function ThemeToggle() {
  const theme = useTheme()
  const next = theme === 'dark' ? 'light' : 'dark'
  return (
    <button
      type="button"
      onClick={() => setTheme(next)}
      aria-label={`Switch to ${next} mode`}
      title={`Switch to ${next} mode`}
      className="inline-flex size-9 shrink-0 items-center justify-center rounded-full bg-wash text-ink transition hover:brightness-95 active:scale-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
    >
      <svg viewBox="0 0 20 20" aria-hidden className="size-[18px]" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
        {theme === 'dark' ? (
          // Sun: switch to light.
          <>
            <circle cx="10" cy="10" r="3.6" />
            <path d="M10 1.8v1.9M10 16.3v1.9M1.8 10h1.9M16.3 10h1.9M4.2 4.2l1.35 1.35M14.45 14.45l1.35 1.35M4.2 15.8l1.35-1.35M14.45 5.55l1.35-1.35" />
          </>
        ) : (
          // Moon: switch to dark.
          <path d="M16.5 12.3A7 7 0 0 1 7.7 3.5a7 7 0 1 0 8.8 8.8Z" />
        )}
      </svg>
    </button>
  )
}

export function Layout() {
  const [params] = useSearchParams()
  // Keep the chosen decision time when moving between pages.
  const cutoff = params.get('cutoff')
  const search = cutoff ? `?cutoff=${encodeURIComponent(cutoff)}` : ''

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="sticky top-0 z-40 border-b border-line bg-globalnav text-ink backdrop-blur-xl backdrop-saturate-150">
        <div className="mx-auto flex h-16 max-w-[1080px] items-center justify-between gap-3 px-4 sm:px-6">
          <NavLink to={`/${search}`} className="text-eyebrow flex shrink-0 items-center gap-2.5 text-ink">
            <img src="/favicon.svg" alt="" className="size-7" />
            <span className="hidden md:inline">Wind Forecast Monitor</span>
          </NavLink>
          <div className="flex items-center gap-2 sm:gap-3">
            <nav aria-label="Main" className="flex gap-0.5 sm:gap-1">
              {PAGES.map((page) => (
                <NavLink
                  key={page.to}
                  to={`${page.to}${search}`}
                  end
                  className={({ isActive }) =>
                    `rounded-full px-3 py-2 text-[15px] leading-none font-medium tracking-[-0.016em] whitespace-nowrap transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent sm:px-4 ${
                      isActive ? 'bg-wash text-ink' : 'text-ink-2 hover:text-ink'
                    }`
                  }
                >
                  <span className="lg:hidden">{page.short}</span>
                  <span className="hidden lg:inline">{page.label}</span>
                </NavLink>
              ))}
            </nav>
            <ThemeToggle />
          </div>
        </div>
      </header>

      <main className="flex-1">
        <Outlet />
      </main>

      <footer className="chapter-light border-t border-line">
        <p className="mx-auto max-w-[1080px] px-4 py-5 text-[12px] leading-[1.33] text-ink-2 sm:px-6">
          Elexon BMRS · FUELHH &amp; WINDFOR · Decisions in January 2026 · UK time
        </p>
      </footer>
    </div>
  )
}
