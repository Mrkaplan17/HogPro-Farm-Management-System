"""Authentication & authorization utilities (stdlib-only, no external deps).

- Password hashing: PBKDF2-HMAC-SHA256 (100k iterations) with per-user salt.
- Tokens: signed HS256 JWTs built with hmac/hashlib.
"""
import base64
import hashlib
import hmac
import json
import os
import secrets
import time

from fastapi import Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from database import get_db
from models import User

SECRET = os.environ.get("PIGGERY_SECRET", "piggery-dev-secret-change-me-in-production")
TOKEN_TTL_HOURS = int(os.environ.get("PIGGERY_TOKEN_TTL_HOURS", "168"))  # 7 days

bearer_scheme = HTTPBearer(auto_error=False)


def _b64url(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode("ascii")


def _b64url_decode(value: str) -> bytes:
    padding = "=" * (-len(value) % 4)
    return base64.urlsafe_b64decode(value + padding)


def hash_password(password: str) -> str:
    salt = secrets.token_bytes(16)
    digest = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt, 100_000)
    return "$".join(["pbkdf2_sha256", _b64url(salt), _b64url(digest)])


def verify_password(password: str, hashed: str) -> bool:
    try:
        _, salt_b64, digest_b64 = hashed.split("$")
        salt = _b64url_decode(salt_b64)
        expected = _b64url_decode(digest_b64)
        actual = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt, 100_000)
        return hmac.compare_digest(actual, expected)
    except Exception:
        return False


def create_access_token(user_id: int, role: str) -> str:
    header = {"alg": "HS256", "typ": "JWT"}
    now = int(time.time())
    payload = {"sub": str(user_id), "role": role, "iat": now, "exp": now + TOKEN_TTL_HOURS * 3600}
    enc_h = _b64url(json.dumps(header, separators=(",", ":")).encode("utf-8"))
    enc_p = _b64url(json.dumps(payload, separators=(",", ":")).encode("utf-8"))
    signing_input = f"{enc_h}.{enc_p}".encode("utf-8")
    sig = hmac.new(SECRET.encode("utf-8"), signing_input, hashlib.sha256).digest()
    return f"{enc_h}.{enc_p}.{_b64url(sig)}"


def decode_token(token: str):
    try:
        h, p, s = token.split(".")
        signing_input = f"{h}.{p}".encode("utf-8")
        expected = hmac.new(SECRET.encode("utf-8"), signing_input, hashlib.sha256).digest()
        if not hmac.compare_digest(expected, _b64url_decode(s)):
            return None
        payload = json.loads(_b64url_decode(p))
        if int(payload.get("exp", 0)) < time.time():
            return None
        return payload
    except Exception:
        return None


def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
    db: Session = Depends(get_db),
):
    if credentials is None:
        raise HTTPException(status_code=401, detail="Not authenticated")
    payload = decode_token(credentials.credentials)
    if payload is None:
        raise HTTPException(status_code=401, detail="Invalid or expired token")
    try:
        user_id = int(payload["sub"])
    except (KeyError, TypeError, ValueError):
        raise HTTPException(status_code=401, detail="Invalid or expired token")
    user = db.query(User).filter(User.id == user_id).first()
    if user is None:
        raise HTTPException(status_code=401, detail="User no longer exists")
    return user


def require_admin(current_user: User = Depends(get_current_user)):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    return current_user