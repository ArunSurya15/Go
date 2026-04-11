"""
Booking notification helpers — email (Resend) and WhatsApp (Twilio or Meta Cloud API).

All functions are fire-and-forget: they log errors but never raise, so a failed
notification never breaks the booking flow.

Enable by setting keys in .env (see settings.py for variable names):
  Email:     RESEND_API_KEY, EMAIL_FROM, APP_BASE_URL
  WhatsApp:  WHATSAPP_PROVIDER=twilio|meta  + provider-specific keys
"""

from __future__ import annotations

import json
import logging
import urllib.request
import urllib.parse
from typing import TYPE_CHECKING

from django.conf import settings

if TYPE_CHECKING:
    from .models import Booking

logger = logging.getLogger(__name__)


# ─── helpers ────────────────────────────────────────────────────────────────

def _get(attr: str, default: str = "") -> str:
    return str(getattr(settings, attr, None) or default).strip()


def _ticket_url(booking: "Booking") -> str:
    base = _get("APP_BASE_URL", "http://localhost:3000").rstrip("/")
    return f"{base}/api/tickets/download/{booking.id}/"


def _booking_url(booking: "Booking") -> str:
    base = _get("APP_BASE_URL", "http://localhost:3000").rstrip("/")
    return f"{base}/bookings/{booking.id}"


def _format_dt(dt) -> str:
    if dt is None:
        return "—"
    try:
        from datetime import timezone as _tz
        from zoneinfo import ZoneInfo
        if dt.tzinfo is not None:
            local = dt.astimezone(ZoneInfo("Asia/Kolkata"))
        else:
            local = dt
        return local.strftime("%d %b %Y, %I:%M %p IST")
    except Exception:
        return str(dt)


# ─── email via Resend ────────────────────────────────────────────────────────

def _resend_send(to: str, subject: str, html: str) -> bool:
    """Send one email via Resend REST API. Returns True on success."""
    api_key = _get("RESEND_API_KEY")
    if not api_key:
        logger.debug("RESEND_API_KEY not set — skipping email to %s", to)
        return False
    payload = json.dumps({
        "from": _get("EMAIL_FROM", "e-GO Tickets <noreply@resend.dev>"),
        "to": [to],
        "subject": subject,
        "html": html,
    }).encode()
    req = urllib.request.Request(
        "https://api.resend.com/emails",
        data=payload,
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
            "User-Agent": "e-GO/1.0",
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=10) as resp:
            return resp.status in (200, 201)
    except Exception as e:
        logger.error("Resend API error for %s: %s", to, e)
        return False


def _passenger_name(booking: "Booking") -> str:
    return (booking.user.first_name or booking.user.username or "").strip()


