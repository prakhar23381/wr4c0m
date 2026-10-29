import { type CSSProperties, type ReactNode, useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Link } from 'react-router'

import { ApiError } from '../api/client'
import type { LegendItem } from '../lib/chartTheme'
import { TONE_CLASS, type Tone, ToneContext } from '../lib/tone'

const focusRing = 'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent'

/** A full-bleed band of the page: the hero, a pale grey field or a white field. */
export function Chapter({
  tone,
  children,
  className = '',
  inner = '',
}: {
  tone: Tone
  children: ReactNode
  className?: string
  inner?: string
}) {
  return (
    <ToneContext.Provider value={tone}>
      <section className={`${TONE_CLASS[tone]} text-ink ${className}`}>
        <div className={`mx-auto max-w-[1080px] px-4 py-14 sm:px-6 sm:py-20 ${inner}`}>{children}</div>
      </section>
    </ToneContext.Provider>
  )
}

/** Sticky, translucent bar under the global nav holding the page title and its controls. */
export function LocalNav({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="z-30 border-b border-line bg-localnav backdrop-blur-xl backdrop-saturate-150 sm:sticky sm:top-16">
      <div className="relative mx-auto flex max-w-[1080px] flex-wrap items-center justify-between gap-x-6 gap-y-3 px-4 py-3 sm:px-6">
        <p className="text-title text-ink">{title}</p>
        <div className="flex flex-wrap items-center gap-x-5 gap-y-3">{children}</div>
      </div>
    </div>
  )
}

export function Heading({
  eyebrow,
  title,
  sub,
  info,
  level = 2,
  className = '',
}: {
  eyebrow?: ReactNode
  title: ReactNode
  sub?: ReactNode
  info?: string
  level?: 1 | 2
  className?: string
}) {
  const Tag = level === 1 ? 'h1' : 'h2'
  return (
    <div className={`relative mb-8 max-w-[760px] sm:mb-10 ${className}`}>
      {eyebrow && <p className="text-eyebrow mb-2 text-ink-2">{eyebrow}</p>}
      <Tag className={level === 1 ? 'text-display text-ink' : 'text-headline text-ink'}>
        {title}
        {info && <InfoTip text={info} />}
      </Tag>
      {sub && <p className="text-lead mt-3 text-ink-2">{sub}</p>}
    </div>
  )
}

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
    <section className={`relative rounded-[18px] bg-card p-5 sm:p-7 ${className}`}>
      {(title || actions) && (
        <header className="mb-4 flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
          <div className="min-w-0">
            {title && <h3 className="text-title flex items-center text-ink">{title}</h3>}
            {subtitle && <p className="text-control mt-1 text-ink-2">{subtitle}</p>}
          </div>
          {actions && <div className="flex flex-wrap items-center gap-x-4 gap-y-2">{actions}</div>}
        </header>
      )}
      {children}
    </section>
  )
}

/** A short explanation in a small bubble beside its trigger: the "i" button, or `children`
 *  shown as dotted-underlined text. Opens on hover, focus or tap. The bubble is rendered in a
 *  portal with fixed positioning, so scroll containers can't clip it, and is kept on screen. */
export function InfoTip({ text, children }: { text: string; children?: ReactNode }) {
  const id = useId()
  const trigger = useRef<HTMLButtonElement>(null)
  const bubble = useRef<HTMLSpanElement>(null)
  const [open, setOpen] = useState(false)
  const [position, setPosition] = useState<{ top: number; left: number } | null>(null)
  const show = () => setOpen(true)
  const hide = useCallback(() => {
    setOpen(false)
    setPosition(null)
  }, [])

  useLayoutEffect(() => {
    if (!open || !trigger.current || !bubble.current) return
    const t = trigger.current.getBoundingClientRect()
    const b = bubble.current.getBoundingClientRect()
    const margin = 12
    const left = Math.min(Math.max(t.left + t.width / 2 - b.width / 2, margin), window.innerWidth - b.width - margin)
    const below = t.bottom + 8
    const top = below + b.height > window.innerHeight - margin ? t.top - b.height - 8 : below
    setPosition({ top, left })
  }, [open])

  useEffect(() => {
    if (!open) return
    const outside = (event: PointerEvent) => {
      if (!trigger.current?.contains(event.target as Node)) hide()
    }
    const escape = (event: KeyboardEvent) => event.key === 'Escape' && hide()
    window.addEventListener('scroll', hide, true)
    window.addEventListener('resize', hide)
    document.addEventListener('pointerdown', outside)
    document.addEventListener('keydown', escape)
    return () => {
      window.removeEventListener('scroll', hide, true)
      window.removeEventListener('resize', hide)
      document.removeEventListener('pointerdown', outside)
      document.removeEventListener('keydown', escape)
    }
  }, [open, hide])

  return (
    <>
      <button
        ref={trigger}
        type="button"
        aria-describedby={id}
        aria-label={children ? undefined : 'More info'}
        onMouseEnter={show}
        onMouseLeave={hide}
        onFocus={show}
        onBlur={hide}
        onClick={show}
        className={
          children
            ? `cursor-help text-inherit underline decoration-current/40 decoration-dotted decoration-1 underline-offset-[3px] ${focusRing}`
            : `ml-1.5 inline-flex size-[17px] shrink-0 cursor-help items-center justify-center rounded-full bg-wash align-middle text-[10px] leading-none font-semibold text-ink-2 hover:text-ink ${focusRing}`
        }
      >
        {children ?? 'i'}
      </button>
      <span id={id} className="sr-only">
        {text}
      </span>
      {open &&
        createPortal(
          <span
            ref={bubble}
            role="tooltip"
            style={{ position: 'fixed', top: position?.top ?? -9999, left: position?.left ?? -9999 }}
            className="pointer-events-none z-50 w-max max-w-[240px] rounded-xl bg-popover px-3 py-2 text-[13px] leading-[1.35] font-normal tracking-[-0.01em] text-ink shadow-[0_8px_28px_rgba(0,0,0,0.18)]"
          >
            {text}
          </span>,
          document.body,
        )}
    </>
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
    <div className="relative rounded-[18px] bg-card p-5 sm:p-6">
      <div className="text-control flex items-center text-ink-2">
        {label}
        {info && <InfoTip text={info} />}
      </div>
      <div className="mt-2 text-[28px] leading-[1.14] font-semibold tracking-[-0.01em] text-ink sm:text-[32px]">{value}</div>
      {detail && <div className="text-control mt-1.5 text-ink-2">{detail}</div>}
    </div>
  )
}

