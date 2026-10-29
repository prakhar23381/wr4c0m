from datetime import UTC, date, datetime, timedelta

import httpx
import pytest

from app.ingestion.elexon_client import ElexonClient


def make_client(handler, sleeps: list[float] | None = None) -> ElexonClient:
    return ElexonClient(
        "https://example.test",
        transport=httpx.MockTransport(handler),
        sleep=(sleeps.append if sleeps is not None else lambda _: None),
    )


def test_fetch_actuals_chunks_inclusive_date_ranges() -> None:
    seen: list[dict] = []

    def handler(request: httpx.Request) -> httpx.Response:
        seen.append(dict(request.url.params))
        return httpx.Response(200, json=[{"n": len(seen)}])

    records = make_client(handler).fetch_actuals(date(2026, 1, 2), date(2026, 1, 16), chunk_days=7)

    assert [(p["settlementDateFrom"], p["settlementDateTo"]) for p in seen] == [
        ("2026-01-02", "2026-01-08"),
        ("2026-01-09", "2026-01-15"),
        ("2026-01-16", "2026-01-16"),
    ]
    assert all(p["fuelType"] == "WIND" for p in seen)
    assert len(records) == 3


def test_fetch_forecasts_chunks_publish_window_in_utc() -> None:
    seen: list[dict] = []

    def handler(request: httpx.Request) -> httpx.Response:
        seen.append(dict(request.url.params))
        return httpx.Response(200, json=[])

    start = datetime(2026, 1, 1, tzinfo=UTC)
    make_client(handler).fetch_forecasts(start, start + timedelta(days=10))

    assert [(p["publishDateTimeFrom"], p["publishDateTimeTo"]) for p in seen] == [
        ("2026-01-01T00:00:00Z", "2026-01-08T00:00:00Z"),
        ("2026-01-08T00:00:00Z", "2026-01-11T00:00:00Z"),
    ]


def test_retries_transient_errors_with_backoff() -> None:
    responses = iter([httpx.Response(503), httpx.Response(429), httpx.Response(200, json=[1])])
    sleeps: list[float] = []
    client = make_client(lambda _: next(responses), sleeps)

    assert client.fetch_actuals(date(2026, 1, 2), date(2026, 1, 2)) == [1]
    assert sleeps == [1.0, 2.0]


def test_client_errors_are_not_retried() -> None:
    calls = 0

    def handler(_: httpx.Request) -> httpx.Response:
        nonlocal calls
        calls += 1
        return httpx.Response(400)

    with pytest.raises(httpx.HTTPStatusError):
        make_client(handler).fetch_actuals(date(2026, 1, 2), date(2026, 1, 2))
    assert calls == 1


def test_non_list_payload_is_rejected() -> None:
    client = make_client(lambda _: httpx.Response(200, json={"data": []}))
    with pytest.raises(ValueError, match="JSON list"):
        client.fetch_actuals(date(2026, 1, 2), date(2026, 1, 2))
