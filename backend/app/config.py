"""Application settings, overridable via environment variables (prefix ``APP_``)."""

from datetime import time
from pathlib import Path

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


settings = Settings()
