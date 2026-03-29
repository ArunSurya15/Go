from rest_framework import serializers
from .models import Route, RoutePattern, RoutePatternStop


class RouteSerializer(serializers.ModelSerializer):
    class Meta:
        model = Route
        fields = ('id', 'origin', 'destination', 'distance_km')


class RoutePatternStopSerializer(serializers.ModelSerializer):
    class Meta:
        model = RoutePatternStop
        fields = ('order', 'name', 'lat', 'lng')


class RoutePatternSerializer(serializers.ModelSerializer):
    stops = RoutePatternStopSerializer(many=True, read_only=True)

    class Meta:
        model = RoutePattern
        fields = ('id', 'route', 'name', 'stops')


class RoutePatternSlimSerializer(serializers.ModelSerializer):
    """Nested on public schedule responses."""

    stops = RoutePatternStopSerializer(many=True, read_only=True)

    class Meta:
        model = RoutePattern
        fields = ('id', 'name', 'stops')