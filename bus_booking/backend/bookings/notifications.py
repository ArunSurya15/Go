"""
Booking notification helpers — email (Resend) and WhatsApp (Twilio or Meta Cloud API).

All functions are fire-and-forget: they log errors but never raise, so a failed
notification never breaks the booking flow.

Enable by setting keys in .env (see settings.py for variable names):
  Email:     RESEND_API_KEY, EMAIL_FROM, APP_BASE_URL
  WhatsApp:  WHATSAPP_PROVIDER=twilio|meta  + provider-specific keys
  SMS:       SMS_PROVIDER + keys (same as booking confirmations)

Operator alerts (KYC cleared/rejected, schedule approved/rejected, trips going live) use the same
channels. Recipients are parsed from operator contact_info (phone, email, alternates) and linked
OPERATOR users. WhatsApp is sent without a separate opt-in (transactional service update).
"""

from __future__ import annotations

import html
import json
import logging
import urllib.request
import urllib.parse
from typing import TYPE_CHECKING, Iterable, Set, Tuple

from django.apps import apps
from django.conf import settings

if TYPE_CHECKING:
    from .models import Booking, Schedule

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


# ─── Operator alerts (KYC / schedules) — email + SMS + WhatsApp ─────────────

def _operator_portal_url() -> str:
    return f"{_get('APP_BASE_URL', 'http://localhost:3000').rstrip('/')}/operator/dashboard"


def _operator_contact_dict(contact_info: str) -> dict:
    raw = (contact_info or "").strip()
    if not raw:
        return {}
    try:
        d = json.loads(raw)
        return d if isinstance(d, dict) else {}
    except Exception:
        return {}


def _kyc_cleared_status(value: str) -> bool:
    return (value or "").strip().upper() in frozenset({"VERIFIED", "APPROVED"})


def collect_operator_recipients(operator) -> Tuple[Set[str], Set[str]]:
    """
    Emails and phone numbers to notify for an operator.
    Uses contact_info JSON (phone, email, alternates) and linked OPERATOR users.
    """
    emails: Set[str] = set()
    phones: Set[str] = set()
    d = _operator_contact_dict(getattr(operator, "contact_info", "") or "")
    for key in ("email", "alternate_email"):
        em = d.get(key)
        if em and isinstance(em, str) and "@" in em.strip():
            emails.add(em.strip().lower())
    for key in ("phone", "alternate_phone"):
        ph = d.get(key)
        if ph and str(ph).strip():
            phones.add(str(ph).strip())
    User = apps.get_model("users", "User")
    for u in User.objects.filter(operator_id=operator.id, role="OPERATOR").only("email", "phone"):
        if u.email and str(u.email).strip():
            emails.add(str(u.email).strip().lower())
        if u.phone and str(u.phone).strip():
            phones.add(str(u.phone).strip())
    return emails, phones


def _phones_for_sms_whatsapp(phones: Iterable[str]) -> list:
    from users.otp import normalize_phone

    out = []
    seen = set()
    for raw in phones:
        p = normalize_phone(raw)
        if len(p) >= 12 and p not in seen:
            seen.add(p)
            out.append(p)
    return out


def send_operator_whatsapp(phone: str, message: str) -> bool:
    """Transactional WhatsApp to operator (no passenger opt-in). Returns True if sent."""
    provider = _get("WHATSAPP_PROVIDER").lower()
    if not provider:
        logger.debug("WHATSAPP_PROVIDER not set — skipping operator WhatsApp")
        return False
    if provider == "twilio":
        return _send_via_twilio(phone, message)
    if provider == "meta":
        return _send_via_meta(phone, message)
    logger.warning("Unknown WHATSAPP_PROVIDER=%s", provider)
    return False


def _broadcast_operator_sms(phones: list, body: str) -> None:
    from users.otp import send_sms

    for phone in phones:
        try:
            if send_sms(phone, body):
                logger.info("Operator SMS sent to %s", phone)
        except Exception as e:
            logger.error("Operator SMS failed to %s: %s", phone, e)


def _broadcast_operator_whatsapp(phones: list, body: str) -> None:
    for phone in phones:
        try:
            if send_operator_whatsapp(phone, body):
                logger.info("Operator WhatsApp sent to %s", phone)
        except Exception as e:
            logger.error("Operator WhatsApp failed to %s: %s", phone, e)


