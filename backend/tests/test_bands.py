import pandas as pd
import pytest

from app.services.bands import error_band


def history(levels_and_errors: list[tuple[float, float]]) -> pd.DataFrame:
    return pd.DataFrame(levels_and_errors, columns=["forecast_mw", "error_mw"])


def test_band_uses_errors_from_the_same_level_bucket() -> None:
    calm = [(2_000.0, e) for e in range(-10, 11)]  # errors -10..10, symmetric
    windy = [(18_000.0, e) for e in range(-3_000, -2_979)]  # errors around -2990
    band = error_band(
        history(calm + windy), pd.Series([1_000.0, 17_000.0]), bucket_width_mw=4000, min_count=5
    )
    assert band.loc[0].tolist() == pytest.approx([1_000 - 8, 1_000, 1_000 + 8])
    assert band.loc[1, "p50_mw"] == pytest.approx(17_000 - 2_990)
    assert band.loc[1, "p90_mw"] < 17_000  # windy band sits entirely below the forecast


def test_sparse_buckets_fall_back_to_global_quantiles() -> None:
    data = history([(2_000.0, e) for e in range(-10, 11)] + [(30_000.0, -5_000.0)])
    band = error_band(data, pd.Series([30_000.0]), bucket_width_mw=4000, min_count=5)
    expected = data["error_mw"].quantile([0.1, 0.5, 0.9]).to_numpy() + 30_000
    assert band.loc[0].tolist() == pytest.approx(expected.tolist())


def test_band_is_floored_at_zero_and_keeps_index() -> None:
    data = history([(500.0, -1_000.0)] * 10)
    band = error_band(data, pd.Series([500.0], index=[7]), min_count=5)
    assert band.index.tolist() == [7]
    assert band.loc[7].tolist() == [0, 0, 0]
