import { useMemo, useState } from 'react'

import { useBreakdown, useDecision, useMeta, useVintages } from '../api/hooks'
import type { DecisionResponse, Meta } from '../api/types'
import { CutoffPicker } from '../components/CutoffPicker'
import { EChart } from '../components/EChart'
import {
  Card,
  Chapter,
  Chevron,
  ChevronLink,
  CircleButton,
  ErrorState,
  fieldClass,
  Heading,
  InfoTip,
  Legend,
  LocalNav,
  pillClass,
  Skeleton,
  StatTile,
  Switch,
} from '../components/ui'
import { useChartTheme } from '../lib/chartTheme'
import { downloadCsv, toCsv } from '../lib/csv'
import { formatGW, formatHours, formatMW, formatMWh, formatPct, formatSignedMW } from '../lib/format'
import { addDays, formatClock, formatDate, formatDateLong, formatDateShort, formatDayTime, zoneAbbr } from '../lib/time'
import { useCutoff } from '../lib/useCutoff'
import { useSearchParam } from '../lib/useSearchParam'
import { decisionChartOption, decisionLegend } from './decision/decisionChart'

export function DecisionPage() {
  const meta = useMeta()
  if (meta.isPending) return <HeroSkeleton />
  if (meta.isError)
    return (
      <Chapter tone="white">
        <ErrorState error={meta.error} onRetry={() => meta.refetch()} />
      </Chapter>
    )
  return <DecisionView meta={meta.data} />
}

function HeroSkeleton() {
  return (
    <Chapter tone="hero">
      <Skeleton className="h-6 w-40" />
      <Skeleton className="mt-4 h-14 w-full max-w-[560px]" />
      <Skeleton className="mt-10 h-[420px]" />
    </Chapter>
  )
}

function DecisionView({ meta }: { meta: Meta }) {
  const first = meta.delivery_first_day
  const last = meta.delivery_last_day
  const [date, setDate] = useSearchParam('date', last, (d) => /^\d{4}-\d{2}-\d{2}$/.test(d) && d >= first && d <= last)
  const [cutoff] = useCutoff()
  const [hindsight, setHindsight] = useState(true)
  const decision = useDecision(date, cutoff)

  return (
    <>
      <LocalNav title="Decision view">
        <DayStepper date={date} first={first} last={last} onChange={setDate} />
        <CutoffPicker />
      </LocalNav>

      {decision.isPending ? (
        <HeroSkeleton />
      ) : decision.isError ? (
        <Chapter tone="white">
          <ErrorState error={decision.error} onRetry={() => decision.refetch()} />
        </Chapter>
      ) : (
        <div className={`transition-opacity ${decision.isPlaceholderData ? 'opacity-60' : ''}`}>
          <DecisionContent
            decision={decision.data}
            meta={meta}
            cutoff={cutoff}
            hindsight={hindsight}
            setHindsight={setHindsight}
            onJump={setDate}
          />
        </div>
      )}
    </>
  )
}

function DayStepper({
  date,
  first,
  last,
  onChange,
}: {
  date: string
  first: string
  last: string
  onChange: (date: string) => void
}) {
  return (
    <div className="flex items-center gap-1.5">
      <CircleButton label="Previous day" disabled={date <= first} onClick={() => onChange(addDays(date, -1))}>
        <Chevron direction="left" className="size-3.5" />
      </CircleButton>
      <input
        id="delivery-date"
        type="date"
        aria-label="Delivery day"
        min={first}
        max={last}
        value={date}
        required
        onChange={(event) => event.target.value && onChange(event.target.value)}
        className={fieldClass}
      />
      <CircleButton label="Next day" disabled={date >= last} onClick={() => onChange(addDays(date, 1))}>
        <Chevron className="size-3.5" />
      </CircleButton>
    </div>
  )
}

