// All times are shown in UK local time (the market's clock), whatever the viewer's timezone.
export const UK_TZ = 'Europe/London'

const formatter = (options: Intl.DateTimeFormatOptions) =>
  new Intl.DateTimeFormat('en-GB', { timeZone: UK_TZ, ...options })

const clock = formatter({ hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
const dayTime = formatter({ weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
const zoneOffset = formatter({ timeZoneName: 'shortOffset' })
// Delivery dates are calendar dates, so format them without a timezone shift.
const calendar = new Intl.DateTimeFormat('en-GB', { timeZone: 'UTC', weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })
const calendarShort = new Intl.DateTimeFormat('en-GB', { timeZone: 'UTC', day: 'numeric', month: 'short' })

const toDate = (value: string | number) => new Date(value)

/** "09:30" in UK time. */
export const formatClock = (value: string | number) => clock.format(toDate(value))

/** "Tue 27 Jan, 09:30" in UK time. */
export const formatDayTime = (value: string | number) => dayTime.format(toDate(value)).replace(' at', ',')

/** "GMT" or "BST" at that instant. Derived from the offset, since browsers disagree on
 *  short zone names ("GMT" vs "GMT+0"). */
export function zoneAbbr(value: string | number): string {
  const offset = zoneOffset.formatToParts(toDate(value)).find((p) => p.type === 'timeZoneName')?.value
  return offset === 'GMT+1' ? 'BST' : 'GMT'
}

/** "Wed 28 Jan 2026" for a YYYY-MM-DD delivery date. */
export const formatDate = (isoDate: string) => calendar.format(new Date(`${isoDate}T00:00:00Z`))

/** "28 Jan" for a YYYY-MM-DD delivery date. */
export const formatDateShort = (isoDate: string) => calendarShort.format(new Date(`${isoDate}T00:00:00Z`))

/** Shift a YYYY-MM-DD date by whole days. */
export function addDays(isoDate: string, days: number): string {
  const date = new Date(`${isoDate}T00:00:00Z`)
  date.setUTCDate(date.getUTCDate() + days)
  return date.toISOString().slice(0, 10)
}

/** "09:50:00" or "09:50" → "09:50". */
export const toHHMM = (time: string) => time.slice(0, 5)

export const isHHMM = (value: string) => /^([01]\d|2[0-3]):[0-5]\d$/.test(value)

const calendarLong = new Intl.DateTimeFormat('en-GB', { timeZone: 'UTC', weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })

/** "Wednesday 28 January 2026" for a YYYY-MM-DD delivery date. */
export const formatDateLong = (isoDate: string) => calendarLong.format(new Date(`${isoDate}T00:00:00Z`)).replace(',', '')
