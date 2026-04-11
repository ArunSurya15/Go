import random
import hashlib
from django.core.cache import cache
from rest_framework import generics
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.status import HTTP_400_BAD_REQUEST
from rest_framework_simplejwt.tokens import RefreshToken

from .models import User
from .serializers import UserRegisterSerializer, OperatorRegisterSerializer, _auto_username
from .otp import send_otp as do_send_otp, verify_otp as do_verify_otp, normalize_phone

REG_CACHE_TTL = 10 * 60  # 10 minutes
REG_CACHE_PREFIX = "reg_pending:"


def _gen_otp(length=6) -> str:
    return "".join(str(random.randint(0, 9)) for _ in range(length))


class RegisterView(generics.GenericAPIView):
    """
    Step 1 — POST { name, email|phone, password }
    Validates, sends OTP (email via Resend / phone via SMS), caches pending data.
    Returns { otp_sent: true, channel: 'email'|'phone' }.
    """
    permission_classes = []

    def post(self, request):
        name = (request.data.get("name") or "").strip()
        email = (request.data.get("email") or "").strip()
        phone = (request.data.get("phone") or "").strip()
        password = (request.data.get("password") or "").strip()

        if not name:
            return Response({"detail": "Name is required."}, status=HTTP_400_BAD_REQUEST)
        if not password or len(password) < 8:
            return Response({"detail": "Password must be at least 8 characters."}, status=HTTP_400_BAD_REQUEST)
        if not email and not phone:
            return Response({"detail": "Provide an email or mobile number."}, status=HTTP_400_BAD_REQUEST)

        if email:
            if User.objects.filter(email__iexact=email).exists():
                return Response({"detail": "This email is already registered."}, status=HTTP_400_BAD_REQUEST)
        if phone:
            phone = normalize_phone(phone)
            if User.objects.filter(phone=phone).exists():
                return Response({"detail": "This mobile number is already registered."}, status=HTTP_400_BAD_REQUEST)

        otp = _gen_otp()
        cache_key = REG_CACHE_PREFIX + (email or phone)
        cache.set(cache_key, {
            "name": name,
            "email": email,
            "phone": phone,
            "password": password,
            "otp": otp,
        }, REG_CACHE_TTL)

        # Send OTP
        channel = "email" if email else "phone"
        sent = False
        if channel == "email":
            from bookings.notifications import send_email_otp
            sent = send_email_otp(email, otp, name=name)
        else:
            from .otp import send_sms
            sent = send_sms(phone, f"Your e-GO verification code is {otp}. Valid for 10 minutes.")

        from django.conf import settings
        if not sent:
            import logging
            logging.getLogger(__name__).warning(
                "OTP delivery failed — DEV FALLBACK: %s OTP for %s is %s",
                channel, email or phone, otp,
            )

        resp = {"otp_sent": True, "channel": channel}
        # In DEBUG mode expose OTP in response so dev testing works without a verified sender
        if getattr(settings, "DEBUG", False) and not sent:
            resp["otp_dev"] = otp
        return Response(resp)


class RegisterConfirmView(generics.GenericAPIView):
    """
    Step 2 — POST { email|phone, otp }
    Verifies OTP, creates user, returns JWT.
    """
    permission_classes = []

    def post(self, request):
        email = (request.data.get("email") or "").strip()
        phone = (request.data.get("phone") or "").strip()
        otp = (request.data.get("otp") or "").strip()

        key = email or phone
        if not key or not otp:
            return Response({"detail": "email/phone and otp are required."}, status=HTTP_400_BAD_REQUEST)

        cache_key = REG_CACHE_PREFIX + key
        pending = cache.get(cache_key)
        if not pending:
            return Response({"detail": "OTP expired or not found. Please start over."}, status=HTTP_400_BAD_REQUEST)
        if pending["otp"] != otp:
            return Response({"detail": "Incorrect OTP. Please try again."}, status=HTTP_400_BAD_REQUEST)

        cache.delete(cache_key)

        # Create user
        username = _auto_username(email=pending["email"], phone=pending["phone"])
        user = User(
            username=username,
            email=pending["email"],
            phone=pending["phone"],
            first_name=pending["name"],
            role="PASSENGER",
        )
        user.set_password(pending["password"])
        user.save()

        refresh = RefreshToken.for_user(user)
        return Response({
            "access": str(refresh.access_token),
            "refresh": str(refresh),
        }, status=201)


class RegisterOperatorView(generics.GenericAPIView):
    """Operator self-signup: creates Operator + User (role=OPERATOR) and links them."""
    serializer_class = OperatorRegisterSerializer
    permission_classes = []

    def post(self, request):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response({"detail": "Operator account created. You can sign in now."}, status=201)


