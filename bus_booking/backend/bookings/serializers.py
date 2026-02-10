from rest_framework import serializers
from .models import Schedule, BoardingPoint, DroppingPoint, Reservation, Booking, Payment
from common.serializers import RouteSerializer
from buses.models import Bus

class BusSlimSerializer(serializers.ModelSerializer):
    operator_name = serializers.CharField(source='operator.name', read_only=True)

    class Meta:
        model = Bus
        fields = ('id', 'registration_no', 'capacity', 'operator_name')

class ScheduleSerializer(serializers.ModelSerializer):
    route = RouteSerializer(read_only=True)
    bus = BusSlimSerializer(read_only=True)

    class Meta:
        model = Schedule
        fields = ('id', 'route', 'bus', 'departure_dt', 'arrival_dt', 'fare', 'status')


class BoardingPointSerializer(serializers.ModelSerializer):
    time = serializers.TimeField(format='%H:%M')

    class Meta:
        model = BoardingPoint
        fields = ('id', 'schedule', 'time', 'location_name', 'landmark')


class DroppingPointSerializer(serializers.ModelSerializer):
    time = serializers.TimeField(format='%H:%M')

    class Meta:
        model = DroppingPoint
        fields = ('id', 'schedule', 'time', 'location_name', 'description')

class ReservationSerializer(serializers.ModelSerializer):
    class Meta:
        model = Reservation
        fields = ('id', 'schedule', 'seat_no', 'reserved_by', 'expires_at', 'status')
        read_only_fields = ('reserved_by', 'expires_at', 'status')

class BookingSerializer(serializers.ModelSerializer):
    seats = serializers.ListField(child=serializers.CharField(), required=False)
    schedule = ScheduleSerializer(read_only=True)

    class Meta:
        model = Booking
        fields = ('id', 'user', 'schedule', 'seats', 'amount', 'status', 'payment_id',
                  'boarding_point', 'dropping_point', 'contact_phone', 'state_of_residence', 'whatsapp_opt_in', 'created_at')
        read_only_fields = ('user', 'status', 'payment_id', 'created_at')

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