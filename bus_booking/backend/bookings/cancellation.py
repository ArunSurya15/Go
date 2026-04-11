"""
Cancellation & refund logic for e-GO bookings.

Refund policy (configurable in settings):
  > CANCEL_FULL_REFUND_HOURS before departure   → 100% refund
  > CANCEL_PARTIAL_REFUND_HOURS before departure → CANCEL_PARTIAL_REFUND_PCT% refund
  ≤ CANCEL_PARTIAL_REFUND_HOURS before departure  → 0% refund
  After departure                                  → 0% refund

All times compared in UTC. Razorpay refund is initiated when a real payment exists.
"""

from __future__ import annotations

import json
import logging
from decimal import Decimal
from typing import TYPE_CHECKING

from django.conf import settings
from django.utils import timezone

if TYPE_CHECKING:
    from .models import Booking

logger = logging.getLogger(__name__)


# ─── policy ──────────────────────────────────────────────────────────────────

def get_policy() -> dict:
    return {
        "cutoff_hours": getattr(settings, "CANCEL_CUTOFF_HOURS", 0),
        "full_refund_hours": getattr(settings, "CANCEL_FULL_REFUND_HOURS", 24),
        "partial_refund_hours": getattr(settings, "CANCEL_PARTIAL_REFUND_HOURS", 6),
        "partial_refund_pct": getattr(settings, "CANCEL_PARTIAL_REFUND_PCT", 50),
    }


def hours_until_departure(booking: "Booking") -> float:
    dep = booking.schedule.departure_dt
    now = timezone.now()
    delta = dep - now
    return delta.total_seconds() / 3600


def calculate_refund_amount(booking: "Booking") -> tuple[Decimal, str]:
    """
    Returns (refund_amount, tier_label).
    tier_label: 'full' | 'partial' | 'none'
    """
    policy = get_policy()
    amount = Decimal(str(booking.amount))
    hours = hours_until_departure(booking)

    if hours <= 0:
        return Decimal("0.00"), "none"

    if hours > policy["full_refund_hours"]:
        return amount, "full"

    if hours > policy["partial_refund_hours"]:
        pct = Decimal(str(policy["partial_refund_pct"])) / 100
        refund = (amount * pct).quantize(Decimal("0.01"))
        return refund, "partial"

    return Decimal("0.00"), "none"


def cancellation_allowed(booking: "Booking", by: str = "passenger") -> tuple[bool, str]:
    """
    Returns (allowed, reason).
    Operators and admins bypass the cutoff restriction.
    """
    if booking.status not in ("CONFIRMED", "PENDING"):
        return False, f"Booking is already {booking.status.lower()}."

    if by == "passenger":
        policy = get_policy()
        hours = hours_until_departure(booking)
        if hours <= 0:
            return False, "Trip has already departed."
        cutoff = policy["cutoff_hours"]
        if cutoff > 0 and hours < cutoff:
            return False, f"Cancellations are not allowed within {cutoff} hours of departure."

    return True, ""


# ─── seat release ─────────────────────────────────────────────────────────────

def release_seats(booking: "Booking") -> None:
    """Mark reservations for cancelled booking's seats as CANCELLED."""
    try:
        seats = json.loads(booking.seats or "[]")
        if not seats:
            return
        from .models import Reservation
        Reservation.objects.filter(
            schedule=booking.schedule,
            seat_no__in=seats,
            reserved_by=booking.user,
        ).update(status="CANCELLED")
    except Exception as e:
        logger.error("release_seats failed for booking %s: %s", booking.id, e)


# ─── Razorpay refund ─────────────────────────────────────────────────────────

def initiate_razorpay_refund(booking: "Booking", refund_amount: Decimal) -> str:
    """
    Issue a Razorpay refund. Returns the refund ID on success, '' on skip/failure.
    Skips gracefully when DEMO_PAYMENTS=True or no real payment ID exists.
    """
    if refund_amount <= 0:
        return ""

    demo = getattr(settings, "DEMO_PAYMENTS", True)
    if demo:
        logger.info("DEMO mode — skipping real Razorpay refund for booking %s (₹%s)", booking.id, refund_amount)
        return "refund_demo"

    payment_id = (booking.payment_id or "").strip()
    if not payment_id or payment_id.startswith("order_demo"):
        logger.info("No real payment_id for booking %s — skipping Razorpay refund", booking.id)
        return ""

    key_id = getattr(settings, "RAZORPAY_KEY_ID", "")
    key_secret = getattr(settings, "RAZORPAY_KEY_SECRET", "")
    if not key_id or not key_secret:
        logger.warning("Razorpay keys not configured — skipping refund for booking %s", booking.id)
        return ""

    try:
        import razorpay
        client = razorpay.Client(auth=(key_id, key_secret))
        amount_paise = int(refund_amount * 100)
        refund = client.payment.refund(payment_id, {"amount": amount_paise, "speed": "normal"})
        refund_id = refund.get("id", "")
        logger.info("Razorpay refund %s initiated for booking %s (₹%s)", refund_id, booking.id, refund_amount)
        return refund_id
    except Exception as e:
        logger.error("Razorpay refund failed for booking %s: %s", booking.id, e)
        return ""


# ─── main action ─────────────────────────────────────────────────────────────

def cancel_booking(
    booking: "Booking",
    by: str,               # 'passenger' | 'operator' | 'admin'
    reason: str = "",
    force_refund_pct: int | None = None,  # operator/admin override (0–100)
) -> dict:
    """
    Cancel a booking end-to-end:
      1. Validate
      2. Calculate refund
      3. Initiate Razorpay refund
      4. Release seats
      5. Update booking status
      6. Update OperatorSale
    Returns a summary dict.
    Raises ValueError on validation failure.
    """
    allowed, msg = cancellation_allowed(booking, by=by)
    if not allowed:
        raise ValueError(msg)

    if force_refund_pct is not None:
        amount = Decimal(str(booking.amount))
        refund_amount = (amount * Decimal(str(force_refund_pct)) / 100).quantize(Decimal("0.01"))
        tier = f"override_{force_refund_pct}pct"
    else:
        refund_amount, tier = calculate_refund_amount(booking)

    refund_id = initiate_razorpay_refund(booking, refund_amount)
    release_seats(booking)

    now = timezone.now()
    new_status = "REFUNDED" if refund_amount > 0 else "CANCELLED"
    booking.status = new_status
    booking.cancelled_at = now
    booking.cancelled_by = by
    booking.cancellation_reason = reason or ""
    booking.refund_amount = refund_amount
    booking.refund_id = refund_id or ""
    booking.save()

    # Sync OperatorSale
    try:
        from .models import OperatorSale
        OperatorSale.objects.filter(booking=booking).update(reversal_status=new_status)
    except Exception as e:
        logger.error("OperatorSale sync failed after cancel for booking %s: %s", booking.id, e)

    return {
        "booking_id": booking.id,
        "status": new_status,
        "refund_amount": str(refund_amount),
        "refund_tier": tier,
        "refund_id": refund_id or "",
    }
