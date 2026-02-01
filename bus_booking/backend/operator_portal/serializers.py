import json
from rest_framework import serializers
from buses.models import Bus, Operator
from common.models import Route
from bookings.models import Schedule, BoardingPoint, DroppingPoint


class OperatorProfileSerializer(serializers.ModelSerializer):
    """Operator profile for onboarding: name, contact_info and bank_details as JSON (stored as text)."""

    class Meta:
        model = Operator
        fields = ("id", "name", "contact_info", "bank_details", "kyc_status")
        read_only_fields = ("id", "kyc_status")

    def to_representation(self, instance):
        data = super().to_representation(instance)
        try:
            data["contact_info"] = json.loads(instance.contact_info or "{}")
        except Exception:
            data["contact_info"] = {}
        try:
            data["bank_details"] = json.loads(instance.bank_details or "{}")
        except Exception:
            data["bank_details"] = {}
        return data

    def to_internal_value(self, data):
        d = dict(data)
        if "contact_info" in d and d["contact_info"] is not None:
            d["contact_info"] = json.dumps(d["contact_info"]) if isinstance(d["contact_info"], dict) else str(d["contact_info"])
        if "bank_details" in d and d["bank_details"] is not None:
            d["bank_details"] = json.dumps(d["bank_details"]) if isinstance(d["bank_details"], dict) else str(d["bank_details"])
        return super().to_internal_value(d)


class SeatMapField(serializers.Field):
    """Exposes seat_map_json as seat_map (dict) in API."""

    def to_representation(self, value):
        try:
            return json.loads(value or "{}")
        except Exception:
            return {}

    def to_internal_value(self, data):
        if data is None:
            return "{}"
        if not isinstance(data, dict):
            raise serializers.ValidationError("seat_map must be a JSON object.")
        rows = data.get("rows")
        cols = data.get("cols")
        labels = data.get("labels")
        if rows is not None and (not isinstance(rows, int) or rows < 1):
            raise serializers.ValidationError("rows must be a positive integer.")
        if cols is not None and (not isinstance(cols, int) or cols < 1):
            raise serializers.ValidationError("cols must be a positive integer.")
        if labels is not None and not isinstance(labels, list):
            raise serializers.ValidationError("labels must be a list of strings.")
        return json.dumps(data)


class OperatorBusSerializer(serializers.ModelSerializer):
    """Bus create/update for operator (includes seat_map)."""

    seat_map = SeatMapField(source="seat_map_json", required=False)

    class Meta:
        model = Bus
        fields = ("id", "registration_no", "capacity", "seat_map", "operator")
        read_only_fields = ("operator",)


class BoardingPointWriteSerializer(serializers.ModelSerializer):
    time = serializers.TimeField(format="%H:%M", input_formats=["%H:%M", "%H:%M:%S"])

    class Meta:
        model = BoardingPoint
        fields = ("id", "time", "location_name", "landmark")


class DroppingPointWriteSerializer(serializers.ModelSerializer):
    time = serializers.TimeField(format="%H:%M", input_formats=["%H:%M", "%H:%M:%S"])

    class Meta:
        model = DroppingPoint
        fields = ("id", "time", "location_name", "description")


class OperatorScheduleSerializer(serializers.ModelSerializer):
    """Schedule create/update for operator; nested boarding/dropping points."""

    boarding_points = BoardingPointWriteSerializer(many=True, required=False)
    dropping_points = DroppingPointWriteSerializer(many=True, required=False)

    class Meta:
        model = Schedule
        fields = (
            "id",
            "bus",
            "route",
            "departure_dt",
            "arrival_dt",
            "fare",
            "status",
            "boarding_points",
            "dropping_points",
        )
        read_only_fields = ("status",)

    def validate_bus(self, value):
        operator = self.context.get("operator")
        if operator and value.operator_id != operator.id:
            raise serializers.ValidationError("Bus does not belong to your operator.")
        return value

    def validate_route(self, value):
        if not Route.objects.filter(pk=value.pk).exists():
            raise serializers.ValidationError("Invalid route.")
        return value

    def create(self, validated_data):
        boarding_points = validated_data.pop("boarding_points", [])
        dropping_points = validated_data.pop("dropping_points", [])
        validated_data.setdefault("status", "PENDING")
        schedule = super().create(validated_data)
        for bp in boarding_points:
            BoardingPoint.objects.create(schedule=schedule, **bp)
        for dp in dropping_points:
            DroppingPoint.objects.create(schedule=schedule, **dp)
        return schedule

    def update(self, instance, validated_data):
        boarding_points = validated_data.pop("boarding_points", None)
        dropping_points = validated_data.pop("dropping_points", None)
        schedule = super().update(instance, validated_data)
        if boarding_points is not None:
            instance.boarding_points.all().delete()
            for bp in boarding_points:
                BoardingPoint.objects.create(schedule=instance, **bp)
        if dropping_points is not None:
            instance.dropping_points.all().delete()
            for dp in dropping_points:
                DroppingPoint.objects.create(schedule=instance, **dp)
        return schedule