def _broadcast_operator_email(emails: Set[str], subject: str, html: str) -> None:
    for to in emails:
        try:
            if _resend_send(to, subject, html):
                logger.info("Operator email sent to %s", to)
        except Exception as e:
            logger.error("Operator email failed to %s: %s", to, e)


def notify_operator_clarification_request(
    operator,
    subject: str,
    body_plain: str,
    *,
    admin_username: str = "",
) -> None:
    """
    Admin asks operator for more KYC / business information (email + short SMS + WhatsApp).
    Never raises.
    """
    try:
        name = (operator.name or "Operator").strip()
        emails, phones = collect_operator_recipients(operator)
        phones_norm = _phones_for_sms_whatsapp(phones)
        portal = _operator_portal_url()
        body_html = (
            f"<p style='color:#374151;font-size:15px'>Hello,</p>"
            f"<div style='color:#1f2937;font-size:15px;line-height:1.6'>"
            f"{html.escape(body_plain).replace(chr(10), '<br>')}</div>"
            f"<p style='margin-top:20px'><a href='{html.escape(portal)}' style='color:#4f46e5'>Open operator dashboard</a></p>"
        )
        if admin_username:
            body_html += f"<p style='color:#9ca3af;font-size:12px'>Message from e-GO admin ({html.escape(admin_username)}).</p>"
        full_html = f"""
<!DOCTYPE html><html><head><meta charset="UTF-8"></head>
<body style="font-family:Arial,sans-serif;background:#f6f7fb;padding:24px">
<div style="max-width:560px;margin:0 auto;background:#fff;border-radius:10px;padding:28px">
  <h1 style="color:#4f46e5;margin:0 0 12px;font-size:18px">{html.escape(subject)}</h1>
  {body_html}
  <p style="color:#9ca3af;font-size:12px;margin-top:24px">— e-GO</p>
</div></body></html>"""
        _broadcast_operator_email(emails, f"e-GO: {subject}", full_html)
        sms = f"e-GO: {subject[:80]}. Check email for details. {portal}"
        wa = f"📩 *e-GO — KYC / account*\n*{subject}*\n\n{body_plain[:900]}\n\n{portal}"
        _broadcast_operator_sms(phones_norm, sms[:480])
        _broadcast_operator_whatsapp(phones_norm, wa[:1600])
    except Exception as e:
        logger.error("notify_operator_clarification_request failed: %s", e)


