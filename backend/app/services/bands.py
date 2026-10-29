"""Uncertainty band around a forecast, from historical errors at similar wind levels.

Errors grow with the forecast level (likely curtailment at high wind), so one global band
would be too wide on calm days and too narrow on windy ones. Instead, each forecast value
gets the error quantiles of historical forecasts in the same level bucket.
"""

import pandas as pd

from app.services.metrics import bucket

LEVEL_BUCKET_MW = 4000
MIN_BUCKET_COUNT = 30
QUANTILES = [0.1, 0.5, 0.9]
BAND_COLUMNS = ["p10_mw", "p50_mw", "p90_mw"]


def error_band(
    history: pd.DataFrame,
    forecast_mw: pd.Series,
    bucket_width_mw: float = LEVEL_BUCKET_MW,
    min_count: int = MIN_BUCKET_COUNT,
) -> pd.DataFrame:
    """Plausible actual generation for each forecast value: forecast + historical error quantiles.

    ``history`` is an aligned frame (``forecast_mw``, ``error_mw``). Buckets with fewer than
    ``min_count`` samples fall back to the quantiles over all of ``history``. Values are
    floored at 0 MW.
    """
    global_offsets = history["error_mw"].quantile(QUANTILES).to_numpy()
    groups = history.groupby(bucket(history["forecast_mw"], bucket_width_mw))["error_mw"]
    counts = groups.size()
    bucket_offsets = groups.quantile(pd.Index(QUANTILES)).unstack()

    rows = []
    for value, level in zip(forecast_mw, bucket(forecast_mw, bucket_width_mw), strict=True):
        offsets = (
            bucket_offsets.loc[level].to_numpy()
            if counts.get(level, 0) >= min_count
            else global_offsets
        )
        rows.append(value + offsets)
    band = pd.DataFrame(rows, columns=BAND_COLUMNS, index=forecast_mw.index, dtype="float64")
    return band.clip(lower=0)
