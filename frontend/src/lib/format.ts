const integer = new Intl.NumberFormat('en-GB', { maximumFractionDigits: 0 })
const oneDecimal = new Intl.NumberFormat('en-GB', { minimumFractionDigits: 1, maximumFractionDigits: 1 })

const MINUS = '−'

const sign = (value: number) => (value < 0 ? MINUS : value > 0 ? '+' : '')

/** "4,184 MW". */
export const formatMW = (value: number | null | undefined) =>
  value == null ? '–' : `${integer.format(value).replace('-', MINUS)} MW`

/** "−1,728 MW" / "+503 MW": always signed, for errors and bias. */
export const formatSignedMW = (value: number | null | undefined) =>
  value == null ? '–' : `${sign(Math.round(value))}${integer.format(Math.abs(value))} MW`

/** "4.2 GW". */
export const formatGW = (value: number | null | undefined) =>
  value == null ? '–' : `${oneDecimal.format(value / 1000).replace('-', MINUS)} GW`

/** "267,230 MWh". */
export const formatMWh = (value: number | null | undefined) =>
  value == null ? '–' : `${integer.format(value)} MWh`

/** "17.7%". */
export const formatPct = (value: number | null | undefined) =>
  value == null ? '–' : `${oneDecimal.format(value)}%`

/** "14.5 h" / "20 min". */
export function formatHours(value: number): string {
  if (value < 1) return `${Math.round(value * 60)} min`
  return `${oneDecimal.format(value).replace(/\.0$/, '')} h`
}

/** Compact axis ticks: 0 / 4k / 12k / −2k. */
export const formatAxisMW = (value: number) =>
  Math.abs(value) >= 1000 ? `${String(value / 1000).replace('-', MINUS)}k` : String(value).replace('-', MINUS)
