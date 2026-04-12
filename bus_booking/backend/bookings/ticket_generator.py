"""
Professional bus ticket + GST invoice PDF (e-GO indigo branding).

Layout inspired by carrier-style tickets: hero strip, QR + journey summary,
reference IDs, structured tables, invoice line items, legal footer.
"""

import hashlib
import html
import hmac
import json
import os
from datetime import datetime
from decimal import Decimal, ROUND_HALF_UP
from io import BytesIO

import qrcode
from django.conf import settings
from django.core.files.base import ContentFile
from django.utils import timezone as django_tz
from reportlab.lib import colors
from reportlab.lib.colors import HexColor
from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_RIGHT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.platypus import Image, KeepTogether, Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle

from .ticket_pdf_icons import label_row_with_icon

from .models import Booking

# e-GO palette (indigo — not competitor red)
C_PRIMARY = HexColor("#3730a3")
C_PRIMARY_DARK = HexColor("#312e81")
C_MUTED = HexColor("#64748b")
C_LINE = HexColor("#e2e8f0")
C_PANEL = HexColor("#f8fafc")
# Neutral surfaces only (avoid pale indigo fills on every subsection).
C_HEAD_GREY = HexColor("#f3f4f6")
C_WHITE = colors.white
C_SLATE = HexColor("#1e293b")


def generate_ticket_signature(booking_id: int) -> str:
    secret = getattr(settings, "TICKET_SECRET", "default-secret-change-in-production")
    message = f"booking_{booking_id}_{datetime.now().strftime('%Y%m%d')}"
    return hmac.new(secret.encode("utf-8"), message.encode("utf-8"), hashlib.sha256).hexdigest()[:16]


def generate_qr_code(booking_id: int) -> BytesIO:
    signature = generate_ticket_signature(booking_id)
    qr_data = f"booking:{booking_id}:{signature}"
    qr = qrcode.QRCode(
        version=1,
        error_correction=qrcode.constants.ERROR_CORRECT_M,
        box_size=7,
        border=2,
    )
    qr.add_data(qr_data)
    qr.make(fit=True)
    img = qr.make_image(fill_color="#312e81", back_color="white")
    buf = BytesIO()
    img.save(buf, format="PNG")
    buf.seek(0)
    return buf


def _format_dt_pdf(dt) -> str:
    if dt is None:
        return "—"
    try:
        from zoneinfo import ZoneInfo

        local = dt.astimezone(ZoneInfo("Asia/Kolkata")) if getattr(dt, "tzinfo", None) else dt
        return local.strftime("%d %b %Y, %I:%M %p IST")
    except Exception:
        return str(dt)


def _seats_list(booking: Booking) -> list:
    try:
        s = json.loads(booking.seats or "[]")
        return s if isinstance(s, list) else []
    except Exception:
        return []


def _passenger_demographic_line(booking: Booking) -> str:
    """Age / gender from passenger_details for first seat (same idea as Show ticket modal)."""
    try:
        pd = json.loads(booking.passenger_details or "{}")
    except Exception:
        pd = {}
    if not isinstance(pd, dict):
        return ""
    seats = _seats_list(booking)
    first = seats[0] if seats else None
    p = pd.get(first) if first else None
    if not isinstance(p, dict):
        p = {}
    parts: list[str] = []
    age = p.get("age")
    if age is not None and str(age).strip() != "":
        parts.append(f"{age} yrs")
    g_raw = (str(p.get("gender") or "")).strip()
    if g_raw:
        gu = g_raw.upper()
        gl = {"M": "Male", "F": "Female", "O": "Other"}.get(gu)
        if gl is None:
            gl = g_raw[:40] if len(g_raw) > 3 else gu.title()
        parts.append(gl)
    return ", ".join(parts)


def _gst_lines(amount) -> tuple[str, str, str]:
    try:
        amt = Decimal(str(amount))
        taxable = (amt / Decimal("1.05")).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
        gst = (amt - taxable).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
        return str(taxable), str(gst), str(amt)
    except Exception:
        a = str(amount)
        return a, "0.00", a


def _p(text: str) -> str:
    return html.escape(str(text) if text is not None else "", quote=True)


def _format_rs(amount) -> str:
    try:
        d = Decimal(str(amount)).quantize(Decimal("0.01"))
        return f"Rs. {d}"
    except Exception:
        return f"Rs. {_p(str(amount))}"


