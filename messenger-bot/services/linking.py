class LinkingService:
    async def start_linking(self, vk_user_id: int) -> dict[str, str | int]:
        return {
            "vk_user_id": vk_user_id,
            "status": "pending_phone",
            "message": "Нужно запросить номер телефона для привязки к ученику.",
        }
