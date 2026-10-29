"""Turn raw Elexon records into tidy, deduplicated, UTC-indexed DataFrames."""

from collections.abc import Sequence
from datetime import datetime

import pandas as pd

from app.ingestion.elexon_client import Record

ACTUAL_COLUMNS = ["start_time", "generation_mw"]
FORECAST_COLUMNS = ["publish_time", "start_time", "generation_mw", "lead_time_h"]


def clean_actuals(records: Sequence[Record]) -> pd.DataFrame:
    """One row per half-hour ``start_time``; if Elexon revised a value, the latest publish wins."""
    if not records:
        return _empty(ACTUAL_COLUMNS)
    df = pd.DataFrame.from_records(records)
    df = df[df["fuelType"] == "WIND"]
    df = pd.DataFrame(
        {
            "publish_time": pd.to_datetime(df["publishTime"], utc=True),
            "start_time": pd.to_datetime(df["startTime"], utc=True),
            "generation_mw": df["generation"].astype(float),
        }
    )
    df = df.sort_values("publish_time").drop_duplicates("start_time", keep="last")
    return df[ACTUAL_COLUMNS].sort_values("start_time").reset_index(drop=True)


def clean_forecasts(records: Sequence[Record]) -> pd.DataFrame:
    """One row per (publish, target hour), keeping only genuine forecasts (lead time >= 0)."""
    if not records:
        return _empty(FORECAST_COLUMNS)
    df = pd.DataFrame.from_records(records)
    df = pd.DataFrame(
        {
            "publish_time": pd.to_datetime(df["publishTime"], utc=True),
            "start_time": pd.to_datetime(df["startTime"], utc=True),
            "generation_mw": df["generation"].astype(float),
        }
    )
    df["lead_time_h"] = (df["start_time"] - df["publish_time"]).dt.total_seconds() / 3600
    df = df[df["lead_time_h"] >= 0]
    df = df.drop_duplicates(["publish_time", "start_time"], keep="last")
    return df[FORECAST_COLUMNS].sort_values(["publish_time", "start_time"]).reset_index(drop=True)


def within(df: pd.DataFrame, column: str, start: datetime, end: datetime) -> pd.DataFrame:
    """Rows with ``start <= df[column] < end``."""
    mask = (df[column] >= start) & (df[column] < end)
    return df[mask].reset_index(drop=True)


def _empty(columns: list[str]) -> pd.DataFrame:
    return pd.DataFrame({column: pd.Series(dtype="float64") for column in columns})
