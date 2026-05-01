from __future__ import annotations

from contextvars import ContextVar, Token

from fastapi import Request


_request_ip: ContextVar[str | None] = ContextVar("request_ip", default=None)


def extract_client_ip(request: Request) -> str | None:
    forwarded_for = request.headers.get("x-forwarded-for")
    if forwarded_for:
        first_hop = forwarded_for.split(",")[0].strip()
        if first_hop:
            return first_hop

    real_ip = request.headers.get("x-real-ip")
    if real_ip:
        return real_ip.strip()

    if request.client and request.client.host:
        return request.client.host

    return None


def set_request_ip(ip_address: str | None) -> Token:
    return _request_ip.set(ip_address)


def reset_request_ip(token: Token) -> None:
    _request_ip.reset(token)


def get_request_ip() -> str | None:
    return _request_ip.get()
