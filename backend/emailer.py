"""SMTP email delivery (stdlib smtplib). All credentials come from env vars.

Gmail example:
    SMTP_HOST=smtp.gmail.com
    SMTP_PORT=587
    SMTP_USER=your-farm-or-app@gmail.com
    SMTP_PASSWORD=<16-char Google App Password>
    SMTP_USE_TLS=true
"""
import os
import smtplib
from email.message import EmailMessage


def _smtp_settings():
    return {
        "host": os.environ.get("SMTP_HOST", "smtp.gmail.com"),
        "port": int(os.environ.get("SMTP_PORT", "587")),
        "user": os.environ.get("SMTP_USER", ""),
        "password": os.environ.get("SMTP_PASSWORD", ""),
        "use_tls": os.environ.get("SMTP_USE_TLS", "true").lower() in ("1", "true", "yes"),
    }


def send_email(to_email: str, subject: str, body: str) -> None:
    """Send a plain-text email. Raises on failure so callers can log status."""
    cfg = _smtp_settings()
    if not cfg["user"] or not cfg["password"]:
        raise RuntimeError("SMTP credentials are not configured (SMTP_USER / SMTP_PASSWORD).")

    msg = EmailMessage()
    msg["From"] = cfg["user"]
    msg["To"] = to_email
    msg["Subject"] = subject
    msg.set_content(body)

    if cfg["use_tls"]:
        with smtplib.SMTP(cfg["host"], cfg["port"], timeout=20) as smtp:
            smtp.starttls()
            smtp.login(cfg["user"], cfg["password"])
            smtp.send_message(msg)
    else:
        with smtplib.SMTP_SSL(cfg["host"], cfg["port"], timeout=20) as smtp:
            smtp.login(cfg["user"], cfg["password"])
            smtp.send_message(msg)


def contact_recipient() -> str:
    """The inbox that receives support messages — NEVER exposed to the frontend."""
    return os.environ.get("CONTACT_RECIPIENT", "billyalcayaga28@gmail.com")