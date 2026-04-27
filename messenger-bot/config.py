import os
from dataclasses import dataclass

from dotenv import load_dotenv


load_dotenv()


@dataclass(slots=True)
class Settings:
    bot_name: str = os.getenv("BOT_NAME", "Nockturn Messenger Bot")
    vk_group_id: str = os.getenv("VK_GROUP_ID", "")
    vk_group_token: str = os.getenv("VK_GROUP_TOKEN", "")
    vk_confirmation_token: str = os.getenv("VK_CONFIRMATION_TOKEN", "")
    vk_secret: str = os.getenv("VK_SECRET", "")
    crm_api_base_url: str = os.getenv("CRM_API_BASE_URL", "http://127.0.0.1:8000")
    crm_api_token: str = os.getenv("CRM_API_TOKEN", "")
    bot_api_token: str = os.getenv("BOT_API_TOKEN", "")


settings = Settings()
