import type { DecisionResponse, Vintage } from '../../api/types'
import {
  baseOption,
  categoryAxis,
  type ChartTheme,
  type LegendItem,
  tooltipRow,
  tooltipTitle,
  valueAxis,
  withAlpha,
} from '../../lib/chartTheme'
import { formatMW, formatSignedMW } from '../../lib/format'
import { formatClock, zoneAbbr } from '../../lib/time'

const HALF_HOUR_MS = 30 * 60 * 1000
const HOUR_MS = 2 * HALF_HOUR_MS
const TICK_LABEL = /^(00|03|06|09|12|15|18|21):00$/

type Values = (number | null)[]

export interface DecisionSeries {
  /** Half-hourly slots (epoch ms) covering the delivery day. */
  slots: number[]
  forecast: Values
  p10: Values
  p50: Values
  p90: Values
  actual: Values
}

/** Lay the hourly forecast and half-hourly actuals on one half-hourly axis. */
export function decisionSeries(decision: DecisionResponse): DecisionSeries {
  const times = new Set<number>()
  for (const hour of decision.hours) {
    const start = Date.parse(hour.start_time)
    times.add(start).add(start + HALF_HOUR_MS)
  }
  for (const point of decision.actuals) times.add(Date.parse(point.start_time))
  const slots = [...times].sort((a, b) => a - b)
  const index = new Map(slots.map((time, i) => [time, i]))
  const empty = (): Values => slots.map(() => null)
  const series = { slots, forecast: empty(), p10: empty(), p50: empty(), p90: empty(), actual: empty() }

  decision.hours.forEach((hour, i) => {
    const start = Date.parse(hour.start_time)
    const at = index.get(start)!
    const half = index.get(start + HALF_HOUR_MS)!
    series.forecast[at] = hour.forecast_mw
    series.p50[at] = hour.p50_mw
    series.p10[at] = hour.p10_mw
    series.p90[at] = hour.p90_mw
    // The band is hourly; fill the half-hour in between so the shaded area is continuous.
    const next = decision.hours[i + 1]
    const joined = next !== undefined && Date.parse(next.start_time) - start === HOUR_MS
    series.p10[half] = joined ? (hour.p10_mw + next.p10_mw) / 2 : hour.p10_mw
    series.p90[half] = joined ? (hour.p90_mw + next.p90_mw) / 2 : hour.p90_mw
  })
  for (const point of decision.actuals) {
    series.actual[index.get(Date.parse(point.start_time))!] = point.generation_mw
  }
  return series
}

export interface DecisionChartOptions {
  actuals: boolean
  band: boolean
  vintages: Vintage[] | null
}

/** The likely-range wash: a light tint on light backgrounds needs more weight on black. */
const bandAlpha = (t: ChartTheme) => (t.dark ? 0.3 : 0.16)

export const SERIES_NAMES = {
  forecast: 'Forecast at decision time',
  band: 'Likely range (P10–P90)',
  p50: 'Typical outcome (P50)',
  vintages: 'Earlier forecasts',
  actual: 'Actual wind',
}

