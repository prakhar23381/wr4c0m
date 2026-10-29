import { describe, expect, it } from 'vitest'

import { formatAxisMW, formatGW, formatHours, formatMW, formatMWh, formatSignedMW } from './format'

describe('number formatting', () => {
  it('formats power with separators and a true minus sign', () => {
    expect(formatMW(4183.9)).toBe('4,184 MW')
    expect(formatMW(-1728)).toBe('−1,728 MW')
    expect(formatMW(null)).toBe('–')
  })

  it('always signs errors', () => {
    expect(formatSignedMW(-1728)).toBe('−1,728 MW')
    expect(formatSignedMW(503.4)).toBe('+503 MW')
    expect(formatSignedMW(0.2)).toBe('0 MW')
  })

  it('formats GW, MWh, hours and axis ticks', () => {
    expect(formatGW(4183.9)).toBe('4.2 GW')
    expect(formatMWh(267230)).toBe('267,230 MWh')
    expect(formatHours(14.5)).toBe('14.5 h')
    expect(formatHours(37)).toBe('37 h')
    expect(formatHours(1 / 3)).toBe('20 min')
    expect(formatAxisMW(-4000)).toBe('−4k')
    expect(formatAxisMW(500)).toBe('500')
  })
})
