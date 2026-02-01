from rest_framework import generics
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.status import HTTP_400_BAD_REQUEST

from .models import User
from .serializers import UserRegisterSerializer, OperatorRegisterSerializer
from .otp import send_otp as do_send_otp, verify_otp as do_verify_otp, normalize_phone


class RegisterView(generics.CreateAPIView):
    queryset = User.objects.all()
    serializer_class = UserRegisterSerializer
    permission_classes = []


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
    """GET current user info (role, operator_id) for redirects and UI."""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        user = request.user
        return Response({
            "username": user.username,
            "email": getattr(user, "email", "") or "",
            "role": getattr(user, "role", "PASSENGER"),
            "operator_id": getattr(user, "operator_id", None),
        })


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
