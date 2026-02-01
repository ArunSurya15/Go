from rest_framework import serializers
from .models import Schedule, Reservation, Booking, Payment
from common.serializers import RouteSerializer
from buses.models import Bus

class BusSlimSerializer(serializers.ModelSerializer):
    class Meta:
        model = Bus
        fields = ('id', 'registration_no', 'capacity')

class ScheduleSerializer(serializers.ModelSerializer):
    route = RouteSerializer(read_only=True)
    bus = BusSlimSerializer(read_only=True)

    class Meta:
        model = Schedule
        fields = ('id', 'route', 'bus', 'departure_dt', 'arrival_dt', 'fare', 'status')

class ReservationSerializer(serializers.ModelSerializer):
    class Meta:
        model = Reservation
        fields = ('id', 'schedule', 'seat_no', 'reserved_by', 'expires_at', 'status')
        read_only_fields = ('reserved_by', 'expires_at', 'status')

class BookingSerializer(serializers.ModelSerializer):
    seats = serializers.ListField(child=serializers.CharField())

    class Meta:
        model = Booking
        fields = ('id', 'user', 'schedule', 'seats', 'amount', 'status', 'payment_id')
        read_only_fields = ('user', 'status', 'payment_id')

    def to_representation(self, instance):
        import json
        data = super().to_representation(instance)
        try:
            data['seats'] = json.loads(instance.seats or '[]')
        except Exception:
            data['seats'] = []
        return data

class PaymentSerializer(serializers.ModelSerializer):
    class Meta:
        model = Payment
        fields = ('id', 'booking', 'gateway_order_id', 'gateway_payment_id', 'status', 'raw_response')
        read_only_fields = ('status', 'raw_response')