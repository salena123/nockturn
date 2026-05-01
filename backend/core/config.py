import os

from dotenv import load_dotenv


load_dotenv()

SECRET_KEY = os.getenv("SECRET_KEY", "fallback-secret-key-change-in-production")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60
REFRESH_TOKEN_EXPIRE_DAYS = 7
BOT_API_TOKEN = os.getenv("BOT_API_TOKEN", "")
DATA_ENCRYPTION_KEY = os.getenv("DATA_ENCRYPTION_KEY", "").strip()
DEFAULT_SUPERADMIN_LOGIN = os.getenv("DEFAULT_SUPERADMIN_LOGIN", "").strip()
DEFAULT_SUPERADMIN_PASSWORD = os.getenv("DEFAULT_SUPERADMIN_PASSWORD", "")
DEFAULT_SUPERADMIN_NAME = os.getenv("DEFAULT_SUPERADMIN_NAME", "Superadmin").strip()
DEFAULT_SUPERADMIN_PHONE = os.getenv("DEFAULT_SUPERADMIN_PHONE", "").strip()
MAX_LOGIN_ATTEMPTS = int(os.getenv("MAX_LOGIN_ATTEMPTS", "5"))
LOGIN_LOCK_MINUTES = int(os.getenv("LOGIN_LOCK_MINUTES", "15"))
