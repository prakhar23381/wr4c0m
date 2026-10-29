"""Shared query parameters, validation and DataFrame → JSON-ready conversion."""

from datetime import date, time
from typing import Annotated, Any, cast

import pandas as pd
from fastapi import Depends, HTTPException, Query

from app.config import settings
from app.repository.snapshot import Snapshot, get_snapshot

SnapshotDep = Annotated[Snapshot, Depends(get_snapshot)]

Cutoff = Annotated[
    time,
    Query(description="Decision time on D-1, local UK time (HH:MM)", examples=["09:50"]),
]
DateFrom = Annotated[date | None, Query(description="First delivery day to include")]
DateTo = Annotated[date | None, Query(description="Last delivery day to include")]


def ensure_delivery_date(day: date) -> None:
    if not settings.delivery_first_day <= day <= settings.delivery_last_day:
        raise HTTPException(
            status_code=422,
            detail=(
                f"delivery_date must be between {settings.delivery_first_day} and "
                f"{settings.delivery_last_day} (decisions made in January 2026)"
            ),
        )


def resolve_range(date_from: date | None, date_to: date | None) -> tuple[date, date]:
    start = date_from or settings.delivery_first_day
    end = date_to or settings.delivery_last_day
    for day in (start, end):
        ensure_delivery_date(day)
    if start > end:
        raise HTTPException(status_code=422, detail="date_from must not be after date_to")
    return start, end


def records(frame: pd.DataFrame) -> list[dict[str, Any]]:
    """Rows as dicts, with NaN turned into None so they serialise as JSON null."""
    rows = frame.astype(object).where(frame.notna(), None).to_dict("records")
    return cast(list[dict[str, Any]], rows)