export function Skeleton({ className = '' }: { className?: string }) {
  return <div aria-hidden className={`animate-pulse rounded-[18px] bg-wash ${className}`} />
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
    <div role="alert" className="rounded-[18px] bg-card p-6">
      <p className="text-title text-ink">Something went wrong loading this data.</p>
      <p className="text-body mt-2 text-ink-2">{message}</p>
      {onRetry && (
        <button type="button" onClick={onRetry} className={`mt-4 ${pillClass}`}>
          Try again
        </button>
      )}
    </div>
  )
}

/** Primary capsule action. */
export const pillClass = `text-control inline-flex items-center gap-1.5 rounded-full bg-accent px-[18px] py-2 text-white transition hover:bg-[#0077ed] active:scale-[0.98] ${focusRing}`

/** Quiet field shell for native inputs (date, time). */
export const fieldClass = `text-control rounded-full border border-line bg-card px-3 py-[7px] text-ink ${focusRing}`

export function Chevron({ direction = 'right', className = 'size-3' }: { direction?: 'left' | 'right'; className?: string }) {
  return (
    <svg viewBox="0 0 12 12" aria-hidden className={className} fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d={direction === 'right' ? 'M4.5 2 8.5 6l-4 4' : 'M7.5 2 3.5 6l4 4'} />
    </svg>
  )
}

/** Circular control, e.g. stepping between days. */
export function CircleButton({
  label,
  onClick,
  disabled,
  children,
}: {
  label: string
  onClick: () => void
  disabled?: boolean
  children: ReactNode
}) {
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className={`inline-flex size-9 items-center justify-center rounded-full bg-wash text-ink transition hover:brightness-95 active:scale-95 disabled:cursor-not-allowed disabled:opacity-30 ${focusRing}`}
    >
      {children}
    </button>
  )
}

const linkClass = `inline-flex items-center gap-1 text-link hover:underline ${focusRing} rounded-sm`

/** Inline link with a trailing chevron, as a route link or an in-page action. */
export function ChevronLink({
  to,
  onClick,
  children,
  className = 'text-body',
}: {
  to?: string
  onClick?: () => void
  children: ReactNode
  className?: string
}) {
  const content = (
    <>
      {children}
      <Chevron className="size-[11px] translate-y-px" />
    </>
  )
  return to ? (
    <Link to={to} className={`${linkClass} ${className}`}>
      {content}
    </Link>
  ) : (
    <button type="button" onClick={onClick} className={`${linkClass} ${className}`}>
      {content}
    </button>
  )
}

export function Switch({
  checked,
  onChange,
  children,
}: {
  checked: boolean
  onChange: (checked: boolean) => void
  children: ReactNode
}) {
  return (
    <label className="text-control inline-flex cursor-pointer items-center gap-2 text-ink-2 select-none">
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative h-[22px] w-[38px] shrink-0 rounded-full transition-colors ${checked ? 'bg-accent' : 'bg-switch-off'} ${focusRing}`}
      >
        <span
          className={`absolute top-[2px] left-[2px] size-[18px] rounded-full bg-white shadow-[0_1px_3px_rgba(0,0,0,0.3)] transition-transform ${checked ? 'translate-x-4' : ''}`}
        />
      </button>
      {children}
    </label>
  )
}

export interface SegmentOption {
  value: string
  label: string
  title?: string
}

export function SegmentedControl({
  options,
  value,
  onChange,
  label,
}: {
  options: SegmentOption[]
  value: string
  onChange: (value: string) => void
  label: string
}) {
  return (
    <div role="group" aria-label={label} className="inline-flex rounded-full bg-wash p-[3px]">
      {options.map((option) => {
        const active = option.value === value
        return (
          <button
            key={option.value}
            type="button"
            title={option.title}
            aria-pressed={active}
            onClick={() => onChange(option.value)}
            className={`text-control rounded-full px-3.5 py-1.5 font-medium whitespace-nowrap transition ${focusRing} ${
              active ? 'bg-thumb text-ink shadow-[0_1px_4px_rgba(0,0,0,0.14)]' : 'text-ink-2 hover:text-ink'
            }`}
          >
            {option.label}
          </button>
        )
      })}
    </div>
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
    <ul className="flex flex-wrap gap-x-5 gap-y-1.5 text-[13px] text-ink-2">
      {items.map((item) => (
        <li key={item.label} className="inline-flex items-center gap-1.5">
          <span aria-hidden className="inline-block shrink-0" style={KEY_STYLES[item.shape](item.color)} />
          {item.tip ? <InfoTip text={item.tip}>{item.label}</InfoTip> : item.label}
        </li>
      ))}
    </ul>
  )
}
