"""
OTP generation, cache storage, and optional SMS delivery.
Set SMS_PROVIDER=twilio or msg91 in .env and add API keys to send real SMS.
Otherwise OTP is logged (dev) and can be verified for testing.
"""
import logging
import random
import re
from django.conf import settings
from django.core.cache import cache

logger = logging.getLogger(__name__)

OTP_CACHE_PREFIX = "otp:"
OTP_TTL = getattr(settings, "OTP_TTL_SECONDS", 300)
OTP_LENGTH = getattr(settings, "OTP_LENGTH", 6)


def normalize_phone(phone: str) -> str:
    """Strip spaces and ensure +country; default +91 for India."""
    s = re.sub(r"\s+", "", str(phone).strip())
    if s and not s.startswith("+"):
        s = "+91" + s.lstrip("0")
    return s


def generate_otp() -> str:
    return "".join(str(random.randint(0, 9)) for _ in range(OTP_LENGTH))


def send_sms(phone: str, message: str) -> bool:
    """Send SMS via configured provider (Twilio / MSG91). Returns True if sent or skipped (dev)."""
    provider = getattr(settings, "SMS_PROVIDER", "") or ""
    if provider == "twilio":
        try:
            import twilio.rest
            client = twilio.rest.Client(
                settings.TWILIO_ACCOUNT_SID,
                settings.TWILIO_AUTH_TOKEN,
            )
            client.messages.create(
                body=message,
                from_=settings.TWILIO_FROM_NUMBER,
                to=phone,
            )
            return True
        except Exception as e:
            logger.exception("Twilio SMS failed: %s", e)
            return False
    if provider == "msg91":
        try:
            import urllib.request
            import urllib.parse
            auth_key = getattr(settings, "MSG91_AUTH_KEY", "")
            sender = getattr(settings, "MSG91_SENDER_ID", "e-GO")
            url = "https://api.msg91.com/api/v5/flow/"
            data = {
                "template_id": "",  # MSG91 template
                "short_url": "0",
                "recipients": [{"mobiles": phone.lstrip("+"), "otp": message}],
            }
            req = urllib.request.Request(
                url,
                data=urllib.parse.urlencode(data).encode(),
                headers={"authkey": auth_key, "Content-Type": "application/json"},
                method="POST",
            )
            # MSG91 OTP API varies; this is a placeholder. Use their OTP API doc.
            with urllib.request.urlopen(req) as resp:
                return resp.status == 200
        except Exception as e:
            logger.exception("MSG91 SMS failed: %s", e)
            return False
    # No provider or dev: log OTP
    logger.warning("OTP (dev, no SMS): to=%s message=%s", phone, message)
    return True


def send_otp(phone: str):
    """
    Generate OTP, store in cache, optionally send SMS.
    Returns (success, message). On success without SMS, message can be "OTP sent" or dev hint.
    """
    phone = normalize_phone(phone)
    if not phone or len(phone) < 10:
        return False, "Invalid mobile number."
    otp = generate_otp()
    cache_key = OTP_CACHE_PREFIX + phone
    cache.set(cache_key, otp, OTP_TTL)
    message = f"Your e-GO verification code is {otp}. Valid for {OTP_TTL // 60} minutes."
    sent = send_sms(phone, message)
    if sent and not getattr(settings, "SMS_PROVIDER", ""):
        return True, "OTP sent (check server logs in dev)."
    return sent, "OTP sent to your mobile." if sent else "Failed to send OTP."


def verify_otp(phone: str, otp: str) -> bool:
    """Verify OTP and delete from cache on success."""
    phone = normalize_phone(phone)
    cache_key = OTP_CACHE_PREFIX + phone
    stored = cache.get(cache_key)
    if stored is None:
        return False
    if str(stored).strip() != str(otp).strip():
        return False
    cache.delete(cache_key)
    return True
