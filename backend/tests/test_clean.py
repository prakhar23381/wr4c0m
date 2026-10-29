from datetime import UTC, datetime

import pandas as pd

from app.ingestion.clean import clean_actuals, clean_forecasts, within


def actual(start: str, generation: float, publish: str, fuel: str = "WIND") -> dict:
    return {"startTime": start, "publishTime": publish, "fuelType": fuel, "generation": generation}


def forecast(publish: str, start: str, generation: float) -> dict:
    return {"publishTime": publish, "startTime": start, "generation": generation}


def test_actuals_keep_latest_revision_and_only_wind() -> None:
    df = clean_actuals(
        [
            actual("2026-01-02T00:30:00Z", 200, "2026-01-02T01:00:00Z"),
            actual("2026-01-02T00:00:00Z", 100, "2026-01-02T00:30:00Z"),
            actual("2026-01-02T00:00:00Z", 110, "2026-01-02T02:00:00Z"),  # later revision
            actual("2026-01-02T00:00:00Z", 999, "2026-01-02T00:30:00Z", fuel="CCGT"),
        ]
    )
    assert list(df.columns) == ["start_time", "generation_mw"]
    assert df["generation_mw"].tolist() == [110, 200]
    assert df["start_time"].is_monotonic_increasing
    assert str(df["start_time"].dt.tz) == "UTC"


def test_forecasts_drop_past_targets_and_compute_lead_time() -> None:
    df = clean_forecasts(
        [
            forecast("2026-01-01T09:30:00Z", "2026-01-01T08:00:00Z", 1),  # backcast: dropped
            forecast("2026-01-01T09:30:00Z", "2026-01-01T10:00:00Z", 2),
            forecast("2026-01-01T09:30:00Z", "2026-01-02T12:00:00Z", 3),
            forecast("2026-01-01T09:30:00Z", "2026-01-02T12:00:00Z", 3),  # chunk-boundary dup
        ]
    )
    assert df["generation_mw"].tolist() == [2, 3]
    assert df["lead_time_h"].tolist() == [0.5, 26.5]


def test_empty_inputs_give_empty_frames_with_columns() -> None:
    assert clean_actuals([]).empty
    assert list(clean_forecasts([]).columns) == [
        "publish_time",
        "start_time",
        "generation_mw",
        "lead_time_h",
    ]


def test_within_is_half_open() -> None:
    times = pd.to_datetime(
        ["2026-01-01T23:30Z", "2026-01-02T00:00Z", "2026-01-03T00:00Z"], utc=True
    )
    df = pd.DataFrame({"start_time": times})
    start, end = datetime(2026, 1, 2, tzinfo=UTC), datetime(2026, 1, 3, tzinfo=UTC)
    assert within(df, "start_time", start, end)["start_time"].tolist() == [times[1]]
