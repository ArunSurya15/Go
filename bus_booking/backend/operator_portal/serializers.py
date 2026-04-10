import json
from rest_framework import serializers
from buses.models import Bus, Operator
from common.models import Route, RoutePattern
from decimal import Decimal

from bookings.models import Schedule, BoardingPoint, DroppingPoint, Booking, OperatorSale
from bookings.pricing import seat_fares_dict_from_schedule
from bookings.seat_rules import get_occupied_and_seat_genders
from buses.constants import VALID_FEATURE_IDS

OPERATOR_OFFER_STYLES = frozenset(
    {"", "last_minute", "flash_sale", "weekend_special", "festival", "custom"}
)


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
        types = data.get("types")
        if rows is not None and (not isinstance(rows, int) or rows < 1):
            raise serializers.ValidationError("rows must be a positive integer.")
        if cols is not None and (not isinstance(cols, int) or cols < 1):
            raise serializers.ValidationError("cols must be a positive integer.")
        if labels is not None and not isinstance(labels, list):
            raise serializers.ValidationError("labels must be a list of strings.")
        valid_types = {"seater", "sleeper", "semi_sleeper", "aisle", "blank"}
        if types is not None:
            if not isinstance(types, list):
                raise serializers.ValidationError("types must be a list of strings.")
            for i, t in enumerate(types):
                if t is not None and t not in valid_types:
                    raise serializers.ValidationError(
                        f"types[{i}] must be one of: seater, sleeper, semi_sleeper, aisle, blank."
                    )
        has_upper = data.get("has_upper_deck")
        if has_upper is not None and not isinstance(has_upper, bool):
            raise serializers.ValidationError("has_upper_deck must be a boolean.")
        orientations = data.get("orientations")
        if orientations is not None:
            if not isinstance(orientations, list):
                raise serializers.ValidationError("orientations must be a list of strings.")
            valid_o = {"portrait", "landscape"}
            for i, o in enumerate(orientations):
                if o is not None and str(o).lower() not in valid_o:
                    raise serializers.ValidationError(
                        f"orientations[{i}] must be portrait or landscape."
                    )
        return json.dumps(data)


