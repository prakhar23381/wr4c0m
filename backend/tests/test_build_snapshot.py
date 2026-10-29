from datetime import date, datetime
from pathlib import Path

import pandas as pd

from app.config import Settings
from app.ingestion.build_snapshot import build_snapshot
from app.repository.snapshot import read_snapshot, write_snapshot

# One delivery day (2 Jan) keeps the fixture small.
CONFIG = Settings(decision_first_day=date(2026, 1, 1), decision_last_day=date(2026, 1, 1))


class FakeClient:
    def __init__(self) -> None:
        self.forecast_window: tuple[datetime, datetime] | None = None

    def fetch_actuals(self, first_day: date, last_day: date) -> list[dict]:
        assert (first_day, last_day) == (date(2026, 1, 2), date(2026, 1, 2))
        times = pd.date_range("2026-01-01T23:30Z", "2026-01-03T00:00Z", freq="30min")
        return [
            {
                "startTime": t.strftime("%Y-%m-%dT%H:%M:%SZ"),
                "publishTime": t.strftime("%Y-%m-%dT%H:%M:%SZ"),
                "fuelType": "WIND",
                "generation": 1000 + i,
            }
            for i, t in enumerate(times)
        ]

    def fetch_forecasts(self, publish_from: datetime, publish_to: datetime) -> list[dict]:
        self.forecast_window = (publish_from, publish_to)
        return [
            # Usable: published on the decision day, targets the delivery day.
            {
                "publishTime": "2026-01-01T09:30:00Z",
                "startTime": "2026-01-02T05:00:00Z",
                "generation": 1,
            },
            # Out of scope: target on 3 Jan.
            {
                "publishTime": "2026-01-01T09:30:00Z",
                "startTime": "2026-01-03T05:00:00Z",
                "generation": 2,
            },
            # Out of scope: published after the last decision day ended.
            {
                "publishTime": "2026-01-02T02:30:00Z",
                "startTime": "2026-01-02T05:00:00Z",
                "generation": 3,
            },
        ]


def test_build_snapshot_filters_to_decision_scope() -> None:
    client = FakeClient()
    snapshot = build_snapshot(client, CONFIG)  # type: ignore[arg-type]

    assert len(snapshot.actuals) == 48
    assert snapshot.actuals["start_time"].min() == pd.Timestamp("2026-01-02T00:00Z")
    assert snapshot.forecasts["generation_mw"].tolist() == [1]
    assert client.forecast_window is not None
    assert client.forecast_window[1] == CONFIG.last_decision_end
    assert snapshot.metadata["quality"]["actuals"]["missing_start_times"] == []


def test_snapshot_round_trip(tmp_path: Path) -> None:
    snapshot = build_snapshot(FakeClient(), CONFIG)  # type: ignore[arg-type]
    write_snapshot(snapshot, tmp_path)
    loaded = read_snapshot(tmp_path)

    pd.testing.assert_frame_equal(loaded.actuals, snapshot.actuals, check_dtype=False)
    pd.testing.assert_frame_equal(loaded.forecasts, snapshot.forecasts, check_dtype=False)
    assert loaded.metadata == snapshot.metadata
