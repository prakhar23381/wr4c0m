import { useMemo, useState } from 'react'
import { Link } from 'react-router'

import { useBreakdown, useDecision, useMeta, useVintages } from '../api/hooks'
import type { DecisionResponse, Meta } from '../api/types'
import { CutoffPicker } from '../components/CutoffPicker'
import { EChart } from '../components/EChart'
import {
  buttonClass,
  Card,
  ErrorState,
  InfoTip,
  inputClass,
  Legend,
  Loading,
  Skeleton,
  StatTile,
  Toggle,
} from '../components/ui'
import { useChartTheme } from '../lib/chartTheme'
import { downloadCsv, toCsv } from '../lib/csv'
import { formatGW, formatHours, formatMW, formatMWh, formatPct, formatSignedMW } from '../lib/format'
import { addDays, formatClock, formatDate, formatDateShort, formatDayTime, zoneAbbr } from '../lib/time'
import { useCutoff } from '../lib/useCutoff'
import { useSearchParam } from '../lib/useSearchParam'
import { decisionChartOption, decisionLegend } from './decision/decisionChart'

export function DecisionPage() {
  const meta = useMeta()
  if (meta.isPending) return <Loading className="h-[32rem]" />
  if (meta.isError) return <ErrorState error={meta.error} onRetry={() => meta.refetch()} />
  return <DecisionView meta={meta.data} />
}

function DecisionView({ meta }: { meta: Meta }) {
  const first = meta.delivery_first_day
  const last = meta.delivery_last_day
  const [date, setDate] = useSearchParam('date', last, (d) => /^\d{4}-\d{2}-\d{2}$/.test(d) && d >= first && d <= last)
  const [cutoff] = useCutoff()
  const [hindsight, setHindsight] = useState(true)
  const decision = useDecision(date, cutoff)

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold text-ink">Day-ahead decision view</h1>
        <p className="mt-1 text-ink-2">
          What the wind forecast said when you had to buy, how far to trust it, and what actually happened.
        </p>
      </div>

      <Card>
        <div className="flex flex-wrap items-end gap-x-8 gap-y-4">
          <DayPicker date={date} first={first} last={last} onChange={setDate} />
          <CutoffPicker />
          <JumpToDay cutoff={cutoff} onChange={setDate} />
          <div className="sm:ml-auto">
            <Toggle checked={hindsight} onChange={setHindsight}>
              Show what actually happened
            </Toggle>
          </div>
        </div>
      </Card>

      {decision.isPending ? (
        <div className="space-y-5">
          <Skeleton className="h-24" />
          <Skeleton className="h-96" />
        </div>
      ) : decision.isError ? (
        <ErrorState error={decision.error} onRetry={() => decision.refetch()} />
      ) : (
        <div className={`space-y-5 transition-opacity ${decision.isPlaceholderData ? 'opacity-60' : ''}`}>
          <DecisionContent decision={decision.data} meta={meta} hindsight={hindsight} />
        </div>
      )}
    </div>
  )
}

function DayPicker({
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
    <div>
      <label htmlFor="delivery-date" className="mb-1 block text-xs font-medium text-ink-2">
        Delivery day
      </label>
      <div className="flex items-center gap-1.5">
        <button type="button" className={buttonClass} aria-label="Previous day" disabled={date <= first} onClick={() => onChange(addDays(date, -1))}>
          ‹
        </button>
        <input
          id="delivery-date"
          type="date"
          min={first}
          max={last}
          value={date}
          required
          onChange={(event) => event.target.value && onChange(event.target.value)}
          className={inputClass}
        />
        <button type="button" className={buttonClass} aria-label="Next day" disabled={date >= last} onClick={() => onChange(addDays(date, 1))}>
          ›
        </button>
      </div>
    </div>
  )
}

/** Shortcuts to the best and worst forecast days for the chosen cutoff. */
function JumpToDay({ cutoff, onChange }: { cutoff: string; onChange: (date: string) => void }) {
  const daily = useBreakdown('day', cutoff)
  const rows = daily.data?.rows
  if (!rows?.length) return null
  const sorted = [...rows].sort((a, b) => a.mae_mw - b.mae_mw)
  const best = String(sorted[0].key)
  const worst = String(sorted[sorted.length - 1].key)
  return (
    <div>
      <div className="mb-1 text-xs font-medium text-ink-2">Jump to</div>
      <div className="flex gap-2">
        <button type="button" className={buttonClass} onClick={() => onChange(worst)}>
          Worst day · {formatDateShort(worst)}
        </button>
        <button type="button" className={buttonClass} onClick={() => onChange(best)}>
          Best day · {formatDateShort(best)}
        </button>
      </div>
    </div>
  )
}

