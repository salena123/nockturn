from __future__ import annotations

from sqlalchemy.types import Text, TypeDecorator

from core.crypto import decrypt_text, encrypt_text, is_encrypted_text


class EncryptedText(TypeDecorator):
    impl = Text
    cache_ok = True

    def process_bind_param(self, value, dialect):
        if value in (None, ""):
            return value
        if is_encrypted_text(value):
            return value
        return encrypt_text(value)

    def process_result_value(self, value, dialect):
        if value in (None, ""):
            return value
        if is_encrypted_text(value):
            return decrypt_text(value)
        return value