# Matches frontend `cancellation-policy` illustrative tiers (keep in sync if those change).
CXL_FULL_H = 24
CXL_PARTIAL_H = 6
CXL_PARTIAL_PCT = 50


def generate_ticket_pdf(booking: Booking) -> ContentFile:
    buffer = BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=A4,
        rightMargin=40,
        leftMargin=40,
        topMargin=30,
        bottomMargin=36,
    )
    # All column widths in **points** from frame width — avoids tables spilling past margins.
    uw = float(doc.width)
    qr_w = min(100.0, uw * 0.195)
    # Hero right column: pad both sides so nested tables + box strokes stay inside the frame (no right spill).
    hero_right_left_pad = 10.0
    hero_right_right_pad = 12.0
    main_flow = max(64.0, uw - qr_w - hero_right_left_pad - hero_right_right_pad)

    styles = getSampleStyleSheet()

    st_brand = ParagraphStyle(
        "brand",
        parent=styles["Normal"],
        fontName="Helvetica-Bold",
        fontSize=24,
        textColor=C_WHITE,
        leading=28,
        spaceAfter=2,
    )
    st_brand_sub = ParagraphStyle(
        "brandSub",
        parent=styles["Normal"],
        fontName="Helvetica",
        fontSize=8.5,
        textColor=HexColor("#e5e7eb"),
        leading=11,
        spaceAfter=0,
    )
    st_route = ParagraphStyle(
        "route",
        parent=styles["Normal"],
        fontName="Helvetica-Bold",
        fontSize=13.5,
        textColor=C_PRIMARY_DARK,
        leading=17,
        alignment=TA_LEFT,
    )
    st_label = ParagraphStyle(
        "lbl",
        parent=styles["Normal"],
        fontName="Helvetica",
        fontSize=7.2,
        textColor=C_MUTED,
        leading=9.5,
        alignment=TA_LEFT,
    )
    # Single-line labels beside icons: leading ≈ icon slot so MIDDLE valign centers text with the glyph.
    st_label_row = ParagraphStyle(
        "lblrow",
        parent=st_label,
        leading=12.0,
        spaceBefore=0,
        spaceAfter=0,
    )
    st_val = ParagraphStyle(
        "val",
        parent=styles["Normal"],
        fontName="Helvetica-Bold",
        fontSize=9.5,
        textColor=C_SLATE,
        leading=12,
        alignment=TA_LEFT,
    )
    st_sec_title = ParagraphStyle(
        "sec",
        parent=styles["Normal"],
        fontName="Helvetica-Bold",
        fontSize=9,
        textColor=C_PRIMARY,
        leading=11,
        spaceBefore=7,
        spaceAfter=4,
    )
    st_body = ParagraphStyle(
        "body",
        parent=styles["Normal"],
        fontSize=8.5,
        textColor=C_SLATE,
        leading=11.5,
    )
    st_body_small = ParagraphStyle(
        "bodys",
        parent=st_body,
        fontSize=7.8,
        leading=10.5,
    )
    st_foot = ParagraphStyle(
        "foot",
        parent=styles["Normal"],
        fontSize=7.2,
        textColor=C_MUTED,
        leading=9.5,
        alignment=TA_CENTER,
    )
    st_ref_lbl = ParagraphStyle(
        "refl",
        parent=styles["Normal"],
        fontName="Helvetica",
        fontSize=7,
        textColor=C_MUTED,
        leading=9,
        alignment=TA_CENTER,
    )
    st_td_title = ParagraphStyle(
        "tdt",
        parent=styles["Normal"],
        fontName="Helvetica-Bold",
        fontSize=9.5,
        textColor=C_PRIMARY_DARK,
        leading=12,
    )
    st_td_banner = ParagraphStyle(
        "tdban",
        parent=st_td_title,
        textColor=C_WHITE,
        fontSize=9.5,
    )
    st_legal = ParagraphStyle(
        "legal",
        parent=styles["Normal"],
        fontName="Helvetica",
        fontSize=7.6,
        textColor=C_SLATE,
        leading=10.5,
        alignment=TA_LEFT,
    )
    st_legal_head = ParagraphStyle(
        "legalh",
        parent=st_legal,
        fontName="Helvetica-Bold",
        fontSize=8.2,
        textColor=C_PRIMARY_DARK,
        spaceBefore=2,
        spaceAfter=3,
    )
    st_box_title = ParagraphStyle(
        "boxt",
        parent=styles["Normal"],
        fontName="Helvetica-Bold",
        fontSize=9.5,
        textColor=C_PRIMARY_DARK,
        leading=11,
    )

    sched = booking.schedule
    route = sched.route
    pnr = f"EGO{booking.id:07d}"
    inv = f"EGOINV{booking.id:07d}"
    seats = _seats_list(booking)
    seats_str = ", ".join(seats) if seats else "—"
    bp = booking.boarding_point.location_name if booking.boarding_point_id else route.origin
    dp = booking.dropping_point.location_name if booking.dropping_point_id else route.destination
    passenger = booking.user.get_full_name() or booking.user.username or "Passenger"
    bill_email = (getattr(booking, "contact_email", None) or booking.user.email or "").strip()
    taxable, gst_amt, total_amt = _gst_lines(booking.amount)
    bus = sched.bus
    op_name = bus.operator.name if sched.bus_id else "—"
    reg = bus.registration_no if sched.bus_id else "—"
    svc = (bus.service_name or "").strip() or "—"
    base_url = (getattr(settings, "APP_BASE_URL", None) or "https://e-go.example").rstrip("/")

    route_txt = _p(f"{route.origin} → {route.destination}")
    dep_s = _p(_format_dt_pdf(sched.departure_dt))
    arr_s = _p(_format_dt_pdf(sched.arrival_dt))

    story = []

    # ── Top brand bar (full width) ─────────────────────────────
    st_right_meta = ParagraphStyle(
        "rs",
        parent=st_brand_sub,
        alignment=TA_RIGHT,
        fontSize=8.5,
        textColor=HexColor("#e5e7eb"),
    )
    brand_left_w = min(168.0, uw * 0.30)
    brand_row = Table(
        [
            [
                Paragraph("e-GO", st_brand),
                Paragraph(
                    "Electronic ticket &amp; tax invoice<br/>Passenger road transport · SAC 996411",
                    st_right_meta,
                ),
            ]
        ],
        colWidths=[brand_left_w, uw - brand_left_w],
    )
    brand_row.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, -1), C_PRIMARY),
                ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                ("LEFTPADDING", (0, 0), (0, 0), 14),
                ("RIGHTPADDING", (1, 0), (1, 0), 14),
                ("TOPPADDING", (0, 0), (-1, -1), 11),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 11),
            ]
        )
    )
    story.append(brand_row)

    # ── Hero: QR + route / times (nested widths = main_flow so table does not spill) ──
    qr_buf = generate_qr_code(booking.id)
    qr_side = max(56.0, qr_w - 12.0)
    qr_img = Image(qr_buf, width=qr_side, height=qr_side)
    qr_cell = Table([[qr_img]], colWidths=[qr_w])
    qr_cell.setStyle(
        TableStyle(
            [
                ("ALIGN", (0, 0), (-1, -1), "CENTER"),
                ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                ("BACKGROUND", (0, 0), (-1, -1), C_WHITE),
                ("BOX", (0, 0), (-1, -1), 0.55, C_LINE),
                ("TOPPADDING", (0, 0), (-1, -1), 7),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 7),
            ]
        )
    )

    # Nested table + strokes eat a few points; stay clearly inside the hero text column.
    times_w = max(36.0, main_flow - 20.0)
    tw0 = times_w / 2.0
    tw1 = times_w - tw0
    st_time_cell = ParagraphStyle(
        "tcell",
        parent=st_val,
        fontSize=7.4,
        leading=9.0,
    )
    times_inner = Table(
        [
            [
                Paragraph("DEPARTURE", st_label),
                Paragraph("ARRIVAL", st_label),
            ],
            [
                Paragraph(dep_s, ParagraphStyle("dv", parent=st_time_cell)),
                Paragraph(arr_s, ParagraphStyle("av", parent=st_time_cell)),
            ],
        ],
        colWidths=[tw0, tw1],
    )
    times_inner.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, -1), C_PANEL),
                ("BOX", (0, 0), (-1, -1), 0.45, C_LINE),
                ("INNERGRID", (0, 0), (-1, -1), 0.3, C_LINE),
                ("TOPPADDING", (0, 0), (-1, -1), 4),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
                ("LEFTPADDING", (0, 0), (-1, -1), 4),
                ("RIGHTPADDING", (0, 0), (-1, -1), 4),
            ]
        )
    )

    right_stack = Table(
        [
            [Paragraph(f"<para align='left'>{route_txt}</para>", st_route)],
            [times_inner],
        ],
        colWidths=[main_flow],
    )
    right_stack.setStyle(TableStyle([("VALIGN", (0, 0), (-1, -1), "TOP"), ("TOPPADDING", (0, 0), (-1, -1), 0)]))

    hero_right_w = uw - qr_w
    hero = Table([[qr_cell, right_stack]], colWidths=[qr_w, hero_right_w])
    hero.setStyle(
        TableStyle(
            [
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("LEFTPADDING", (1, 0), (1, 0), hero_right_left_pad),
                ("RIGHTPADDING", (1, 0), (1, 0), hero_right_right_pad),
                ("TOPPADDING", (0, 0), (-1, -1), 10),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 10),
                ("BACKGROUND", (0, 0), (-1, -1), C_WHITE),
                ("BOX", (0, 0), (-1, -1), 0.7, C_LINE),
            ]
        )
    )
    story.append(hero)

    # ── Reference strip (same family as body text, not monospace) ─────────
    w3 = uw / 3.0
    ref = Table(
        [
            [
                Paragraph(
                    f"<b>PNR</b><br/><font name='Helvetica-Bold' size='10'>{_p(pnr)}</font>",
                    st_ref_lbl,
                ),
                Paragraph(
                    f"<b>Invoice no.</b><br/><font name='Helvetica-Bold' size='10'>{_p(inv)}</font>",
                    st_ref_lbl,
                ),
                Paragraph(
                    f"<b>Trip ref.</b><br/><font name='Helvetica-Bold' size='10'>#{booking.id}</font>",
                    st_ref_lbl,
                ),
            ]
        ],
        colWidths=[w3, w3, w3],
    )
    ref.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, -1), C_WHITE),
                ("BOX", (0, 0), (-1, -1), 0.55, C_LINE),
                ("INNERGRID", (0, 0), (-1, -1), 0.4, C_LINE),
                ("TOPPADDING", (0, 0), (-1, -1), 7),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 7),
                ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
            ]
        )
    )
    story.append(ref)
    story.append(Spacer(1, 5))

    # ── Ticket details (redBus-style single panel) ───────────────────────
    bp_lm = ""
    bp_time_note = ""
    if booking.boarding_point_id:
        bpt = booking.boarding_point
        bp_lm = (bpt.landmark or "").strip()
        bp_time_note = bpt.time.strftime("%I:%M %p") if bpt.time else ""
    dp_desc = ""
    dp_time_note = ""
    if booking.dropping_point_id:
        dpt = booking.dropping_point
        dp_desc = (dpt.description or "").strip()
        dp_time_note = dpt.time.strftime("%I:%M %p") if dpt.time else ""

    op_contact = ""
    if sched.bus_id and bus.operator_id:
        op_contact = (bus.operator.contact_info or "").strip()[:220]

    boarding_val_parts = [f"<b>{_p(bp)}</b>"]
    if bp_lm:
        boarding_val_parts.append(f"<font size='7.5' color='#64748b'>{_p(bp_lm)}</font>")
    if bp_time_note:
        boarding_val_parts.append(f"<font size='7.5' color='#64748b'>Reporting time at point: {_p(bp_time_note)} IST</font>")
    if op_contact:
        boarding_val_parts.append(f"<font size='7.5' color='#312e81'><b>{_p(op_contact)}</b></font>")
    boarding_para = Paragraph("<br/>".join(boarding_val_parts), st_body)

    dropping_val_parts = [f"<b>{_p(dp)}</b>"]
    if dp_desc:
        dropping_val_parts.append(f"<font size='7.5' color='#64748b'>{_p(dp_desc)}</font>")
    dropping_val_parts.append(
        f"<font size='7.5' color='#64748b'>Dropping date &amp; time (trip):</font> "
        f"<b>{_p(_format_dt_pdf(sched.arrival_dt))}</b>"
    )
    if dp_time_note:
        dropping_val_parts.append(
            f"<font size='7.5' color='#64748b'>Scheduled time at this point: {_p(dp_time_note)} IST</font>"
        )
    dropping_para = Paragraph("<br/>".join(dropping_val_parts), st_body)

    td_left_w = uw * 0.34
    td_val_w = uw - td_left_w

    pass_demo = _passenger_demographic_line(booking)
    passenger_bits = [f"<b>{_p(passenger)}</b>"]
    if pass_demo:
        passenger_bits.append(f"<font size='7.5' color='#64748b'>{_p(pass_demo)}</font>")
    passenger_bits.append(f"<font size='7.5' color='#64748b'>{_p(bill_email or '—')}</font>")
    passenger_bits.append(
        f"<font size='7.2' color='#64748b'>Seat no.</font> <b>{_p(seats_str)}</b>"
    )
    passenger_para = Paragraph("<br/>".join(passenger_bits), st_body)

    cxl_summary = (
        f"<b>More than {CXL_FULL_H}h</b> before departure: <b>100%</b> fare refund "
        f"(fees/GST per policy).<br/>"
        f"<b>{CXL_PARTIAL_H}h-{CXL_FULL_H}h</b> before: <b>{CXL_PARTIAL_PCT}%</b> fare refund.<br/>"
        f"<b>Under {CXL_PARTIAL_H}h</b> before: <b>no refund</b>.<br/>"
        f"<b>Operator</b> cancels the trip: <b>100%</b> refund processed automatically.<br/>"
        f"Refunds: <b>5-7 business days</b> to the original payment method."
    )
    cxl_how = (
        "Cancel only from <b>My Trips</b> on e-GO; phone or email cancellations are not accepted. "
        "You see the exact refund amount before you confirm. "
        "Cancelling removes the entire booking (all seats together). "
        f"Full policy: <font color='#312e81'>{_p(base_url)}/cancellation-policy</font>"
    )

    ticket_rows = [
        [
            Paragraph("<b>Ticket details</b>", st_td_banner),
            "",
        ],
        [
            label_row_with_icon(
                "calendar",
                Paragraph("Journey date &amp; time", st_label_row),
                td_left_w,
            ),
            Paragraph(_format_dt_pdf(sched.departure_dt), st_val),
        ],
        [
            label_row_with_icon("bus", Paragraph("Travels", st_label_row), td_left_w),
            Paragraph(
                f"<b>{_p(op_name)}</b><br/><font size='7.8' color='#64748b'>{_p(reg)} · {_p(svc)}</font>",
                st_body,
            ),
        ],
        [
            label_row_with_icon("wallet", Paragraph("Ticket price", st_label_row), td_left_w),
            Paragraph(
                f"<b>{_format_rs(booking.amount)}</b><br/><font size='7.5' color='#64748b'>(inclusive of GST)</font>",
                st_body,
            ),
        ],
        [
            label_row_with_icon("map-pin", Paragraph("Boarding point", st_label_row), td_left_w),
            boarding_para,
        ],
        [
            label_row_with_icon("map-pin", Paragraph("Dropping point", st_label_row), td_left_w),
            dropping_para,
        ],
        [
            label_row_with_icon("user", Paragraph("Passenger", st_label_row), td_left_w),
            passenger_para,
        ],
        [
            label_row_with_icon("clipboard-list", Paragraph("Booking issued on", st_label_row), td_left_w),
            Paragraph(_p(_format_dt_pdf(booking.created_at)), st_body),
        ],
    ]
    ticket_tbl = Table(ticket_rows, colWidths=[td_left_w, td_val_w])
    ticket_tbl.setStyle(
        TableStyle(
            [
                ("SPAN", (0, 0), (1, 0)),
                ("BACKGROUND", (0, 0), (-1, 0), C_PRIMARY),
                ("TEXTCOLOR", (0, 0), (-1, 0), C_WHITE),
                ("TOPPADDING", (0, 0), (-1, 0), 6),
                ("BOTTOMPADDING", (0, 0), (-1, 0), 6),
                ("LEFTPADDING", (0, 0), (-1, 0), 9),
                ("LINEBELOW", (0, 0), (-1, 0), 0.5, C_LINE),
                ("BOX", (0, 0), (-1, -1), 0.55, C_LINE),
                ("INNERGRID", (0, 1), (-1, -1), 0.35, C_LINE),
                ("BACKGROUND", (0, 1), (-1, -1), C_WHITE),
                ("VALIGN", (1, 1), (1, -1), "TOP"),
                ("VALIGN", (0, 1), (0, -1), "MIDDLE"),
                ("TOPPADDING", (0, 1), (-1, -1), 4),
                ("BOTTOMPADDING", (0, 1), (-1, -1), 4),
                ("LEFTPADDING", (0, 1), (-1, -1), 6),
                ("RIGHTPADDING", (0, 1), (-1, -1), 8),
            ]
        )
    )
    story.append(ticket_tbl)

    # ── Tax invoice table (column widths sum to uw) ───────────
    story.append(Paragraph("Tax invoice — supply details", st_sec_title))
    desc_line = f"Passenger transport by road: {_p(route.origin)} to {_p(route.destination)}"
    st_desc_cell = ParagraphStyle("descinv", parent=st_body, fontSize=7.9, leading=10.5)
    ih = ParagraphStyle("ih", parent=st_body, fontName="Helvetica-Bold", fontSize=7.6, textColor=C_WHITE)
    iha = ParagraphStyle("iha", parent=ih, alignment=TA_RIGHT)
    inv_rows = [
        [
            Paragraph("<b>HSN / SAC</b>", ih),
            Paragraph("<b>Description</b>", ih),
            Paragraph("<b>Qty</b>", iha),
            Paragraph("<b>Taxable (Rs.)</b>", iha),
            Paragraph("<b>GST 5% (Rs.)</b>", iha),
            Paragraph("<b>Total (Rs.)</b>", iha),
        ],
        [
            Paragraph("996411", st_body),
            Paragraph(desc_line, st_desc_cell),
            Paragraph("1", ParagraphStyle("r", parent=st_body, alignment=TA_RIGHT)),
            Paragraph(_p(taxable), ParagraphStyle("r2", parent=st_body, alignment=TA_RIGHT)),
            Paragraph(_p(gst_amt), ParagraphStyle("r3", parent=st_body, alignment=TA_RIGHT)),
            Paragraph(_p(total_amt), ParagraphStyle("r4", parent=st_body, alignment=TA_RIGHT, fontName="Helvetica-Bold")),
        ],
        [
            "",
            "",
            "",
            Paragraph("<b>Grand total (INR)</b>", ParagraphStyle("gt", parent=st_body, fontName="Helvetica-Bold", alignment=TA_RIGHT)),
            "",
            Paragraph(f"<b>{_p(total_amt)}</b>", ParagraphStyle("gta", parent=st_body, fontName="Helvetica-Bold", alignment=TA_RIGHT, fontSize=10)),
        ],
    ]
    cw_ratios = [0.092, 0.455, 0.068, 0.128, 0.125, 0.132]
    cw = [uw * r for r in cw_ratios]
    inv_t = Table(inv_rows, colWidths=cw)
    inv_t.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, 0), C_PRIMARY),
                ("TEXTCOLOR", (0, 0), (-1, 0), C_WHITE),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
                ("TOPPADDING", (0, 0), (-1, -1), 8),
                ("LEFTPADDING", (0, 0), (-1, -1), 5),
                ("RIGHTPADDING", (0, 0), (-1, -1), 5),
                ("BOX", (0, 0), (-1, -1), 0.65, C_LINE),
                ("LINEBELOW", (0, 1), (-1, 1), 0.5, C_LINE),
                ("BACKGROUND", (0, 1), (-1, 1), C_WHITE),
                ("BACKGROUND", (0, 2), (-1, 2), C_HEAD_GREY),
            ]
        )
    )
    story.append(inv_t)
    story.append(Spacer(1, 4))
    story.append(
        Paragraph(
            "<i>Fare above is shown with GST computed on a 5% inclusive basis for platform display. "
            "Final tax treatment follows the operator invoice where applicable.</i>",
            ParagraphStyle("gstmini", parent=st_foot, alignment=TA_LEFT, fontSize=7),
        )
    )

    # ── Note regarding tax invoice (aggregator / s. 9(5) style disclosure) ──
    story.append(Paragraph("Note regarding tax invoice", st_legal_head))
    story.append(
        Paragraph(
            "The tax invoice for this booking will be issued by the <b>Bus Operator</b>. "
            "Where the operator works through an aggregator / e-commerce model, the tax invoice "
            "for this booking as per the requirements of <b>section 9(5)</b> of the CGST Act (and "
            "parallel provisions under IGST / SGST as applicable) may be issued by the "
            "<b>Bus Operator</b> to you. e-GO facilitates this booking as an <b>intermediary</b>; "
            "statutory invoicing obligations remain with the operator as per applicable law.",
            st_legal,
        )
    )

    # ── Terms & conditions (boxed section) ────────────────────
    terms_lines = (
        "• This ticket is valid only for the <b>date, service, route, and seat(s)</b> printed above; "
        "it is <b>non-transferable</b> except where the operator explicitly allows a name change.",
        "• Present the <b>same government-issued photo ID</b> used at booking (or as per operator rules) "
        "at boarding; the operator may refuse travel without valid ID.",
        "• Reach the boarding point at least <b>15 minutes</b> before departure. "
        "The operator may refuse boarding for late arrival.",
        "• <b>Luggage, safety, and conduct</b> on board are subject to operator and statutory rules; "
        "e-GO is not liable for operator-controlled service quality beyond platform obligations.",
        "• Delays, diversions, breakdowns, or cancellations may occur; remedies follow operator terms "
        "and applicable law. Platform terms apply in addition: see "
        f"<font color='#312e81'>{_p(base_url)}/terms</font>.",
    )
    terms_rows = [[Paragraph("<b>Terms &amp; conditions</b>", st_box_title)]]
    for line in terms_lines:
        terms_rows.append([Paragraph(line, st_legal)])
    terms_tbl = Table(terms_rows, colWidths=[uw])
    terms_tbl.setStyle(
        TableStyle(
            [
                ("BOX", (0, 0), (-1, -1), 0.65, C_LINE),
                ("BACKGROUND", (0, 0), (-1, 0), C_HEAD_GREY),
                ("LINEBELOW", (0, 0), (-1, 0), 0.45, C_LINE),
                ("TOPPADDING", (0, 0), (-1, -1), 7),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
                ("LEFTPADDING", (0, 0), (-1, -1), 10),
                ("RIGHTPADDING", (0, 0), (-1, -1), 10),
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
            ]
        )
    )
    story.append(KeepTogether([Spacer(1, 6), terms_tbl]))

    # ── Cancellation & refund (boxed, separate from ticket details) ──
    cxl_rows = [
        [Paragraph("<b>Cancellation &amp; refund policy</b>", st_box_title)],
        [Paragraph(cxl_summary, st_legal)],
        [Paragraph(cxl_how, st_legal)],
    ]
    cxl_tbl = Table(cxl_rows, colWidths=[uw])
    cxl_tbl.setStyle(
        TableStyle(
            [
                ("BOX", (0, 0), (-1, -1), 0.65, C_LINE),
                ("BACKGROUND", (0, 0), (-1, 0), C_HEAD_GREY),
                ("LINEBELOW", (0, 0), (-1, 0), 0.45, C_LINE),
                ("LINEBELOW", (0, 1), (-1, 1), 0.25, C_LINE),
                ("TOPPADDING", (0, 0), (-1, -1), 7),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
                ("LEFTPADDING", (0, 0), (-1, -1), 10),
                ("RIGHTPADDING", (0, 0), (-1, -1), 10),
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
            ]
        )
    )
    story.append(KeepTogether([Spacer(1, 6), cxl_tbl]))

    # ── Short reminders ─────────────────────────────────────────
    story.append(Paragraph("Reminders", st_sec_title))
    for line in (
        "• Keep this PDF or show the in-app ticket; the <b>QR code</b> may be used for verification.",
        "• For support, visit the website above with your PNR and booking ID.",
    ):
        story.append(Paragraph(line, st_body_small))
    story.append(Spacer(1, 8))

    story.append(
        Paragraph(
            f"Need help? Visit <font color='#312e81'><b>{_p(base_url)}</b></font> &nbsp;|&nbsp; "
            f"Document generated {_p(_format_dt_pdf(django_tz.now()))}",
            st_foot,
        )
    )

    doc.build(story)
    buffer.seek(0)
    # Stable basename so downloads can overwrite the same file (avoids stale layouts on disk).
    filename = f"ticket_{booking.id}.pdf"
    return ContentFile(buffer.getvalue(), name=filename)


def save_ticket_to_booking(booking: Booking) -> str:
    """Generate and save ticket PDF under tickets/ticket_<id>.pdf; return filename."""
    pdf_content = generate_ticket_pdf(booking)
    tickets_dir = os.path.join(settings.BASE_DIR, "tickets")
    os.makedirs(tickets_dir, exist_ok=True)
    filename = pdf_content.name
    filepath = os.path.join(tickets_dir, filename)
    prev = (booking.ticket_file or "").strip()
    data = pdf_content.read()
    with open(filepath, "wb") as f:
        f.write(data)
    if prev and prev != filename:
        old_path = os.path.join(tickets_dir, prev)
        if os.path.isfile(old_path):
            try:
                os.remove(old_path)
            except OSError:
                pass
    return filename
