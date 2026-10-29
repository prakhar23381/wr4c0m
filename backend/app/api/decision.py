from datetime import date

import pandas as pd
from fastapi import APIRouter

from app.api.params import Cutoff, SnapshotDep, ensure_delivery_date, records
from app.api.schemas import (
    ActualPoint,
    DaySummary,
    DecisionResponse,
    ForecastHour,
    Vintage,
    VintagePoint,
    VintagesResponse,
)
from app.config import settings
from app.ingestion.clean import within
from app.services.analysis import decision_pairs
from app.services.bands import LEVEL_BUCKET_MW, error_band
from app.services.selection import decision_cutoff, delivery_day_bounds, select_forecast_at_cutoff

router = APIRouter()


@router.get("/decision", response_model=DecisionResponse)
def decision(
    delivery_date: date,
    snapshot: SnapshotDep,
    cutoff: Cutoff = settings.default_cutoff,
) -> DecisionResponse:
    """The forecast available at the cutoff on D-1 for one delivery day, with an error band
    and (in hindsight) the actual outcome."""
    ensure_delivery_date(delivery_date)
    chosen = select_forecast_at_cutoff(snapshot.forecasts, delivery_date, cutoff)
    day_start, day_end = delivery_day_bounds(delivery_date)
    actuals = within(snapshot.actuals, "start_time", day_start, day_end)

    history = decision_pairs(cutoff)
    history = history[history["delivery_date"] != delivery_date]
    other_days = history["delivery_date"].nunique()
    band_basis = (
        f"P10/P50/P90 of decision-time forecast errors on the other {other_days} delivery days, "
        f"for forecasts at a similar wind level ({LEVEL_BUCKET_MW / 1000:.0f} GW buckets)"
    )

    hours: list[ForecastHour] = []
    summary = None
    if not chosen.forecast.empty:
        band = error_band(history, chosen.forecast["forecast_mw"])
        frame = pd.concat([chosen.forecast, band], axis=1).merge(
            actuals.rename(columns={"generation_mw": "actual_mw"}), on="start_time", how="left"
        )
        frame["error_mw"] = frame["actual_mw"] - frame["forecast_mw"]
        hours = [ForecastHour(**row) for row in records(frame)]
        summary = _summarise(frame, actuals, pd.Timedelta(day_end - day_start))

    return DecisionResponse(
        delivery_date=delivery_date,
        cutoff=chosen.cutoff,
        publish_time=chosen.publish_time,
        forecast_age_h=(
            (chosen.cutoff - chosen.publish_time).total_seconds() / 3600
            if chosen.publish_time is not None
            else None
        ),
        missing_hours=[hour.to_pydatetime() for hour in chosen.missing_hours],
        band_basis=band_basis,
        hours=hours,
        actuals=[ActualPoint(**row) for row in records(actuals)],
        summary=summary,
    )


def _summarise(frame: pd.DataFrame, actuals: pd.DataFrame, day_length: pd.Timedelta) -> DaySummary:
    errors = frame["error_mw"].dropna()
    complete = len(actuals) == day_length / pd.Timedelta("30min")
    return DaySummary(
        # Hourly MW values, so summing gives MWh.
        forecast_energy_mwh=float(frame["forecast_mw"].sum()),
        p10_energy_mwh=float(frame["p10_mw"].sum()),
        forecast_min_mw=float(frame["forecast_mw"].min()),
        forecast_max_mw=float(frame["forecast_mw"].max()),
        actual_energy_mwh=float(actuals["generation_mw"].sum() * 0.5) if complete else None,
        mae_mw=float(errors.abs().mean()) if len(errors) else None,
        bias_mw=float(errors.mean()) if len(errors) else None,
    )


@router.get("/vintages", response_model=VintagesResponse)
def vintages(
    delivery_date: date,
    snapshot: SnapshotDep,
    cutoff: Cutoff = settings.default_cutoff,
) -> VintagesResponse:
    """Every forecast publish covering the delivery day: how the forecast evolved."""
    ensure_delivery_date(delivery_date)
    cutoff_at = decision_cutoff(delivery_date, cutoff)
    day_start, day_end = delivery_day_bounds(delivery_date)
    rows = within(snapshot.forecasts, "start_time", day_start, day_end)
    return VintagesResponse(
        delivery_date=delivery_date,
        cutoff=cutoff_at,
        vintages=[
            Vintage(
                publish_time=publish_time,
                available_at_cutoff=publish_time <= cutoff_at,
                points=[
                    VintagePoint(start_time=t, forecast_mw=v)
                    for t, v in zip(group["start_time"], group["generation_mw"], strict=True)
                ],
            )
            for publish_time in sorted(rows["publish_time"].unique())
            for group in [rows[rows["publish_time"] == publish_time]]
        ],
    )