export function decisionChartOption(
  decision: DecisionResponse,
  t: ChartTheme,
  show: DecisionChartOptions,
) {
  const s = decisionSeries(decision)
  const labels = s.slots.map((slot) => formatClock(slot))
  const line = (color: string, width = 2) => ({
    type: 'line',
    showSymbol: false,
    connectNulls: true,
    lineStyle: { color, width, cap: 'round', join: 'round' },
    itemStyle: { color },
    emphasis: { disabled: true },
  })
  const series: Record<string, unknown>[] = []

  if (show.band) {
    const width = s.p90.map((high, i) => (high === null || s.p10[i] === null ? null : high - s.p10[i]!))
    series.push(
      { ...line(t.forecast, 0), name: '_band_base', stack: 'band', data: s.p10, lineStyle: { opacity: 0 } },
      {
        ...line(t.forecast, 0),
        name: SERIES_NAMES.band,
        stack: 'band',
        data: width,
        lineStyle: { opacity: 0 },
        areaStyle: { color: withAlpha(t.forecast, bandAlpha(t)) },
      },
      { ...line(t.forecast, 1.5), name: SERIES_NAMES.p50, data: s.p50, lineStyle: { color: t.forecast, width: 1.5, type: [4, 4], opacity: 0.8 } },
    )
  }

  if (show.vintages) {
    const index = new Map(s.slots.map((time, i) => [time, i]))
    for (const vintage of show.vintages) {
      if (!vintage.available_at_cutoff || vintage.publish_time === decision.publish_time) continue
      const data: Values = s.slots.map(() => null)
      for (const point of vintage.points) {
        const at = index.get(Date.parse(point.start_time))
        if (at !== undefined) data[at] = point.forecast_mw
      }
      series.push({ ...line(t.muted, 1), name: SERIES_NAMES.vintages, data, lineStyle: { color: t.muted, width: 1, opacity: 0.55 }, z: 1 })
    }
  }

  series.push({ ...line(t.forecast), name: SERIES_NAMES.forecast, data: s.forecast, z: 3 })

  if (show.actuals) {
    series.push({ ...line(t.actual), name: SERIES_NAMES.actual, data: s.actual, z: 4 })
  }

  const errors = new Map(decision.hours.map((h) => [Date.parse(h.start_time), h.error_mw]))
  const zone = decision.hours.length ? zoneAbbr(decision.hours[0].start_time) : 'UK'
  const tooltipFormatter = (params: { dataIndex: number }[]) => {
    const i = params[0]?.dataIndex ?? 0
    const slot = s.slots[i]
    const hourly = s.forecast[i] !== null
    const rows = [
      tooltipTitle(hourly ? `${formatClock(slot)}–${formatClock(slot + HOUR_MS)} ${zone}` : `${formatClock(slot)} ${zone}`),
    ]
    if (hourly) {
      rows.push(tooltipRow(t.forecast, 'Forecast', formatMW(s.forecast[i])))
      if (show.band) {
        rows.push(tooltipRow(withAlpha(t.forecast, bandAlpha(t) + 0.2), 'Likely range', `${formatMW(s.p10[i])} – ${formatMW(s.p90[i])}`.replace(' MW –', ' –')))
        rows.push(tooltipRow(t.forecast, 'Typical (P50)', formatMW(s.p50[i])))
      }
    }
    if (show.actuals && s.actual[i] !== null) {
      rows.push(tooltipRow(t.actual, 'Actual', formatMW(s.actual[i])))
      const error = errors.get(slot)
      if (hourly && error != null) rows.push(tooltipRow(null, 'Error (actual − forecast)', formatSignedMW(error)))
    }
    return rows.join('')
  }

  const base = baseOption(t)
  return {
    ...base,
    tooltip: { ...base.tooltip, formatter: tooltipFormatter },
    xAxis: categoryAxis(t, labels, {
      boundaryGap: false,
      axisLabel: { color: t.muted, hideOverlap: true, interval: (_: number, label: string) => TICK_LABEL.test(label) },
    }),
    yAxis: valueAxis(t, { min: 0, name: 'MW' }),
    series,
  }
}

export function decisionLegend(t: ChartTheme, show: Omit<DecisionChartOptions, 'vintages'> & { vintages: boolean }): LegendItem[] {
  return [
    { label: SERIES_NAMES.forecast, color: t.forecast, shape: 'line' as const },
    ...(show.actuals ? [{ label: SERIES_NAMES.actual, color: t.actual, shape: 'line' as const }] : []),
    ...(show.band
      ? [
          { label: SERIES_NAMES.band, color: withAlpha(t.forecast, bandAlpha(t) + 0.15), shape: 'area' as const },
          { label: SERIES_NAMES.p50, color: t.forecast, shape: 'dashed' as const },
        ]
      : []),
    ...(show.vintages ? [{ label: SERIES_NAMES.vintages, color: t.muted, shape: 'line' as const }] : []),
  ]
}
