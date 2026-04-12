"""Operator staff list + invite (org owners only); public invite preview/accept."""

from __future__ import annotations

import logging
from datetime import timedelta

from django.conf import settings
from django.contrib.auth import get_user_model
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError
from django.db import transaction
from django.utils import timezone
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from bookings.notifications import send_operator_staff_invite_email
from users.models import OperatorStaffInvite
from users.serializers import _auto_username

from .permissions import IsOperator, IsOperatorOrgOwner


User = get_user_model()
logger = logging.getLogger(__name__)


def _invite_app_base() -> str:
    base = (getattr(settings, "APP_BASE_URL", None) or "http://localhost:3000").rstrip("/")
    if not getattr(settings, "DEBUG", False) and "localhost" in base.lower():
        logger.warning(
            "APP_BASE_URL is %r while DEBUG is off — operator invite links may not work for "
            "recipients outside your machine. Set APP_BASE_URL to your public frontend URL.",
            base,
        )
    return base


def _invite_abs_url(token: str) -> str:
    return f"{_invite_app_base()}/operator/join?token={token}"


def _serialize_invite(inv: OperatorStaffInvite, now) -> dict:
    url = _invite_abs_url(str(inv.token))
    expired = inv.expires_at < now
    return {
        "id": inv.id,
        "email": inv.email,
        "role": inv.role,
        "expires_at": inv.expires_at.isoformat(),
        "expired": expired,
        "invite_url": url,
        "created_at": inv.created_at.isoformat(),
    }


def _send_invite_email(inv: OperatorStaffInvite, invite_url: str) -> bool:
    op_name = inv.operator.name or "Operator"
    role_display = inv.get_role_display()
    return send_operator_staff_invite_email(inv.email, invite_url, op_name, role_display)


class OperatorStaffListView(APIView):
    """GET: operator users on the same operator (org owner only)."""

    permission_classes = [IsAuthenticated, IsOperator, IsOperatorOrgOwner]

    def get(self, request):
        op = getattr(request.user, "operator", None)
        if not op:
            return Response({"detail": "Operator access required."}, status=403)
        rows = (
            User.objects.filter(operator_id=op.id, role="OPERATOR")
            .order_by("date_joined")
            .values("id", "username", "email", "operator_staff_role", "date_joined", "is_active")
        )
        return Response({"results": list(rows)})


class OperatorStaffInvitesView(APIView):
    """GET: pending invites. POST: create invite + email (copy link still returned)."""

    permission_classes = [IsAuthenticated, IsOperator, IsOperatorOrgOwner]

    def get(self, request):
        op = getattr(request.user, "operator", None)
        if not op:
            return Response({"detail": "Operator access required."}, status=403)
        now = timezone.now()
        qs = (
            OperatorStaffInvite.objects.filter(operator=op, accepted_at__isnull=True)
            .order_by("-created_at")
            .select_related("operator")
        )
        return Response({"results": [_serialize_invite(inv, now) for inv in qs]})

    def post(self, request):
        op = getattr(request.user, "operator", None)
        if not op:
            return Response({"detail": "Operator access required."}, status=403)
        email = (request.data.get("email") or "").strip().lower()
        role = (request.data.get("role") or "").strip().upper()
        if not email:
            return Response({"detail": "email is required."}, status=400)
        if role not in (OperatorStaffInvite.Role.MANAGER, OperatorStaffInvite.Role.DISPATCHER):
            return Response({"detail": "role must be MANAGER or DISPATCHER."}, status=400)

        if User.objects.filter(email__iexact=email).exists():
            return Response(
                {
                    "detail": "That email already has an account. Use Django admin to link them, or use another email.",
                },
                status=400,
            )
        pending = OperatorStaffInvite.objects.filter(
            operator=op,
            email__iexact=email,
            accepted_at__isnull=True,
            expires_at__gte=timezone.now(),
        ).exists()
        if pending:
            return Response({"detail": "An active invite already exists for this email."}, status=400)

        inv = OperatorStaffInvite.objects.create(
            operator=op,
            email=email,
            role=role,
            created_by=request.user,
            expires_at=timezone.now() + timedelta(days=7),
        )
        url = _invite_abs_url(str(inv.token))
        email_sent = _send_invite_email(inv, url)
        detail = (
            "Invite created and emailed."
            if email_sent
            else "Invite created. Email could not be sent (check RESEND_API_KEY / EMAIL_FROM). Share the link below."
        )
        return Response(
            {
                "detail": detail,
                "invite_url": url,
                "token": str(inv.token),
                "email_sent": email_sent,
                "invite": _serialize_invite(inv, timezone.now()),
            },
            status=201,
        )


