import httpx

from config import settings


class VKApiClient:
    api_version = "5.199"

    def __init__(self) -> None:
        self.token = settings.vk_group_token

    async def send_message(self, user_id: int, message: str, keyboard: str | None = None) -> dict:
        payload = {
            "user_id": user_id,
            "random_id": 0,
            "message": message,
            "access_token": self.token,
            "v": self.api_version,
        }
        if keyboard:
            payload["keyboard"] = keyboard

        async with httpx.AsyncClient(timeout=20.0) as client:
            response = await client.post("https://api.vk.com/method/messages.send", data=payload)
            response.raise_for_status()
            return response.json()
