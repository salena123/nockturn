from fastapi import FastAPI

from config import settings
from handlers.vk_callback import router as vk_router


def create_app() -> FastAPI:
    app = FastAPI(title="Nockturn Messenger Bot")
    app.include_router(vk_router)

    @app.get("/health")
    def healthcheck() -> dict[str, str]:
        return {"status": "ok", "bot": settings.bot_name}

    return app


app = create_app()