def _booking_confirmation_html(booking: "Booking") -> str:
    sched = booking.schedule
    route = sched.route
    try:
        seats = json.loads(booking.seats or "[]")
    except Exception:
        seats = []
    seats_str = ", ".join(seats) if seats else "—"
    pnr = f"EGO{booking.id:07d}"
    ticket_url = _ticket_url(booking)
    booking_url = _booking_url(booking)
    dep = _format_dt(sched.departure_dt)
    arr = _format_dt(sched.arrival_dt)
    bus_name = (sched.bus.service_name or sched.bus.registration_no) if sched.bus_id else "—"
    bp = booking.boarding_point.location_name if booking.boarding_point_id else "—"
    dp = booking.dropping_point.location_name if booking.dropping_point_id else "—"

    return f"""
<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Booking Confirmed — {pnr}</title>
<style>
  body{{font-family:Arial,sans-serif;background:#f6f7fb;margin:0;padding:0}}
  .wrap{{max-width:580px;margin:32px auto;background:#fff;border-radius:10px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,.08)}}
  .header{{background:#4f46e5;padding:28px 32px;color:#fff}}
  .header h1{{margin:0;font-size:22px;letter-spacing:-.3px}}
  .header p{{margin:6px 0 0;opacity:.85;font-size:14px}}
  .body{{padding:28px 32px}}
  .pnr{{display:inline-block;background:#eef2ff;color:#4f46e5;font-family:monospace;font-size:22px;font-weight:700;padding:10px 20px;border-radius:8px;letter-spacing:2px;margin-bottom:20px}}
  table{{width:100%;border-collapse:collapse;font-size:14px;margin-bottom:20px}}
  td{{padding:8px 0;border-bottom:1px solid #f1f1f4;color:#374151}}
  td:first-child{{color:#6b7280;width:140px;font-size:13px}}
  .btn{{display:inline-block;background:#4f46e5;color:#ffffff !important;text-decoration:none;padding:12px 28px;border-radius:8px;font-size:14px;font-weight:700;margin-top:4px;border:2px solid #4f46e5}}
  .footer{{background:#f9fafb;padding:18px 32px;font-size:12px;color:#9ca3af;text-align:center;border-top:1px solid #f1f1f4}}
</style></head>
<body>
<div class="wrap">
  <div class="header">
    <h1>✅ Booking confirmed{f", {_passenger_name(booking)}!" if _passenger_name(booking) else "!"}</h1>
    <p>Thank you for booking with e-GO.</p>
  </div>
  <div class="body">
    <div class="pnr">{pnr}</div>
    <table>
      <tr><td>Route</td><td><strong>{route.origin} → {route.destination}</strong></td></tr>
      <tr><td>Departure</td><td>{dep}</td></tr>
      <tr><td>Arrival</td><td>{arr}</td></tr>
      <tr><td>Bus</td><td>{bus_name}</td></tr>
      <tr><td>Seat(s)</td><td>{seats_str}</td></tr>
      <tr><td>Boarding point</td><td>{bp}</td></tr>
      <tr><td>Drop point</td><td>{dp}</td></tr>
      <tr><td>Amount paid</td><td><strong>₹{booking.amount}</strong></td></tr>
    </table>
    <p style="margin-bottom:16px;font-size:14px;color:#374151">
      Download your ticket below and carry it on your trip (digital or printed).
    </p>
    <a class="btn" href="{ticket_url}" style="display:inline-block;background:#4f46e5;color:#ffffff !important;text-decoration:none;padding:12px 28px;border-radius:8px;font-size:14px;font-weight:700;">Download Ticket (PDF)</a>
    <p style="margin-top:16px;font-size:12px;color:#9ca3af">
      You can also view your booking at <a href="{booking_url}" style="color:#4f46e5">{booking_url}</a>
    </p>
  </div>
  <div class="footer">e-GO · Book smarter, travel better · This is an automated message, please do not reply.</div>
</div>
</body></html>"""


def send_booking_confirmation_email(booking: "Booking") -> None:
    """Send booking confirmation email with ticket link. Silent on failure."""
    try:
        # Prefer the email the passenger entered at checkout; fall back to account email
        to = (getattr(booking, "contact_email", "") or booking.user.email or "").strip()
        if not to:
            logger.debug("No email for booking %s — skipping confirmation email", booking.id)
            return
        sched = booking.schedule
        route = sched.route
        pnr = f"EGO{booking.id:07d}"
        subject = f"Booking confirmed — {pnr} | {route.origin} → {route.destination}"
        html = _booking_confirmation_html(booking)
        ok = _resend_send(to, subject, html)
        if ok:
            logger.info("Confirmation email sent to %s for booking %s", to, booking.id)
    except Exception as e:
        logger.error("send_booking_confirmation_email failed for booking %s: %s", booking.id, e)


# ─── WhatsApp ────────────────────────────────────────────────────────────────

