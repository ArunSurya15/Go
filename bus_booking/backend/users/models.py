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

    def __str__(self):
        return f"{self.username} ({self.role})"
