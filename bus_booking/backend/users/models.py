import uuid

from django.conf import settings
from django.contrib.auth.models import AbstractUser
from django.db import models
class User(AbstractUser):
    ROLE_CHOICES = (
        ('PASSENGER', 'Passenger'),
        ('OPERATOR', 'Operator'),
        ('ADMIN', 'Admin'),
    )
    # Sub-role when role == OPERATOR (multiple logins per operator). Blank = legacy full access (= owner).
    OPERATOR_STAFF_ROLE_CHOICES = (
        ('', 'Owner (legacy default)'),
        ('OWNER', 'Owner'),
        ('MANAGER', 'Manager'),
        ('DISPATCHER', 'Dispatcher'),
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
    operator_staff_role = models.CharField(
        max_length=20,
        choices=OPERATOR_STAFF_ROLE_CHOICES,
        blank=True,
        default='',
        help_text='OPERATOR: Dispatcher=read/manifest; Manager=fares & fleet; Owner=+company/KYC/invites; blank=legacy owner.',
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

    def _operator_staff_role_norm(self) -> str:
        return (self.operator_staff_role or "").strip()

    def is_operator_org_owner(self) -> bool:
        """Business owner: KYC/profile, staff invites. Legacy blank role = owner."""
        if self.role != "OPERATOR" or not self.operator_id:
            return False
        return self._operator_staff_role_norm() in ("", "OWNER")

    def is_operator_ops_lead(self) -> bool:
        """Pricing, fleet, refunds, sales — owner, manager, or legacy blank."""
        if self.role != "OPERATOR" or not self.operator_id:
            return False
        return self._operator_staff_role_norm() in ("", "OWNER", "MANAGER")

    def is_operator_owner(self) -> bool:
        """Alias for :meth:`is_operator_org_owner` (historic name)."""
        return self.is_operator_org_owner()

    def __str__(self):
        return f"{self.username} ({self.role})"


class OperatorStaffInvite(models.Model):
    """Time-boxed invite for MANAGER or DISPATCHER on an operator account."""

    class Role(models.TextChoices):
        MANAGER = "MANAGER", "Manager"
        DISPATCHER = "DISPATCHER", "Dispatcher"

    operator = models.ForeignKey(
        "buses.Operator",
        on_delete=models.CASCADE,
        related_name="staff_invites",
    )
    email = models.EmailField()
    role = models.CharField(max_length=20, choices=Role.choices)
    token = models.UUIDField(default=uuid.uuid4, unique=True, editable=False)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="operator_staff_invites_sent",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    expires_at = models.DateTimeField()
    accepted_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"Invite {self.email} → {self.operator_id} ({self.role})"


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
