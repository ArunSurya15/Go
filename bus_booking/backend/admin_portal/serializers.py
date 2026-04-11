import json

from rest_framework import serializers

from bookings.models import Schedule
from bookings.serializers import ScheduleSerializer
from buses.models import Bus, Operator

from .models import AdminAuditLog


class FlexibleJSONTextField(serializers.Field):
    """DB stores text; API reads/writes as JSON object when valid."""

    def to_representation(self, value):
        if value is None:
            return {}
        if isinstance(value, dict):
            return value
        raw = str(value).strip()
        if not raw:
            return {}
        try:
            return json.loads(raw)
        except Exception:
            return {"_unparsed": raw}

    def to_internal_value(self, data):
        if data is None:
            return ""
        if isinstance(data, dict):
            return json.dumps(data)
        return str(data)


class AdminAuditLogSerializer(serializers.ModelSerializer):
    actor_username = serializers.CharField(source="actor.username", read_only=True, allow_null=True)

    class Meta:
        model = AdminAuditLog
        fields = (
            "id",
            "actor_username",
            "action",
            "target_type",
            "target_id",
            "details",
            "created_at",
        )
        read_only_fields = fields


class AdminBusPreviewSerializer(serializers.ModelSerializer):
    """Bus with seat map for admin schedule / operator review."""

    operator_name = serializers.CharField(source="operator.name", read_only=True)
    seat_map = serializers.SerializerMethodField()
    features = serializers.SerializerMethodField()

    class Meta:
        model = Bus
        fields = (
            "id",
            "registration_no",
            "capacity",
            "service_name",
            "extras_note",
            "operator_name",
            "seat_map",
            "features",
        )
        read_only_fields = fields

    def get_seat_map(self, obj):
        try:
            return json.loads(obj.seat_map_json or "{}")
        except Exception:
            return {}

    def get_features(self, obj):
        try:
            return json.loads(obj.features_json or "[]")
        except Exception:
            return []


class AdminSchedulePendingSerializer(ScheduleSerializer):
    """Same as public schedule list but bus includes seat_map for admin verification."""

    bus = AdminBusPreviewSerializer(read_only=True)

    class Meta(ScheduleSerializer.Meta):
        pass


class AdminOperatorSerializer(serializers.ModelSerializer):
    buses = serializers.SerializerMethodField()
    contact_info = FlexibleJSONTextField()
    bank_details = FlexibleJSONTextField()
    kyc_checklist = FlexibleJSONTextField(source="kyc_checklist_json")
    kyc_internal_notes = serializers.CharField(allow_blank=True, required=False)
    kyc_format_hints = serializers.SerializerMethodField()
    buses_count = serializers.IntegerField(read_only=True)
    users_count = serializers.IntegerField(read_only=True)

    class Meta:
        model = Operator
        fields = (
            "id",
            "name",
            "contact_info",
            "bank_details",
            "kyc_status",
            "kyc_checklist",
            "kyc_internal_notes",
            "kyc_format_hints",
            "buses_count",
            "users_count",
            "buses",
        )
        read_only_fields = ("buses_count", "users_count", "buses", "kyc_format_hints")

    def get_kyc_format_hints(self, obj):
        """Pattern checks only — not proof of valid documents or bank linkage."""
        from common.kyc_india import (
            aadhaar_digits_only_ok,
            aadhaar_last_four_ok,
            gstin_format_ok,
            ifsc_format_ok,
            pan_format_ok,
        )

        def _obj(raw):
            try:
                d = json.loads(raw or "{}")
                return d if isinstance(d, dict) else {}
            except Exception:
                return {}

        c = _obj(obj.contact_info)
        b = _obj(obj.bank_details)
        pan = str(c.get("pan") or c.get("PAN") or "").strip().upper()
        gst = str(c.get("gstin") or c.get("GSTIN") or c.get("gst") or c.get("gst_number") or "").strip().upper()
        regs = c.get("gstin_registrations")
        if not gst and isinstance(regs, list) and regs:
            head = next(
                (x for x in regs if isinstance(x, dict) and x.get("is_head_office")),
                regs[0] if regs else None,
            )
            if isinstance(head, dict):
                gst = str(head.get("gstin") or "").strip().upper()
        aad = str(c.get("aadhar") or c.get("aadhaar") or c.get("aadhaar_number") or "").strip()
        aad4 = str(c.get("aadhaar_last_4") or c.get("aadhar_last_4") or "").strip()
        ifsc = str(b.get("ifsc") or b.get("IFSC") or "").strip().upper()
        notes = []
        if aadhaar_digits_only_ok(aad):
            notes.append(
                "A full 12-digit Aadhaar value is stored — consider masking to last 4 digits in profile (UIDAI rules)."
            )
        return {
            "pan": {
                "provided": bool(pan),
                "format_ok": pan_format_ok(pan) if pan else None,
            },
            "gstin": {
                "provided": bool(gst),
                "format_ok": gstin_format_ok(gst) if gst else None,
            },
            "aadhaar_last_four": {
                "provided": bool(aad4),
                "format_ok": aadhaar_last_four_ok(aad4) if aad4 else None,
            },
            "ifsc": {
                "provided": bool(ifsc),
                "format_ok": ifsc_format_ok(ifsc) if ifsc else None,
            },
            "compliance_notes": notes,
        }

    def get_buses(self, obj):
        out = []
        qs = getattr(obj, "buses", None)
        if qs is None:
            return out
        for b in qs.all().order_by("registration_no"):
            try:
                sm = json.loads(b.seat_map_json or "{}")
            except Exception:
                sm = {}
            try:
                feats = json.loads(b.features_json or "[]")
            except Exception:
                feats = []
            out.append(
                {
                    "id": b.id,
                    "registration_no": b.registration_no,
                    "capacity": b.capacity,
                    "service_name": b.service_name or "",
                    "extras_note": b.extras_note or "",
                    "seat_map": sm,
                    "features": feats,
                }
            )
        return out
