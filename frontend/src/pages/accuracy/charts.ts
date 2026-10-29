import type { BreakdownRow, CutoffSweepRow, DistributionResponse } from '../../api/types'
import {
  bar,
  baseOption,
  categoryAxis,
  type ChartTheme,
  type LegendItem,
  tooltipRow,
  tooltipTitle,
  valueAxis,
  withAlpha,
} from '../../lib/chartTheme'
import { formatAxisMW, formatMW, formatPct, formatSignedMW } from '../../lib/format'
import { formatDateShort, toHHMM } from '../../lib/time'

// Series identity on this page: average miss (MAE) is blue, bias (actual − forecast) is red.
export const MAE = 'Average miss (MAE)'
export const BIAS = 'Bias (actual − forecast)'

export const maeBiasLegend = (t: ChartTheme, shapes: [LegendItem['shape'], LegendItem['shape']]): LegendItem[] => [
  { label: MAE, color: t.forecast, shape: shapes[0] },
  { label: BIAS, color: t.shortfall, shape: shapes[1] },
]

type Params = { dataIndex: number }[]

const gw = (mw: number) => String(mw / 1000)

/** Base chrome with space under the plot for an x-axis title. */
const withAxisTitle = (t: ChartTheme) => {
  const base = baseOption(t)
  return { ...base, grid: { ...base.grid, bottom: 28 } }
}

function maeBiasTooltip(t: ChartTheme, rows: BreakdownRow[], title: (row: BreakdownRow) => string) {
  return (params: Params) => {
    const row = rows[params[0]?.dataIndex ?? 0]
    return [
      tooltipTitle(title(row)),
      tooltipRow(t.forecast, 'Average miss', formatMW(row.mae_mw)),
      tooltipRow(t.shortfall, 'Bias', formatSignedMW(row.bias_mw)),
      tooltipRow(null, '8 in 10 errors between', `${formatSignedMW(row.p10_mw)} and ${formatSignedMW(row.p90_mw)}`),
      tooltipRow(null, 'Hours', String(row.count)),
    ].join('')
  }
}

const lineSeries = (name: string, color: string, data: number[]) => ({
  name,
  type: 'line',
  data,
  symbol: 'circle',
  symbolSize: 8,
  lineStyle: { color, width: 2, cap: 'round', join: 'round' },
  itemStyle: { color, borderColor: 'transparent' },
  emphasis: { disabled: true },
})

const barSeries = (name: string, color: string, data: number[]) => ({
  name,
  type: 'bar',
  barMaxWidth: 24,
  barGap: '15%',
  itemStyle: { color },
  data: data.map((value) => bar(value, color)),
})

function withSurfaceRing<T extends { itemStyle: object }>(series: T, t: ChartTheme): T {
  return { ...series, itemStyle: { ...series.itemStyle, borderColor: t.surface, borderWidth: 2 } }
}

/** MAE and bias per forecast-level bucket: the "windy days are over-forecast" chart. */
export function levelOption(rows: BreakdownRow[], width: number, t: ChartTheme) {
  const labels = rows.map((r) => `${gw(Number(r.key))}–${gw(Number(r.key) + width)}`)
  return {
    ...withAxisTitle(t),
    tooltip: { ...baseOption(t).tooltip, axisPointer: { type: 'shadow', shadowStyle: { color: withAlpha(t.muted, 0.08) } }, formatter: maeBiasTooltip(t, rows, (r) => `Forecast ${labels[rows.indexOf(r)]} GW`) },
    xAxis: categoryAxis(t, labels, { name: 'Forecast level (GW)', nameLocation: 'middle', nameGap: 28, axisLabel: { color: t.muted, interval: 0 } }),
    yAxis: valueAxis(t, { name: 'MW' }),
    series: [
      barSeries(MAE, t.forecast, rows.map((r) => r.mae_mw)),
      barSeries(BIAS, t.shortfall, rows.map((r) => r.bias_mw)),
    ],
  }
}