def notify_operator_kyc_changed(operator, old_status: str, new_status: str) -> None:
    """
    After admin changes operator KYC: notify on approval (→ VERIFIED/APPROVED) or rejection (→ REJECTED).
    Fire-and-forget; never raises.
    """
    try:
        old = (old_status or "").strip().upper()
        new = (new_status or "").strip().upper()
        if old == new:
            return
        emails, phones = collect_operator_recipients(operator)
        phones_norm = _phones_for_sms_whatsapp(phones)
        name = (operator.name or "Operator").strip()
        portal = _operator_portal_url()

        if _kyc_cleared_status(new) and not _kyc_cleared_status(old):
            subject = f"e-GO: KYC verified — {name}"
            html = f"""
<!DOCTYPE html><html><head><meta charset="UTF-8"></head>
<body style="font-family:Arial,sans-serif;background:#f6f7fb;padding:24px">
<div style="max-width:520px;margin:0 auto;background:#fff;border-radius:10px;padding:28px">
  <h1 style="color:#16a34a;margin:0 0 12px;font-size:20px">KYC verified</h1>
  <p style="color:#374151;font-size:15px">Hello,</p>
  <p style="color:#374151;font-size:15px">Your operator account <strong>{name}</strong> has been verified on e-GO.
  New trips you add can go live immediately without waiting in the admin approval queue.</p>
  <p><a href="{portal}" style="color:#4f46e5">Open operator dashboard</a></p>
  <p style="color:#9ca3af;font-size:12px;margin-top:24px">— e-GO</p>
</div></body></html>"""
            sms = (
                f"e-GO: KYC verified for {name}. New schedules can go live. Dashboard: {portal}"
            )
            wa = (
                f"✅ *KYC verified*\n\n"
                f"Operator: *{name}*\n"
                f"Your account is cleared on e-GO. New trips can publish as live immediately.\n"
                f"Dashboard: {portal}"
            )
            _broadcast_operator_email(emails, subject, html)
            _broadcast_operator_sms(phones_norm, sms)
            _broadcast_operator_whatsapp(phones_norm, wa)

        elif new == "REJECTED" and old != "REJECTED":
            subject = f"e-GO: KYC update — {name}"
            html = f"""
<!DOCTYPE html><html><head><meta charset="UTF-8"></head>
<body style="font-family:Arial,sans-serif;background:#f6f7fb;padding:24px">
<div style="max-width:520px;margin:0 auto;background:#fff;border-radius:10px;padding:28px">
  <h1 style="color:#b91c1c;margin:0 0 12px;font-size:20px">KYC not approved</h1>
  <p style="color:#374151;font-size:15px">Hello,</p>
  <p style="color:#374151;font-size:15px">Your operator profile <strong>{name}</strong> could not be verified yet.
  Please review your submitted details in the operator portal or contact e-GO support.</p>
  <p><a href="{portal}" style="color:#4f46e5">Open operator dashboard</a></p>
  <p style="color:#9ca3af;font-size:12px;margin-top:24px">— e-GO</p>
</div></body></html>"""
            sms = f"e-GO: KYC not approved for {name}. Check operator portal: {portal}"
            wa = f"⚠️ *KYC update*\n\nOperator: *{name}*\nStatus: not approved. Please check the operator portal.\n{portal}"
            _broadcast_operator_email(emails, subject, html)
            _broadcast_operator_sms(phones_norm, sms)
            _broadcast_operator_whatsapp(phones_norm, wa)
    except Exception as e:
        logger.error("notify_operator_kyc_changed failed: %s", e)


def notify_operator_schedule_published(schedule: "Schedule", *, source: str = "admin") -> None:
    """
    Trip is live (ACTIVE): admin approved or auto-published for verified operator.
    source: 'admin' | 'auto'
    """
    try:
        operator = schedule.bus.operator
        emails, phones = collect_operator_recipients(operator)
        phones_norm = _phones_for_sms_whatsapp(phones)
        route = schedule.route
        dep = _format_dt(schedule.departure_dt)
        reg = schedule.bus.registration_no
        label = "approved and is now live" if source == "admin" else "is now live on e-GO"
        subject = f"e-GO: Trip live — {route.origin} → {route.destination}"
        html = f"""
<!DOCTYPE html><html><head><meta charset="UTF-8"></head>
<body style="font-family:Arial,sans-serif;background:#f6f7fb;padding:24px">
<div style="max-width:520px;margin:0 auto;background:#fff;border-radius:10px;padding:28px">
  <h1 style="color:#4f46e5;margin:0 0 12px;font-size:20px">Trip published</h1>
  <p style="color:#374151;font-size:15px">Your schedule has been {label}.</p>
  <table style="width:100%;font-size:14px;color:#374151;margin-top:12px">
    <tr><td style="color:#6b7280">Route</td><td><strong>{route.origin} → {route.destination}</strong></td></tr>
    <tr><td style="color:#6b7280">Departure</td><td>{dep}</td></tr>
    <tr><td style="color:#6b7280">Bus</td><td>{reg}</td></tr>
  </table>
  <p style="margin-top:16px"><a href="{_operator_portal_url()}" style="color:#4f46e5">Operator dashboard</a></p>
  <p style="color:#9ca3af;font-size:12px">— e-GO</p>
</div></body></html>"""
        sms = (
            f"e-GO: Trip live {route.origin}-{route.destination} {dep} Bus {reg}. "
            f"{_operator_portal_url()}"
        )
        wa = (
            f"✅ *Trip live*\n"
            f"{route.origin} → {route.destination}\n"
            f"*Dep:* {dep}\n*Bus:* {reg}\n"
            f"Dashboard: {_operator_portal_url()}"
        )
        _broadcast_operator_email(emails, subject, html)
        _broadcast_operator_sms(phones_norm, sms)
        _broadcast_operator_whatsapp(phones_norm, wa)
    except Exception as e:
        logger.error("notify_operator_schedule_published failed for schedule %s: %s", schedule.id, e)


