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


class RoutePattern(models.Model):
    """Ordered via stops for a route (e.g. NH vs Villianur branch). Operators attach a pattern to each schedule."""
    route = models.ForeignKey(Route, on_delete=models.CASCADE, related_name='patterns')
    name = models.CharField(max_length=120, default='Standard')

    class Meta:
        ordering = ['route', 'name']
        constraints = [
            models.UniqueConstraint(fields=['route', 'name'], name='common_routepattern_route_name_uniq'),
        ]

    def __str__(self):
        return f"{self.route}: {self.name}"


class RoutePatternStop(models.Model):
    pattern = models.ForeignKey(RoutePattern, on_delete=models.CASCADE, related_name='stops')
    order = models.PositiveSmallIntegerField()
    name = models.CharField(max_length=120)
    lat = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True)
    lng = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True)

    class Meta:
        ordering = ['pattern', 'order']
        unique_together = [('pattern', 'order')]

    def __str__(self):
        return f"{self.order}. {self.name}"