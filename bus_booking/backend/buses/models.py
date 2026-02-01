from django.db import models

class Operator(models.Model):
    name = models.CharField(max_length=150)
    contact_info = models.TextField(blank=True)
    kyc_status = models.CharField(max_length=20, default='PENDING')
    bank_details = models.TextField(blank=True)

    def __str__(self):
        return self.name

class Bus(models.Model):
    operator = models.ForeignKey(Operator, on_delete=models.CASCADE, related_name='buses')
    registration_no = models.CharField(max_length=50, unique=True)
    capacity = models.PositiveIntegerField()
    seat_map_json = models.TextField(default=dict, blank=True)

    def __str__(self):
        return f"{self.registration_no} ({self.capacity})"