def _wa_message_text(booking: "Booking") -> str:
    sched = booking.schedule
    route = sched.route
    try:
        seats = json.loads(booking.seats or "[]")
    except Exception:
        seats = []
    pnr = f"EGO{booking.id:07d}"
    dep = _format_dt(sched.departure_dt)
    ticket_url = _ticket_url(booking)
    seats_str = ", ".join(seats) if seats else "—"
    bp = booking.boarding_point.location_name if booking.boarding_point_id else "—"
    return (
        f"✅ *Booking Confirmed!*\n\n"
        f"*PNR:* `{pnr}`\n"
        f"*Route:* {route.origin} → {route.destination}\n"
        f"*Departure:* {dep}\n"
        f"*Seat(s):* {seats_str}\n"
        f"*Boarding:* {bp}\n"
        f"*Amount:* ₹{booking.amount}\n\n"
        f"🎫 *Download ticket:* {ticket_url}\n\n"
        f"_Bon voyage! — e-GO_"
    )


def _send_via_twilio(to_phone: str, message: str) -> bool:
    sid = _get("TWILIO_ACCOUNT_SID")
    token = _get("TWILIO_AUTH_TOKEN")
    from_wa = _get("TWILIO_WHATSAPP_FROM", "whatsapp:+14155238886")
    if not sid or not token:
        logger.debug("Twilio credentials not set — skipping WhatsApp")
        return False
    # Normalise phone to whatsapp:+91XXXXXXXXXX
    to_wa = to_phone.strip()
    if not to_wa.startswith("whatsapp:"):
        if not to_wa.startswith("+"):
            to_wa = "+91" + to_wa.lstrip("0")
        to_wa = "whatsapp:" + to_wa
    url = f"https://api.twilio.com/2010-04-01/Accounts/{sid}/Messages.json"
    data = urllib.parse.urlencode({"From": from_wa, "To": to_wa, "Body": message}).encode()
    req = urllib.request.Request(url, data=data, method="POST")
    import base64
    creds = base64.b64encode(f"{sid}:{token}".encode()).decode()
    req.add_header("Authorization", f"Basic {creds}")
    try:
        with urllib.request.urlopen(req, timeout=10) as resp:
            return resp.status in (200, 201)
    except Exception as e:
        logger.error("Twilio WhatsApp error to %s: %s", to_phone, e)
        return False


def _send_via_meta(to_phone: str, message: str) -> bool:
    token = _get("META_WHATSAPP_TOKEN")
    phone_id = _get("META_WHATSAPP_PHONE_ID")
    if not token or not phone_id:
        logger.debug("Meta WhatsApp credentials not set — skipping")
        return False
    to = to_phone.strip().lstrip("+").replace(" ", "")
    if to.startswith("0"):
        to = "91" + to[1:]
    elif not to.startswith("91") and len(to) == 10:
        to = "91" + to
    url = f"https://graph.facebook.com/v19.0/{phone_id}/messages"
    payload = json.dumps({
        "messaging_product": "whatsapp",
        "to": to,
        "type": "text",
        "text": {"preview_url": True, "body": message},
    }).encode()
    req = urllib.request.Request(url, data=payload, method="POST")
    req.add_header("Authorization", f"Bearer {token}")
    req.add_header("Content-Type", "application/json")
    try:
        with urllib.request.urlopen(req, timeout=10) as resp:
            return resp.status in (200, 201)
    except Exception as e:
        logger.error("Meta WhatsApp error to %s: %s", to_phone, e)
        return False


def send_booking_confirmation_whatsapp(booking: "Booking") -> None:
    """Send WhatsApp message if passenger opted in and provider is configured."""
    try:
        if not booking.whatsapp_opt_in:
            return
        phone = (booking.contact_phone or "").strip()
        if not phone:
            logger.debug("No contact phone for booking %s — skipping WhatsApp", booking.id)
            return
        provider = _get("WHATSAPP_PROVIDER").lower()
        if not provider:
            logger.debug("WHATSAPP_PROVIDER not set — skipping WhatsApp for booking %s", booking.id)
            return
        text = _wa_message_text(booking)
        if provider == "twilio":
            ok = _send_via_twilio(phone, text)
        elif provider == "meta":
            ok = _send_via_meta(phone, text)
        else:
            logger.warning("Unknown WHATSAPP_PROVIDER=%s", provider)
            return
        if ok:
            logger.info("WhatsApp sent to %s for booking %s", phone, booking.id)
    except Exception as e:
        logger.error("send_booking_confirmation_whatsapp failed for booking %s: %s", booking.id, e)