class OperatorBusSerializer(serializers.ModelSerializer):
    """Bus create/update for operator (includes seat_map, amenities checklist, extras)."""

    seat_map = SeatMapField(source="seat_map_json", required=False)
    features = serializers.ListField(
        child=serializers.CharField(max_length=64),
        required=False,
        default=list,
    )
    extras_note = serializers.CharField(required=False, allow_blank=True, max_length=500, default="")

    class Meta:
        model = Bus
        fields = (
            "id",
            "registration_no",
            "capacity",
            "seat_map",
            "features",
            "extras_note",
            "service_name",
            "operator",
        )
        read_only_fields = ("operator",)

    def validate_features(self, value):
        for fid in value:
            if fid not in VALID_FEATURE_IDS:
                raise serializers.ValidationError(f"Unknown feature id: {fid}")
        return value

    def to_representation(self, instance):
        data = super().to_representation(instance)
        try:
            data["features"] = json.loads(instance.features_json or "[]")
        except Exception:
            data["features"] = []
        data["extras_note"] = instance.extras_note or ""
        data["service_name"] = instance.service_name or ""
        return data

    def create(self, validated_data):
        features = validated_data.pop("features", [])
        extras_note = validated_data.pop("extras_note", "")
        validated_data["features_json"] = json.dumps(features)
        validated_data["extras_note"] = extras_note
        return super().create(validated_data)

    def update(self, instance, validated_data):
        features = validated_data.pop("features", None)
        extras_note = validated_data.pop("extras_note", None)
        instance = super().update(instance, validated_data)
        update_fields = []
        if features is not None:
            instance.features_json = json.dumps(features)
            update_fields.append("features_json")
        if extras_note is not None:
            instance.extras_note = extras_note
            update_fields.append("extras_note")
        if update_fields:
            instance.save(update_fields=update_fields)
        return instance


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
    route_pattern = serializers.PrimaryKeyRelatedField(
        queryset=RoutePattern.objects.all(),
        required=False,
        allow_null=True,
    )
    fare_editable = serializers.SerializerMethodField()
    confirmed_bookings_count = serializers.SerializerMethodField()
    seat_fares = serializers.SerializerMethodField()
    occupied_seats = serializers.SerializerMethodField()
    occupied_details = serializers.SerializerMethodField()

    class Meta:
        model = Schedule
        fields = (
            "id",
            "bus",
            "route",
            "route_pattern",
            "departure_dt",
            "arrival_dt",
            "fare",
            "fare_original",
            "operator_promo_title",
            "operator_offer_style",
            "seat_fares",
            "platform_promo_title",
            "status",
            "boarding_points",
            "dropping_points",
            "fare_editable",
            "confirmed_bookings_count",
            "occupied_seats",
            "occupied_details",
        )
        read_only_fields = (
            "status",
            "platform_promo_title",
            "fare_editable",
            "confirmed_bookings_count",
            "seat_fares",
            "occupied_seats",
            "occupied_details",
        )

    def get_fare_editable(self, obj):
        if not getattr(obj, "pk", None):
            return True
        return not obj.bookings.filter(status="CONFIRMED").exists()

    def get_confirmed_bookings_count(self, obj):
        if not getattr(obj, "pk", None):
            return 0
        return obj.bookings.filter(status="CONFIRMED").count()

    def get_seat_fares(self, obj):
        return seat_fares_dict_from_schedule(obj)

    def get_occupied_seats(self, obj):
        if not getattr(obj, "pk", None):
            return []
        occupied, _ = get_occupied_and_seat_genders(obj)
        return sorted(occupied)

    def get_occupied_details(self, obj):
        if not getattr(obj, "pk", None):
            return []
        occupied, seat_gender = get_occupied_and_seat_genders(obj)
        return [{"label": s, "gender": seat_gender.get(s)} for s in sorted(occupied)]

    @staticmethod
    def _effective_seat_price(schedule, label: str) -> Decimal:
        ov = seat_fares_dict_from_schedule(schedule)
        if label in ov:
            return Decimal(str(ov[label])).quantize(Decimal("0.01"))
        return Decimal(str(schedule.fare)).quantize(Decimal("0.01"))

    def _assert_occupied_seat_prices_unchanged(self, instance, validated_data, request):
        occupied, _ = get_occupied_and_seat_genders(instance)
        if not occupied:
            return
        new_base = Decimal(str(validated_data.get("fare", instance.fare))).quantize(Decimal("0.01"))
        if request and "seat_fares" in getattr(request, "data", {}):
            new_ov = self._validate_seat_fares_dict(request.data.get("seat_fares"))
        else:
            new_ov = seat_fares_dict_from_schedule(instance)
        for label in occupied:
            old_eff = self._effective_seat_price(instance, label)
            new_eff = (
                Decimal(str(new_ov[label])).quantize(Decimal("0.01"))
                if label in new_ov
                else new_base
            )
            if old_eff != new_eff:
                raise serializers.ValidationError(
                    {
                        "seat_fares": (
                            f"Price for booked seat {label} cannot change while seats are booked or held."
                        )
                    }
                )

    def validate_operator_offer_style(self, value):
        v = (value or "").strip()
        if v not in OPERATOR_OFFER_STYLES:
            raise serializers.ValidationError("Invalid offer highlight style.")
        return v

    def _validate_seat_fares_dict(self, value):
        if value is None:
            return {}
        if not isinstance(value, dict):
            raise serializers.ValidationError("seat_fares must be an object mapping seat labels to prices.")
        out = {}
        for k, v in value.items():
            ks = str(k).strip()
            if not ks:
                continue
            try:
                d = Decimal(str(v)).quantize(Decimal("0.01"))
            except Exception:
                raise serializers.ValidationError(f"Invalid price for seat {ks}.")
            out[ks] = str(d)
        return out

    def to_representation(self, instance):
        data = super().to_representation(instance)
        data["route"] = {
            "id": instance.route_id,
            "origin": instance.route.origin,
            "destination": instance.route.destination,
            "distance_km": instance.route.distance_km,
        }
        data["bus"] = OperatorBusSerializer(instance.bus, context=self.context).data
        return data

    def validate_bus(self, value):
        operator = self.context.get("operator")
        if operator and value.operator_id != operator.id:
            raise serializers.ValidationError("Bus does not belong to your operator.")
        return value

    def validate_route(self, value):
        if not Route.objects.filter(pk=value.pk).exists():
            raise serializers.ValidationError("Invalid route.")
        return value

    def validate(self, attrs):
        route = attrs.get("route")
        if route is None and self.instance is not None:
            route = self.instance.route
        if "route_pattern" in attrs:
            rp = attrs["route_pattern"]
            if rp is not None and route is not None and rp.route_id != route.id:
                raise serializers.ValidationError(
                    {
                        "route_pattern": "Selected pattern must belong to the same route as the schedule.",
                    }
                )
        elif (
            self.instance is not None
            and "route" in attrs
            and self.instance.route_pattern_id
        ):
            new_route = attrs["route"]
            if self.instance.route_pattern.route_id != new_route.id:
                raise serializers.ValidationError(
                    {
                        "route": "Clear or change route pattern when changing to a different route.",
                    }
                )
        return attrs

    def create(self, validated_data):
        boarding_points = validated_data.pop("boarding_points", [])
        dropping_points = validated_data.pop("dropping_points", [])
        validated_data.setdefault("status", "PENDING")
        request = self.context.get("request")
        if request and "seat_fares" in getattr(request, "data", {}):
            validated_data["seat_fares_json"] = json.dumps(
                self._validate_seat_fares_dict(request.data.get("seat_fares"))
            )
        schedule = super().create(validated_data)
        for bp in boarding_points:
            BoardingPoint.objects.create(schedule=schedule, **bp)
        for dp in dropping_points:
            DroppingPoint.objects.create(schedule=schedule, **dp)
        return schedule

    def _fare_unchanged(self, instance, validated_data):
        for key in ("fare", "fare_original"):
            if key not in validated_data:
                continue
            old = getattr(instance, key)
            new = validated_data[key]
            d_old = Decimal(str(old)) if old is not None else None
            d_new = Decimal(str(new)) if new is not None else None
            if d_old != d_new:
                return False
        return True

    def _seat_fares_unchanged(self, instance, request):
        if not request or "seat_fares" not in getattr(request, "data", {}):
            return True
        old = seat_fares_dict_from_schedule(instance)
        new = self._validate_seat_fares_dict(request.data.get("seat_fares"))
        return old == new

    def update(self, instance, validated_data):
        request = self.context.get("request")
        confirmed = instance.bookings.filter(status="CONFIRMED").exists()
        # Confirmed bookings lock base fare (selling + MRP) only. Per-seat overrides for *unbooked*
        # seats can still change; booked/hold seats are protected by _assert_occupied_seat_prices_unchanged.
        if confirmed and not self._fare_unchanged(instance, validated_data):
            raise serializers.ValidationError(
                {
                    "non_field_errors": [
                        "Cannot change selling fare or MRP: this trip already has confirmed bookings. "
                        "You can still adjust per-seat prices for seats that are not booked."
                    ]
                }
            )
        if request and (
            "fare" in validated_data
            or "seat_fares" in getattr(request, "data", {})
        ):
            self._assert_occupied_seat_prices_unchanged(instance, validated_data, request)
        if request and "seat_fares" in getattr(request, "data", {}):
            validated_data["seat_fares_json"] = json.dumps(
                self._validate_seat_fares_dict(request.data.get("seat_fares"))
            )
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


