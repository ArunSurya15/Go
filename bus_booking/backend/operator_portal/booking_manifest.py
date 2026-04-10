"""CSV/PDF manifest export for operator bookings."""
import csv
import io
import json
from decimal import Decimal

from django.http import HttpResponse
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4, landscape
from reportlab.lib.styles import getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle


def booking_pnr(booking_id: int) -> str:
    return f"EGO{int(booking_id):07d}"


def passenger_rows_from_booking(booking):
    """List of dicts with seat, name, age, gender per seat."""
    try:
        seats = json.loads(booking.seats or "[]")
    except Exception:
        seats = []
    try:
        details = json.loads(booking.passenger_details or "{}")
    except Exception:
        details = {}
    rows = []
    for seat in seats:
        s = str(seat).strip()
        if not s:
            continue
        d = details.get(s) or details.get(str(s)) or {}
        if not isinstance(d, dict):
            d = {}
        rows.append(
            {
                "seat": s,
                "name": (d.get("name") or "").strip(),
                "age": (d.get("age") or "").strip(),
                "gender": (d.get("gender") or "").strip(),
            }
        )
    return rows


def payment_status_for_booking(booking):
    try:
        p = booking.payment
    except Exception:
        return "", ""
    if not p:
        return "", ""
    return (p.status or "", p.gateway_order_id or "")


def bookings_to_csv_rows(bookings, include_schedule_columns: bool):
    """Yield header row then data rows."""
    if include_schedule_columns:
        header = [
            "PNR",
            "Route",
            "Departure",
            "Seat",
            "Passenger name",
            "Age",
            "Gender",
            "Contact phone",
            "Booker email",
            "Amount (₹)",
            "Booking status",
            "Payment status",
            "Boarding",
            "Drop",
            "Booked at",
        ]
    else:
        header = [
            "PNR",
            "Seat",
            "Passenger name",
            "Age",
            "Gender",
            "Contact phone",
            "Booker email",
            "Amount (₹)",
            "Booking status",
            "Payment status",
            "Boarding",
            "Drop",
            "Booked at",
        ]
    yield header

    for b in bookings:
        sched = b.schedule
        route = sched.route
        route_str = f"{route.origin} → {route.destination}"
        dep = sched.departure_dt.strftime("%Y-%m-%d %H:%M")
        pay_st, _ = payment_status_for_booking(b)
        bp = b.boarding_point.location_name if b.boarding_point_id else ""
        dp = b.dropping_point.location_name if b.dropping_point_id else ""
        contact = (b.contact_phone or "").strip()
        email = (b.user.email or "").strip() if b.user_id else ""
        amt = str(b.amount) if isinstance(b.amount, Decimal) else str(b.amount)
        booked_at = b.created_at.strftime("%Y-%m-%d %H:%M") if b.created_at else ""

        prow = passenger_rows_from_booking(b)
        if not prow:
            prow = [{"seat": "", "name": "", "age": "", "gender": ""}]

        for pr in prow:
            if include_schedule_columns:
                row = [
                    booking_pnr(b.id),
                    route_str,
                    dep,
                    pr["seat"],
                    pr["name"],
                    pr["age"],
                    pr["gender"],
                    contact,
                    email,
                    amt,
                    b.status,
                    pay_st,
                    bp,
                    dp,
                    booked_at,
                ]
            else:
                row = [
                    booking_pnr(b.id),
                    pr["seat"],
                    pr["name"],
                    pr["age"],
                    pr["gender"],
                    contact,
                    email,
                    amt,
                    b.status,
                    pay_st,
                    bp,
                    dp,
                    booked_at,
                ]
            yield row


def build_csv_response(bookings, filename: str, include_schedule_columns: bool) -> HttpResponse:
    buf = io.StringIO()
    writer = csv.writer(buf)
    for row in bookings_to_csv_rows(bookings, include_schedule_columns):
        writer.writerow(row)
    data = buf.getvalue()
    response = HttpResponse(data.encode("utf-8-sig"), content_type="text/csv; charset=utf-8")
    response["Content-Disposition"] = f'attachment; filename="{filename}"'
    return response


def build_pdf_response(bookings, title: str, filename: str, include_schedule_columns: bool) -> HttpResponse:
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=landscape(A4),
        rightMargin=12 * mm,
        leftMargin=12 * mm,
        topMargin=12 * mm,
        bottomMargin=12 * mm,
    )
    styles = getSampleStyleSheet()
    story = []
    story.append(Paragraph(f"<b>{title}</b>", styles["Title"]))
    story.append(Spacer(1, 6 * mm))

    rows = list(bookings_to_csv_rows(bookings, include_schedule_columns))
    if not rows or (len(rows) == 1 and not bookings):
        story.append(Paragraph("No bookings.", styles["Normal"]))
    else:
        data = [[str(c) for c in row] for row in rows]
        t = Table(data, repeatRows=1)
        t.setStyle(
            TableStyle(
                [
                    ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#e0e7ff")),
                    ("FONTSIZE", (0, 0), (-1, -1), 7),
                    ("GRID", (0, 0), (-1, -1), 0.25, colors.grey),
                    ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ]
            )
        )
        story.append(t)

    doc.build(story)
    pdf = buffer.getvalue()
    buffer.close()
    response = HttpResponse(pdf, content_type="application/pdf")
    response["Content-Disposition"] = f'attachment; filename="{filename}"'
    return response
