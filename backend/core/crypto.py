from __future__ import annotations

import base64
import hashlib
from functools import lru_cache

from cryptography.fernet import Fernet, InvalidToken
from fastapi import HTTPException

from core.config import DATA_ENCRYPTION_KEY


@lru_cache(maxsize=1)
def get_fernet() -> Fernet:
    if not DATA_ENCRYPTION_KEY:
        raise RuntimeError("DATA_ENCRYPTION_KEY is not configured")

    try:
        return Fernet(DATA_ENCRYPTION_KEY.encode("utf-8"))
    except Exception:
        derived_key = base64.urlsafe_b64encode(
            hashlib.sha256(DATA_ENCRYPTION_KEY.encode("utf-8")).digest()
        )
        return Fernet(derived_key)


def encrypt_bytes(payload: bytes) -> bytes:
    return get_fernet().encrypt(payload)


def decrypt_bytes(payload: bytes) -> bytes:
    try:
        return get_fernet().decrypt(payload)
    except InvalidToken as exc:
        raise HTTPException(status_code=500, detail="Не удалось расшифровать защищенный файл") from exc


def encrypt_text(value: str | None) -> str | None:
    if value in (None, ""):
        return value
    return encrypt_bytes(value.encode("utf-8")).decode("utf-8")


def decrypt_text(value: str | None) -> str | None:
    if value in (None, ""):
        return value
    return decrypt_bytes(value.encode("utf-8")).decode("utf-8")
