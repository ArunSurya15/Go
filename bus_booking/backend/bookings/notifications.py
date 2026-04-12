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

import base64
import html
import json
import logging
import os
import urllib.parse
import urllib.request
from decimal import Decimal, ROUND_HALF_UP
from typing import TYPE_CHECKING, Iterable, List, Optional, Set, Tuple, TypedDict

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


def _format_dt_long(dt) -> str:
    """e.g. Friday, 10 October 2025 — for email hero line."""
    if dt is None:
        return "—"
    try:
        from zoneinfo import ZoneInfo

        local = dt.astimezone(ZoneInfo("Asia/Kolkata")) if dt.tzinfo else dt
        return local.strftime("%A, %d %B %Y")
    except Exception:
        return str(dt)


def _duration_hm(sched) -> str:
    try:
        dep, arr = sched.departure_dt, sched.arrival_dt
        if not dep or not arr:
            return "—"
        secs = (arr - dep).total_seconds()
        if secs <= 0:
            return "—"
        h, m = int(secs // 3600), int((secs % 3600) // 60)
        parts = []
        if h:
            parts.append(f"{h} hr{'s' if h != 1 else ''}")
        if m or not h:
            parts.append(f"{m} min")
        return ", ".join(parts) if parts else "—"
    except Exception:
        return "—"


def _gst_taxable_and_total(amount) -> tuple[str, str, str]:
    """Assume 5% GST included in fare (typical bus aggregator display)."""
    try:
        amt = Decimal(str(amount))
        taxable = (amt / Decimal("1.05")).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
        gst = (amt - taxable).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
        return str(taxable), str(gst), str(amt)
    except Exception:
        return str(amount), "0.00", str(amount)


# ─── email via Resend ────────────────────────────────────────────────────────

class _ResendAttachment(TypedDict):
    filename: str
    content: str


def _resend_send(
    to: str,
    subject: str,
    html: str,
    *,
    attachments: Optional[List[Tuple[str, str]]] = None,
) -> bool:
    """
    Send one email via Resend REST API. Returns True on success.

    attachments: optional list of (filepath on disk, attachment filename).
    """
    api_key = _get("RESEND_API_KEY")
    if not api_key:
        logger.debug("RESEND_API_KEY not set — skipping email to %s", to)
        return False
    body: dict = {
        "from": _get("EMAIL_FROM", "e-GO Tickets <noreply@resend.dev>"),
        "to": [to],
        "subject": subject,
        "html": html,
    }
    if attachments:
        att_payload: list[_ResendAttachment] = []
        for filepath, filename in attachments:
            try:
                if not filepath or not os.path.isfile(filepath):
                    continue
                with open(filepath, "rb") as fp:
                    att_payload.append(
                        {
                            "filename": filename,
                            "content": base64.standard_b64encode(fp.read()).decode("ascii"),
                        }
                    )
            except OSError as e:
                logger.warning("Could not attach %s: %s", filepath, e)
        if att_payload:
            body["attachments"] = att_payload
    payload = json.dumps(body).encode()
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
    inv = f"EGOINV{booking.id:07d}"
    ticket_url = _ticket_url(booking)
    booking_url = _booking_url(booking)
    dep = _format_dt(sched.departure_dt)
    arr = _format_dt(sched.arrival_dt)
    dep_long = _format_dt_long(sched.departure_dt)
    dur = _duration_hm(sched)
    bus_name = (sched.bus.service_name or sched.bus.registration_no) if sched.bus_id else "—"
    bp = booking.boarding_point.location_name if booking.boarding_point_id else route.origin
    dp = booking.dropping_point.location_name if booking.dropping_point_id else route.destination
    passenger = (booking.user.get_full_name() or booking.user.username or "Passenger").strip()
    bill_email = (getattr(booking, "contact_email", None) or booking.user.email or "").strip()
    taxable, gst_amt, total_amt = _gst_taxable_and_total(booking.amount)
    e = lambda x: html.escape(str(x) if x is not None else "", quote=True)
    route_title = f"{route.origin} → {route.destination}"

    return f"""
<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>e-GO Ticket — {e(pnr)}</title>
<style>
  body{{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;background:#eef2ff;margin:0;padding:24px 12px;color:#1e1b4b}}
  .shell{{max-width:600px;margin:0 auto}}
  .card{{background:#fff;border-radius:14px;overflow:hidden;box-shadow:0 4px 24px rgba(67,56,202,.12),0 1px 3px rgba(0,0,0,.06)}}
  .summary{{padding:20px 22px 18px;border-bottom:1px solid #e0e7ff}}
  .summary h2{{margin:0;font-size:18px;font-weight:700;color:#312e81;letter-spacing:-.02em}}
  .summary .sub{{margin:6px 0 0;font-size:13px;color:#64748b}}
  .grid3{{width:100%;border-collapse:collapse;margin-top:16px;font-size:13px}}
  .grid3 td{{vertical-align:top;padding:10px 8px;width:33%;border:1px solid #e2e8f0;border-radius:8px;background:#f8fafc}}
  .grid3 .lbl{{display:block;font-size:11px;text-transform:uppercase;letter-spacing:.04em;color:#64748b;margin-bottom:4px}}
  .grid3 .val{{font-weight:600;color:#1e293b}}
  .hero{{background:linear-gradient(135deg,#4338ca 0%,#6366f1 45%,#4f46e5 100%);color:#fff;padding:22px 22px 0;text-align:center}}
  .hero h1{{margin:0;font-size:20px;font-weight:800;letter-spacing:-.02em}}
  .hero .route{{margin:8px 0 0;font-size:14px;opacity:.95;font-weight:500}}
  .hero-strip{{margin-top:16px;padding:10px 16px;font-size:11px;font-weight:600;letter-spacing:.06em;text-transform:uppercase;
    background:rgba(0,0,0,.18);border-radius:0 0 12px 12px}}
  .body{{padding:22px 22px 26px}}
  .body p{{margin:0 0 14px;font-size:14px;line-height:1.55;color:#334155}}
  .details{{border:1px solid #e2e8f0;border-radius:10px;overflow:hidden;margin:16px 0}}
  .details th{{background:#f1f5f9;text-align:left;font-size:11px;text-transform:uppercase;letter-spacing:.05em;color:#64748b;padding:10px 14px}}
  .details td{{padding:10px 14px;font-size:13px;border-top:1px solid #f1f5f9;color:#334155}}
  .details td:first-child{{width:38%;color:#64748b;font-weight:500}}
  .legal{{font-size:11px;line-height:1.5;color:#64748b;margin:18px 0;padding:12px;background:#f8fafc;border-radius:8px;border:1px solid #e2e8f0}}
  .btn{{display:inline-block;background:linear-gradient(135deg,#4f46e5,#6366f1);color:#fff!important;text-decoration:none;padding:14px 28px;border-radius:10px;font-size:14px;font-weight:700;box-shadow:0 4px 14px rgba(79,70,229,.35)}}
  .btn2{{display:inline-block;margin-top:10px;font-size:13px;color:#4f46e5!important}}
  .footer{{padding:16px;text-align:center;font-size:11px;color:#94a3b8}}
</style></head>
<body>
<div class="shell">
  <div class="card">
    <div class="summary">
      <h2>{e(route_title)}</h2>
      <p class="sub">{e(dep_long)} · {e(dep)} — {e(arr)}</p>
      <table class="grid3" role="presentation">
        <tr>
          <td><span class="lbl">Departure</span><span class="val">{e(dep)}</span></td>
          <td><span class="lbl">Duration</span><span class="val">{e(dur)}</span></td>
          <td><span class="lbl">Arrival</span><span class="val">{e(arr)}</span></td>
        </tr>
        <tr>
          <td><span class="lbl">From</span><span class="val">{e(route.origin)}</span></td>
          <td><span class="lbl">To</span><span class="val">{e(route.destination)}</span></td>
          <td><span class="lbl">PNR</span><span class="val" style="font-family:ui-monospace,monospace">{e(pnr)}</span></td>
        </tr>
      </table>
    </div>
    <div class="hero">
      <h1>e-GO ticket &amp; tax invoice</h1>
      <p class="route">{e(route_title)}</p>
      <p class="route" style="font-size:13px;margin-top:4px;opacity:.9">{e(dep_long)}</p>
      <div class="hero-strip">Ticket #{e(booking.id)} &nbsp;·&nbsp; PNR {e(pnr)} &nbsp;·&nbsp; Invoice {e(inv)}</div>
    </div>
    <div class="body">
      <p>Dear <strong>{e(passenger)}</strong>,<br/>Thank you for booking with e-GO. Your payment is confirmed. A copy of your <strong>ticket &amp; GST invoice</strong> is attached to this email (PDF). You can also download it anytime from the link below.</p>
      <table class="details" role="presentation" width="100%">
        <tr><th colspan="2">Ticket details</th></tr>
        <tr><td>Travels / service</td><td><strong>{e(sched.bus.operator.name if sched.bus_id else '—')}</strong> — {e(bus_name)}</td></tr>
        <tr><td>Seat(s)</td><td><strong>{e(seats_str)}</strong></td></tr>
        <tr><td>Boarding</td><td>{e(bp)}</td></tr>
        <tr><td>Dropping</td><td>{e(dp)}</td></tr>
        <tr><td>Bill to</td><td>{e(passenger)} &lt;{e(bill_email)}&gt;</td></tr>
        <tr><td>Taxable value (excl. GST)</td><td>₹{e(taxable)}</td></tr>
        <tr><td>GST (5% included in fare)</td><td>₹{e(gst_amt)}</td></tr>
        <tr><td><strong>Total paid</strong></td><td><strong>₹{e(total_amt)}</strong></td></tr>
      </table>
      <p class="legal">e-GO is a technology platform connecting passengers with bus operators. This tax invoice is issued for the bus transportation service (SAC 996411) arranged through the platform. For cancellation terms, see the link in your booking.</p>
      <a class="btn" href="{e(ticket_url)}">Download ticket (PDF)</a><br/>
      <a class="btn2" href="{e(booking_url)}">View booking on e-GO</a>
    </div>
    <div class="footer">e-GO · Book smarter, travel better · Automated message — do not reply to this email.</div>
  </div>
</div>
</body></html>"""


def send_booking_confirmation_email(booking: "Booking") -> None:
    """Send booking confirmation + tax invoice email (HTML + PDF attachment when available)."""
    try:
        # Prefer the email the passenger entered at checkout; fall back to account email
        to = (getattr(booking, "contact_email", "") or booking.user.email or "").strip()
        if not to:
            logger.debug("No email for booking %s — skipping confirmation email", booking.id)
            return
        sched = booking.schedule
        route = sched.route
        pnr = f"EGO{booking.id:07d}"
        subject = f"e-GO Ticket & invoice — {pnr} | {route.origin} → {route.destination}"
        html = _booking_confirmation_html(booking)
        attachments: list[tuple[str, str]] | None = None
        tf = (booking.ticket_file or "").strip()
        if tf:
            fp = os.path.join(settings.BASE_DIR, "tickets", tf)
            if os.path.isfile(fp):
                attachments = [(fp, f"e-GO-ticket-{pnr}.pdf")]
        ok = _resend_send(to, subject, html, attachments=attachments)
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


# ─── Operator staff invites ─────────────────────────────────────────────────

def send_operator_staff_invite_email(
    to_email: str,
    invite_url: str,
    operator_name: str,
    role_display: str,
) -> bool:
    """
    Email a teammate their one-time join link. Uses Resend like other mail.
    Returns True if sent; False if RESEND_API_KEY is unset or send failed.
    """
    e = lambda x: html.escape(str(x) if x is not None else "", quote=True)
    org = (operator_name or "Your team").strip() or "Your team"
    role_line = (role_display or "teammate").strip()
    subject = f"You're invited to {org} on e-GO"
    html_body = f"""
<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><title>Operator invite — e-GO</title>
<style>
  body{{font-family:Arial,sans-serif;background:#f6f7fb;margin:0;padding:0}}
  .wrap{{max-width:520px;margin:32px auto;background:#fff;border-radius:10px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,.08)}}
  .header{{background:#4f46e5;padding:24px 32px;color:#fff}}
  .header h1{{margin:0;font-size:20px}}
  .body{{padding:28px 32px;color:#374151;font-size:15px;line-height:1.5}}
  .btn{{display:inline-block;margin:20px 0;padding:14px 28px;background:#4f46e5;color:#fff!important;text-decoration:none;border-radius:999px;font-weight:600;font-size:15px}}
  .muted{{color:#6b7280;font-size:13px}}
  .footer{{background:#f9fafb;padding:16px 32px;font-size:12px;color:#9ca3af;text-align:center;border-top:1px solid #f1f1f4}}
</style></head>
<body>
<div class="wrap">
  <div class="header"><h1>Join your operator team</h1></div>
  <div class="body">
    <p><strong>{e(org)}</strong> invited you to e-GO as <strong>{e(role_line)}</strong>.</p>
    <p class="muted">Open the link below to choose a password and access the operator portal. The link expires in seven days.</p>
    <p style="text-align:center"><a class="btn" href="{e(invite_url)}">Accept invitation</a></p>
    <p class="muted" style="word-break:break-all">If the button doesn&rsquo;t work, paste this URL into your browser:<br/>{e(invite_url)}</p>
  </div>
  <div class="footer">e-GO · If you didn&rsquo;t expect this, you can ignore this email.</div>
</div>
</body></html>"""
    return _resend_send(to_email, subject, html_body)


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
