from django.contrib import admin
from .models import Schedule, BoardingPoint, DroppingPoint, Reservation, Booking, Payment
admin.site.register(Schedule)
admin.site.register(BoardingPoint)
admin.site.register(DroppingPoint)
admin.site.register(Reservation)
admin.site.register(Booking)
admin.site.register(Payment)