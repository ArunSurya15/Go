import json

from django.db.models.signals import post_save
from django.dispatch import receiver
from django.utils import timezone

from .models import Booking, OperatorSale


@receiver(post_save, sender=Booking)
def sync_operator_sale_from_booking(sender, instance: Booking, **kwargs):
    """Keep OperatorSale in sync for confirmed / refunded / cancelled bookings."""
    if instance.status == "CONFIRMED":
        try:
            seats = json.loads(instance.seats or "[]")
        except Exception:
            seats = []
        n = len(seats) if seats else 1
        op_id = instance.schedule.bus.operator_id
        sale, created = OperatorSale.objects.get_or_create(
            booking=instance,
            defaults={
                "operator_id": op_id,
                "schedule_id": instance.schedule_id,
                "gross_amount": instance.amount,
                "seat_count": max(1, n),
                "currency": "INR",
                "confirmed_at": timezone.now(),
                "reversal_status": "",
            },
        )
        if not created:
            OperatorSale.objects.filter(pk=sale.pk).update(
                operator_id=op_id,
                schedule_id=instance.schedule_id,
                gross_amount=instance.amount,
                seat_count=max(1, n),
                reversal_status="",
            )
    elif instance.status in ("REFUNDED", "CANCELLED"):
        OperatorSale.objects.filter(booking=instance).update(reversal_status=instance.status)
