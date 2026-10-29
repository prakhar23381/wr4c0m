from datetime import UTC, datetime

import pandas as pd

from app.ingestion.quality import quality_report

START = datetime(2026, 1, 2, tzinfo=UTC)
END = datetime(2026, 1, 2, 2, tzinfo=UTC)


def test_reports_gaps_late_publishes_and_bad_values() -> None:
    actuals = pd.DataFrame(
        {
            "start_time": pd.to_datetime(["2026-01-02T00:00Z", "2026-01-02T01:00Z"], utc=True),
            "generation_mw": [-5.0, 40_000.0],
        }
    )
    forecasts = pd.DataFrame(
        {
            "publish_time": pd.to_datetime(["2026-01-01T09:30Z", "2026-01-01T12:25Z"], utc=True),
            "start_time": pd.to_datetime(["2026-01-02T00:00Z", "2026-01-02T00:00Z"], utc=True),
            "generation_mw": [100.0, 120.0],
        }
    )

    report = quality_report(actuals, forecasts, START, END)

    assert report["actuals"]["expected_rows"] == 4
    assert report["actuals"]["missing_start_times"] == [
        "2026-01-02T00:30:00Z",
        "2026-01-02T01:30:00Z",
    ]
    assert report["actuals"]["negative_values"] == 1
    assert report["actuals"]["implausibly_high_values"] == 1
    assert report["forecasts"]["off_schedule_publishes"] == ["2026-01-01T12:25:00Z"]
    assert report["forecasts"]["max_gap_between_publishes_h"] == 2 + 55 / 60
    assert report["forecasts"]["target_hours_without_any_forecast"] == ["2026-01-02T01:00:00Z"]
