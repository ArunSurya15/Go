from django.db.models import Count
from django.shortcuts import get_object_or_404
from rest_framework import generics
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from bookings.models import Schedule
from bookings.notifications import (
    notify_operator_clarification_request,
    notify_operator_kyc_changed,
    notify_operator_schedule_published,
    notify_operator_schedule_rejected,
)
from bookings.serializers import ScheduleSerializer
from buses.models import Operator

from .models import AdminAuditLog, log_admin_action
from .permissions import IsAdmin
from .serializers import AdminAuditLogSerializer, AdminOperatorSerializer, AdminSchedulePendingSerializer


class AdminStatsView(APIView):
    """
    GET /api/admin/stats/
    Dashboard counts for admins.
    """
    permission_classes = [IsAuthenticated, IsAdmin]

    def get(self, request):
        pending_schedules = Schedule.objects.filter(status="PENDING", archived=False).count()
        pending_kyc = Operator.objects.filter(kyc_status="PENDING").count()
        total_operators = Operator.objects.count()
        active_schedules = Schedule.objects.filter(status="ACTIVE", archived=False).count()
        return Response({
            "pending_schedules": pending_schedules,
            "pending_operator_kyc": pending_kyc,
            "total_operators": total_operators,
            "active_upcoming_schedules": active_schedules,
        })


class AdminAuditLogListView(generics.ListAPIView):
    """
    GET /api/admin/audit/?limit=100&target_type=schedule|operator&action=...
    Recent admin actions (newest first). limit capped at 500.
    """
    permission_classes = [IsAuthenticated, IsAdmin]
    serializer_class = AdminAuditLogSerializer
    pagination_class = None

    def get_queryset(self):
        limit = min(max(1, int(self.request.query_params.get("limit", 100))), 500)
        qs = AdminAuditLog.objects.select_related("actor").order_by("-created_at")
        tt = (self.request.query_params.get("target_type") or "").strip().lower()
        if tt in (AdminAuditLog.TARGET_SCHEDULE, AdminAuditLog.TARGET_OPERATOR):
            qs = qs.filter(target_type=tt)
        act = (self.request.query_params.get("action") or "").strip()
        if act:
            qs = qs.filter(action=act)
        return qs[:limit]


class AdminPendingSchedulesView(generics.ListAPIView):
    """
    GET /api/admin/schedules/pending/
    Schedules awaiting approval (PENDING, not archived).
    """
    permission_classes = [IsAuthenticated, IsAdmin]
    serializer_class = AdminSchedulePendingSerializer

    def get_queryset(self):
        return (
            Schedule.objects.filter(status="PENDING", archived=False)
            .select_related("route", "route_pattern", "bus", "bus__operator")
            .order_by("departure_dt")
        )


class AdminScheduleApproveView(APIView):
    """
    POST /api/admin/schedules/<pk>/approve/
    Sets schedule status to ACTIVE so it appears in passenger search.
    """
    permission_classes = [IsAuthenticated, IsAdmin]

    def post(self, request, pk):
        schedule = (
            Schedule.objects.filter(pk=pk, archived=False)
            .select_related("route", "bus__operator")
            .first()
        )
        if not schedule:
            return Response({"detail": "Schedule not found."}, status=404)
        if schedule.status != "PENDING":
            return Response(
                {"detail": f"Only PENDING schedules can be approved (current: {schedule.status})."},
                status=400,
            )
        schedule.status = "ACTIVE"
        schedule.save(update_fields=["status"])
        log_admin_action(
            request.user,
            AdminAuditLog.ACTION_SCHEDULE_APPROVED,
            AdminAuditLog.TARGET_SCHEDULE,
            schedule.id,
            {
                "previous_status": "PENDING",
                "new_status": "ACTIVE",
                "route": f"{schedule.route.origin} → {schedule.route.destination}",
                "departure_dt": schedule.departure_dt.isoformat(),
                "operator_name": schedule.bus.operator.name,
                "bus_registration": schedule.bus.registration_no,
            },
        )
        notify_operator_schedule_published(schedule, source="admin")
        return Response(ScheduleSerializer(schedule).data)


