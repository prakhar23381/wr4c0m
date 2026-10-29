import type { UseQueryResult } from '@tanstack/react-query'
import { type ReactNode, useCallback, useMemo } from 'react'
import { Link, useNavigate } from 'react-router'

import { useAccuracySummary, useBreakdown, useCutoffSweep, useDistribution, useMeta } from '../api/hooks'
import type { AccuracySummary, BreakdownResponse } from '../api/types'
import { CutoffPicker } from '../components/CutoffPicker'
import { type ChartOption, EChart } from '../components/EChart'
import { Card, Chapter, ErrorState, Heading, InfoTip, Legend, LocalNav, Skeleton, StatTile } from '../components/ui'
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
    <>
      <LocalNav title="Forecast accuracy">
        <CutoffPicker />
      </LocalNav>

      <Chapter tone="dark" inner="sm:pt-16">
        {summary.isPending ? (
          <>
            <Skeleton className="h-6 w-72" />
            <Skeleton className="mt-4 h-28 w-80" />
            <Skeleton className="mt-12 h-24" />
          </>
        ) : summary.isError ? (
          <ErrorState error={summary.error} onRetry={() => summary.refetch()} />
        ) : (
          <div className={`transition-opacity ${summary.isPlaceholderData ? 'opacity-60' : ''}`}>
            <Headline summary={summary.data} cutoff={cutoff} />
          </div>
        )}
      </Chapter>

      <Chapter tone="light">
        <Heading
          title="Windy days are over-forecast the most."
          sub="Error by forecast wind level. Above about 16 GW of forecast wind, actual output fell several gigawatts short."
        />
        <LevelChart cutoff={cutoff} />
        <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
          <DistributionChart cutoff={cutoff} />
          {summary.data && <SecondaryTiles summary={summary.data} />}
        </div>
      </Chapter>

      <Chapter tone="white">
        <Heading title="Day by day." sub="Most days were over-forecast. Click a day to open it in the decision view." />
        <DailyChart cutoff={cutoff} />
      </Chapter>

      <Chapter tone="light">
        <Heading title="When the error happens." sub="By hour of day, and by how far ahead the forecast was made." />
        <div className="grid gap-4 lg:grid-cols-2">
          <HourChart cutoff={cutoff} />
          <LeadTimeChart cutoff={cutoff} />
        </div>
      </Chapter>

      <CutoffSweep />
    </>
  )
}

function Headline({ summary, cutoff }: { summary: AccuracySummary; cutoff: string }) {
  const m = summary.metrics
  const share = (100 * m.shortfall_buffer_mw) / m.mean_forecast_mw
  const numbers = [
    {
      label: 'Average miss',
      value: formatMW(m.mae_mw),
      detail: `MAE over ${m.count} hours`,
      info: 'Mean absolute error: on average, how far each hourly forecast was from what happened, ignoring direction.',
    },
    {
      label: 'Bias',
      value: formatSignedMW(m.bias_mw),
      detail: m.bias_mw < 0 ? 'Forecast ran too high' : 'Forecast ran too low',
      info: 'Mean of actual − forecast. Negative means the forecast was systematically too high, so you would tend to be short of wind and buy the gap later at a higher price.',
    },
    {
      label: 'Error as % of output',
      value: formatPct(m.wape_pct),
      detail: 'WAPE',
      info: "Total absolute error divided by total actual wind (weighted absolute percentage error). Unlike MAPE, it doesn't explode in near-calm hours.",
    },
    {
      label: 'Forecast vs actual',
      value: `${formatGW(m.mean_forecast_mw).replace(' GW', '')} → ${formatGW(m.mean_actual_mw).replace(' GW', '')}`,
      detail: 'GW, average hourly wind',
    },
  ]
  return (
    <>
      <div className="relative max-w-[820px]">
        <p className="text-eyebrow flex items-center text-ink-2">
          Shortfall buffer
          <InfoTip text="Minus the 10th percentile of hourly errors (actual − forecast). In 9 hours out of 10, actual wind was no more than this far below the forecast, so holding this much cover protects you in all but the worst 10% of hours." />
        </p>
        <h1 className="text-hero mt-3 text-ink">{formatGW(m.shortfall_buffer_mw)}</h1>
        <p className="text-lead mt-6 text-ink-2">
          To cover a wind shortfall in <span className="font-semibold text-ink">9 hours out of 10</span>, plan for up to{' '}
          <span className="font-semibold text-ink">{formatMW(m.shortfall_buffer_mw)}</span> less wind than forecast,{' '}
          {formatPct(share)} of the average forecast. Based on {summary.days} delivery days ({formatDate(summary.date_from)} to{' '}
          {formatDate(summary.date_to)}), deciding at {toHHMM(cutoff)} the day before.
        </p>
      </div>
      <dl className="mt-12 grid grid-cols-2 gap-x-6 gap-y-8 border-t border-line pt-8 lg:grid-cols-4">
        {numbers.map((n) => (
          <div key={n.label} className="relative lg:border-l lg:border-line lg:pl-6 lg:first:border-0 lg:first:pl-0">
            <dt className="text-control flex items-center text-ink-2">
              {n.label}
              {n.info && <InfoTip text={n.info} />}
            </dt>
            <dd className="mt-1.5 text-[28px] leading-[1.14] font-semibold tracking-[-0.01em] text-ink sm:text-[32px]">{n.value}</dd>
            <dd className="text-control mt-1 text-ink-2">{n.detail}</dd>
          </div>
        ))}
      </dl>
    </>
  )
}

