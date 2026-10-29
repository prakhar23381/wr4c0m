"""Data-quality checks on the cleaned snapshot. Problems are reported, never silently fixed."""

from datetime import datetime
from typing import Any

import pandas as pd

# Sanity ceiling well above GB's metered wind fleet; anything higher is flagged.
MAX_PLAUSIBLE_MW = 35_000
# Regular WINDFOR publish times (UTC) observed in January 2026.
SCHEDULED_PUBLISH_TIMES = {"02:30", "04:30", "07:30", "09:30", "11:30", "15:30", "18:30", "22:30"}


def quality_report(
    actuals: pd.DataFrame, forecasts: pd.DataFrame, start: datetime, end: datetime
) -> dict[str, Any]:
    return {
        "actuals": _actuals_report(actuals, start, end),
        "forecasts": _forecasts_report(forecasts, start, end),
    }


def _actuals_report(actuals: pd.DataFrame, start: datetime, end: datetime) -> dict[str, Any]:
    expected = _utc_range(start, end, "30min")
    missing = expected.difference(pd.DatetimeIndex(actuals["start_time"]))
    return {
        "rows": len(actuals),
        "expected_rows": len(expected),
        "missing_start_times": [_iso(t) for t in missing],
        **_value_checks(actuals["generation_mw"]),
    }


def _forecasts_report(forecasts: pd.DataFrame, start: datetime, end: datetime) -> dict[str, Any]:
    publishes = pd.DatetimeIndex(forecasts["publish_time"].drop_duplicates().sort_values())
    off_schedule = [t for t in publishes if t.strftime("%H:%M") not in SCHEDULED_PUBLISH_TIMES]
    gaps_h = publishes.to_series().diff().dt.total_seconds().div(3600)
    expected_hours = _utc_range(start, end, "h")
    uncovered = expected_hours.difference(pd.DatetimeIndex(forecasts["start_time"].unique()))
    return {
        "rows": len(forecasts),
        "publishes": len(publishes),
        "first_publish": _iso(publishes[0]) if len(publishes) else None,
        "last_publish": _iso(publishes[-1]) if len(publishes) else None,
        "off_schedule_publishes": [_iso(t) for t in off_schedule],
        "max_gap_between_publishes_h": float(gaps_h.max()) if len(publishes) > 1 else None,
        "target_hours_without_any_forecast": [_iso(t) for t in uncovered],
        **_value_checks(forecasts["generation_mw"]),
    }


def _utc_range(start: datetime, end: datetime, freq: str) -> pd.DatetimeIndex:
    return pd.date_range(start, end, freq=freq, inclusive="left").tz_convert("UTC")


def _value_checks(values: pd.Series) -> dict[str, Any]:
    return {
        "min_mw": float(values.min()) if len(values) else None,
        "max_mw": float(values.max()) if len(values) else None,
        "negative_values": int((values < 0).sum()),
        "implausibly_high_values": int((values > MAX_PLAUSIBLE_MW).sum()),
    }


def _iso(moment: pd.Timestamp) -> str:
    return moment.strftime("%Y-%m-%dT%H:%M:%SZ")
