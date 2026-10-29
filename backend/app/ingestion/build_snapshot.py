"""Fetch the in-scope Elexon data, clean it, check it and write the snapshot.

Usage (from ``backend/``)::

    python -m app.ingestion.build_snapshot [--data-dir PATH]
"""

import argparse
import json
import logging
from datetime import UTC, datetime, timedelta
from pathlib import Path
from typing import Any

from app.config import Settings, settings
from app.ingestion.clean import clean_actuals, clean_forecasts, within
from app.ingestion.elexon_client import ElexonClient
from app.ingestion.quality import quality_report
from app.repository.snapshot import Snapshot, write_snapshot

log = logging.getLogger(__name__)

# Every WINDFOR publish on day X targets X-1 21:00 to X+2 21:00 UTC, so the earliest publishes
# reaching the first delivery day are from two days before; 72h of lookback covers them.
FORECAST_LOOKBACK = timedelta(hours=72)


def build_snapshot(client: ElexonClient, config: Settings = settings) -> Snapshot:
    start, end = config.delivery_start, config.delivery_end

    raw_actuals = client.fetch_actuals(config.delivery_first_day, config.delivery_last_day)
    actuals = within(clean_actuals(raw_actuals), "start_time", start, end)

    # Only forecasts published before the last decision deadline could inform a decision.
    raw_forecasts = client.fetch_forecasts(start - FORECAST_LOOKBACK, config.last_decision_end)
    forecasts = clean_forecasts(raw_forecasts)
    forecasts = forecasts[forecasts["publish_time"] < config.last_decision_end]
    forecasts = within(forecasts, "start_time", start, end)

    metadata: dict[str, Any] = {
        "built_at": datetime.now(UTC).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "source": config.elexon_base_url,
        "decision_days": [
            config.decision_first_day.isoformat(),
            config.decision_last_day.isoformat(),
        ],
        "delivery_days": [
            config.delivery_first_day.isoformat(),
            config.delivery_last_day.isoformat(),
        ],
        "raw_records": {"actuals": len(raw_actuals), "forecasts": len(raw_forecasts)},
        "quality": quality_report(actuals, forecasts, start, end),
    }
    return Snapshot(actuals=actuals, forecasts=forecasts, metadata=metadata)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--data-dir", type=Path, default=settings.data_dir)
    args = parser.parse_args()
    logging.basicConfig(level=logging.INFO, format="%(levelname)s %(name)s: %(message)s")

    with ElexonClient() as client:
        snapshot = build_snapshot(client)
    write_snapshot(snapshot, args.data_dir)
    log.info("Wrote snapshot to %s", args.data_dir)
    print(json.dumps(snapshot.metadata, indent=2))


if __name__ == "__main__":
    main()
