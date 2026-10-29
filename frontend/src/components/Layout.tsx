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
      <header className="border-b border-line bg-surface">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-x-6 gap-y-2 px-4 py-3">
          <NavLink to={`/${search}`} className="flex items-center gap-2 font-semibold text-ink">
            <img src="/favicon.svg" alt="" className="size-6" />
            Wind Forecast Monitor
            <span className="hidden text-sm font-normal text-muted sm:inline">GB day-ahead</span>
          </NavLink>
          <nav aria-label="Main" className="-mx-1 flex gap-1 overflow-x-auto">
            {PAGES.map((page) => (
              <NavLink
                key={page.to}
                to={`${page.to}${search}`}
                end
                className={({ isActive }) =>
                  `rounded-lg px-3 py-1.5 text-sm font-medium whitespace-nowrap focus-visible:outline-2 focus-visible:outline-forecast ${
                    isActive ? 'bg-wash text-ink' : 'text-ink-2 hover:bg-wash hover:text-ink'
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

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6">
        <Outlet />
      </main>

      <footer className="border-t border-line text-xs text-muted">
        <div className="mx-auto flex max-w-6xl flex-wrap justify-between gap-2 px-4 py-4">
          <span>
            Data: Elexon BMRS — FUELHH (wind outturn) and WINDFOR (wind forecast)
            {meta.data &&
              `, purchase decisions ${formatDate(meta.data.decision_first_day)} to ${formatDate(meta.data.decision_last_day)}`}
            .
          </span>
          <span>All times are UK time.</span>
        </div>
      </footer>
    </div>
  )
}
