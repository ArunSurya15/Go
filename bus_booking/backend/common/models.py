from django.db import models

class Route(models.Model):
    origin = models.CharField(max_length=100)
    destination = models.CharField(max_length=100)
    distance_km = models.PositiveIntegerField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ('origin', 'destination')
        ordering = ['origin', 'destination']

    def __str__(self):
        return f"{self.origin} → {self.destination}"