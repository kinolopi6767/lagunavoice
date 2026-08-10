"""LugunaVoice developer SDK — thin client for the developer API."""

from __future__ import annotations

import base64
import time
from typing import Any, Optional

import httpx

DEFAULT_BASE_URL = "https://api.lugunavoice.com/v1"


class LugunaVoiceError(Exception):
    def __init__(self, message: str, code: str, status: int) -> None:
        super().__init__(message)
        self.code = code
        self.status = status


class LugunaVoice:
    def __init__(self, api_key: str, base_url: str = DEFAULT_BASE_URL) -> None:
        if not api_key:
            raise ValueError("LugunaVoice SDK requires an API key")
        self._key = api_key
        self._base = base_url.rstrip("/")
        self._client = httpx.Client(
            headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"}
        )

    def _request(self, method: str, path: str, **kwargs: Any) -> Any:
        res = self._client.request(method, f"{self._base}{path}", **kwargs)
        if res.status_code >= 400:
            data = res.json() if res.headers.get("content-type", "").startswith("application/json") else {}
            raise LugunaVoiceError(
                data.get("error") or f"HTTP {res.status_code}",
                data.get("code") or "api_error",
                res.status_code,
            )
        return res.json()

    def list_voices(self, q: str = "", language: str = "", tier: str = "", limit: int = 60, offset: int = 0) -> dict:
        params = {"limit": limit, "offset": offset}
        if q:
            params["q"] = q
        if language:
            params["language"] = language
        if tier:
            params["tier"] = tier
        return self._request("GET", f"/voices?{'&'.join(f'{k}={v}' for k, v in params.items())}")

    def generate(self, text: str, voice: str, style: str = "neutral", idempotency_key: Optional[str] = None) -> dict:
        headers = {"Idempotency-Key": idempotency_key} if idempotency_key else None
        return self._request(
            "POST",
            "/tts/generations",
            json={"text": text, "voice": voice, "style": style},
            headers=headers,
        )

    def get_generation(self, generation_id: str) -> dict:
        return self._request("GET", f"/tts/generations/{generation_id}")

    def generate_and_wait(self, text: str, voice: str, style: str = "neutral", poll_interval: float = 1.5, timeout: float = 120.0) -> dict:
        created = self.generate(text, voice, style)
        started = time.time()
        while True:
            gen = self.get_generation(created["id"])
            if gen["status"] in ("completed", "failed"):
                return gen
            if time.time() - started > timeout:
                raise LugunaVoiceError("Generation timed out", "timeout", 408)
            time.sleep(poll_interval)

    def audio_bytes(self, generation: dict) -> bytes:
        """Decode the base64 audio from a completed generation."""
        if generation.get("status") != "completed" or not generation.get("audioBase64"):
            raise LugunaVoiceError("Generation not completed", "not_ready", 409)
        return base64.b64decode(generation["audioBase64"])

    def me(self) -> dict:
        return self._request("GET", "/me")

    def close(self) -> None:
        self._client.close()

    def __enter__(self) -> "LugunaVoice":
        return self

    def __exit__(self, *exc: Any) -> None:
        self.close()
