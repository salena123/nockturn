from fastapi import APIRouter, Header, HTTPException, Request

from config import settings
from schemas.vk import VkCallbackPayload
from services.vk_dispatcher import handle_vk_callback


router = APIRouter()


@router.post("/vk/webhook")
async def vk_webhook(
    payload: VkCallbackPayload,
    request: Request,
    x_secret: str | None = Header(default=None),
):
    callback_secret = payload.secret or x_secret
    if settings.vk_secret and callback_secret != settings.vk_secret:
        raise HTTPException(status_code=403, detail="Некорректный секрет VK")

    if payload.type == "confirmation":
        return settings.vk_confirmation_token

    await handle_vk_callback(payload, request)
    return "ok"
