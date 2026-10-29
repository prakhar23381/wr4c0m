import { NavLink, Outlet, useSearchParams } from 'react-router'


const PAGES = [
  { to: '/', label: 'Decision view', short: 'Decision' },
  { to: '/accuracy', label: 'Forecast accuracy', short: 'Accuracy' },
  { to: '/methodology', label: 'Methodology', short: 'Method' },
]

export function Layout() {
  const [params] = useSearchParams()
  // Keep the chosen decision time when moving between pages.
  const cutoff = params.get('cutoff')
  const search = cutoff ? `?cutoff=${encodeURIComponent(cutoff)}` : ''

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="sticky top-0 z-40 bg-[rgba(22,22,23,0.82)] text-[#f5f5f7] backdrop-blur-xl backdrop-saturate-150">
        <div className="mx-auto flex h-12 max-w-[1080px] items-center justify-between gap-4 px-4 sm:px-6">
          <NavLink to={`/${search}`} className="flex items-center gap-2 text-[14px] font-semibold tracking-[-0.016em]">
            <img src="/favicon.svg" alt="" className="size-5" />
            <span className="hidden min-[420px]:inline">Wind Forecast Monitor</span>
          </NavLink>
          <nav aria-label="Main" className="flex gap-5 sm:gap-7">
            {PAGES.map((page) => (
              <NavLink
                key={page.to}
                to={`${page.to}${search}`}
                end
                className={({ isActive }) =>
                  `text-[13px] tracking-[-0.01em] whitespace-nowrap transition-colors focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent ${
                    isActive ? 'text-white' : 'text-[#f5f5f7]/70 hover:text-white'
                  }`
                }
              >
                <span className="sm:hidden">{page.short}</span>
                <span className="hidden sm:inline">{page.label}</span>
              </NavLink>
            ))}
          </nav>
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
