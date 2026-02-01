from django.contrib.auth.models import AbstractUser
from django.db import models

class User(AbstractUser):
    # Add roles (default = PASSENGER)
    ROLE_CHOICES = (
        ('PASSENGER', 'Passenger'),
        ('OPERATOR', 'Operator'),
        ('ADMIN', 'Admin'),
    )
    role = models.CharField(max_length=20, choices=ROLE_CHOICES, default='PASSENGER')
    phone = models.CharField(max_length=20, blank=True)  # for OTP / operator lookup
    # Link to Operator when role=OPERATOR (one operator can have multiple users if needed)
    operator = models.ForeignKey(
        'buses.Operator',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='users'
    )

    def __str__(self):
        return f"{self.username} ({self.role})"
