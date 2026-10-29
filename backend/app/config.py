"""Application settings, overridable via environment variables (prefix ``APP_``)."""

from datetime import date, datetime, time, timedelta
from pathlib import Path
from zoneinfo import ZoneInfo

from pydantic_settings import BaseSettings, SettingsConfigDict

BACKEND_DIR = Path(__file__).resolve().parent.parent


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_prefix="APP_")

    # GB day-ahead gate closure (Europe/London). N2EX DA auction closes 09:50 UK;
    # EPEX GB DA closes 09:20 UK. The UI lets users switch between them.
    default_cutoff: time = time(9, 50)
    timezone: str = "Europe/London"
    data_dir: Path = BACKEND_DIR / "data"
    elexon_base_url: str = "https://data.elexon.co.uk/bmrs/api/v1/datasets"

    # Purchase decisions in scope (local calendar days); each buys for the following day.
    decision_first_day: date = date(2026, 1, 1)
    decision_last_day: date = date(2026, 1, 31)

    @property
    def tz(self) -> ZoneInfo:
        return ZoneInfo(self.timezone)

    @property
    def delivery_first_day(self) -> date:
        return self.decision_first_day + timedelta(days=1)

    @property
    def delivery_last_day(self) -> date:
        return self.decision_last_day + timedelta(days=1)

    @property
    def delivery_start(self) -> datetime:
        """Start of the first delivery day (inclusive), timezone-aware."""
        return datetime.combine(self.delivery_first_day, time(0), self.tz)

    @property
    def delivery_end(self) -> datetime:
        """End of the last delivery day (exclusive), timezone-aware."""
        return datetime.combine(self.delivery_last_day + timedelta(days=1), time(0), self.tz)

    @property
    def last_decision_end(self) -> datetime:
        """No forecast published after this instant can inform an in-scope decision."""
        return datetime.combine(self.decision_last_day + timedelta(days=1), time(0), self.tz)


settings = Settings()
