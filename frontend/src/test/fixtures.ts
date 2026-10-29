import type { DecisionResponse, ForecastHour, Meta } from '../api/types'

export const meta: Meta = {
  decision_first_day: '2026-01-01',
  decision_last_day: '2026-01-31',
  delivery_first_day: '2026-01-02',
  delivery_last_day: '2026-02-01',
  timezone: 'Europe/London',
  default_cutoff: '09:50:00',
  cutoff_presets: [
    { label: 'N2EX day-ahead auction', time: '09:50:00', note: 'N2EX gate' },
    { label: 'EPEX day-ahead auction', time: '09:20:00', note: 'EPEX gate (approx.)' },
  ],
  data_built_at: '2026-10-29T13:31:20Z',
  source: 'https://data.elexon.co.uk/bmrs/api/v1/datasets',
  forecast_publishes: 256,
  late_publishes: [],
}

const hour = (h: number, forecast: number, actual: number): ForecastHour => ({
  start_time: `2026-01-28T${String(h).padStart(2, '0')}:00:00Z`,
  forecast_mw: forecast,
  lead_time_h: 14.5 + h,
  p10_mw: forecast - 2000,
  p50_mw: forecast - 1000,
  p90_mw: forecast + 500,
  actual_mw: actual,
  error_mw: actual - forecast,
})

/** Two forecast hours, four half-hourly actuals. */
export const decision: DecisionResponse = {
  delivery_date: '2026-01-28',
  cutoff: '2026-01-27T09:50:00Z',
  publish_time: '2026-01-27T09:30:00Z',
  forecast_age_h: 1 / 3,
  missing_hours: [],
  band_basis: 'P10/P50/P90 of errors on the other 30 delivery days',
  hours: [hour(0, 10000, 8000), hour(1, 12000, 9000)],
  actuals: [
    { start_time: '2026-01-28T00:00:00Z', generation_mw: 8000 },
    { start_time: '2026-01-28T00:30:00Z', generation_mw: 8500 },
    { start_time: '2026-01-28T01:00:00Z', generation_mw: 9000 },
    { start_time: '2026-01-28T01:30:00Z', generation_mw: 9500 },
  ],
  summary: {
    forecast_energy_mwh: 22000,
    p10_energy_mwh: 18000,
    forecast_min_mw: 10000,
    forecast_max_mw: 12000,
    actual_energy_mwh: 17500,
    mae_mw: 2500,
    bias_mw: -2500,
  },
}
