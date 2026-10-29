import { type CSSProperties, useId, type ReactNode } from 'react'

import { ApiError } from '../api/client'
import type { LegendItem } from '../lib/chartTheme'

export function Card({
  title,
  subtitle,
  actions,
  children,
  className = '',
}: {
  title?: ReactNode
  subtitle?: ReactNode
  actions?: ReactNode
  children: ReactNode
  className?: string
}) {
  return (
    <section className={`relative rounded-xl border border-line bg-surface p-4 sm:p-5 ${className}`}>
      {(title || actions) && (
        <header className="mb-3 flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
          <div className="min-w-0">
            {title && <h2 className="text-base font-semibold text-ink">{title}</h2>}
            {subtitle && <p className="mt-0.5 text-sm text-ink-2">{subtitle}</p>}
          </div>
          {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
        </header>
      )}
      {children}
    </section>
  )
}

/** "i" button whose explanation shows on hover or keyboard focus. Needs a `relative` ancestor
 *  (e.g. a Card or StatTile): the bubble spans that ancestor so it never runs off-screen. */
export function InfoTip({ text }: { text: string }) {
  const id = useId()
  return (
    <span className="group inline-flex align-middle">
      <button
        type="button"
        aria-describedby={id}
        aria-label="Explain"
        className="ml-1.5 inline-flex size-4 cursor-help items-center justify-center rounded-full border border-line text-[10px] leading-none font-semibold text-muted hover:text-ink focus-visible:text-ink focus-visible:outline-2 focus-visible:outline-forecast"
      >
        i
      </button>
      <span
        role="tooltip"
        id={id}
        className="pointer-events-none invisible absolute inset-x-2 top-9 z-30 rounded-lg border border-line bg-surface p-3 text-xs leading-relaxed font-normal text-ink-2 opacity-0 shadow-lg transition-opacity group-focus-within:visible group-focus-within:opacity-100 group-hover:visible group-hover:opacity-100"
      >
        {text}
      </span>
    </span>
  )
}

export function StatTile({
  label,
  value,
  detail,
  info,
}: {
  label: string
  value: ReactNode
  detail?: ReactNode
  info?: string
}) {
  return (
    <div className="relative rounded-xl border border-line bg-surface px-4 py-3">
      <div className="flex items-center text-sm text-ink-2">
        {label}
        {info && <InfoTip text={info} />}
      </div>
      <div className="mt-1 text-2xl font-semibold text-ink">{value}</div>
      {detail && <div className="mt-0.5 text-xs text-ink-2">{detail}</div>}
    </div>
  )
}

export function Skeleton({ className = '' }: { className?: string }) {
  return <div aria-hidden className={`animate-pulse rounded-xl bg-wash ${className}`} />
}

export function Loading({ label = 'Loading…', className = 'h-80' }: { label?: string; className?: string }) {
  return (
    <div role="status" aria-label={label}>
      <Skeleton className={className} />
    </div>
  )
}

export function ErrorState({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  const message =
    error instanceof ApiError
      ? error.message
      : 'Could not reach the server. Check your connection and try again.'
  return (
    <div role="alert" className="rounded-xl border border-line bg-surface p-5 text-sm">
      <p className="font-semibold text-ink">Something went wrong loading this data.</p>
      <p className="mt-1 text-ink-2">{message}</p>
      {onRetry && (
        <button type="button" onClick={onRetry} className={`mt-3 ${buttonClass}`}>
          Try again
        </button>
      )}
    </div>
  )
}

export const buttonClass =
  'inline-flex items-center gap-1.5 rounded-lg border border-line bg-surface px-3 py-1.5 text-sm font-medium text-ink hover:bg-wash focus-visible:outline-2 focus-visible:outline-forecast disabled:cursor-not-allowed disabled:opacity-40'

export const inputClass =
  'rounded-lg border border-line bg-surface px-2.5 py-1.5 text-sm text-ink focus-visible:outline-2 focus-visible:outline-forecast'

export function Toggle({
  checked,
  onChange,
  children,
}: {
  checked: boolean
  onChange: (checked: boolean) => void
  children: ReactNode
}) {
  return (
    <label className="inline-flex cursor-pointer items-center gap-2 text-sm text-ink-2 select-none">
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="size-4 accent-forecast"
      />
      {children}
    </label>
  )
}

const KEY_STYLES: Record<LegendItem['shape'], (color: string) => CSSProperties> = {
  line: (color) => ({ width: 16, height: 3, borderRadius: 2, background: color }),
  dashed: (color) => ({ width: 16, borderTop: `2px dashed ${color}` }),
  area: (color) => ({ width: 16, height: 10, borderRadius: 3, background: color }),
  bar: (color) => ({ width: 10, height: 10, borderRadius: 3, background: color }),
  dot: (color) => ({ width: 8, height: 8, borderRadius: 4, background: color }),
}

/** Chart legend: a colour key beside each label (text stays in text colours). */
export function Legend({ items }: { items: LegendItem[] }) {
  return (
    <ul className="mb-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-2">
      {items.map((item) => (
        <li key={item.label} className="inline-flex items-center gap-1.5">
          <span aria-hidden className="inline-block shrink-0" style={KEY_STYLES[item.shape](item.color)} />
          {item.label}
        </li>
      ))}
    </ul>
  )
}
