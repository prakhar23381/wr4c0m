"""Response models. Times are ISO-8601 UTC; dates are local (Europe/London) delivery days."""

from datetime import date, datetime, time
from typing import Literal

from pydantic import BaseModel, Field

BreakdownBy = Literal["hour", "day", "lead_time", "level"]


class CutoffPreset(BaseModel):
    label: str
    time: time
    note: str


class Meta(BaseModel):
    decision_first_day: date
    decision_last_day: date
    delivery_first_day: date
    delivery_last_day: date
    timezone: str
    default_cutoff: time
    cutoff_presets: list[CutoffPreset]
    data_built_at: datetime
    source: str
    forecast_publishes: int
    late_publishes: list[datetime]


class ForecastHour(BaseModel):
    start_time: datetime
    forecast_mw: float
    lead_time_h: float
    p10_mw: float = Field(description="Low case: forecast + historical P10 error at this level")
    p50_mw: float = Field(description="Bias-adjusted: forecast + historical median error")
    p90_mw: float = Field(description="High case: forecast + historical P90 error at this level")
    actual_mw: float | None
    error_mw: float | None = Field(description="actual - forecast; negative = wind shortfall")


class ActualPoint(BaseModel):
    start_time: datetime
    generation_mw: float


class DaySummary(BaseModel):
    forecast_energy_mwh: float
    p10_energy_mwh: float = Field(description="Sum of hourly P10 values (a cautious low case)")
    forecast_min_mw: float
    forecast_max_mw: float
    actual_energy_mwh: float | None = Field(description="Only when all half-hours are present")
    mae_mw: float | None
    bias_mw: float | None


class DecisionResponse(BaseModel):
    delivery_date: date
    cutoff: datetime
    publish_time: datetime | None = Field(description="Forecast used: latest publish <= cutoff")
    forecast_age_h: float | None = Field(description="Hours between that publish and the cutoff")
    missing_hours: list[datetime]
    band_basis: str
    hours: list[ForecastHour]
    actuals: list[ActualPoint]
    summary: DaySummary | None


class VintagePoint(BaseModel):
    start_time: datetime
    forecast_mw: float


class Vintage(BaseModel):
    publish_time: datetime
    available_at_cutoff: bool
    points: list[VintagePoint]


class VintagesResponse(BaseModel):
    delivery_date: date
    cutoff: datetime
    vintages: list[Vintage]


class Metrics(BaseModel):
    count: int
    mae_mw: float
    rmse_mw: float
    bias_mw: float
    wape_pct: float
    p10_mw: float
    p50_mw: float
    p90_mw: float
    max_shortfall_mw: float
    max_surplus_mw: float
    shortfall_buffer_mw: float
    mean_actual_mw: float
    mean_forecast_mw: float


class AccuracySummary(BaseModel):
    cutoff: time
    date_from: date
    date_to: date
    days: int
    metrics: Metrics


class BreakdownRow(BaseModel):
    key: date | float
    count: int
    mae_mw: float
    rmse_mw: float
    bias_mw: float
    p10_mw: float
    p90_mw: float


class BreakdownResponse(BaseModel):
    by: BreakdownBy
    basis: str
    bucket_width: float | None = Field(description="Bucket size for lead_time (h) / level (MW)")
    rows: list[BreakdownRow]


class HistogramBin(BaseModel):
    left_mw: float
    right_mw: float
    count: int


class DistributionResponse(BaseModel):
    cutoff: time
    count: int
    bin_width_mw: float
    p10_mw: float
    p50_mw: float
    p90_mw: float
    bins: list[HistogramBin]


class CutoffSweepRow(BaseModel):
    cutoff: time
    publish_times_used: list[str] = Field(description="Distinct publish slots (UTC HH:MM) used")
    mae_mw: float
    bias_mw: float
    wape_pct: float
    shortfall_buffer_mw: float


class CutoffSweepResponse(BaseModel):
    rows: list[CutoffSweepRow]
