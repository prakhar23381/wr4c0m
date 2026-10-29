import type { UseQueryResult } from '@tanstack/react-query'
import { useCallback, useMemo, type ReactNode } from 'react'
import { Link, useNavigate } from 'react-router'

import { useAccuracySummary, useBreakdown, useCutoffSweep, useDistribution, useMeta } from '../api/hooks'
import type { BreakdownResponse, Metrics } from '../api/types'
import { CutoffPicker } from '../components/CutoffPicker'
import { type ChartOption, EChart } from '../components/EChart'
import { Card, ErrorState, InfoTip, Legend, Loading, StatTile } from '../components/ui'
import { type ChartTheme, type LegendItem, useChartTheme } from '../lib/chartTheme'
import { formatGW, formatMW, formatPct, formatSignedMW } from '../lib/format'
import { formatDate, toHHMM } from '../lib/time'
import { useCutoff } from '../lib/useCutoff'
import {
  cutoffSweepOption,
  dailyOption,
  distributionOption,
  hourOption,
  leadTimeOption,
  levelOption,
  maeBiasLegend,
  sweepLegend,
} from './accuracy/charts'

export function AccuracyPage() {
  const [cutoff] = useCutoff()
  const summary = useAccuracySummary(cutoff)

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold text-ink">Forecast accuracy</h1>
        <p className="mt-1 text-ink-2">
          How the forecast you would have used at the decision time compared with actual wind
          {summary.data && (
            <>
              , across {summary.data.days} delivery days ({formatDate(summary.data.date_from)} to{' '}
              {formatDate(summary.data.date_to)})
            </>
          )}
          .
        </p>
      </div>

      <Card>
        <CutoffPicker />
      </Card>

      {summary.isPending ? (
        <Loading className="h-56" />
      ) : summary.isError ? (
        <ErrorState error={summary.error} onRetry={() => summary.refetch()} />
      ) : (
        <Headline metrics={summary.data.metrics} />
      )}

      <div className="grid gap-5 lg:grid-cols-2">
        <LevelChart cutoff={cutoff} />
        <DistributionChart cutoff={cutoff} />
      </div>
      <DailyChart cutoff={cutoff} />
      <div className="grid gap-5 lg:grid-cols-2">
        <HourChart cutoff={cutoff} />
        <LeadTimeChart cutoff={cutoff} />
      </div>
      <CutoffSweepChart />
    </div>
  )
}

function Headline({ metrics: m }: { metrics: Metrics }) {
  const share = (100 * m.shortfall_buffer_mw) / m.mean_forecast_mw
  return (
    <div className="grid gap-3 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
      <div className="relative rounded-xl border border-line border-l-4 border-l-shortfall bg-surface p-5">
        <div className="flex items-center text-sm text-ink-2">
          Shortfall buffer
          <InfoTip text="Minus the 10th percentile of hourly errors (actual − forecast). In 9 hours out of 10, actual wind was no more than this far below the forecast, so holding this much cover protects you in all but the worst 10% of hours." />
        </div>
        <div className="mt-1 text-5xl font-semibold text-ink">{formatGW(m.shortfall_buffer_mw)}</div>
        <p className="mt-3 text-ink">
          To cover a wind shortfall in <b>9 hours out of 10</b>, plan for up to{' '}
          <b>{formatMW(m.shortfall_buffer_mw)}</b> less wind than forecast ({formatPct(share)} of the average forecast).
        </p>
        <p className="mt-2 text-sm text-ink-2">
          Forecasts ran <b className="text-ink">{formatMW(Math.abs(m.bias_mw))} too high</b> on average: mean forecast{' '}
          {formatGW(m.mean_forecast_mw)} against {formatGW(m.mean_actual_mw)} actual.
        </p>
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <StatTile
          label="Average miss (MAE)"
          value={formatMW(m.mae_mw)}
          detail={`Over ${m.count} hours`}
          info="Mean absolute error: on average, how far each hourly forecast was from what happened, ignoring direction."
        />
        <StatTile
          label="Bias"
          value={formatSignedMW(m.bias_mw)}
          detail={m.bias_mw < 0 ? 'Less wind than forecast' : 'More wind than forecast'}
          info="Mean of actual − forecast. Negative means the forecast was systematically too high, so you would tend to be short of wind and buy the gap later at a higher price."
        />
        <StatTile
          label="Error as % of output"
          value={formatPct(m.wape_pct)}
          detail="WAPE"
          info="Total absolute error divided by total actual wind (weighted absolute percentage error). Unlike MAPE, it doesn't explode in near-calm hours."
        />
        <StatTile
          label="RMSE"
          value={formatMW(m.rmse_mw)}
          detail="Weights big misses more"
          info="Root mean square error. Higher than MAE when there are occasional large misses, which are the ones that cost the most."
        />
        <StatTile
          label="Typical error range"
          value={`${formatGW(m.p10_mw).replace(' GW', '')} to ${m.p90_mw > 0 ? '+' : ''}${formatGW(m.p90_mw).replace(' GW', '')}`}
          detail="GW, P10 to P90 of hourly errors"
          info="8 hours in 10 had an error (actual − forecast) inside this range. It is lopsided: shortfalls are much larger than surpluses."
        />
        <StatTile
          label="Worst hour"
          value={formatSignedMW(-m.max_shortfall_mw)}
          detail={`Best surprise ${formatSignedMW(m.max_surplus_mw)}`}
          info="The largest single-hour shortfall (actual below forecast) in the period, and the largest surplus."
        />
      </div>
    </div>
  )
}

