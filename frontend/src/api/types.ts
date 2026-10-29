// Mirrors backend/app/api/schemas.py. Datetimes are ISO-8601 UTC strings; dates (YYYY-MM-DD)
// are UK delivery days; times are "HH:MM:SS" UK local time.

export interface CutoffPreset {
  label: string
  time: string
  note: string
}

export interface Meta {
  decision_first_day: string
  decision_last_day: string
  delivery_first_day: string
  delivery_last_day: string
  timezone: string
  default_cutoff: string
  cutoff_presets: CutoffPreset[]
  data_built_at: string
  source: string
  forecast_publishes: number
  late_publishes: string[]
}

export interface ForecastHour {
  start_time: string
  forecast_mw: number
  lead_time_h: number
  p10_mw: number
  p50_mw: number
  p90_mw: number
  actual_mw: number | null
  error_mw: number | null
}

export interface ActualPoint {
  start_time: string
  generation_mw: number
}

export interface DaySummary {
  forecast_energy_mwh: number
  p10_energy_mwh: number
  forecast_min_mw: number
  forecast_max_mw: number
  actual_energy_mwh: number | null
  mae_mw: number | null
  bias_mw: number | null
}

export interface DecisionResponse {
  delivery_date: string
  cutoff: string
  publish_time: string | null
  forecast_age_h: number | null
  missing_hours: string[]
  band_basis: string
  hours: ForecastHour[]
  actuals: ActualPoint[]
  summary: DaySummary | null
}

export interface Vintage {
  publish_time: string
  available_at_cutoff: boolean
  points: { start_time: string; forecast_mw: number }[]
}

export interface VintagesResponse {
  delivery_date: string
  cutoff: string
  vintages: Vintage[]
}

export interface Metrics {
  count: number
  mae_mw: number
  rmse_mw: number
  bias_mw: number
  wape_pct: number
  p10_mw: number
  p50_mw: number
  p90_mw: number
  max_shortfall_mw: number
  max_surplus_mw: number
  shortfall_buffer_mw: number
  mean_actual_mw: number
  mean_forecast_mw: number
}

export interface AccuracySummary {
  cutoff: string
  date_from: string
  date_to: string
  days: number
  metrics: Metrics
}

export type BreakdownBy = 'hour' | 'day' | 'lead_time' | 'level'

export interface BreakdownRow {
  key: string | number
  count: number
  mae_mw: number
  rmse_mw: number
  bias_mw: number
  p10_mw: number
  p90_mw: number
}

export interface BreakdownResponse {
  by: BreakdownBy
  basis: string
  bucket_width: number | null
  rows: BreakdownRow[]
}

export interface DistributionResponse {
  cutoff: string
  count: number
  bin_width_mw: number
  p10_mw: number
  p50_mw: number
  p90_mw: number
  bins: { left_mw: number; right_mw: number; count: number }[]
}

export interface CutoffSweepRow {
  cutoff: string
  publish_times_used: string[]
  mae_mw: number
  bias_mw: number
  wape_pct: number
  shortfall_buffer_mw: number
}

export interface CutoffSweepResponse {
  rows: CutoffSweepRow[]
}
