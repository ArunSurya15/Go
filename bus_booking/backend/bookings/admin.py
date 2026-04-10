from django.contrib import admin
from .models import (
    Schedule,
    BoardingPoint,
    DroppingPoint,
    Reservation,
    Booking,
    Payment,
    BusRating,
    OperatorSale,
)


@admin.register(OperatorSale)
class OperatorSaleAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "booking_id",
        "operator",
        "gross_amount",
        "seat_count",
        "currency",
        "confirmed_at",
        "reversal_status",
    )
    list_filter = ("reversal_status", "currency", "operator")
    search_fields = ("booking__id",)
    raw_id_fields = ("booking", "operator", "schedule")
    date_hierarchy = "confirmed_at"
    ordering = ("-confirmed_at", "-id")


admin.site.register(Schedule)
admin.site.register(BoardingPoint)
admin.site.register(DroppingPoint)
admin.site.register(Reservation)
admin.site.register(Booking)
admin.site.register(Payment)
admin.site.register(BusRating)