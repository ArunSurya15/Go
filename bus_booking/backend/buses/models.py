from django.db import models

class Operator(models.Model):
    name = models.CharField(max_length=150)
    contact_info = models.TextField(blank=True)
    kyc_status = models.CharField(max_length=20, default='PENDING')
    bank_details = models.TextField(blank=True)
    # Admin review progress (JSON): personal_reviewed, fleet_reviewed, identity_payout_reviewed (bools)
    kyc_checklist_json = models.TextField(default="{}", blank=True)
    # Internal notes — not shown to operators
    kyc_internal_notes = models.TextField(blank=True, default="")

    def is_kyc_cleared(self) -> bool:
        """True when admin has cleared this operator — new schedules can go live without a review queue."""
        return (self.kyc_status or "").strip().upper() in frozenset({"VERIFIED", "APPROVED"})

    def __str__(self):
        return self.name

class Bus(models.Model):
    operator = models.ForeignKey(Operator, on_delete=models.CASCADE, related_name='buses')
    registration_no = models.CharField(max_length=50, unique=True)
    capacity = models.PositiveIntegerField()
    seat_map_json = models.TextField(default=dict, blank=True)
    # JSON list of feature ids from BUS_FEATURE_DEFINITIONS (e.g. ["ac","wifi"])
    features_json = models.TextField(default='[]', blank=True)
    # Free text for anything not in the checklist
    extras_note = models.CharField(max_length=500, blank=True, default='')
    # Optional marketing line, e.g. "Bharat Benz A/C Sleeper (2+1)"
    service_name = models.CharField(max_length=200, blank=True, default='')
    # Aggregates from passenger ratings (after completed trips)
    rating_avg = models.DecimalField(max_digits=3, decimal_places=2, null=True, blank=True)
    rating_count = models.PositiveIntegerField(default=0)

    def __str__(self):
        return f"{self.registration_no} ({self.capacity})"