/** Histogram of hourly errors with P10 / P50 / P90 and zero markers. */
export function distributionOption(d: DistributionResponse, t: ChartTheme) {
  const first = d.bins[0]?.left_mw ?? 0
  // Category axis: bin i spans index i − 0.5 … i + 0.5, so a value maps to a fractional index.
  const position = (mw: number) => (mw - first) / d.bin_width_mw - 0.5
  const marker = (mw: number, label: string, color: string) => ({
    xAxis: position(mw),
    lineStyle: { color, width: 1, type: 'solid' },
    label: { formatter: label, color: t.ink2, fontSize: 11, position: 'end' },
  })
  const base = withAxisTitle(t)
  return {
    ...base,
    tooltip: {
      ...baseOption(t).tooltip,
      axisPointer: { type: 'shadow', shadowStyle: { color: withAlpha(t.muted, 0.08) } },
      formatter: (params: Params) => {
        const b = d.bins[params[0]?.dataIndex ?? 0]
        return [
          tooltipTitle(`${formatSignedMW(b.left_mw)} to ${formatSignedMW(b.right_mw)}`),
          tooltipRow(t.forecast, 'Hours', `${b.count} (${formatPct((100 * b.count) / d.count)})`),
        ].join('')
      },
    },
    xAxis: categoryAxis(t, d.bins.map((b) => formatAxisMW(b.left_mw)), {
      name: 'Actual − forecast (MW)',
      nameLocation: 'middle',
      nameGap: 28,
    }),
    yAxis: valueAxis(t, { name: 'Hours', axisLabel: { color: t.muted } }),
    series: [
      {
        name: 'Hours',
        type: 'bar',
        barCategoryGap: 2,
        itemStyle: { color: t.forecast, borderRadius: [4, 4, 0, 0] },
        data: d.bins.map((b) => b.count),
        markLine: {
          silent: true,
          symbol: 'none',
          data: [
            // Zero is labelled by the axis; only the percentiles get a label.
            { ...marker(0, '', t.axis), label: { show: false } },
            marker(d.p10_mw, `P10 ${formatSignedMW(d.p10_mw)}`, t.ink2),
            marker(d.p50_mw, 'P50', t.ink2),
            marker(d.p90_mw, 'P90', t.ink2),
          ],
        },
      },
    ],
  }
}

/** Daily MAE (bars) and bias (dots); clicking a day opens it in the Decision View. */
export function dailyOption(rows: BreakdownRow[], t: ChartTheme) {
  const labels = rows.map((r) => formatDateShort(String(r.key)))
  return {
    ...baseOption(t),
    tooltip: {
      ...baseOption(t).tooltip,
      axisPointer: { type: 'shadow', shadowStyle: { color: withAlpha(t.muted, 0.08) } },
      formatter: (params: Params) =>
        maeBiasTooltip(t, rows, (r) => `${formatDateShort(String(r.key))} · click to open`)(params),
    },
    xAxis: categoryAxis(t, labels),
    yAxis: valueAxis(t, { name: 'MW' }),
    series: [
      barSeries(MAE, t.forecast, rows.map((r) => r.mae_mw)),
      withSurfaceRing({ ...lineSeries(BIAS, t.shortfall, rows.map((r) => r.bias_mw)), lineStyle: { width: 0 } }, t),
    ],
  }
}

export function hourOption(rows: BreakdownRow[], t: ChartTheme) {
  const labels = rows.map((r) => `${String(r.key).padStart(2, '0')}:00`)
  return {
    ...baseOption(t),
    tooltip: { ...baseOption(t).tooltip, formatter: maeBiasTooltip(t, rows, (r) => `${labels[rows.indexOf(r)]} UK`) },
    xAxis: categoryAxis(t, labels, { boundaryGap: false, axisLabel: { color: t.muted, interval: 2 } }),
    yAxis: valueAxis(t, { name: 'MW' }),
    series: [
      withSurfaceRing(lineSeries(MAE, t.forecast, rows.map((r) => r.mae_mw)), t),
      withSurfaceRing(lineSeries(BIAS, t.shortfall, rows.map((r) => r.bias_mw)), t),
    ],
  }
}

