from collections.abc import Awaitable, Callable

from fastapi import FastAPI, Request, Response
from fastapi.middleware.cors import CORSMiddleware

from app.api import accuracy, decision, health, meta

# The data is static per deployment and Vercel purges its CDN cache on every deploy, so the
# CDN can keep responses for a year; browsers re-check after 5 minutes.
CACHE_CONTROL = "public, max-age=300, s-maxage=31536000"


def create_app() -> FastAPI:
    app = FastAPI(
        title="Wind Forecast API",
        description=(
            "Day-ahead wind forecast visibility and accuracy for GB, January 2026 "
            "(Elexon BMRS FUELHH actuals vs WINDFOR forecasts)."
        ),
        docs_url="/api/docs",
        openapi_url="/api/openapi.json",
    )
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["http://localhost:5173"],
        allow_methods=["GET"],
    )

    @app.middleware("http")
    async def cache_headers(
        request: Request, call_next: Callable[[Request], Awaitable[Response]]
    ) -> Response:
        response = await call_next(request)
        if (
            request.method == "GET"
            and response.status_code == 200
            and request.url.path.startswith("/api/")
            and request.url.path != "/api/health"
        ):
            response.headers.setdefault("Cache-Control", CACHE_CONTROL)
        return response

    for router in (health.router, meta.router, decision.router, accuracy.router):
        app.include_router(router, prefix="/api")
    return app


app = create_app()
