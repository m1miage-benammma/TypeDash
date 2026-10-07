import base64
import hashlib
import hmac
import json
import secrets
import time
from uuid import UUID, uuid4

from fastapi import HTTPException


class Security:
    def __init__(self, key: str, production: bool):
        self.key = key.encode()
        self.production = production
        self.cookie_name = "__Host-typedash-session" if production else "typedash-session"
        self.origins = {"https://typedash.online", "https://www.typedash.online",
                        "https://typedasha.netlify.app"}
        if not production:
            self.origins.update({"http://localhost:4200", "http://127.0.0.1:4200"})

    def sign(self, device_id: str, purpose: str, ttl: int, test_id: str = "") -> str:
        payload = json.dumps({"device": device_id, "purpose": purpose, "test": test_id,
                              "expires": int(time.time()) + ttl, "nonce": secrets.token_hex(16)},
                             separators=(",", ":")).encode()
        encoded = base64.urlsafe_b64encode(payload).decode().rstrip("=")
        signature = hmac.new(self.key, encoded.encode(), hashlib.sha256).hexdigest()
        return encoded + "." + signature

    def verify(self, token: str | None, purpose: str, test_id: str = "") -> str:
        try:
            if not token or len(token) > 1024:
                raise ValueError()
            encoded, signature = token.split(".")
            expected = hmac.new(self.key, encoded.encode(), hashlib.sha256).hexdigest()
            if not hmac.compare_digest(signature, expected):
                raise ValueError()
            payload = json.loads(base64.urlsafe_b64decode(encoded + "=" * (-len(encoded) % 4)))
            if (payload["purpose"] != purpose or payload["test"] != test_id
                    or payload["expires"] <= time.time()):
                raise ValueError()
            return str(UUID(payload["device"]))
        except (ValueError, KeyError, TypeError):
            raise HTTPException(401, "Session authentication required.") from None

    def new_device(self) -> str:
        return str(uuid4())

    def client_key(self, value: str) -> str:
        return hmac.new(self.key, value.encode(), hashlib.sha256).hexdigest()
