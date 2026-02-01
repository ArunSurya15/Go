from django.contrib import admin
from .models import Schedule, Reservation, Booking, Payment
admin.site.register(Schedule)
admin.site.register(Reservation)
admin.site.register(Booking)
admin.site.register(Payment)