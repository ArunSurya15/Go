from django.db import models
from django.conf import settings
from django.utils import timezone
from decimal import Decimal
from buses.models import Bus
from common.models import Route

class Schedule(models.Model):
    STATUS_CHOICES = (
        ('ACTIVE', 'Active'),
        ('CANCELLED', 'Cancelled'),
    )
    bus = models.ForeignKey(Bus, on_delete=models.CASCADE, related_name='schedules')
    route = models.ForeignKey(Route, on_delete=models.CASCADE, related_name='schedules')
    departure_dt = models.DateTimeField()
    arrival_dt = models.DateTimeField()
    fare = models.DecimalField(max_digits=10, decimal_places=2, default=Decimal('0.00'))
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='ACTIVE')

    class Meta:
        ordering = ['departure_dt']
        indexes = [
            models.Index(fields=['route', 'departure_dt']),
        ]

    def __str__(self):
        return f"{self.route} @ {self.departure_dt:%Y-%m-%d %H:%M}"

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
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"Booking {self.id} - {self.user} - {self.status}"

class Payment(models.Model):
    booking = models.OneToOneField(Booking, on_delete=models.CASCADE, related_name='payment')
    gateway_order_id = models.CharField(max_length=100, blank=True)
    gateway_payment_id = models.CharField(max_length=100, blank=True)
    status = models.CharField(max_length=30, default='CREATED')
    raw_response = models.TextField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)