function DecisionContent({
  decision,
  meta,
  cutoff,
  hindsight,
  setHindsight,
  onJump,
}: {
  decision: DecisionResponse
  meta: Meta
  cutoff: string
  hindsight: boolean
  setHindsight: (value: boolean) => void
  onJump: (date: string) => void
}) {
  if (!decision.publish_time || !decision.summary) {
    return (
      <Chapter tone="hero">
        <Heading
          level={1}
          eyebrow="Delivery day"
          title={formatDateLong(decision.delivery_date)}
          sub={`No wind forecast covering this day had been published by ${formatDayTime(decision.cutoff)} ${zoneAbbr(decision.cutoff)}. Try a later decision time.`}
        />
      </Chapter>
    )
  }
  return (
    <>
      <Hero decision={decision} meta={meta} cutoff={cutoff} hindsight={hindsight} setHindsight={setHindsight} onJump={onJump} />
      <Numbers decision={decision} hindsight={hindsight} />
      <HourlyTable decision={decision} hindsight={hindsight} />
    </>
  )
}

function Hero({
  decision,
  meta,
  cutoff,
  hindsight,
  setHindsight,
  onJump,
}: {
  decision: DecisionResponse
  meta: Meta
  cutoff: string
  hindsight: boolean
  setHindsight: (value: boolean) => void
  onJump: (date: string) => void
}) {
  const publish = decision.publish_time!
  const leads = decision.hours.map((h) => h.lead_time_h)
  const late = meta.late_publishes.includes(publish)
  return (
    <Chapter tone="hero" inner="sm:pt-16">
      <p className="text-eyebrow text-ink-2">Delivery day</p>
      <h1 className="text-display mt-2 text-ink">{formatDateLong(decision.delivery_date)}</h1>
      <dl className="mt-8 grid gap-x-8 gap-y-5 sm:grid-cols-3">
        <Fact label="Decided" tip="When the day-ahead purchase is committed, the day before delivery." value={`${formatDayTime(decision.cutoff)} ${zoneAbbr(decision.cutoff)}`} />
        <Fact
          label="Forecast used"
          tip="The newest forecast published at or before the decision time."
          value={`${formatDayTime(publish)} ${zoneAbbr(publish)}`}
          detail={
            [decision.forecast_age_h !== null && `${formatHours(decision.forecast_age_h)} old`, late && '⚠ published late']
              .filter(Boolean)
              .join(' · ') || undefined
          }
        />
        <Fact
          label="Looks ahead"
          tip="Hours from the forecast's publish time to each delivery hour."
          value={`${formatHours(Math.min(...leads)).replace(' h', '')}–${formatHours(Math.max(...leads))}`}
          detail={decision.missing_hours.length > 0 ? `⚠ ${decision.missing_hours.length} hour(s) missing` : undefined}
        />
      </dl>
      <JumpLinks cutoff={cutoff} onJump={onJump} />
      <ForecastChart decision={decision} hindsight={hindsight} setHindsight={setHindsight} />
    </Chapter>
  )
}

function Fact({ label, tip, value, detail }: { label: string; tip: string; value: string; detail?: string }) {
  return (
    <div className="border-t border-line pt-4">
      <dt className="text-control flex items-center text-ink-2">
        {label}
        <InfoTip text={tip} />
      </dt>
      <dd className="text-title mt-1.5 text-ink">{value}</dd>
      {detail && <dd className="text-control mt-1 text-ink-2">{detail}</dd>}
    </div>
  )
}

/** Shortcuts to the best and worst forecast days for the chosen cutoff. */
function JumpLinks({ cutoff, onJump }: { cutoff: string; onJump: (date: string) => void }) {
  const daily = useBreakdown('day', cutoff)
  const rows = daily.data?.rows
  if (!rows?.length) return null
  const sorted = [...rows].sort((a, b) => a.mae_mw - b.mae_mw)
  const best = String(sorted[0].key)
  const worst = String(sorted[sorted.length - 1].key)
  return (
    <div className="mt-7 flex flex-wrap gap-x-7 gap-y-2">
      <ChevronLink onClick={() => onJump(worst)}>Worst day · {formatDateShort(worst)}</ChevronLink>
      <ChevronLink onClick={() => onJump(best)}>Best day · {formatDateShort(best)}</ChevronLink>
    </div>
  )
}

