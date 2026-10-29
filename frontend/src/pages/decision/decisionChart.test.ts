import { describe, expect, it } from 'vitest'

import type { ChartTheme } from '../../lib/chartTheme'
import { decision } from '../../test/fixtures'
import { decisionChartOption, decisionSeries, SERIES_NAMES } from './decisionChart'

const theme: ChartTheme = {
  surface: '#fcfcfb', ink: '#0b0b0b', ink2: '#52514e', muted: '#898781', grid: '#e1e0d9',
  axis: '#c3c2b7', border: '#000000', forecast: '#2a78d6', actual: '#eb6834', shortfall: '#e34948',
}

describe('decisionSeries', () => {
  it('puts hourly forecasts and half-hourly actuals on one half-hourly axis', () => {
    const s = decisionSeries(decision)
    expect(s.slots).toHaveLength(4)
    expect(s.forecast).toEqual([10000, null, 12000, null])
    expect(s.actual).toEqual([8000, 8500, 9000, 9500])
  })

  it('fills the band between hours so it is continuous', () => {
    const s = decisionSeries(decision)
    expect(s.p10).toEqual([8000, 9000, 10000, 10000])
    expect(s.p50).toEqual([9000, null, 11000, null])
  })
})

describe('decisionChartOption', () => {
  const names = (option: ReturnType<typeof decisionChartOption>) =>
    option.series.map((series) => series.name)

  it('hides actuals when hindsight is off', () => {
    const option = decisionChartOption(decision, theme, { actuals: false, band: true, vintages: null })
    expect(names(option)).not.toContain(SERIES_NAMES.actual)
    expect(names(option)).toContain(SERIES_NAMES.band)
  })

  it('shows only earlier forecasts that were available at the cutoff', () => {
    const point = { start_time: '2026-01-28T00:00:00Z', forecast_mw: 1 }
    const option = decisionChartOption(decision, theme, {
      actuals: true,
      band: false,
      vintages: [
        { publish_time: '2026-01-27T07:30:00Z', available_at_cutoff: true, points: [point] },
        { publish_time: decision.publish_time!, available_at_cutoff: true, points: [point] },
        { publish_time: '2026-01-27T11:30:00Z', available_at_cutoff: false, points: [point] },
      ],
    })
    expect(names(option).filter((n) => n === SERIES_NAMES.vintages)).toHaveLength(1)
  })
})