class AdminScheduleRejectView(APIView):
    """
    POST /api/admin/schedules/<pk>/reject/
    Sets schedule to CANCELLED (admin rejection — not shown to passengers).
    """
    permission_classes = [IsAuthenticated, IsAdmin]

    def post(self, request, pk):
        schedule = (
            Schedule.objects.filter(pk=pk, archived=False)
            .select_related("route", "bus__operator")
            .first()
        )
        if not schedule:
            return Response({"detail": "Schedule not found."}, status=404)
        if schedule.status != "PENDING":
            return Response(
                {"detail": "Only PENDING schedules can be rejected from the approval queue."},
                status=400,
            )
        schedule.status = "CANCELLED"
        schedule.save(update_fields=["status"])
        log_admin_action(
            request.user,
            AdminAuditLog.ACTION_SCHEDULE_REJECTED,
            AdminAuditLog.TARGET_SCHEDULE,
            schedule.id,
            {
                "previous_status": "PENDING",
                "new_status": "CANCELLED",
                "route": f"{schedule.route.origin} → {schedule.route.destination}",
                "departure_dt": schedule.departure_dt.isoformat(),
                "operator_name": schedule.bus.operator.name,
                "bus_registration": schedule.bus.registration_no,
            },
        )
        notify_operator_schedule_rejected(schedule)
        return Response({"id": schedule.id, "status": schedule.status, "detail": "Schedule rejected."})


class AdminOperatorListView(generics.ListAPIView):
    """
    GET /api/admin/operators/?kyc=PENDING
    List operators; optional filter by kyc_status.
    """
    permission_classes = [IsAuthenticated, IsAdmin]
    serializer_class = AdminOperatorSerializer

    def get_queryset(self):
        qs = (
            Operator.objects.annotate(
                buses_count=Count("buses", distinct=True),
                users_count=Count("users", distinct=True),
            )
            .prefetch_related("buses")
            .order_by("name")
        )
        kyc = (self.request.query_params.get("kyc") or "").strip().upper()
        if kyc:
            qs = qs.filter(kyc_status__iexact=kyc)
        return qs


class AdminOperatorDetailView(generics.RetrieveUpdateAPIView):
    """
    GET / PATCH /api/admin/operators/<pk>/
    View or update operator (KYC status, contact, bank details, name).
    """
    permission_classes = [IsAuthenticated, IsAdmin]
    serializer_class = AdminOperatorSerializer
    queryset = Operator.objects.annotate(
        buses_count=Count("buses", distinct=True),
        users_count=Count("users", distinct=True),
    ).prefetch_related("buses")

    def get_queryset(self):
        return self.queryset

    def perform_update(self, serializer):
        instance = self.get_object()
        before = {
            "name": instance.name,
            "contact_info": instance.contact_info or "",
            "bank_details": instance.bank_details or "",
            "kyc_status": instance.kyc_status,
        }
        serializer.save()
        instance.refresh_from_db()
        after = {
            "name": instance.name,
            "contact_info": instance.contact_info or "",
            "bank_details": instance.bank_details or "",
            "kyc_status": instance.kyc_status,
        }
        changes = {k: {"from": before[k], "to": after[k]} for k in before if before[k] != after[k]}
        if changes:
            log_admin_action(
                self.request.user,
                AdminAuditLog.ACTION_OPERATOR_UPDATED,
                AdminAuditLog.TARGET_OPERATOR,
                instance.id,
                {"operator_name": after["name"], "changes": changes},
            )
        if before["kyc_status"] != after["kyc_status"]:
            notify_operator_kyc_changed(instance, before["kyc_status"], after["kyc_status"])


class AdminOperatorRequestInfoView(APIView):
    """
    POST /api/admin/operators/<pk>/request-info/
    Body: { "subject": "...", "message": "..." }
    Sends clarification request to operator contacts (email + SMS + WhatsApp).
    """
    permission_classes = [IsAuthenticated, IsAdmin]

    def post(self, request, pk):
        subject = (request.data.get("subject") or "").strip()
        message = (request.data.get("message") or "").strip()
        if not subject or not message:
            return Response({"detail": "Both subject and message are required."}, status=400)
        operator = get_object_or_404(Operator, pk=pk)
        notify_operator_clarification_request(
            operator,
            subject,
            message,
            admin_username=getattr(request.user, "username", "") or "",
        )
        log_admin_action(
            request.user,
            AdminAuditLog.ACTION_OPERATOR_CLARIFICATION_SENT,
            AdminAuditLog.TARGET_OPERATOR,
            operator.id,
            {"subject": subject, "operator_name": operator.name},
        )
        return Response({"detail": "Clarification request sent to operator contacts."})
