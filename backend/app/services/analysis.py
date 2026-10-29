"""Cached compositions of selection + metrics over the loaded snapshot, used by the API.

The snapshot is static for the lifetime of a deployment, so results are memoised per cutoff.
Returned frames are shared between callers and must not be mutated.
"""

from datetime import date, time
from functools import lru_cache

import pandas as pd

from app.config import settings
from app.repository.snapshot import get_snapshot
from app.services.metrics import align, local_date
from app.services.selection import decision_forecasts


def delivery_days() -> list[date]:
    return list(pd.date_range(settings.delivery_first_day, settings.delivery_last_day).date)


@lru_cache(maxsize=64)
def decision_pairs(cutoff: time) -> pd.DataFrame:
    """Decision-time forecast vs actual for every delivery day at this cutoff."""
    snapshot = get_snapshot()
    return align(decision_forecasts(snapshot.forecasts, delivery_days(), cutoff), snapshot.actuals)


@lru_cache(maxsize=1)
def vintage_pairs() -> pd.DataFrame:
    """Every forecast (all publishes, all lead times) vs actual, with a ``delivery_date`` column."""
    snapshot = get_snapshot()
    pairs = align(
        snapshot.forecasts.rename(columns={"generation_mw": "forecast_mw"}), snapshot.actuals
    )
    return pairs.assign(delivery_date=local_date(pairs))


def between(pairs: pd.DataFrame, date_from: date | None, date_to: date | None) -> pd.DataFrame:
    """Rows whose ``delivery_date`` is within ``[date_from, date_to]`` (either bound optional)."""
    mask = pd.Series(True, index=pairs.index)
    if date_from is not None:
        mask &= pairs["delivery_date"] >= date_from
    if date_to is not None:
        mask &= pairs["delivery_date"] <= date_to
    return pairs[mask]