function DecisionContent({ decision, meta, hindsight }: { decision: DecisionResponse; meta: Meta; hindsight: boolean }) {
  if (!decision.publish_time || !decision.summary) {
    return (
      <Card>
        <p className="font-semibold text-ink">No forecast was available at this decision time.</p>
        <p className="mt-1 text-sm text-ink-2">
          No wind forecast covering {formatDate(decision.delivery_date)} had been published by{' '}
          {formatDayTime(decision.cutoff)} {zoneAbbr(decision.cutoff)}. Try a later decision time.
        </p>
      </Card>
    )
  }
  return (
    <>
      <ForecastBanner decision={decision} meta={meta} />
      <SummaryTiles decision={decision} hindsight={hindsight} />
      <ForecastChart decision={decision} hindsight={hindsight} />
      <HourlyTable decision={decision} hindsight={hindsight} />
    </>
  )
}

function ForecastBanner({ decision, meta }: { decision: DecisionResponse; meta: Meta }) {
  const publish = decision.publish_time!
  const leads = decision.hours.map((h) => h.lead_time_h)
  const late = meta.late_publishes.includes(publish)
  return (
    <Card className="border-l-4 border-l-forecast">
      <p className="text-sm text-ink-2">Delivery day</p>
      <p className="text-lg font-semibold text-ink">{formatDate(decision.delivery_date)}</p>
      <p className="mt-2 text-ink">
        Deciding at <b>{formatDayTime(decision.cutoff)} {zoneAbbr(decision.cutoff)}</b>, the latest wind forecast was
        published at <b>{formatDayTime(publish)} {zoneAbbr(publish)}</b>
        {decision.forecast_age_h !== null && <> ({formatHours(decision.forecast_age_h)} earlier)</>}. It looks{' '}
        {formatHours(Math.min(...leads))} to {formatHours(Math.max(...leads))} ahead.
      </p>
      {late && <p className="mt-2 text-sm text-ink-2">⚠ This forecast was published later than its scheduled slot.</p>}
      {decision.missing_hours.length > 0 && (
        <p className="mt-2 text-sm text-ink-2">
          ⚠ The forecast has no value for {decision.missing_hours.length} hour(s):{' '}
          {decision.missing_hours.map((h) => formatClock(h)).join(', ')}.
        </p>
      )}
    </Card>
  )
}

function SummaryTiles({ decision, hindsight }: { decision: DecisionResponse; hindsight: boolean }) {
  const s = decision.summary!
  const hours = decision.hours.length
  return (
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-3">
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
        <div className="grid gap-3 sm:grid-cols-3">
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
      )}
    </div>
  )
}

function ForecastChart({ decision, hindsight }: { decision: DecisionResponse; hindsight: boolean }) {
  const theme = useChartTheme()
  const [band, setBand] = useState(true)
  const [showVintages, setShowVintages] = useState(false)
  const date = decision.delivery_date
  const cutoff = formatClock(decision.cutoff)
  const vintages = useVintages(date, cutoff, showVintages)
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
    <Card
      title="Forecast at decision time vs outcome"
      subtitle={
        <>
          Shaded: where actual wind landed 8 hours in 10 for similar forecasts on other days.
          <InfoTip text={`${decision.band_basis}. The dashed line (P50) is the typical outcome: the forecast corrected by its usual error at that wind level.`} />
        </>
      }
      actions={
        <>
          <Toggle checked={band} onChange={setBand}>Likely range</Toggle>
          <Toggle checked={showVintages} onChange={setShowVintages}>Earlier forecasts</Toggle>
        </>
      }
    >
      <Legend items={decisionLegend(theme, { actuals: hindsight, band, vintages: showVintages })} />
      <EChart
        option={option}
        height={360}
        label={`Hourly wind forecast for ${formatDate(date)} made at the decision time${hindsight ? ', with actual wind generation' : ''}.`}
      />
      {vintages.isError && <p className="mt-2 text-sm text-ink-2">Could not load earlier forecasts.</p>}
    </Card>
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
    <Card
      title="Hourly detail"
      actions={
        <button type="button" className={buttonClass} onClick={exportCsv}>
          Download CSV
        </button>
      }
    >
      <details>
        <summary className="cursor-pointer text-sm text-ink-2 hover:text-ink">Show {decision.hours.length} hours</summary>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-right text-sm tabular-nums">
            <thead className="text-xs text-ink-2">
              <tr className="border-b border-line">
                <th className="py-2 pr-3 text-left font-medium">Hour ({zone})</th>
                <th className="px-3 font-medium">Ahead</th>
                <th className="px-3 font-medium">Forecast</th>
                <th className="px-3 font-medium">Low (P10)</th>
                <th className="px-3 font-medium">Typical (P50)</th>
                <th className="px-3 font-medium">High (P90)</th>
                {hindsight && <th className="px-3 font-medium">Actual</th>}
                {hindsight && <th className="pl-3 font-medium">Error</th>}
              </tr>
            </thead>
            <tbody>
              {decision.hours.map((h) => (
                <tr key={h.start_time} className="border-b border-line last:border-0">
                  <td className="py-1.5 pr-3 text-left">{formatClock(h.start_time)}</td>
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
      <p className="mt-3 text-xs text-muted">
        Prefer the full picture? See <Link to="/accuracy" className="underline hover:text-ink">forecast accuracy across January</Link>.
      </p>
    </Card>
  )
}

const round = (value: number) => Math.round(value * 10) / 10