function ForecastChart({
  decision,
  hindsight,
  setHindsight,
}: {
  decision: DecisionResponse
  hindsight: boolean
  setHindsight: (value: boolean) => void
}) {
  const theme = useChartTheme()
  const [band, setBand] = useState(true)
  const [showVintages, setShowVintages] = useState(false)
  const date = decision.delivery_date
  const vintages = useVintages(date, formatClock(decision.cutoff), showVintages)
  const option = useMemo(
    () =>
      decisionChartOption(decision, theme, {
        actuals: hindsight,
        band,
        vintages: showVintages ? (vintages.data?.vintages ?? null) : null,
      }),
    [decision, theme, hindsight, band, showVintages, vintages.data],
  )
  return (
    <div className="mt-14 sm:mt-16">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-x-6 gap-y-4">
        <p className="text-title text-ink">Forecast vs outcome</p>
        <div className="flex flex-wrap gap-x-5 gap-y-2">
          <Switch checked={hindsight} onChange={setHindsight}>Outcome</Switch>
          <Switch checked={band} onChange={setBand}>Likely range</Switch>
          <Switch checked={showVintages} onChange={setShowVintages}>Earlier forecasts</Switch>
        </div>
      </div>
      <Legend items={decisionLegend(theme, { actuals: hindsight, band, vintages: showVintages })} />
      <div className="mt-3">
        <EChart
          option={option}
          height={420}
          label={`Hourly wind forecast for ${formatDate(date)} made at the decision time${hindsight ? ', with actual wind generation' : ''}.`}
        />
      </div>
      {vintages.isError && <p className="text-control mt-2 text-ink-2">Could not load earlier forecasts.</p>}
    </div>
  )
}

function Numbers({ decision, hindsight }: { decision: DecisionResponse; hindsight: boolean }) {
  const s = decision.summary!
  const hours = decision.hours.length
  return (
    <Chapter tone="light">
      <Heading title="The day in numbers." />
      <div className="grid gap-4 sm:grid-cols-3">
        <StatTile
          label="Forecast wind energy"
          value={formatMWh(s.forecast_energy_mwh)}
          detail={`Avg ${formatGW(s.forecast_energy_mwh / hours)}`}
          info="Sum of the hourly forecast for the delivery day."
        />
        <StatTile
          label="Low case (P10)"
          value={formatMWh(s.p10_energy_mwh)}
          detail={`${formatPct((100 * s.p10_energy_mwh) / s.forecast_energy_mwh)} of forecast`}
          info="On similar days, wind fell below this only 1 hour in 10."
        />
        <StatTile
          label="Forecast range"
          value={`${formatGW(s.forecast_min_mw)} – ${formatGW(s.forecast_max_mw)}`}
          info="Lowest and highest forecast hour."
        />
      </div>
      {hindsight && s.actual_energy_mwh !== null && (
        <>
          <p className="text-eyebrow mt-10 mb-4 text-ink">In hindsight</p>
          <div className="grid gap-4 sm:grid-cols-3">
            <StatTile
              label="Actual wind energy"
              value={formatMWh(s.actual_energy_mwh)}
              detail={`${formatPct((100 * s.actual_energy_mwh) / s.forecast_energy_mwh)} of forecast`}
              info="Metered wind output on the delivery day."
            />
            <StatTile
              label="Average miss"
              value={formatMW(s.mae_mw)}
              info="Average size of the hourly error, ignoring direction (MAE)."
            />
            <StatTile
              label="Bias"
              value={formatSignedMW(s.bias_mw)}
              detail={s.bias_mw !== null && s.bias_mw < 0 ? 'Less wind than forecast' : 'More wind than forecast'}
              info="Average of actual minus forecast. Negative means you were short of wind."
            />
          </div>
        </>
      )}
    </Chapter>
  )
}