class OperatorStaffInviteDestroyView(APIView):
    """DELETE: revoke a pending invite (org owner only)."""

    permission_classes = [IsAuthenticated, IsOperator, IsOperatorOrgOwner]

    def delete(self, request, pk: int):
        op = getattr(request.user, "operator", None)
        if not op:
            return Response({"detail": "Operator access required."}, status=403)
        inv = OperatorStaffInvite.objects.filter(pk=pk, operator_id=op.id, accepted_at__isnull=True).first()
        if not inv:
            return Response({"detail": "Invite not found or already used."}, status=404)
        inv.delete()
        return Response(status=204)


class OperatorStaffInviteResendView(APIView):
    """POST: resend invite email and extend expiry by 7 days from now."""

    permission_classes = [IsAuthenticated, IsOperator, IsOperatorOrgOwner]

    def post(self, request, pk: int):
        op = getattr(request.user, "operator", None)
        if not op:
            return Response({"detail": "Operator access required."}, status=403)
        inv = OperatorStaffInvite.objects.filter(pk=pk, operator_id=op.id, accepted_at__isnull=True).first()
        if not inv:
            return Response({"detail": "Invite not found or already used."}, status=404)
        inv.expires_at = timezone.now() + timedelta(days=7)
        inv.save(update_fields=["expires_at"])
        url = _invite_abs_url(str(inv.token))
        email_sent = _send_invite_email(inv, url)
        detail = (
            "Invite email sent again and validity extended by 7 days."
            if email_sent
            else "Could not send email (check RESEND_API_KEY / EMAIL_FROM). Expiry was extended — share the link manually."
        )
        return Response(
            {
                "detail": detail,
                "email_sent": email_sent,
                "invite": _serialize_invite(inv, timezone.now()),
            }
        )


class OperatorStaffInvitePreviewView(APIView):
    """GET ?token= — public; validates invite before join form."""

    permission_classes = [AllowAny]
    authentication_classes = []

    def get(self, request):
        raw = (request.query_params.get("token") or "").strip()
        if not raw:
            return Response({"valid": False, "detail": "token is required."}, status=400)
        try:
            from uuid import UUID

            tid = UUID(raw)
        except ValueError:
            return Response({"valid": False, "detail": "Invalid token."}, status=400)

        inv = OperatorStaffInvite.objects.filter(token=tid).select_related("operator").first()
        if not inv:
            return Response({"valid": False, "detail": "Invite not found."}, status=404)
        if inv.accepted_at:
            return Response({"valid": False, "detail": "This invite was already used."}, status=410)
        if inv.expires_at < timezone.now():
            return Response({"valid": False, "detail": "This invite has expired."}, status=410)
        return Response(
            {
                "valid": True,
                "email": inv.email,
                "role": inv.role,
                "operator_name": inv.operator.name or "Operator",
            }
        )


class OperatorStaffInviteAcceptView(APIView):
    """POST { token, password, name? } — creates OPERATOR user linked to invite's operator."""

    permission_classes = [AllowAny]
    authentication_classes = []

    def post(self, request):
        raw = (request.data.get("token") or "").strip()
        password = (request.data.get("password") or "").strip()
        name = (request.data.get("name") or "").strip()
        if not raw or not password:
            return Response({"detail": "token and password are required."}, status=400)
        if len(password) < 8:
            return Response({"detail": "Password must be at least 8 characters."}, status=400)
        try:
            from uuid import UUID

            tid = UUID(raw)
        except ValueError:
            return Response({"detail": "Invalid token."}, status=400)

        try:
            validate_password(password)
        except ValidationError as e:
            return Response({"detail": "; ".join(e.messages)}, status=400)

        with transaction.atomic():
            inv = (
                OperatorStaffInvite.objects.select_for_update()
                .filter(token=tid)
                .select_related("operator")
                .first()
            )
            if not inv:
                return Response({"detail": "Invite not found."}, status=404)
            if inv.accepted_at:
                return Response({"detail": "This invite was already used."}, status=410)
            if inv.expires_at < timezone.now():
                return Response({"detail": "This invite has expired."}, status=410)
            if User.objects.filter(email__iexact=inv.email).exists():
                return Response({"detail": "That email is already registered."}, status=400)

            username = _auto_username(email=inv.email, phone="")
            user = User(
                username=username,
                email=inv.email,
                first_name=name[:150] if name else "",
                role="OPERATOR",
                operator=inv.operator,
                operator_staff_role=inv.role,
                is_active=True,
            )
            user.set_password(password)
            user.save()
            inv.accepted_at = timezone.now()
            inv.save(update_fields=["accepted_at"])

        return Response({"detail": "Account created. You can sign in as an operator now."}, status=201)
