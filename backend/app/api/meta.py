from datetime import datetime, time

from fastapi import APIRouter

from app.api.params import SnapshotDep
from app.api.schemas import CutoffPreset, Meta
from app.config import settings

router = APIRouter()

CUTOFF_PRESETS = [
    CutoffPreset(
        label="N2EX day-ahead auction",
        time=time(9, 50),
        note="Nord Pool GB day-ahead auction gate closure, 09:50 UK time",
    ),
    CutoffPreset(
        label="EPEX day-ahead auction",
        time=time(9, 20),
        note="EPEX SPOT GB day-ahead auction gate closure, approx. 09:20 UK time",
    ),
]


@router.get("/meta", response_model=Meta)
def meta(snapshot: SnapshotDep) -> Meta:
    quality = snapshot.metadata["quality"]["forecasts"]
    return Meta(
        decision_first_day=settings.decision_first_day,
        decision_last_day=settings.decision_last_day,
        delivery_first_day=settings.delivery_first_day,
        delivery_last_day=settings.delivery_last_day,
        timezone=settings.timezone,
        default_cutoff=settings.default_cutoff,
        cutoff_presets=CUTOFF_PRESETS,
        data_built_at=datetime.fromisoformat(snapshot.metadata["built_at"]),
        source=snapshot.metadata["source"],
        forecast_publishes=quality["publishes"],
        late_publishes=[datetime.fromisoformat(t) for t in quality["off_schedule_publishes"]],
    )
