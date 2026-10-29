import math

import pandas as pd
import pytest

from app.services.metrics import align, breakdown, bucket, compute_metrics, histogram, local_hour


def aligned_frame(forecast: list[float], actual: list[float]) -> pd.DataFrame:
    times = pd.date_range("2026-01-15T00:00Z", periods=len(forecast), freq="h")
    return align(
        pd.DataFrame({"start_time": times, "forecast_mw": forecast}),
        pd.DataFrame({"start_time": times, "generation_mw": actual}),
    )


def test_align_pairs_hourly_forecast_with_half_hour_starting_on_the_hour() -> None:
    forecast = pd.DataFrame(
        {
            "start_time": pd.to_datetime(["2026-01-15T00:00Z", "2026-01-15T01:00Z"], utc=True),
            "forecast_mw": [100.0, 200.0],
            "publish_time": pd.Timestamp("2026-01-14T09:30Z"),
        }
    )
    actuals = pd.DataFrame(
        {
            "start_time": pd.to_datetime(["2026-01-15T00:00Z", "2026-01-15T00:30Z"], utc=True),
            "generation_mw": [90.0, 999.0],
        }
    )
    result = align(forecast, actuals)
    assert result[["forecast_mw", "actual_mw", "error_mw"]].values.tolist() == [[100, 90, -10]]
    assert "publish_time" in result  # extra columns survive


def test_compute_metrics_by_hand() -> None:
    # errors (actual - forecast): -200, 0, 200, 400
    m = compute_metrics(aligned_frame([1200, 1000, 800, 600], [1000, 1000, 1000, 1000]))
    assert m.count == 4
    assert m.mae_mw == 200
    assert m.rmse_mw == pytest.approx(math.sqrt((200**2 + 0 + 200**2 + 400**2) / 4))
    assert m.bias_mw == 100
    assert m.wape_pct == 20  # 800 / 4000
    assert m.p10_mw == pytest.approx(-140)  # linear interpolation between -200 and 0
    assert m.p50_mw == 100
    assert m.max_shortfall_mw == 200
    assert m.max_surplus_mw == 400
    assert m.shortfall_buffer_mw == pytest.approx(140)


def test_buffer_is_zero_when_forecasts_never_overshoot() -> None:
    m = compute_metrics(aligned_frame([100, 100], [150, 200]))
    assert m.max_shortfall_mw == 0
    assert m.shortfall_buffer_mw == 0


def test_compute_metrics_rejects_empty() -> None:
    with pytest.raises(ValueError):
        compute_metrics(aligned_frame([], []))


def test_breakdown_by_local_hour() -> None:
    aligned = aligned_frame([100, 100, 100], [90, 130, 100])
    table = breakdown(aligned, local_hour(aligned), "hour")
    assert table["hour"].tolist() == [0, 1, 2]
    assert table["mae_mw"].tolist() == [10, 30, 0]
    assert table["bias_mw"].tolist() == [-10, 30, 0]


def test_bucket_uses_left_edges() -> None:
    assert bucket(pd.Series([0.5, 5.9, 6.0, 37.5]), 6).tolist() == [0, 0, 6, 36]


def test_histogram_bins_are_aligned_and_complete() -> None:
    table = histogram(pd.Series([-600.0, -100.0, 0.0, 499.0, 500.0]), bin_width_mw=500)
    assert table["left_mw"].tolist() == [-1000, -500, 0, 500]
    assert table["count"].tolist() == [1, 1, 2, 1]
    assert table["count"].sum() == 5