class OperatorBookingManifestSerializer(serializers.ModelSerializer):
    """Operator-facing booking row: PNR, seats, passengers, contact, payment."""

    pnr = serializers.SerializerMethodField()
    seats = serializers.SerializerMethodField()
    passengers = serializers.SerializerMethodField()
    payment_status = serializers.SerializerMethodField()
    gateway_order_id = serializers.SerializerMethodField()
    booker_email = serializers.SerializerMethodField()
    booker_phone = serializers.SerializerMethodField()
    schedule = serializers.SerializerMethodField()
    boarding_point_name = serializers.SerializerMethodField()
    dropping_point_name = serializers.SerializerMethodField()

    class Meta:
        model = Booking
        fields = (
            "id",
            "pnr",
            "seats",
            "passengers",
            "amount",
            "status",
            "contact_phone",
            "booker_email",
            "booker_phone",
            "payment_status",
            "gateway_order_id",
            "boarding_point_name",
            "dropping_point_name",
            "schedule",
            "created_at",
        )

    def get_pnr(self, obj):
        from .booking_manifest import booking_pnr

        return booking_pnr(obj.id)

    def get_seats(self, obj):
        try:
            return json.loads(obj.seats or "[]")
        except Exception:
            return []

    def get_passengers(self, obj):
        from .booking_manifest import passenger_rows_from_booking

        return passenger_rows_from_booking(obj)

    def get_payment_status(self, obj):
        from .booking_manifest import payment_status_for_booking

        st, _ = payment_status_for_booking(obj)
        return st

    def get_gateway_order_id(self, obj):
        from .booking_manifest import payment_status_for_booking

        _, oid = payment_status_for_booking(obj)
        return oid

    def get_booker_email(self, obj):
        return (obj.user.email or "").strip() if obj.user_id else ""

    def get_booker_phone(self, obj):
        if not obj.user_id:
            return ""
        return (getattr(obj.user, "phone", None) or "").strip()

    def get_boarding_point_name(self, obj):
        return obj.boarding_point.location_name if obj.boarding_point_id else ""

    def get_dropping_point_name(self, obj):
        return obj.dropping_point.location_name if obj.dropping_point_id else ""

    def get_schedule(self, obj):
        s = obj.schedule
        return {
            "id": s.id,
            "origin": s.route.origin,
            "destination": s.route.destination,
            "departure_dt": s.departure_dt.isoformat() if s.departure_dt else None,
        }


class OperatorSaleSerializer(serializers.ModelSerializer):
    """Read-only sale lines for operator reporting (from OperatorSale)."""

    pnr = serializers.SerializerMethodField()
    booking_id = serializers.IntegerField(source="booking.id", read_only=True)
    origin = serializers.CharField(source="schedule.route.origin", read_only=True)
    destination = serializers.CharField(source="schedule.route.destination", read_only=True)
    departure_dt = serializers.DateTimeField(source="schedule.departure_dt", read_only=True)

    class Meta:
        model = OperatorSale
        fields = (
            "id",
            "booking_id",
            "pnr",
            "origin",
            "destination",
            "departure_dt",
            "gross_amount",
            "seat_count",
            "currency",
            "confirmed_at",
            "reversal_status",
        )

    def get_pnr(self, obj):
        from .booking_manifest import booking_pnr

        return booking_pnr(obj.booking_id)
