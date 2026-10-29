"""End-to-end API tests against the committed January 2026 snapshot."""

import pytest
from fastapi.testclient import TestClient

from app.main import CACHE_CONTROL, app

client = TestClient(app)


def get(url: str) -> dict:
    response = client.get(url)
    assert response.status_code == 200, response.text
    return response.json()


def test_meta_describes_scope_and_presets() -> None:
    meta = get("/api/meta")
    assert (meta["delivery_first_day"], meta["delivery_last_day"]) == ("2026-01-02", "2026-02-01")
    assert meta["default_cutoff"] == "09:50:00"
    assert [p["time"] for p in meta["cutoff_presets"]] == ["09:50:00", "09:20:00"]
    assert meta["late_publishes"] == ["2026-01-15T12:25:00Z"]


@pytest.mark.parametrize(("cutoff", "publish"), [("09:50", "09:30"), ("09:20", "07:30")])
def test_decision_uses_latest_publish_before_cutoff(cutoff: str, publish: str) -> None:
    body = get(f"/api/decision?delivery_date=2026-01-28&cutoff={cutoff}")
    assert body["publish_time"] == f"2026-01-27T{publish}:00Z"
    assert body["cutoff"] == f"2026-01-27T{cutoff}:00Z"
    assert len(body["hours"]) == 24
    assert len(body["actuals"]) == 48
    assert body["missing_hours"] == []


def test_decision_hours_are_consistent() -> None:
    body = get("/api/decision?delivery_date=2026-01-28")
    for hour in body["hours"]:
        assert hour["p10_mw"] <= hour["p50_mw"] <= hour["p90_mw"]
        assert hour["error_mw"] == pytest.approx(hour["actual_mw"] - hour["forecast_mw"])
    summary = body["summary"]
    assert summary["forecast_energy_mwh"] == pytest.approx(
        sum(h["forecast_mw"] for h in body["hours"])
    )
    assert summary["bias_mw"] == pytest.approx(-5329, abs=1)  # worst day of January
    assert "other 30 delivery days" in body["band_basis"]


def test_band_excludes_the_day_being_shown() -> None:
    # Leave-one-day-out: two days with the same forecast level get different bands.
    a = get("/api/decision?delivery_date=2026-01-28")["hours"][0]
    b = get("/api/decision?delivery_date=2026-01-27")["hours"][0]
    offset_a = a["p50_mw"] - a["forecast_mw"]
    offset_b = b["p50_mw"] - b["forecast_mw"]
    assert offset_a < 0 and offset_b < 0
    assert offset_a != offset_b


def test_vintages_mark_availability_at_cutoff() -> None:
    body = get("/api/vintages?delivery_date=2026-01-28")
    publishes = [v["publish_time"] for v in body["vintages"]]
    assert publishes == sorted(publishes)
    available = [v["publish_time"] for v in body["vintages"] if v["available_at_cutoff"]]
    assert available[-1] == "2026-01-27T09:30:00Z"
    assert all(p < "2026-02-01T00:00:00Z" for p in publishes)


def test_accuracy_summary_matches_analysis() -> None:
    body = get("/api/accuracy/summary")
    assert body["days"] == 31
    metrics = body["metrics"]
    assert metrics["count"] == 744
    assert metrics["mae_mw"] == pytest.approx(1995.6, abs=0.1)
    assert metrics["bias_mw"] == pytest.approx(-1728.0, abs=0.1)
    assert metrics["shortfall_buffer_mw"] == pytest.approx(4183.9, abs=0.1)


def test_accuracy_summary_date_range() -> None:
    body = get("/api/accuracy/summary?date_from=2026-01-10&date_to=2026-01-12")
    assert body["days"] == 3
    assert body["metrics"]["count"] == 72


@pytest.mark.parametrize(
    ("by", "rows", "first_key"),
    [("hour", 24, 0), ("day", 31, "2026-01-02"), ("lead_time", 12, 0), ("level", 6, 0)],
)
def test_breakdowns(by: str, rows: int, first_key: object) -> None:
    body = get(f"/api/accuracy/breakdown?by={by}")
    assert len(body["rows"]) == rows
    assert body["rows"][0]["key"] == first_key
    assert body["basis"].startswith("All forecast" if by == "lead_time" else "Decision-time")


def test_distribution_counts_every_hour() -> None:
    body = get("/api/accuracy/distribution?bin_width_mw=1000")
    assert sum(b["count"] for b in body["bins"]) == body["count"] == 744
    assert body["p10_mw"] < body["p50_mw"] < body["p90_mw"]


def test_cutoff_sweep_shows_late_morning_forecast_is_better() -> None:
    rows = {r["cutoff"]: r for r in get("/api/accuracy/cutoffs")["rows"]}
    assert rows["09:50:00"]["publish_times_used"] == ["09:30"]
    assert rows["12:00:00"]["mae_mw"] < rows["09:50:00"]["mae_mw"]


@pytest.mark.parametrize(
    "url",
    [
        "/api/decision?delivery_date=2026-03-01",
        "/api/decision?delivery_date=2026-01-28&cutoff=25:00",
        "/api/accuracy/summary?date_from=2026-01-20&date_to=2026-01-10",
        "/api/accuracy/breakdown?by=weekday",
        "/api/accuracy/distribution?bin_width_mw=1",
    ],
)
def test_invalid_requests_are_422(url: str) -> None:
    assert client.get(url).status_code == 422


def test_cache_headers() -> None:
    assert client.get("/api/accuracy/summary").headers["cache-control"] == CACHE_CONTROL
    assert "cache-control" not in client.get("/api/health").headers
    assert "cache-control" not in client.get("/api/decision?delivery_date=2026-03-01").headers
