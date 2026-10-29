from dataclasses import asdict
from datetime import time
from typing import Annotated

import pandas as pd
from fastapi import APIRouter, Query

from app.api.meta import CUTOFF_PRESETS
from app.api.params import Cutoff, DateFrom, DateTo, records, resolve_range
from app.api.schemas import (
    AccuracySummary,
    BreakdownBy,
    BreakdownResponse,
    BreakdownRow,
    CutoffSweepResponse,
    CutoffSweepRow,
    DistributionResponse,
    HistogramBin,
    Metrics,
)
from app.config import settings
from app.services.analysis import between, decision_pairs, vintage_pairs
from app.services.metrics import breakdown, bucket, compute_metrics, histogram, local_hour

router = APIRouter(prefix="/accuracy")

LEAD_BUCKET_H = 6
LEVEL_BUCKET_MW = 4000
# Every half hour through the morning of D-1, plus the auction gate closures themselves.
SWEEP_CUTOFFS = sorted(
    {time(h, m) for h in range(6, 13) for m in (0, 30)} | {p.time for p in CUTOFF_PRESETS}
)
DECISION_BASIS = "Decision-time forecast (latest publish at or before the cutoff on D-1)"


@router.get("/summary", response_model=AccuracySummary)
def summary(
    cutoff: Cutoff = settings.default_cutoff,
    date_from: DateFrom = None,
    date_to: DateTo = None,
) -> AccuracySummary:
    """Headline error metrics of the decision-time forecast over a range of delivery days."""
    start, end = resolve_range(date_from, date_to)
    pairs = between(decision_pairs(cutoff), start, end)
    return AccuracySummary(
        cutoff=cutoff,
        date_from=start,
        date_to=end,
        days=pairs["delivery_date"].nunique(),
        metrics=Metrics(
            **asdict(compute_metrics(pairs)),
            mean_actual_mw=float(pairs["actual_mw"].mean()),
            mean_forecast_mw=float(pairs["forecast_mw"].mean()),
        ),
    )


@router.get("/breakdown", response_model=BreakdownResponse)
def breakdown_by(
    by: BreakdownBy,
    cutoff: Cutoff = settings.default_cutoff,
    date_from: DateFrom = None,
    date_to: DateTo = None,
) -> BreakdownResponse:
    """Error statistics grouped by hour of day, delivery day, lead time or forecast level.

    ``lead_time`` uses every forecast publish (not just the decision-time one) so accuracy
    can be compared across horizons; the cutoff does not apply to it.
    """
    start, end = resolve_range(date_from, date_to)
    basis, width = DECISION_BASIS, None
    if by == "lead_time":
        pairs = between(vintage_pairs(), start, end)
        key, basis, width = (
            bucket(pairs["lead_time_h"], LEAD_BUCKET_H),
            "All forecast publishes",
            LEAD_BUCKET_H,
        )
    else:
        pairs = between(decision_pairs(cutoff), start, end)
        if by == "hour":
            key = local_hour(pairs)
        elif by == "day":
            key = pairs["delivery_date"]
        else:
            key, width = bucket(pairs["forecast_mw"], LEVEL_BUCKET_MW), LEVEL_BUCKET_MW
    table = breakdown(pairs, key, "key")
    return BreakdownResponse(
        by=by,
        basis=basis,
        bucket_width=width,
        rows=[BreakdownRow(**row) for row in records(table)],
    )


@router.get("/distribution", response_model=DistributionResponse)
def distribution(
    cutoff: Cutoff = settings.default_cutoff,
    date_from: DateFrom = None,
    date_to: DateTo = None,
    bin_width_mw: Annotated[int, Query(ge=100, le=5000)] = 500,
) -> DistributionResponse:
    """Histogram of hourly errors (actual - forecast) with P10/P50/P90 markers."""
    start, end = resolve_range(date_from, date_to)
    pairs = between(decision_pairs(cutoff), start, end)
    metrics = compute_metrics(pairs)
    bins = histogram(pairs["error_mw"], bin_width_mw)
    return DistributionResponse(
        cutoff=cutoff,
        count=metrics.count,
        bin_width_mw=bin_width_mw,
        p10_mw=metrics.p10_mw,
        p50_mw=metrics.p50_mw,
        p90_mw=metrics.p90_mw,
        bins=[HistogramBin(**row) for row in records(bins)],
    )


@router.get("/cutoffs", response_model=CutoffSweepResponse)
def cutoff_sweep(date_from: DateFrom = None, date_to: DateTo = None) -> CutoffSweepResponse:
    """How accuracy would change if the decision were made at a different time on D-1."""
    start, end = resolve_range(date_from, date_to)
    rows = []
    for cutoff in SWEEP_CUTOFFS:
        pairs = between(decision_pairs(cutoff), start, end)
        metrics = compute_metrics(pairs)
        slots = sorted(set(pd.DatetimeIndex(pairs["publish_time"]).strftime("%H:%M")))
        rows.append(
            CutoffSweepRow(
                cutoff=cutoff,
                publish_times_used=slots,
                mae_mw=metrics.mae_mw,
                bias_mw=metrics.bias_mw,
                wape_pct=metrics.wape_pct,
                shortfall_buffer_mw=metrics.shortfall_buffer_mw,
            )
        )
    return CutoffSweepResponse(rows=rows)