/** A chart card that handles its query's loading and error states. */
function ChartCard<T>({
  query,
  title,
  subtitle,
  info,
  label,
  build,
  legend,
  height = 300,
  onClick,
  footer,
  className,
}: {
  query: UseQueryResult<T>
  title: string
  subtitle: string
  info?: string
  label: string
  build: (data: T, theme: ChartTheme) => ChartOption
  legend?: (theme: ChartTheme) => LegendItem[]
  height?: number
  onClick?: (params: { dataIndex: number }) => void
  footer?: (data: T) => ReactNode
  className?: string
}) {
  const theme = useChartTheme()
  const { data } = query
  const option = useMemo(() => (data === undefined ? null : build(data, theme)), [data, theme, build])
  return (
    <Card
      className={className}
      title={title}
      subtitle={
        <>
          {subtitle}
          {info && <InfoTip text={info} />}
        </>
      }
    >
      {query.isError ? (
        <ErrorState error={query.error} onRetry={() => query.refetch()} />
      ) : option === null ? (
        <Loading className="" />
      ) : (
        <div className={`transition-opacity ${query.isPlaceholderData ? 'opacity-60' : ''}`}>
          {legend && <Legend items={legend(theme)} />}
          <EChart option={option} label={label} height={height} onClick={onClick} />
          {data !== undefined && footer?.(data)}
        </div>
      )}
    </Card>
  )
}

const buildLevel = (d: BreakdownResponse, t: ChartTheme) => levelOption(d.rows, d.bucket_width ?? 4000, t)
const buildHour = (d: BreakdownResponse, t: ChartTheme) => hourOption(d.rows, t)
const buildLead = (d: BreakdownResponse, t: ChartTheme) => leadTimeOption(d.rows, d.bucket_width ?? 6, t)
const buildDaily = (d: BreakdownResponse, t: ChartTheme) => dailyOption(d.rows, t)

function LevelChart({ cutoff }: { cutoff: string }) {
  return (
    <ChartCard
      query={useBreakdown('level', cutoff)}
      title="Windy days are over-forecast the most"
      subtitle="Error by forecast wind level."
      info="Above about 16 GW of forecast wind, actual output fell several GW short. A likely cause is curtailment: when the grid can't take all the wind, wind farms are paid to turn down, while the forecast predicts what they could generate. This is a hypothesis; the data in scope can't confirm it."
      label="Bar chart of average miss and bias by forecast level; bias grows more negative as the forecast level rises."
      build={buildLevel}
      legend={(t) => maeBiasLegend(t, ['bar', 'bar'])}
    />
  )
}

function DistributionChart({ cutoff }: { cutoff: string }) {
  const query = useDistribution(cutoff)
  return (
    <ChartCard
      query={query}
      title="Errors lean towards shortfall"
      subtitle="Hours by size of error (actual − forecast)."
      info="Each bar counts hours whose error fell in that 500 MW band. Left of zero, actual wind was below the forecast. P10, P50 and P90 mark the 10th, 50th and 90th percentiles."
      label="Histogram of hourly forecast errors, centred well below zero."
      build={distributionOption}
    />
  )
}