class MeView(generics.GenericAPIView):
    """GET / PATCH current user profile."""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        u = request.user
        return Response({
            "username": u.username,
            "name": u.first_name or "",
            "email": u.email or "",
            "phone": getattr(u, "phone", "") or "",
            "gender": getattr(u, "gender", "") or "",
            "date_of_birth": str(u.date_of_birth) if getattr(u, "date_of_birth", None) else "",
            "seat_preference": getattr(u, "seat_preference", "any") or "any",
            "deck_preference": getattr(u, "deck_preference", "any") or "any",
            "emergency_contact_name": getattr(u, "emergency_contact_name", "") or "",
            "emergency_contact_phone": getattr(u, "emergency_contact_phone", "") or "",
            "role": getattr(u, "role", "PASSENGER"),
            "operator_id": getattr(u, "operator_id", None),
            "date_joined": u.date_joined.strftime("%b %Y"),
        })

    def patch(self, request):
        u = request.user
        data = request.data
        ALLOWED = [
            "name", "email", "phone", "gender", "date_of_birth",
            "seat_preference", "deck_preference",
            "emergency_contact_name", "emergency_contact_phone",
        ]
        for field in ALLOWED:
            if field not in data:
                continue
            val = data[field]
            if field == "name":
                u.first_name = (val or "").strip()
            elif field == "date_of_birth":
                u.date_of_birth = val or None
            else:
                setattr(u, field, (val or "").strip())
        u.save()
        return self.get(request)


class ChangePasswordView(generics.GenericAPIView):
    """POST { current_password, new_password } to change password."""
    permission_classes = [IsAuthenticated]

    def post(self, request):
        current = (request.data.get("current_password") or "").strip()
        new = (request.data.get("new_password") or "").strip()
        if not current or not new:
            return Response({"detail": "current_password and new_password required."}, status=HTTP_400_BAD_REQUEST)
        if not request.user.check_password(current):
            return Response({"detail": "Current password is incorrect."}, status=HTTP_400_BAD_REQUEST)
        if len(new) < 8:
            return Response({"detail": "New password must be at least 8 characters."}, status=HTTP_400_BAD_REQUEST)
        request.user.set_password(new)
        request.user.save()
        return Response({"detail": "Password changed successfully."})


class SavedPassengerView(generics.GenericAPIView):
    """GET list / POST create saved passengers."""
    permission_classes = [IsAuthenticated]

    def _serialize(self, sp):
        return {"id": sp.id, "name": sp.name, "age": sp.age, "gender": sp.gender}

    def get(self, request):
        from .models import SavedPassenger
        passengers = SavedPassenger.objects.filter(user=request.user)
        return Response([self._serialize(p) for p in passengers])

    def post(self, request):
        from .models import SavedPassenger
        name = (request.data.get("name") or "").strip()
        if not name:
            return Response({"detail": "name is required."}, status=HTTP_400_BAD_REQUEST)
        sp = SavedPassenger.objects.create(
            user=request.user,
            name=name,
            age=request.data.get("age") or None,
            gender=(request.data.get("gender") or "").strip(),
        )
        return Response(self._serialize(sp), status=201)


class SavedPassengerDetailView(generics.GenericAPIView):
    """PATCH / DELETE a saved passenger."""
    permission_classes = [IsAuthenticated]

    def _get(self, request, pk):
        from .models import SavedPassenger
        try:
            return SavedPassenger.objects.get(pk=pk, user=request.user)
        except SavedPassenger.DoesNotExist:
            return None

    def _serialize(self, sp):
        return {"id": sp.id, "name": sp.name, "age": sp.age, "gender": sp.gender}

    def patch(self, request, pk):
        sp = self._get(request, pk)
        if not sp:
            return Response({"detail": "Not found."}, status=404)
        if "name" in request.data:
            sp.name = (request.data["name"] or "").strip() or sp.name
        if "age" in request.data:
            sp.age = request.data["age"] or None
        if "gender" in request.data:
            sp.gender = (request.data["gender"] or "").strip()
        sp.save()
        return Response(self._serialize(sp))

    def delete(self, request, pk):
        sp = self._get(request, pk)
        if not sp:
            return Response({"detail": "Not found."}, status=404)
        sp.delete()
        return Response(status=204)


class SendOtpView(generics.GenericAPIView):
    """POST { \"mobile\": \"+91999...\" } - send OTP (for operator verification or login)."""
    permission_classes = []

    def post(self, request):
        mobile = (request.data.get("mobile") or request.data.get("phone") or "").strip()
        if not mobile:
            return Response({"detail": "mobile required"}, status=HTTP_400_BAD_REQUEST)
        ok, msg = do_send_otp(mobile)
        if not ok:
            return Response({"detail": msg}, status=HTTP_400_BAD_REQUEST)
        return Response({"detail": msg})


class VerifyOtpView(generics.GenericAPIView):
    """POST { \"mobile\": \"+91999...\", \"otp\": \"123456\" } - verify OTP."""
    permission_classes = []

    def post(self, request):
        mobile = (request.data.get("mobile") or request.data.get("phone") or "").strip()
        otp = (request.data.get("otp") or "").strip()
        if not mobile or not otp:
            return Response(
                {"detail": "mobile and otp required"},
                status=HTTP_400_BAD_REQUEST,
            )
        if do_verify_otp(mobile, otp):
            return Response({"detail": "Verified.", "verified": True})
        return Response({"detail": "Invalid or expired OTP.", "verified": False}, status=HTTP_400_BAD_REQUEST)
