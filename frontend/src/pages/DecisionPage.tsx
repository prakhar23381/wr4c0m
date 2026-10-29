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
    <Chapter tone="dark">
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
      <Chapter tone="dark">
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
    <Chapter tone="dark" inner="sm:pt-16">
      <div className="relative max-w-[820px]">
        <p className="text-eyebrow text-ink-2">Delivery day</p>
        <h1 className="text-display mt-2 text-ink">{formatDateLong(decision.delivery_date)}</h1>
        <p className="text-lead mt-5 text-ink-2">
          Deciding at <span className="font-semibold text-ink">{formatDayTime(decision.cutoff)} {zoneAbbr(decision.cutoff)}</span>, the
          latest wind forecast was published at{' '}
          <span className="font-semibold text-ink">{formatDayTime(publish)} {zoneAbbr(publish)}</span>
          {decision.forecast_age_h !== null && <>, {formatHours(decision.forecast_age_h)} earlier</>}. It looks{' '}
          {formatHours(Math.min(...leads))} to {formatHours(Math.max(...leads))} ahead.
        </p>
        {late && <p className="text-control mt-3 text-ink-2">⚠ This forecast was published later than its scheduled slot.</p>}
        {decision.missing_hours.length > 0 && (
          <p className="text-control mt-3 text-ink-2">
            ⚠ The forecast has no value for {decision.missing_hours.length} hour(s):{' '}
            {decision.missing_hours.map((h) => formatClock(h)).join(', ')}.
          </p>
        )}
        <JumpLinks cutoff={cutoff} onJump={onJump} />
      </div>
      <ForecastChart decision={decision} hindsight={hindsight} setHindsight={setHindsight} />
    </Chapter>
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
    <div className="mt-5 flex flex-wrap gap-x-7 gap-y-2">
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
    <div className="relative mt-12 sm:mt-14">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-x-6 gap-y-4 border-t border-line pt-6">
        <div className="relative">
          <p className="text-title flex items-center text-ink">
            Forecast at decision time vs outcome
            <InfoTip text={`Shaded: where actual wind landed 8 hours in 10 for similar forecasts. ${decision.band_basis}. The dashed line (P50) is the typical outcome: the forecast corrected by its usual error at that wind level.`} />
          </p>
        </div>
        <div className="flex flex-wrap gap-x-5 gap-y-2">
          <Switch checked={hindsight} onChange={setHindsight}>Show what actually happened</Switch>
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
      <Heading
        title="The day in numbers."
        sub="What the forecast promised, a cautious low case to plan against and, in hindsight, what actually happened."
      />
      <div className="grid gap-4 sm:grid-cols-3">
        <StatTile
          label="Forecast wind energy"
          value={formatMWh(s.forecast_energy_mwh)}
          detail={`Average ${formatMW(s.forecast_energy_mwh / hours)} over ${hours} hours`}
          info="Total wind generation the forecast expected for the delivery day: the sum of its hourly values."
        />
        <StatTile
          label="Low case (P10)"
          value={formatMWh(s.p10_energy_mwh)}
          detail={`${formatPct((100 * s.p10_energy_mwh) / s.forecast_energy_mwh)} of the forecast`}
          info="A cautious planning figure. On other January days with similar forecasts, actual wind fell below this hourly level only 1 hour in 10. Buying cover against this, not the headline forecast, protects against a wind shortfall."
        />
        <StatTile
          label="Forecast range"
          value={`${formatGW(s.forecast_min_mw)} – ${formatGW(s.forecast_max_mw)}`}
          detail="Lowest and highest forecast hour"
        />
      </div>
      {hindsight && s.actual_energy_mwh !== null && (
        <>
          <p className="text-eyebrow mt-10 mb-4 text-ink">In hindsight</p>
          <div className="grid gap-4 sm:grid-cols-3">
            <StatTile
              label="Actual wind energy"
              value={formatMWh(s.actual_energy_mwh)}
              detail={`${formatPct((100 * s.actual_energy_mwh) / s.forecast_energy_mwh)} of the forecast`}
              info="Metered wind generation on the delivery day (Elexon FUELHH, transmission-connected wind farms)."
            />
            <StatTile
              label="Average miss (MAE)"
              value={formatMW(s.mae_mw)}
              detail="Mean absolute hourly error"
              info="On average, how far each hourly forecast was from what happened, ignoring direction."
            />
            <StatTile
              label="Bias"
              value={formatSignedMW(s.bias_mw)}
              detail={s.bias_mw !== null && s.bias_mw < 0 ? 'Less wind than forecast' : 'More wind than forecast'}
              info="Average of actual minus forecast. Negative means the forecast was too high: you would have been short of wind and had to buy the gap at a higher price."
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
        <Heading title="Hour by hour." sub="Every forecast hour with its likely range and, in hindsight, the outcome." />
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
                  <th className="px-3 font-semibold">Ahead</th>
                  <th className="px-3 font-semibold">Forecast</th>
                  <th className="px-3 font-semibold">Low (P10)</th>
                  <th className="px-3 font-semibold">Typical (P50)</th>
                  <th className="px-3 font-semibold">High (P90)</th>
                  {hindsight && <th className="px-3 font-semibold">Actual</th>}
                  {hindsight && <th className="pl-3 font-semibold">Error</th>}
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
        <ChevronLink to="/accuracy">See forecast accuracy across January</ChevronLink>
      </div>
    </Chapter>
  )
}

const round = (value: number) => Math.round(value * 10) / 10
