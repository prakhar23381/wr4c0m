"""Forecast error statistics.

Sign convention: ``error = actual - forecast``. A negative error is a wind *shortfall*
(less wind than forecast), which is the costly direction for a buyer: the gap has to be
bought later in intraday or imbalance markets.
"""

from dataclasses import dataclass
from zoneinfo import ZoneInfo

import numpy as np
import pandas as pd

from app.config import settings


def align(forecast: pd.DataFrame, actuals: pd.DataFrame) -> pd.DataFrame:
    """Pair each forecast row with the actual for the same ``start_time``.

    WINDFOR is hourly and FUELHH half-hourly, so each forecast hour is compared with the
    half-hour starting on the hour. Forecast hours without an actual are dropped. Extra
    forecast columns are kept; ``actual_mw`` and ``error_mw`` are added.
    """
    merged = forecast.merge(
        actuals.rename(columns={"generation_mw": "actual_mw"}), on="start_time", how="inner"
    )
    merged["error_mw"] = merged["actual_mw"] - merged["forecast_mw"]
    return merged


@dataclass(frozen=True)
class ErrorMetrics:
    count: int
    mae_mw: float
    rmse_mw: float
    bias_mw: float
    """Mean error. Negative means forecasts were too optimistic on average."""
    wape_pct: float
    """Total absolute error as a % of total actual generation (robust at low wind, unlike MAPE)."""
    p10_mw: float
    p50_mw: float
    p90_mw: float
    max_shortfall_mw: float
    """Largest amount by which actual wind fell below forecast (0 if it never did)."""
    max_surplus_mw: float
    shortfall_buffer_mw: float
    """Buffer above which actual wind fell short of forecast in only 10% of hours: max(0, -P10)."""


def compute_metrics(aligned: pd.DataFrame) -> ErrorMetrics:
    if aligned.empty:
        raise ValueError("No forecast/actual pairs to evaluate")
    error = aligned["error_mw"]
    p10, p50, p90 = error.quantile([0.1, 0.5, 0.9])
    return ErrorMetrics(
        count=len(error),
        mae_mw=float(error.abs().mean()),
        rmse_mw=float(np.sqrt((error**2).mean())),
        bias_mw=float(error.mean()),
        wape_pct=float(error.abs().sum() / aligned["actual_mw"].sum() * 100),
        p10_mw=float(p10),
        p50_mw=float(p50),
        p90_mw=float(p90),
        max_shortfall_mw=float(max(0.0, -error.min())),
        max_surplus_mw=float(max(0.0, error.max())),
        shortfall_buffer_mw=float(max(0.0, -p10)),
    )


def breakdown(aligned: pd.DataFrame, key: pd.Series, name: str) -> pd.DataFrame:
    """Error statistics per group; ``key`` is aligned row-for-row with ``aligned``."""
    grouped = aligned["error_mw"].groupby(key.rename(name))
    return pd.DataFrame(
        {
            "count": grouped.size(),
            "mae_mw": grouped.apply(lambda e: e.abs().mean()),
            "rmse_mw": grouped.apply(lambda e: np.sqrt((e**2).mean())),
            "bias_mw": grouped.mean(),
            "p10_mw": grouped.quantile(0.1),
            "p90_mw": grouped.quantile(0.9),
        }
    ).reset_index()


def local_hour(aligned: pd.DataFrame, tz: ZoneInfo = settings.tz) -> pd.Series:
    return aligned["start_time"].dt.tz_convert(tz).dt.hour


def local_date(aligned: pd.DataFrame, tz: ZoneInfo = settings.tz) -> pd.Series:
    return aligned["start_time"].dt.tz_convert(tz).dt.date


def bucket(values: pd.Series, width: float) -> pd.Series:
    """Left edge of the ``width``-sized bin each value falls in."""
    return (values // width) * width


def histogram(errors: pd.Series, bin_width_mw: float = 500) -> pd.DataFrame:
    """Error counts in fixed-width bins aligned to multiples of ``bin_width_mw``."""
    low = np.floor(errors.min() / bin_width_mw) * bin_width_mw
    high = (np.floor(errors.max() / bin_width_mw) + 1) * bin_width_mw
    counts, edges = np.histogram(errors, bins=np.arange(low, high + bin_width_mw / 2, bin_width_mw))
    return pd.DataFrame({"left_mw": edges[:-1], "right_mw": edges[1:], "count": counts})
