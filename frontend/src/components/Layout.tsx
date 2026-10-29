import { NavLink, Outlet, useSearchParams } from 'react-router'

import { useMeta } from '../api/hooks'
import { formatDate } from '../lib/time'

const PAGES = [
  { to: '/', label: 'Decision view', short: 'Decision' },
  { to: '/accuracy', label: 'Forecast accuracy', short: 'Accuracy' },
  { to: '/methodology', label: 'Methodology', short: 'Method' },
]

export function Layout() {
  const [params] = useSearchParams()
  const meta = useMeta()
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
        <div className="mx-auto max-w-[1080px] space-y-1.5 px-4 py-6 text-[12px] leading-[1.33] text-ink-2 sm:px-6">
          <p>
            Data: Elexon BMRS, FUELHH (wind outturn) and WINDFOR (wind forecast)
            {meta.data &&
              `, for purchase decisions from ${formatDate(meta.data.decision_first_day)} to ${formatDate(meta.data.decision_last_day)}`}
            .
          </p>
          <p>All times are UK time. Forecast errors are actual minus forecast; negative means less wind than forecast.</p>
        </div>
      </footer>
    </div>
  )
}
