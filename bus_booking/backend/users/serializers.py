import json
from rest_framework import serializers
from .models import User
from django.contrib.auth.password_validation import validate_password
from buses.models import Operator


class UserRegisterSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, validators=[validate_password])

    class Meta:
        model = User
        fields = ('username', 'email', 'password', 'role')

    def create(self, validated_data):
        user = User(
            username=validated_data['username'],
            email=validated_data['email'],
            role=validated_data.get('role', 'PASSENGER')
        )
        user.set_password(validated_data['password'])
        user.save()
        return user


class OperatorRegisterSerializer(serializers.Serializer):
    """Operator self-signup: creates Operator + User linked."""
    username = serializers.CharField(max_length=150)
    email = serializers.EmailField(required=False, allow_blank=True, default="")
    password = serializers.CharField(write_only=True, validators=[validate_password])
    phone = serializers.CharField(max_length=20, required=False, allow_blank=True, default="")
    company_name = serializers.CharField(max_length=150, source="name")
    owner_name = serializers.CharField(max_length=150, required=False, allow_blank=True, default="")

    def validate_username(self, value):
        if User.objects.filter(username__iexact=value).exists():
            raise serializers.ValidationError("Username already taken.")
        return value

    def validate(self, attrs):
        email = (attrs.get("email") or "").strip()
        phone = (attrs.get("phone") or "").strip()
        if not email and not phone:
            raise serializers.ValidationError(
                "Provide at least one of email or mobile number."
            )
        if email and User.objects.filter(email__iexact=email).exists():
            raise serializers.ValidationError({"email": "This email is already registered."})
        if phone and User.objects.filter(phone=phone).exists():
            raise serializers.ValidationError({"phone": "This mobile number is already registered."})
        return attrs

    def create(self, validated_data):
        from buses.models import Operator
        name = validated_data.pop("name")
        username = validated_data.pop("username")
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
        user = User(
            username=username,
            email=email or "",
            role="OPERATOR",
            phone=phone or "",
            operator=operator,
            is_active=True,
        )
        user.set_password(password)
        user.save()
        return user