function DailyChart({ cutoff }: { cutoff: string }) {
  const query = useBreakdown('day', cutoff)
  const navigate = useNavigate()
  const rows = query.data?.rows
  const openDay = useCallback(
    ({ dataIndex }: { dataIndex: number }) => {
      const day = rows?.[dataIndex]
      if (day) navigate(`/?date=${day.key}&cutoff=${cutoff}`)
    },
    [rows, navigate, cutoff],
  )
  return (
    <ChartCard
      query={query}
      title="Accuracy by delivery day"
      subtitle="Click a day to open it in the decision view."
      label="Bar chart of average miss per delivery day, with bias dots; most days show negative bias."
      build={buildDaily}
      legend={(t) => maeBiasLegend(t, ['bar', 'dot'])}
      onClick={openDay}
      footer={(d) => <WorstDays data={d} cutoff={cutoff} />}
    />
  )
}

function WorstDays({ data, cutoff }: { data: BreakdownResponse; cutoff: string }) {
  const worst = [...data.rows].sort((a, b) => b.mae_mw - a.mae_mw).slice(0, 5)
  return (
    <div className="mt-4 overflow-x-auto">
      <h3 className="mb-1 text-sm font-semibold text-ink">Five worst days</h3>
      <table className="w-full text-right text-sm tabular-nums">
        <thead className="text-xs text-ink-2">
          <tr className="border-b border-line">
            <th className="py-2 pr-3 text-left font-medium">Delivery day</th>
            <th className="px-3 font-medium">Average miss</th>
            <th className="px-3 font-medium">Bias</th>
            <th className="pl-3 font-medium">Worst 10% of hours beyond</th>
          </tr>
        </thead>
        <tbody>
          {worst.map((row) => (
            <tr key={String(row.key)} className="border-b border-line last:border-0">
              <td className="py-1.5 pr-3 text-left">
                <Link to={`/?date=${row.key}&cutoff=${cutoff}`} className="text-forecast underline-offset-2 hover:underline">
                  {formatDate(String(row.key))}
                </Link>
              </td>
              <td className="px-3">{formatMW(row.mae_mw)}</td>
              <td className="px-3">{formatSignedMW(row.bias_mw)}</td>
              <td className="pl-3">{formatSignedMW(row.p10_mw)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function HourChart({ cutoff }: { cutoff: string }) {
  return (
    <ChartCard
      query={useBreakdown('hour', cutoff)}
      title="By hour of day"
      subtitle="Error for each delivery hour (UK time)."
      label="Line chart of average miss and bias by hour of day; both vary modestly."
      build={buildHour}
      legend={(t) => maeBiasLegend(t, ['line', 'line'])}
    />
  )
}

function LeadTimeChart({ cutoff }: { cutoff: string }) {
  return (
    <ChartCard
      query={useBreakdown('lead_time', cutoff)}
      title="Closer to delivery is better, but the bias stays"
      subtitle="Error by how far ahead the forecast was made, using every forecast published."
      info="Uses all forecast publishes, not only the one available at the decision time, so it shows how accuracy changes with horizon. The miss shrinks closer to delivery, but the negative bias is there at every horizon, so it is structural rather than a weather-forecasting limit."
      label="Line chart of average miss and bias by forecast lead time; the miss rises with lead time and bias is negative throughout."
      build={buildLead}
      legend={(t) => maeBiasLegend(t, ['line', 'line'])}
    />
  )
}

function CutoffSweepChart() {
  const meta = useMeta()
  const query = useCutoffSweep()
  const gates = useMemo(
    () => (meta.data?.cutoff_presets ?? []).map((p) => ({ time: toHHMM(p.time), label: `${p.label.split(' ')[0]} gate` })),
    [meta.data],
  )
  const build = useCallback(
    (d: { rows: Parameters<typeof cutoffSweepOption>[0] }, t: ChartTheme) => cutoffSweepOption(d.rows, gates, t),
    [gates],
  )
  const best = query.data?.rows.reduce((a, b) => (b.mae_mw < a.mae_mw ? b : a))
  return (
    <ChartCard
      query={query}
      title="Would a later forecast help?"
      subtitle={
        best
          ? `The best forecast in the morning arrives after the auction gates (from ${toHHMM(best.cutoff)}), so it can't inform the purchase. That's why the buffer matters.`
          : 'Accuracy if the decision were made at other times on the day before.'
      }
      info="For each decision time, the app re-runs the whole month using the latest forecast published by then. Forecasts are published about every 2–3 hours, so the lines step when a new one arrives."
      label="Step chart of average miss and shortfall buffer against decision time; both drop only after the auction gates."
      build={build}
      legend={sweepLegend}
      height={320}
    />
  )
}
