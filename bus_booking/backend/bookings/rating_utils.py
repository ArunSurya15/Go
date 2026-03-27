"""Aggregate bus rating from BusRating rows."""
from decimal import Decimal

from django.db.models import Avg, Count

from buses.models import Bus


def refresh_bus_rating_aggregate(bus: Bus) -> None:
    from .models import BusRating

    agg = BusRating.objects.filter(bus=bus).aggregate(avg=Avg("stars"), n=Count("id"))
    avg = agg["avg"]
    n = agg["n"] or 0
    if avg is not None:
        bus.rating_avg = Decimal(str(round(float(avg), 2)))
    else:
        bus.rating_avg = None
    bus.rating_count = n
    bus.save(update_fields=["rating_avg", "rating_count"])