function HourlyTable({ decision, hindsight }: { decision: DecisionResponse; hindsight: boolean }) {
  const zone = zoneAbbr(decision.delivery_date + 'T12:00:00Z')
  const exportCsv = () => {
    const rows = decision.hours.map((h) => [
      h.start_time,
      formatClock(h.start_time),
      h.lead_time_h,
      h.forecast_mw,
      round(h.p10_mw),
      round(h.p50_mw),
      round(h.p90_mw),
      h.actual_mw,
      h.error_mw,
    ])
    const header = ['start_time_utc', 'hour_uk', 'lead_time_h', 'forecast_mw', 'p10_mw', 'p50_mw', 'p90_mw', 'actual_mw', 'error_mw']
    downloadCsv(`wind-forecast-${decision.delivery_date}-cutoff-${formatClock(decision.cutoff).replace(':', '')}.csv`, toCsv(header, rows))
  }
  return (
    <Chapter tone="white">
      <div className="flex flex-wrap items-end justify-between gap-x-6">
        <Heading title="Hour by hour." />
        <button type="button" className={`mb-8 sm:mb-10 ${pillClass}`} onClick={exportCsv}>
          Download CSV
        </button>
      </div>
      <Card>
        <details className="group">
          <summary className="text-body flex cursor-pointer list-none items-center gap-1 text-link hover:underline [&::-webkit-details-marker]:hidden">
            Show {decision.hours.length} hours
            <Chevron className="size-[11px] translate-y-px transition-transform group-open:rotate-90" />
          </summary>
          <div className="mt-4 overflow-x-auto">
            <table className="text-control w-full text-right tabular-nums">
              <thead className="text-ink-2">
                <tr className="border-b border-line">
                  <th className="py-2.5 pr-3 text-left font-semibold">Hour ({zone})</th>
                  <th className="px-3 font-semibold"><InfoTip text="Hours between the forecast's publish time and this hour.">Ahead</InfoTip></th>
                  <th className="px-3 font-semibold">Forecast</th>
                  <th className="px-3 font-semibold"><InfoTip text="P10: wind fell below this 1 hour in 10 on similar days.">Low</InfoTip></th>
                  <th className="px-3 font-semibold"><InfoTip text="P50: the forecast plus its usual error at this level.">Typical</InfoTip></th>
                  <th className="px-3 font-semibold"><InfoTip text="P90: wind beat this only 1 hour in 10 on similar days.">High</InfoTip></th>
                  {hindsight && <th className="px-3 font-semibold">Actual</th>}
                  {hindsight && (
                    <th className="pl-3 font-semibold">
                      <InfoTip text="Actual minus forecast. Negative means less wind than forecast.">Error</InfoTip>
                    </th>
                  )}
                </tr>
              </thead>
              <tbody className="text-ink">
                {decision.hours.map((h) => (
                  <tr key={h.start_time} className="border-b border-line last:border-0">
                    <td className="py-2 pr-3 text-left">{formatClock(h.start_time)}</td>
                    <td className="px-3 text-ink-2">{formatHours(h.lead_time_h)}</td>
                    <td className="px-3">{formatMW(h.forecast_mw)}</td>
                    <td className="px-3 text-ink-2">{formatMW(h.p10_mw)}</td>
                    <td className="px-3 text-ink-2">{formatMW(h.p50_mw)}</td>
                    <td className="px-3 text-ink-2">{formatMW(h.p90_mw)}</td>
                    {hindsight && <td className="px-3">{formatMW(h.actual_mw)}</td>}
                    {hindsight && <td className="pl-3">{formatSignedMW(h.error_mw)}</td>}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      </Card>
      <div className="mt-8">
        <ChevronLink to="/accuracy">January accuracy</ChevronLink>
      </div>
    </Chapter>
  )
}

const round = (value: number) => Math.round(value * 10) / 10