function SecondaryTiles({ summary }: { summary: AccuracySummary }) {
  const m = summary.metrics
  return (
    <div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-1">
      <StatTile
        label="RMSE"
        value={formatMW(m.rmse_mw)}
        detail="Weights big misses more"
        info="Root mean square error. Higher than MAE when there are occasional large misses, which are the ones that cost the most."
      />
      <StatTile
        label="Typical error range"
        value={`${formatGW(m.p10_mw).replace(' GW', '')} to ${m.p90_mw > 0 ? '+' : ''}${formatGW(m.p90_mw)}`}
        detail="P10 to P90 of hourly errors"
        info="8 hours in 10 had an error (actual − forecast) inside this range. It is lopsided: shortfalls are much larger than surpluses."
      />
      <StatTile
        label="Worst hour"
        value={formatSignedMW(-m.max_shortfall_mw)}
        detail={`Best surprise ${formatSignedMW(m.max_surplus_mw)}`}
        info="The largest single-hour shortfall (actual below forecast) in the period, and the largest surplus."
      />
    </div>
  )
}

/** A chart with its query's loading and error states; in a card, or bare on a black scene. */
function ChartBlock<T>({
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
  bare = false,
}: {
  query: UseQueryResult<T>
  title?: string
  subtitle?: string
  info?: string
  label: string
  build: (data: T, theme: ChartTheme) => ChartOption
  legend?: (theme: ChartTheme) => LegendItem[]
  height?: number
  onClick?: (params: { dataIndex: number }) => void
  footer?: (data: T) => ReactNode
  bare?: boolean
}) {
  const theme = useChartTheme()
  const { data } = query
  const option = useMemo(() => (data === undefined ? null : build(data, theme)), [data, theme, build])
  const body = query.isError ? (
    <ErrorState error={query.error} onRetry={() => query.refetch()} />
  ) : option === null ? (
    <Skeleton className="" />
  ) : (
    <div className={`transition-opacity ${query.isPlaceholderData ? 'opacity-60' : ''}`}>
      {legend && <Legend items={legend(theme)} />}
      <div className="mt-3">
        <EChart option={option} label={label} height={height} onClick={onClick} />
      </div>
      {data !== undefined && footer?.(data)}
    </div>
  )
  if (bare) return body
  return (
    <Card
      title={title}
      subtitle={
        subtitle && (
          <>
            {subtitle}
            {info && <InfoTip text={info} />}
          </>
        )
      }
    >
      {option === null && !query.isError ? <Skeleton className="h-[300px]" /> : body}
    </Card>
  )
}

const buildLevel = (d: BreakdownResponse, t: ChartTheme) => levelOption(d.rows, d.bucket_width ?? 4000, t)
const buildHour = (d: BreakdownResponse, t: ChartTheme) => hourOption(d.rows, t)
const buildLead = (d: BreakdownResponse, t: ChartTheme) => leadTimeOption(d.rows, d.bucket_width ?? 6, t)
const buildDaily = (d: BreakdownResponse, t: ChartTheme) => dailyOption(d.rows, t)

