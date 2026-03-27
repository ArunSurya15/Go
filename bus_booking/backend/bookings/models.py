from django.db import models
from django.conf import settings
from django.utils import timezone
from decimal import Decimal
from buses.models import Bus
from common.models import Route


class Schedule(models.Model):
    STATUS_CHOICES = (
        ('PENDING', 'Pending'),   # awaiting admin approval
        ('ACTIVE', 'Active'),
        ('CANCELLED', 'Cancelled'),
    )
    bus = models.ForeignKey(Bus, on_delete=models.CASCADE, related_name='schedules')
    route = models.ForeignKey(Route, on_delete=models.CASCADE, related_name='schedules')
    departure_dt = models.DateTimeField()
    arrival_dt = models.DateTimeField()
    fare = models.DecimalField(max_digits=10, decimal_places=2, default=Decimal('0.00'))
    # Optional "MRP" for strikethrough when running a discount
    fare_original = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    # Operator-entered promo line for this trip (e.g. "Exclusive ₹100 OFF")
    operator_promo_title = models.CharField(max_length=160, blank=True, default='')
    # e-GO platform promo (set by admin/backend or default in settings)
    platform_promo_title = models.CharField(max_length=160, blank=True, default='')
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='PENDING')

    class Meta:
        ordering = ['departure_dt']
        indexes = [
            models.Index(fields=['route', 'departure_dt']),
        ]

    def __str__(self):
        return f"{self.route} @ {self.departure_dt:%Y-%m-%d %H:%M}"


class BoardingPoint(models.Model):
    """Boarding point for a schedule (time, location, landmark)."""
    schedule = models.ForeignKey(Schedule, on_delete=models.CASCADE, related_name='boarding_points')
    time = models.TimeField()
    location_name = models.CharField(max_length=150)
    landmark = models.CharField(max_length=255, blank=True)

    class Meta:
        ordering = ['time']

    def __str__(self):
        return f"{self.location_name} @ {self.time}"


class DroppingPoint(models.Model):
    """Dropping point for a schedule (time, location, description)."""
    schedule = models.ForeignKey(Schedule, on_delete=models.CASCADE, related_name='dropping_points')
    time = models.TimeField()
    location_name = models.CharField(max_length=150)
    description = models.CharField(max_length=255, blank=True)

    class Meta:
        ordering = ['time']

    def __str__(self):
        return f"{self.location_name} @ {self.time}"


class ScheduleLocation(models.Model):
    """Live GPS position for a schedule. Tracking is typically active from 1 hour before first boarding until arrival."""
    schedule = models.ForeignKey(Schedule, on_delete=models.CASCADE, related_name='locations')
    lat = models.DecimalField(max_digits=9, decimal_places=6)
    lng = models.DecimalField(max_digits=9, decimal_places=6)
    recorded_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-recorded_at']
        indexes = [
            models.Index(fields=['schedule', '-recorded_at']),
        ]


class Reservation(models.Model):
    STATUS_CHOICES = (
        ('PENDING', 'Pending'),
        ('CONFIRMED', 'Confirmed'),
        ('CANCELLED', 'Cancelled'),
        ('EXPIRED', 'Expired'),
    )
    schedule = models.ForeignKey(Schedule, on_delete=models.CASCADE, related_name='reservations')
    seat_no = models.CharField(max_length=10)
    reserved_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='reservations')
    expires_at = models.DateTimeField()
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='PENDING')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        indexes = [
            models.Index(fields=['schedule', 'seat_no']),
        ]

    def is_active(self):
        return self.status == 'PENDING' and self.expires_at > timezone.now()

class Booking(models.Model):
    STATUS_CHOICES = (
        ('PENDING', 'Pending'),
        ('CONFIRMED', 'Confirmed'),
        ('CANCELLED', 'Cancelled'),
        ('REFUNDED', 'Refunded'),
    )
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='bookings')
    schedule = models.ForeignKey(Schedule, on_delete=models.PROTECT, related_name='bookings')
    seats = models.TextField(default=list)  # e.g., ["1A","1B"]
    amount = models.DecimalField(max_digits=10, decimal_places=2)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='PENDING')
    payment_id = models.CharField(max_length=100, blank=True)
    ticket_file = models.CharField(max_length=255, blank=True)  # Path to generated ticket PDF
    boarding_point = models.ForeignKey(BoardingPoint, on_delete=models.SET_NULL, null=True, blank=True, related_name='bookings')
    dropping_point = models.ForeignKey(DroppingPoint, on_delete=models.SET_NULL, null=True, blank=True, related_name='bookings')
    contact_phone = models.CharField(max_length=20, blank=True)
    state_of_residence = models.CharField(max_length=100, blank=True)
    whatsapp_opt_in = models.BooleanField(default=False)
    passenger_details = models.TextField(blank=True, default="{}")  # JSON: {"1A": {"gender": "F"}, ...}
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"Booking {self.id} - {self.user} - {self.status}"


class BusRating(models.Model):
    """One rating per booking, after the passenger has completed the trip."""
    booking = models.OneToOneField(Booking, on_delete=models.CASCADE, related_name='bus_rating')
    bus = models.ForeignKey(Bus, on_delete=models.CASCADE, related_name='ratings')
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='bus_ratings')
    stars = models.PositiveSmallIntegerField()  # 1–5
    comment = models.CharField(max_length=500, blank=True, default='')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        indexes = [
            models.Index(fields=['bus', '-created_at'], name='bookings_busrating_bus_created'),
        ]

    def __str__(self):
        return f"BusRating {self.bus_id} {self.stars}★"


class Payment(models.Model):
    booking = models.OneToOneField(Booking, on_delete=models.CASCADE, related_name='payment')
    gateway_order_id = models.CharField(max_length=100, blank=True)
    gateway_payment_id = models.CharField(max_length=100, blank=True)
    status = models.CharField(max_length=30, default='CREATED')
    raw_response = models.TextField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)