export function leadTimeOption(rows: BreakdownRow[], width: number, t: ChartTheme) {
  const labels = rows.map((r) => `${r.key}–${Number(r.key) + width} h`)
  return {
    ...withAxisTitle(t),
    tooltip: { ...baseOption(t).tooltip, formatter: maeBiasTooltip(t, rows, (r) => `${labels[rows.indexOf(r)]} ahead`) },
    xAxis: categoryAxis(t, labels, { name: 'Hours ahead of delivery', nameLocation: 'middle', nameGap: 28, boundaryGap: false }),
    yAxis: valueAxis(t, { name: 'MW' }),
    series: [
      withSurfaceRing(lineSeries(MAE, t.forecast, rows.map((r) => r.mae_mw)), t),
      withSurfaceRing(lineSeries(BIAS, t.shortfall, rows.map((r) => r.bias_mw)), t),
    ],
  }
}

export const BUFFER = 'Shortfall buffer (−P10)'

export const sweepLegend = (t: ChartTheme): LegendItem[] => [
  { label: MAE, color: t.forecast, shape: 'line' },
  { label: BUFFER, color: t.shortfall, shape: 'line' },
]

/** Accuracy if the decision were made at other times on D-1, with the auction gates marked. */
export function cutoffSweepOption(rows: CutoffSweepRow[], gates: { time: string; label: string }[], t: ChartTheme) {
  const labels = rows.map((r) => toHHMM(r.cutoff))
  const latestGate = [...gates].map((g) => g.time).sort().at(-1)
  return {
    ...withAxisTitle(t),
    tooltip: {
      ...baseOption(t).tooltip,
      formatter: (params: Params) => {
        const row = rows[params[0]?.dataIndex ?? 0]
        return [
          tooltipTitle(`Deciding at ${toHHMM(row.cutoff)} UK`),
          tooltipRow(null, 'Forecast used (UTC)', row.publish_times_used.join(', ')),
          tooltipRow(t.forecast, 'Average miss', formatMW(row.mae_mw)),
          tooltipRow(t.shortfall, 'Shortfall buffer', formatMW(row.shortfall_buffer_mw)),
          tooltipRow(null, 'Bias', formatSignedMW(row.bias_mw)),
        ].join('')
      },
    },
    xAxis: categoryAxis(t, labels, { name: 'Decision time on the day before (UK)', nameLocation: 'middle', nameGap: 28, boundaryGap: false }),
    yAxis: valueAxis(t, { name: 'MW', min: 0 }),
    series: [
      {
        ...withSurfaceRing(lineSeries(MAE, t.forecast, rows.map((r) => r.mae_mw)), t),
        step: 'end',
        markLine: {
          silent: true,
          symbol: 'none',
          data: gates.map((g) => ({
            xAxis: g.time,
            lineStyle: { color: t.ink2, width: 1, type: 'solid' },
            label: { formatter: g.label, color: t.ink2, fontSize: 11, position: 'end' },
          })),
        },
        markArea: latestGate && {
          silent: true,
          itemStyle: { color: withAlpha(t.muted, 0.1) },
          label: { formatter: 'Too late for the auction', color: t.muted, fontSize: 11, position: 'insideBottom', offset: [0, -8] },
          data: [[{ xAxis: latestGate }, { xAxis: labels.at(-1) }]],
        },
      },
      { ...withSurfaceRing(lineSeries(BUFFER, t.shortfall, rows.map((r) => r.shortfall_buffer_mw)), t), step: 'end' },
    ],
  }
}
