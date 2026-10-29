"""Read/write the committed data snapshot (gzipped CSV + metadata JSON)."""

import json
from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path
from typing import Any

import pandas as pd

from app.config import settings

ACTUALS_FILE = "actuals.csv.gz"
FORECASTS_FILE = "forecasts.csv.gz"
METADATA_FILE = "metadata.json"

_TIMESTAMP_FORMAT = "%Y-%m-%dT%H:%M:%SZ"
# Fixed gzip mtime so rebuilding unchanged data produces byte-identical files.
_COMPRESSION = {"method": "gzip", "mtime": 0}


@dataclass(frozen=True)
class Snapshot:
    actuals: pd.DataFrame
    forecasts: pd.DataFrame
    metadata: dict[str, Any]


def write_snapshot(snapshot: Snapshot, data_dir: Path) -> None:
    data_dir.mkdir(parents=True, exist_ok=True)
    for frame, name in ((snapshot.actuals, ACTUALS_FILE), (snapshot.forecasts, FORECASTS_FILE)):
        frame.to_csv(
            data_dir / name, index=False, date_format=_TIMESTAMP_FORMAT, compression=_COMPRESSION
        )
    (data_dir / METADATA_FILE).write_text(json.dumps(snapshot.metadata, indent=2) + "\n")


def read_snapshot(data_dir: Path) -> Snapshot:
    actuals = pd.read_csv(data_dir / ACTUALS_FILE)
    forecasts = pd.read_csv(data_dir / FORECASTS_FILE)
    for frame in (actuals, forecasts):
        for column in ("publish_time", "start_time"):
            if column in frame:
                frame[column] = pd.to_datetime(frame[column], utc=True)
    metadata = json.loads((data_dir / METADATA_FILE).read_text())
    return Snapshot(actuals=actuals, forecasts=forecasts, metadata=metadata)


@lru_cache(maxsize=1)
def get_snapshot() -> Snapshot:
    """Process-wide cached snapshot from the configured data directory."""
    return read_snapshot(settings.data_dir)
