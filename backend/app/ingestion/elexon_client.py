"""Thin client for the Elexon BMRS Insights API stream endpoints (FUELHH, WINDFOR)."""

import logging
import time
from collections.abc import Callable
from datetime import UTC, date, datetime, timedelta
from typing import Any, Self

import httpx

from app.config import settings

log = logging.getLogger(__name__)

Record = dict[str, Any]

RETRYABLE_STATUS = {429, 500, 502, 503, 504}


class ElexonClient:
    def __init__(
        self,
        base_url: str = settings.elexon_base_url,
        *,
        timeout_s: float = 30.0,
        max_attempts: int = 4,
        backoff_s: float = 1.0,
        transport: httpx.BaseTransport | None = None,
        sleep: Callable[[float], None] = time.sleep,
    ) -> None:
        self._http = httpx.Client(base_url=base_url, timeout=timeout_s, transport=transport)
        self._max_attempts = max_attempts
        self._backoff_s = backoff_s
        self._sleep = sleep

    def __enter__(self) -> Self:
        return self

    def __exit__(self, *_: object) -> None:
        self.close()

    def close(self) -> None:
        self._http.close()

    def fetch_actuals(self, first_day: date, last_day: date, chunk_days: int = 7) -> list[Record]:
        """Half-hourly WIND outturn (FUELHH) for settlement dates ``first_day..last_day``."""
        records: list[Record] = []
        start = first_day
        while start <= last_day:
            end = min(start + timedelta(days=chunk_days - 1), last_day)
            records += self._get(
                "/FUELHH/stream",
                {
                    "settlementDateFrom": start.isoformat(),
                    "settlementDateTo": end.isoformat(),
                    "fuelType": "WIND",
                },
            )
            start = end + timedelta(days=1)
        return records

    def fetch_forecasts(
        self, publish_from: datetime, publish_to: datetime, chunk: timedelta = timedelta(days=7)
    ) -> list[Record]:
        """All WINDFOR forecasts published in ``[publish_from, publish_to]``.

        Chunk boundaries are inclusive on both ends, so a publish exactly on a boundary can
        appear twice; cleaning drops the duplicates.
        """
        records: list[Record] = []
        start = publish_from
        while start < publish_to:
            end = min(start + chunk, publish_to)
            records += self._get(
                "/WINDFOR/stream",
                {"publishDateTimeFrom": _iso_z(start), "publishDateTimeTo": _iso_z(end)},
            )
            start = end
        return records

    def _get(self, path: str, params: dict[str, str]) -> list[Record]:
        for attempt in range(1, self._max_attempts + 1):
            try:
                response = self._http.get(path, params=params)
                response.raise_for_status()
                data = response.json()
            except (httpx.TransportError, httpx.HTTPStatusError) as exc:
                retryable = (
                    isinstance(exc, httpx.TransportError)
                    or exc.response.status_code in RETRYABLE_STATUS
                )
                if not retryable or attempt == self._max_attempts:
                    raise
                delay = self._backoff_s * 2 ** (attempt - 1)
                log.warning("GET %s failed (%s); retry %d in %.1fs", path, exc, attempt, delay)
                self._sleep(delay)
                continue
            if not isinstance(data, list):
                raise ValueError(f"Expected a JSON list from {path}, got {type(data).__name__}")
            log.info("GET %s %s -> %d records", path, params, len(data))
            return data
        raise AssertionError("unreachable")


def _iso_z(moment: datetime) -> str:
    return moment.astimezone(UTC).strftime("%Y-%m-%dT%H:%M:%SZ")
