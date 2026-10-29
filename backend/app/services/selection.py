"""Which forecast was available when? Pure functions over the cleaned forecast table.

All timestamps in the input frames are UTC. Delivery days and cutoffs are local
(Europe/London) calendar concepts, converted to UTC instants before comparing.
"""

from collections.abc import Iterable
from dataclasses import dataclass
from datetime import date, datetime, time, timedelta
from zoneinfo import ZoneInfo

import numpy as np
import pandas as pd

from app.config import settings

DECISION_COLUMNS = [
    "delivery_date",
    "cutoff",
    "publish_time",
    "start_time",
    "forecast_mw",
    "lead_time_h",
]


def decision_cutoff(delivery_date: date, cutoff_time: time, tz: ZoneInfo = settings.tz) -> datetime:
    """The instant the purchase decision for ``delivery_date`` is made (day before, local time)."""
    return datetime.combine(delivery_date - timedelta(days=1), cutoff_time, tz)


def delivery_day_bounds(
    delivery_date: date, tz: ZoneInfo = settings.tz
) -> tuple[datetime, datetime]:
    """Local midnight to midnight, as aware datetimes (23 or 25 hours on clock-change days)."""
    start = datetime.combine(delivery_date, time(0), tz)
    return start, datetime.combine(delivery_date + timedelta(days=1), time(0), tz)


@dataclass(frozen=True)
class DecisionForecast:
    delivery_date: date
    cutoff: datetime
    publish_time: pd.Timestamp | None
    """Latest publish at or before the cutoff; None if nothing had been published yet."""
    forecast: pd.DataFrame
    """Columns ``start_time, forecast_mw, lead_time_h`` for the delivery day's hours."""
    missing_hours: list[pd.Timestamp]
    """Delivery-day hours that the selected publish does not cover."""


def select_forecast_at_cutoff(
    forecasts: pd.DataFrame,
    delivery_date: date,
    cutoff_time: time,
    tz: ZoneInfo = settings.tz,
) -> DecisionForecast:
    """The most recent forecast a trader could have used for ``delivery_date``.

    Uses the actual ``publish_time`` of each forecast (late publishes count from when they
    arrived, not from their scheduled slot). A publish exactly at the cutoff is available.
    """
    cutoff = decision_cutoff(delivery_date, cutoff_time, tz)
    day_start, day_end = delivery_day_bounds(delivery_date, tz)
    expected_hours = list(
        pd.date_range(day_start, day_end, freq="h", inclusive="left").tz_convert("UTC")
    )

    published = forecasts["publish_time"][forecasts["publish_time"] <= cutoff]
    if published.empty:
        empty = pd.DataFrame(columns=["start_time", "forecast_mw", "lead_time_h"])
        return DecisionForecast(delivery_date, cutoff, None, empty, expected_hours)

    publish_time = published.max()
    rows = forecasts[
        (forecasts["publish_time"] == publish_time)
        & (forecasts["start_time"] >= day_start)
        & (forecasts["start_time"] < day_end)
    ]
    forecast = (
        rows.rename(columns={"generation_mw": "forecast_mw"})[
            ["start_time", "forecast_mw", "lead_time_h"]
        ]
        .sort_values("start_time")
        .reset_index(drop=True)
    )
    covered = set(forecast["start_time"])
    missing = [hour for hour in expected_hours if hour not in covered]
    return DecisionForecast(delivery_date, cutoff, publish_time, forecast, missing)


def decision_forecasts(
    forecasts: pd.DataFrame,
    delivery_dates: Iterable[date],
    cutoff_time: time,
    tz: ZoneInfo = settings.tz,
) -> pd.DataFrame:
    """``select_forecast_at_cutoff`` for many delivery days at once, as one long table.

    Days with no publish before their cutoff are omitted.
    """
    publishes = np.sort(forecasts["publish_time"].unique())
    frames = []
    for delivery_date in delivery_dates:
        cutoff = pd.Timestamp(decision_cutoff(delivery_date, cutoff_time, tz)).tz_convert("UTC")
        index = np.searchsorted(publishes, cutoff, side="right") - 1
        if index < 0:
            continue
        day_start, day_end = delivery_day_bounds(delivery_date, tz)
        rows = forecasts[
            (forecasts["publish_time"] == publishes[index])
            & (forecasts["start_time"] >= day_start)
            & (forecasts["start_time"] < day_end)
        ]
        frames.append(rows.assign(delivery_date=delivery_date, cutoff=cutoff))
    if not frames:
        return pd.DataFrame(columns=DECISION_COLUMNS)
    combined = pd.concat(frames, ignore_index=True).rename(columns={"generation_mw": "forecast_mw"})
    return combined[DECISION_COLUMNS].sort_values("start_time").reset_index(drop=True)


def forecast_at_horizon(forecasts: pd.DataFrame, horizon_h: float) -> pd.DataFrame:
    """For each target hour, the latest forecast published at least ``horizon_h`` hours ahead."""
    eligible = forecasts[forecasts["lead_time_h"] >= horizon_h]
    latest = eligible.sort_values("publish_time").groupby("start_time", as_index=False).last()
    return (
        latest.rename(columns={"generation_mw": "forecast_mw"})[
            ["start_time", "publish_time", "forecast_mw", "lead_time_h"]
        ]
        .sort_values("start_time")
        .reset_index(drop=True)
    )
