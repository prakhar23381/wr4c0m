import { describe, expect, it } from 'vitest'

import { addDays, formatClock, formatDate, isHHMM, toHHMM, zoneAbbr } from './time'

describe('UK time helpers', () => {
  it('shows UK clock time regardless of the instant being UTC', () => {
    expect(formatClock('2026-01-27T09:30:00Z')).toBe('09:30') // GMT
    expect(formatClock('2026-07-01T08:50:00Z')).toBe('09:50') // BST
  })

  it('names the UK zone from its offset', () => {
    expect(zoneAbbr('2026-01-27T09:30:00Z')).toBe('GMT')
    expect(zoneAbbr('2026-07-01T09:30:00Z')).toBe('BST')
  })

  it('treats delivery dates as calendar dates', () => {
    expect(formatDate('2026-02-01')).toContain('1 Feb 2026')
    expect(addDays('2026-01-31', 1)).toBe('2026-02-01')
    expect(addDays('2026-01-02', -1)).toBe('2026-01-01')
  })

  it('validates and normalises cutoff times', () => {
    expect(toHHMM('09:50:00')).toBe('09:50')
    expect(isHHMM('09:20')).toBe(true)
    expect(isHHMM('25:00')).toBe(false)
    expect(isHHMM('9:20')).toBe(false)
  })
})
