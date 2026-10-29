from datetime import date, time

import pandas as pd
import pytest

from app.services.selection import (
    decision_forecasts,
    forecast_at_horizon,
    select_forecast_at_cutoff,
)

DELIVERY = date(2026, 1, 15)


def make_forecasts(publishes: dict[str, float], *, hours: int = 24) -> pd.DataFrame:
    """Each publish forecasts a flat ``value`` for every hour of the delivery day."""
    targets = pd.date_range("2026-01-15T00:00Z", periods=hours, freq="h")
    rows = [
        {"publish_time": pd.Timestamp(publish), "start_time": target, "generation_mw": value}
        for publish, value in publishes.items()
        for target in targets
    ]
    df = pd.DataFrame(rows)
    df["lead_time_h"] = (df["start_time"] - df["publish_time"]).dt.total_seconds() / 3600
    return df


# 14 Jan: regular 09:30 publish, then the 11:30 slot arriving late at 12:25.
FORECASTS = make_forecasts(
    {"2026-01-14T07:30Z": 700, "2026-01-14T09:30Z": 930, "2026-01-14T12:25Z": 1225}
)


@pytest.mark.parametrize(
    ("cutoff", "expected_value"),
    [
        (time(9, 20), 700),  # EPEX gate: 09:30 not yet out
        (time(9, 50), 930),  # N2EX gate
        (time(9, 30), 930),  # publish exactly at cutoff counts
        (time(12, 0), 930),  # 11:30 slot was late, so still the 09:30 forecast
        (time(12, 30), 1225),
    ],
)
def test_select_uses_actual_publish_time(cutoff: time, expected_value: float) -> None:
    result = select_forecast_at_cutoff(FORECASTS, DELIVERY, cutoff)
    assert len(result.forecast) == 24
    assert set(result.forecast["forecast_mw"]) == {expected_value}
    assert result.missing_hours == []


def test_select_reports_cutoff_and_lead_times() -> None:
    result = select_forecast_at_cutoff(FORECASTS, DELIVERY, time(9, 50))
    assert result.cutoff.isoformat() == "2026-01-14T09:50:00+00:00"
    assert result.publish_time == pd.Timestamp("2026-01-14T09:30Z")
    assert result.forecast["lead_time_h"].iloc[0] == 14.5
    assert result.forecast["lead_time_h"].iloc[-1] == 37.5


def test_select_with_nothing_published_yet() -> None:
    result = select_forecast_at_cutoff(FORECASTS, DELIVERY, time(6, 0))
    assert result.publish_time is None
    assert result.forecast.empty
    assert len(result.missing_hours) == 24


def test_select_reports_uncovered_hours() -> None:
    partial = make_forecasts({"2026-01-14T09:30Z": 1}, hours=21)
    result = select_forecast_at_cutoff(partial, DELIVERY, time(9, 50))
    assert [h.hour for h in result.missing_hours] == [21, 22, 23]


def test_select_respects_british_summer_time() -> None:
    # 1 July: 09:50 BST is 08:50 UTC, so a 09:30 UTC publish is NOT yet available.
    summer = make_forecasts({"2026-06-30T07:30Z": 1, "2026-06-30T09:30Z": 2})
    summer["start_time"] += pd.Timedelta(days=167)  # move targets to 1 July
    result = select_forecast_at_cutoff(summer, date(2026, 7, 1), time(9, 50))
    assert result.publish_time == pd.Timestamp("2026-06-30T07:30Z")


def test_bulk_selection_matches_single_day() -> None:
    bulk = decision_forecasts(FORECASTS, [DELIVERY, date(2026, 1, 1)], time(9, 50))
    single = select_forecast_at_cutoff(FORECASTS, DELIVERY, time(9, 50))
    assert set(bulk["delivery_date"]) == {DELIVERY}  # 1 Jan has no publish before its cutoff
    assert bulk["forecast_mw"].tolist() == single.forecast["forecast_mw"].tolist()
    assert (bulk["publish_time"] == single.publish_time).all()


def test_forecast_at_horizon_picks_latest_with_enough_lead() -> None:
    result = forecast_at_horizon(FORECASTS, horizon_h=16)
    first = result.iloc[0]  # 15 Jan 00:00: 12:25 publish has 11.6h lead, 09:30 has 14.5h
    assert first["forecast_mw"] == 700
    last = result.iloc[-1]  # 15 Jan 23:00: the 12:25 publish has 34.6h lead
    assert last["forecast_mw"] == 1225
    assert (result["lead_time_h"] >= 16).all()