function LevelChart({ cutoff }: { cutoff: string }) {
  return (
    <ChartBlock
      query={useBreakdown('level', cutoff)}
      title="Error by forecast level"
      subtitle="Average miss and bias for each 4 GW band of forecast wind."
      info="A likely cause is curtailment: when the grid can't take all the wind, wind farms are paid to turn down, while the forecast predicts what they could generate. This is a hypothesis; the data in scope can't confirm it."
      label="Bar chart of average miss and bias by forecast level; bias grows more negative as the forecast level rises."
      build={buildLevel}
      legend={(t) => maeBiasLegend(t, ['bar', 'bar'])}
      height={340}
    />
  )
}

function DistributionChart({ cutoff }: { cutoff: string }) {
  return (
    <ChartBlock
      query={useDistribution(cutoff)}
      title="Errors lean towards shortfall"
      subtitle="Hours by size of error (actual − forecast)."
      info="Each bar counts hours whose error fell in that 500 MW band. Left of zero, actual wind was below the forecast. P10, P50 and P90 mark the 10th, 50th and 90th percentiles."
      label="Histogram of hourly forecast errors, centred well below zero."
      build={distributionOption}
      height={330}
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
    <ChartBlock
      query={query}
      title="Accuracy by delivery day"
      subtitle="Average miss (bars) and bias (dots) for each day."
      label="Bar chart of average miss per delivery day, with bias dots; most days show negative bias."
      build={buildDaily}
      legend={(t) => maeBiasLegend(t, ['bar', 'dot'])}
      onClick={openDay}
      height={320}
      footer={(d) => <WorstDays data={d} cutoff={cutoff} />}
    />
  )
}

function WorstDays({ data, cutoff }: { data: BreakdownResponse; cutoff: string }) {
  const worst = [...data.rows].sort((a, b) => b.mae_mw - a.mae_mw).slice(0, 5)
  return (
    <div className="mt-8 overflow-x-auto">
      <h4 className="text-eyebrow mb-2 text-ink">Five worst days</h4>
      <table className="text-control w-full text-right tabular-nums">
        <thead className="text-ink-2">
          <tr className="border-b border-line">
            <th className="py-2.5 pr-3 text-left font-semibold">Delivery day</th>
            <th className="px-3 font-semibold">Average miss</th>
            <th className="px-3 font-semibold">Bias</th>
            <th className="pl-3 font-semibold">Worst 10% of hours beyond</th>
          </tr>
        </thead>
        <tbody className="text-ink">
          {worst.map((row) => (
            <tr key={String(row.key)} className="border-b border-line last:border-0">
              <td className="py-2 pr-3 text-left">
                <Link to={`/?date=${row.key}&cutoff=${cutoff}`} className="text-link hover:underline">
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
    <ChartBlock
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
    <ChartBlock
      query={useBreakdown('lead_time', cutoff)}
      title="By hours ahead"
      subtitle="Closer to delivery is better, but the bias stays."
      info="Uses all forecast publishes, not only the one available at the decision time, so it shows how accuracy changes with horizon. The miss shrinks closer to delivery, but the negative bias is there at every horizon, so it is structural rather than a weather-forecasting limit."
      label="Line chart of average miss and bias by forecast lead time; the miss rises with lead time and bias is negative throughout."
      build={buildLead}
      legend={(t) => maeBiasLegend(t, ['line', 'line'])}
    />
  )
}

function CutoffSweep() {
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
    <Chapter tone="dark">
      <Heading
        title="Would a later forecast help?"
        sub={
          best
            ? `The most accurate morning forecast arrives from ${toHHMM(best.cutoff)}, after both auction gates have closed. It can't inform the purchase, which is why the buffer matters.`
            : 'Accuracy if the decision were made at other times on the day before.'
        }
      />
      <ChartBlock
        bare
        query={query}
        label="Step chart of average miss and shortfall buffer against decision time; both drop only after the auction gates."
        build={build}
        legend={sweepLegend}
        height={360}
      />
      <p className="text-control mt-4 text-ink-2">
        For each decision time, the whole month is re-run using the latest forecast published by then. Forecasts arrive every 2–3
        hours, so the lines step when a new one lands.
      </p>
    </Chapter>
  )
}