# ─── Email OTP (for signup verification) ────────────────────────────────────

def send_email_otp(to: str, otp: str, name: str = "") -> bool:
    """Send a signup verification OTP via Resend. Returns True on success."""
    greeting = f"Hi {name}," if name else "Hello,"
    html = f"""
<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><title>Verify your email — e-GO</title>
<style>
  body{{font-family:Arial,sans-serif;background:#f6f7fb;margin:0;padding:0}}
  .wrap{{max-width:480px;margin:32px auto;background:#fff;border-radius:10px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,.08)}}
  .header{{background:#4f46e5;padding:24px 32px;color:#fff}}
  .header h1{{margin:0;font-size:20px}}
  .body{{padding:28px 32px;text-align:center}}
  .otp{{display:inline-block;background:#eef2ff;color:#4f46e5;font-family:monospace;font-size:36px;font-weight:700;padding:16px 32px;border-radius:10px;letter-spacing:8px;margin:16px 0}}
  .footer{{background:#f9fafb;padding:16px 32px;font-size:12px;color:#9ca3af;text-align:center;border-top:1px solid #f1f1f4}}
</style></head>
<body>
<div class="wrap">
  <div class="header"><h1>Verify your email</h1></div>
  <div class="body">
    <p style="color:#374151;font-size:15px;margin-bottom:4px">{greeting}</p>
    <p style="color:#6b7280;font-size:14px;margin-top:0">Use this code to complete your e-GO sign up:</p>
    <div class="otp">{otp}</div>
    <p style="color:#9ca3af;font-size:13px;margin-top:8px">Valid for 10 minutes. Don&rsquo;t share this with anyone.</p>
  </div>
  <div class="footer">e-GO · If you didn&rsquo;t request this, ignore this email.</div>
</div>
</body></html>"""
    return _resend_send(to, "Your e-GO verification code", html)


# ─── SMS ─────────────────────────────────────────────────────────────────────

def send_booking_confirmation_sms(booking: "Booking") -> None:
    """Send booking confirmation SMS to all passengers. Silent on failure."""
    try:
        provider = _get("SMS_PROVIDER").lower()
        if not provider:
            logger.debug("SMS_PROVIDER not set — skipping SMS for booking %s", booking.id)
            return
        phone = (booking.contact_phone or "").strip()
        if not phone:
            logger.debug("No contact phone for booking %s — skipping SMS", booking.id)
            return
        # Normalise to +91XXXXXXXXXX
        if not phone.startswith("+"):
            phone = "+91" + phone.lstrip("0")

        sched = booking.schedule
        route = sched.route
        try:
            seats = json.loads(booking.seats or "[]")
        except Exception:
            seats = []
        pnr = f"EGO{booking.id:07d}"
        dep = _format_dt(sched.departure_dt)
        seats_str = ", ".join(seats) if seats else "—"
        ticket_url = _ticket_url(booking)

        # Keep under 160 chars for single-segment SMS
        message = (
            f"Booking confirmed! PNR: {pnr} | "
            f"{route.origin} to {route.destination} | "
            f"Seat(s): {seats_str} | Dep: {dep}. "
            f"Ticket: {ticket_url}"
        )

        from users.otp import send_sms
        ok = send_sms(phone, message)
        if ok:
            logger.info("Confirmation SMS sent to %s for booking %s", phone, booking.id)
    except Exception as e:
        logger.error("send_booking_confirmation_sms failed for booking %s: %s", booking.id, e)


# ─── combined ────────────────────────────────────────────────────────────────

def notify_booking_confirmed(booking: "Booking") -> None:
    """Fire email + SMS + WhatsApp for a newly confirmed booking. Never raises."""
    send_booking_confirmation_email(booking)
    send_booking_confirmation_sms(booking)
    send_booking_confirmation_whatsapp(booking)
