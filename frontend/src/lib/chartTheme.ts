import { useMemo } from 'react'

import { formatAxisMW } from './format'
import { useTheme } from './theme'
import { TONE_CLASS, useTone } from './tone'

export interface ChartTheme {
  /** True in dark mode: washes need more opacity on dark backgrounds. */
  dark: boolean
  surface: string
  ink: string
  ink2: string
  muted: string
  grid: string
  axis: string
  border: string
  forecast: string
  actual: string
  shortfall: string
}

/** Chart colours for the chapter the chart sits in, read from the CSS tokens so they follow
 *  the light/dark theme. */
export function useChartTheme(): ChartTheme {
  const tone = useTone()
  const theme = useTheme()
  return useMemo(() => {
    const dark = theme === 'dark'
    // Resolve the tokens as they apply inside this chapter, via a throwaway element.
    const probe = document.createElement('div')
    probe.className = TONE_CLASS[tone]
    document.body.appendChild(probe)
    const styles = getComputedStyle(probe)
    const token = (name: string) => styles.getPropertyValue(`--${name}`).trim()
    const colours = {
      dark,
      surface: token('card'),
      ink: token('ink'),
      ink2: token('ink-2'),
      muted: token('muted'),
      grid: token('grid'),
      axis: token('axis'),
      border: token('border'),
      forecast: token('forecast'),
      actual: token('actual'),
      shortfall: token('shortfall'),
    }
    probe.remove()
    return colours
  }, [theme, tone])
}

/** Hex colour at an opacity, for washes such as the error band. */
export function withAlpha(hex: string, alpha: number): string {
  const value = hex.replace('#', '')
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(value.slice(i, i + 2), 16))
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

const FONT = '-apple-system, BlinkMacSystemFont, "SF Pro Text", "Helvetica Neue", Helvetica, Arial, sans-serif'

/** Shared chrome: recessive axes and grid, legend top-left, themed tooltip. */
export function baseOption(t: ChartTheme) {
  return {
    animationDuration: 300,
    textStyle: { fontFamily: FONT, color: t.muted, fontSize: 12 },
    grid: { left: 4, right: 12, top: 28, bottom: 4, containLabel: true },
    // Legends are HTML (components/ui Legend), so they wrap cleanly on narrow screens.
    legend: { show: false },
    tooltip: {
      trigger: 'axis',
      backgroundColor: t.surface,
      borderColor: t.border,
      borderWidth: 0,
      padding: [10, 12],
      textStyle: { color: t.ink, fontSize: 12, fontFamily: FONT },
      extraCssText: 'border-radius: 12px; box-shadow: 0 8px 28px rgba(0,0,0,0.16);',
      axisPointer: { type: 'line', lineStyle: { color: t.axis, width: 1 } },
    },
  }
}

export function valueAxis(t: ChartTheme, extra: Record<string, unknown> = {}) {
  return {
    type: 'value',
    nameTextStyle: { color: t.muted, align: 'left' },
    axisLabel: { color: t.muted, formatter: formatAxisMW },
    splitLine: { lineStyle: { color: t.grid, width: 1 } },
    axisLine: { show: false },
    axisTick: { show: false },
    ...extra,
  }
}

export function categoryAxis(t: ChartTheme, data: string[], extra: Record<string, unknown> = {}) {
  return {
    type: 'category',
    data,
    axisLine: { lineStyle: { color: t.axis } },
    axisTick: { show: false },
    axisLabel: { color: t.muted, hideOverlap: true },
    ...extra,
  }
}

/** A bar value with its 4px rounded end on the data side (bottom for negative bars). */
export function bar(value: number, color: string) {
  return {
    value,
    itemStyle: { color, borderRadius: value < 0 ? [0, 0, 4, 4] : [4, 4, 0, 0] },
  }
}

/** One tooltip line: a colour key beside the label, the value in primary ink. */
export function tooltipRow(color: string | null, label: string, value: string): string {
  const key = color
    ? `<span style="display:inline-block;width:10px;height:3px;border-radius:2px;background:${color};margin-right:6px;vertical-align:middle"></span>`
    : '<span style="display:inline-block;width:16px"></span>'
  return `<div style="display:flex;justify-content:space-between;gap:16px;line-height:1.7"><span>${key}${label}</span><b style="font-weight:600">${value}</b></div>`
}

export const tooltipTitle = (text: string) =>
  `<div style="font-weight:600;margin-bottom:2px">${text}</div>`

export interface LegendItem {
  label: string
  color: string
  shape: 'line' | 'dashed' | 'area' | 'bar' | 'dot'
  tip?: string
}