def notify_operator_bulk_schedules_published(operator, count: int, date_from, date_to) -> None:
    """Many trips went live at once (bulk create for verified operator). One notification bundle."""
    try:
        if count <= 0:
            return
        emails, phones = collect_operator_recipients(operator)
        phones_norm = _phones_for_sms_whatsapp(phones)
        name = (operator.name or "Operator").strip()
        portal = _operator_portal_url()
        df = date_from.isoformat() if hasattr(date_from, "isoformat") else str(date_from)
        dt = date_to.isoformat() if hasattr(date_to, "isoformat") else str(date_to)
        subject = f"e-GO: {count} trip(s) now live — {name}"
        html = f"""
<!DOCTYPE html><html><head><meta charset="UTF-8"></head>
<body style="font-family:Arial,sans-serif;background:#f6f7fb;padding:24px">
<div style="max-width:520px;margin:0 auto;background:#fff;border-radius:10px;padding:28px">
  <h1 style="color:#4f46e5;margin:0 0 12px;font-size:20px">Trips published</h1>
  <p style="color:#374151;font-size:15px"><strong>{count}</strong> new schedule(s) for <strong>{name}</strong> are live on e-GO
  (dates {df} to {dt}).</p>
  <p><a href="{portal}" style="color:#4f46e5">Operator dashboard</a></p>
  <p style="color:#9ca3af;font-size:12px">— e-GO</p>
</div></body></html>"""
        sms = f"e-GO: {count} new trip(s) live for {name} ({df}–{dt}). {portal}"
        wa = f"✅ *{count} trip(s) now live*\n{name}\nDates: {df} to {dt}\n{portal}"
        _broadcast_operator_email(emails, subject, html)
        _broadcast_operator_sms(phones_norm, sms)
        _broadcast_operator_whatsapp(phones_norm, wa)
    except Exception as e:
        logger.error("notify_operator_bulk_schedules_published failed: %s", e)


def notify_operator_schedule_rejected(schedule: "Schedule") -> None:
    """Admin rejected a pending schedule (CANCELLED)."""
    try:
        operator = schedule.bus.operator
        emails, phones = collect_operator_recipients(operator)
        phones_norm = _phones_for_sms_whatsapp(phones)
        route = schedule.route
        dep = _format_dt(schedule.departure_dt)
        reg = schedule.bus.registration_no
        subject = f"e-GO: Trip not approved — {route.origin} → {route.destination}"
        html = f"""
<!DOCTYPE html><html><head><meta charset="UTF-8"></head>
<body style="font-family:Arial,sans-serif;background:#f6f7fb;padding:24px">
<div style="max-width:520px;margin:0 auto;background:#fff;border-radius:10px;padding:28px">
  <h1 style="color:#b45309;margin:0 0 12px;font-size:20px">Trip not approved</h1>
  <p style="color:#374151;font-size:15px">A schedule you submitted was not approved and will not appear for booking.</p>
  <table style="width:100%;font-size:14px;color:#374151;margin-top:12px">
    <tr><td style="color:#6b7280">Route</td><td><strong>{route.origin} → {route.destination}</strong></td></tr>
    <tr><td style="color:#6b7280">Departure</td><td>{dep}</td></tr>
    <tr><td style="color:#6b7280">Bus</td><td>{reg}</td></tr>
  </table>
  <p style="margin-top:16px">Create a corrected trip from your <a href="{_operator_portal_url()}" style="color:#4f46e5">operator dashboard</a>.</p>
  <p style="color:#9ca3af;font-size:12px">— e-GO</p>
</div></body></html>"""
        sms = f"e-GO: Trip not approved {route.origin}-{route.destination} {dep}. Portal: {_operator_portal_url()}"
        wa = (
            f"⚠️ *Trip not approved*\n"
            f"{route.origin} → {route.destination}\n"
            f"*Dep:* {dep}\n*Bus:* {reg}\n"
            f"See operator portal."
        )
        _broadcast_operator_email(emails, subject, html)
        _broadcast_operator_sms(phones_norm, sms)
        _broadcast_operator_whatsapp(phones_norm, wa)
    except Exception as e:
        logger.error("notify_operator_schedule_rejected failed for schedule %s: %s", schedule.id, e)
