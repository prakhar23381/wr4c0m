from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api import health


def create_app() -> FastAPI:
    app = FastAPI(
        title="Wind Forecast API",
        docs_url="/api/docs",
        openapi_url="/api/openapi.json",
    )
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["http://localhost:5173"],
        allow_methods=["GET"],
    )
    app.include_router(health.router, prefix="/api")
    return app


app = create_app()
