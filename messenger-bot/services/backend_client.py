import httpx

from config import settings


class CRMBackendClient:
    def __init__(self) -> None:
        self.base_url = settings.crm_api_base_url.rstrip("/")
        self.token = settings.crm_api_token

    def _headers(self) -> dict[str, str]:
        headers: dict[str, str] = {}
        if self.token:
            headers["Authorization"] = f"Bearer {self.token}"
        if settings.bot_api_token:
            headers["X-Bot-Token"] = settings.bot_api_token
        return headers

    async def get_student(self, student_id: int) -> dict:
        async with httpx.AsyncClient(base_url=self.base_url, timeout=20.0) as client:
            response = await client.get(
                f"/api/students/{student_id}",
                headers=self._headers(),
            )
            response.raise_for_status()
            return response.json()

    async def resolve_vk_phone(self, phone: str) -> dict:
        async with httpx.AsyncClient(base_url=self.base_url, timeout=20.0) as client:
            response = await client.post(
                "/api/bot/vk/resolve-phone",
                json={"phone": phone},
                headers=self._headers(),
            )
            response.raise_for_status()
            return response.json()

    async def create_vk_link(
        self,
        vk_user_id: int,
        student_id: int,
        parent_id: int | None = None,
        phone: str | None = None,
    ) -> dict:
        async with httpx.AsyncClient(base_url=self.base_url, timeout=20.0) as client:
            response = await client.post(
                "/api/bot/vk/link",
                json={
                    "vk_user_id": vk_user_id,
                    "student_id": student_id,
                    "parent_id": parent_id,
                    "phone": phone,
                },
                headers=self._headers(),
            )
            response.raise_for_status()
            return response.json()

    async def get_vk_profile(self, vk_user_id: int) -> dict:
        async with httpx.AsyncClient(base_url=self.base_url, timeout=20.0) as client:
            response = await client.get(
                f"/api/bot/vk/profile/{vk_user_id}",
                headers=self._headers(),
            )
            response.raise_for_status()
            return response.json()

    async def get_vk_subscription(self, vk_user_id: int) -> dict:
        async with httpx.AsyncClient(base_url=self.base_url, timeout=20.0) as client:
            response = await client.get(
                f"/api/bot/vk/subscription/{vk_user_id}",
                headers=self._headers(),
            )
            response.raise_for_status()
            return response.json()

    async def get_vk_schedule(self, vk_user_id: int) -> dict:
        async with httpx.AsyncClient(base_url=self.base_url, timeout=20.0) as client:
            response = await client.get(
                f"/api/bot/vk/schedule/{vk_user_id}",
                headers=self._headers(),
            )
            response.raise_for_status()
            return response.json()

    async def report_vk_absence(
        self,
        *,
        vk_user_id: int,
        lesson_id: int,
        reason: str,
        comment: str | None = None,
    ) -> dict:
        async with httpx.AsyncClient(base_url=self.base_url, timeout=20.0) as client:
            response = await client.post(
                f"/api/bot/vk/absence/{vk_user_id}",
                json={
                    "lesson_id": lesson_id,
                    "reason": reason,
                    "comment": comment,
                },
                headers=self._headers(),
            )
            response.raise_for_status()
            return response.json()
