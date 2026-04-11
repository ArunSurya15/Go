from django.contrib.auth.models import AbstractUser
from django.db import models

class User(AbstractUser):
    ROLE_CHOICES = (
        ('PASSENGER', 'Passenger'),
        ('OPERATOR', 'Operator'),
        ('ADMIN', 'Admin'),
    )
    GENDER_CHOICES = (('M', 'Male'), ('F', 'Female'), ('O', 'Other'))
    SEAT_PREF_CHOICES = (('window', 'Window'), ('aisle', 'Aisle'), ('any', 'No preference'))
    DECK_PREF_CHOICES = (('lower', 'Lower deck'), ('upper', 'Upper deck'), ('any', 'No preference'))

    role = models.CharField(max_length=20, choices=ROLE_CHOICES, default='PASSENGER')
    phone = models.CharField(max_length=20, blank=True)
    operator = models.ForeignKey(
        'buses.Operator',
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name='users'
    )
    # Profile
    gender = models.CharField(max_length=1, choices=GENDER_CHOICES, blank=True)
    date_of_birth = models.DateField(null=True, blank=True)
    # Travel preferences
    seat_preference = models.CharField(max_length=10, choices=SEAT_PREF_CHOICES, default='any')
    deck_preference = models.CharField(max_length=10, choices=DECK_PREF_CHOICES, default='any')
    # Emergency contact
    emergency_contact_name = models.CharField(max_length=150, blank=True)
    emergency_contact_phone = models.CharField(max_length=20, blank=True)

    def __str__(self):
        return f"{self.username} ({self.role})"


class SavedPassenger(models.Model):
    """Frequently travelled co-passengers saved by a user for fast checkout."""
    GENDER_CHOICES = (('M', 'Male'), ('F', 'Female'), ('O', 'Other'))
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='saved_passengers')
    name = models.CharField(max_length=150)
    age = models.PositiveSmallIntegerField(null=True, blank=True)
    gender = models.CharField(max_length=1, choices=GENDER_CHOICES, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['name']

    def __str__(self):
        return f"{self.name} (saved by {self.user_id})"
