import json
import re
import uuid
from rest_framework import serializers
from .models import User
from django.contrib.auth.password_validation import validate_password
from buses.models import Operator


def _auto_username(email: str = "", phone: str = "") -> str:
    """Generate a unique username from email or phone."""
    if email:
        base = re.sub(r"[^a-zA-Z0-9]", "", email.split("@")[0])[:20] or "user"
    else:
        digits = re.sub(r"\D", "", phone)
        base = "user" + digits[-6:] if len(digits) >= 6 else "user"
    username = base
    if User.objects.filter(username__iexact=username).exists():
        username = base + "_" + uuid.uuid4().hex[:5]
    return username


class UserRegisterSerializer(serializers.Serializer):
    email = serializers.EmailField(required=False, allow_blank=True, default="")
    phone = serializers.CharField(max_length=20, required=False, allow_blank=True, default="")
    password = serializers.CharField(write_only=True, validators=[validate_password])

    def validate(self, attrs):
        email = (attrs.get("email") or "").strip()
        phone = (attrs.get("phone") or "").strip()
        if not email and not phone:
            raise serializers.ValidationError("Provide at least an email or a phone number.")
        if email and User.objects.filter(email__iexact=email).exists():
            raise serializers.ValidationError({"email": "This email is already registered."})
        if phone:
            from .otp import normalize_phone
            phone = normalize_phone(phone)
            attrs["phone"] = phone
            if User.objects.filter(phone=phone).exists():
                raise serializers.ValidationError({"phone": "This mobile number is already registered."})
        return attrs

    def create(self, validated_data):
        email = (validated_data.get("email") or "").strip()
        phone = (validated_data.get("phone") or "").strip()
        username = _auto_username(email=email, phone=phone)
        user = User(
            username=username,
            email=email,
            phone=phone,
            role="PASSENGER",
        )
        user.set_password(validated_data["password"])
        user.save()
        return user


class OperatorRegisterSerializer(serializers.Serializer):
    """Operator self-signup: creates Operator + User linked."""
    username = serializers.CharField(max_length=150, required=False, allow_blank=True, default="")
    email = serializers.EmailField(required=False, allow_blank=True, default="")
    password = serializers.CharField(write_only=True, validators=[validate_password])
    phone = serializers.CharField(max_length=20, required=False, allow_blank=True, default="")
    company_name = serializers.CharField(max_length=150, source="name")
    owner_name = serializers.CharField(max_length=150, required=False, allow_blank=True, default="")

    def validate_username(self, value):
        value = (value or "").strip()
        if not value:
            return ""
        if User.objects.filter(username__iexact=value).exists():
            raise serializers.ValidationError("Username already taken.")
        return value

    def validate(self, attrs):
        from .otp import normalize_phone

        email = (attrs.get("email") or "").strip()
        phone = (attrs.get("phone") or "").strip()
        if not email and not phone:
            raise serializers.ValidationError(
                "Provide at least one of email or mobile number."
            )
        if phone:
            phone = normalize_phone(phone)
            attrs["phone"] = phone
        if email and User.objects.filter(email__iexact=email).exists():
            raise serializers.ValidationError({"email": "This email is already registered."})
        if phone and User.objects.filter(phone=phone).exists():
            raise serializers.ValidationError({"phone": "This mobile number is already registered."})
        return attrs

    def create(self, validated_data):
        from buses.models import Operator
        name = validated_data.pop("name")
        username_in = (validated_data.pop("username") or "").strip()
        email = (validated_data.get("email") or "").strip()
        password = validated_data.pop("password")
        phone = (validated_data.pop("phone") or "").strip()
        owner_name = (validated_data.pop("owner_name") or "").strip()
        contact_info = json.dumps({"owner_name": owner_name, "phone": phone, "email": email})
        operator = Operator.objects.create(
            name=name,
            contact_info=contact_info,
            kyc_status="PENDING",
        )
        username = username_in if username_in else _auto_username(email=email, phone=phone)
        user = User(
            username=username,
            email=email or "",
            role="OPERATOR",
            phone=phone or "",
            operator=operator,
            operator_staff_role="OWNER",
            is_active=True,
        )
        user.set_password(password)
        user.save()
        return user