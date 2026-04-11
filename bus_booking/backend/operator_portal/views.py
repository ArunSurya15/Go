from rest_framework import generics
from rest_framework.exceptions import NotFound
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from datetime import date

from django.db.models import Count, Prefetch, Sum

from buses.models import Bus, Operator

from bookings.models import Booking, OperatorSale, Schedule, ScheduleLocation
from common.models import Route, RoutePattern, RoutePatternStop
from common.serializers import RoutePatternSerializer

from .booking_manifest import build_csv_response, build_pdf_response
from .permissions import IsOperator
from .serializers import (
    OperatorBookingManifestSerializer,
    OperatorBusSerializer,
    OperatorScheduleSerializer,
    OperatorProfileSerializer,
    OperatorSaleSerializer,
)


def get_operator(request):
    if not request.user or request.user.role != "OPERATOR":
        return None
    return getattr(request.user, "operator", None)


class BusListCreateView(generics.ListCreateAPIView):
    """List buses for the logged-in operator; create a new bus (assigned to their operator)."""
    permission_classes = [IsAuthenticated, IsOperator]
    serializer_class = OperatorBusSerializer

    def get_queryset(self):
        op = get_operator(self.request)
        if not op:
            return Bus.objects.none()
        return Bus.objects.filter(operator=op).order_by("registration_no")

    def perform_create(self, serializer):
        op = get_operator(self.request)
        serializer.save(operator=op)


class BusDetailView(generics.RetrieveUpdateAPIView):
    """Retrieve or update a bus (only if it belongs to the operator)."""
    permission_classes = [IsAuthenticated, IsOperator]
    serializer_class = OperatorBusSerializer

    def get_queryset(self):
        op = get_operator(self.request)
        if not op:
            return Bus.objects.none()
        return Bus.objects.filter(operator=op)


class ScheduleListCreateView(generics.ListCreateAPIView):
    """List schedules for the operator's buses; create a schedule (bus must belong to operator).

    Extra: GET ?export=csv|pdf&date=YYYY-MM-DD  →  day booking manifest download (no new URL needed).
    """
    permission_classes = [IsAuthenticated, IsOperator]
    serializer_class = OperatorScheduleSerializer

    def list(self, request, *args, **kwargs):
        export_fmt = (request.query_params.get("export") or "").strip().lower()
        if export_fmt in ("csv", "pdf"):
            day_raw = (request.query_params.get("date") or "").strip()
            if not day_raw:
                return Response({"detail": "date (YYYY-MM-DD) is required for export."}, status=400)
            try:
                d = date.fromisoformat(day_raw)
            except ValueError:
                return Response({"detail": "Invalid date. Use YYYY-MM-DD."}, status=400)
            op = get_operator(request)
            if not op:
                return Response({"detail": "Operator access required."}, status=403)
            sched_ids = Schedule.objects.filter(bus__operator=op, departure_dt__date=d).values_list("id", flat=True)
            bookings = Booking.objects.filter(schedule_id__in=sched_ids).select_related(
                "user", "payment", "schedule", "schedule__route", "boarding_point", "dropping_point"
            ).order_by("schedule__departure_dt", "id")
            op_name = op.name or "Operator"
            title = f"{op_name} · All trips · {d.strftime('%d %b %Y')}"
            fname = f"manifest-day-{d.isoformat()}.{export_fmt}"
            if export_fmt == "csv":
                return build_csv_response(bookings, fname, True)
            return build_pdf_response(bookings, title, fname, True)
        return super().list(request, *args, **kwargs)

    def get_queryset(self):
        op = get_operator(self.request)
        if not op:
            return Schedule.objects.none()
        qs = (
            Schedule.objects.filter(bus__operator=op)
            .select_related("bus", "route", "route_pattern")
            .prefetch_related(
                Prefetch(
                    "route_pattern__stops",
                    queryset=RoutePatternStop.objects.order_by("order"),
                ),
                "boarding_points",
                "dropping_points",
                "bookings",
                "reservations",
            )
        )
        params = self.request.query_params
        df = (params.get("date_from") or "").strip()
        dt = (params.get("date_to") or "").strip()
        if df or dt:
            try:
                if df:
                    qs = qs.filter(departure_dt__date__gte=date.fromisoformat(df))
                if dt:
                    qs = qs.filter(departure_dt__date__lte=date.fromisoformat(dt))
            except ValueError:
                pass
        return qs.order_by("-departure_dt")

    def get_serializer_context(self):
        ctx = super().get_serializer_context()
        ctx["operator"] = get_operator(self.request)
        return ctx

    def perform_create(self, serializer):
        serializer.save(status="PENDING")


class OperatorRoutePatternListView(generics.ListAPIView):
    """List route patterns (with stops) for a route — `?route_id=` required."""

    permission_classes = [IsAuthenticated, IsOperator]
    serializer_class = RoutePatternSerializer

    def get_queryset(self):
        route_id = self.request.query_params.get("route_id")
        if not route_id:
            return RoutePattern.objects.none()
        return (
            RoutePattern.objects.filter(route_id=route_id)
            .prefetch_related(
                Prefetch("stops", queryset=RoutePatternStop.objects.order_by("order"))
            )
            .order_by("name")
        )


class OperatorProfileView(generics.RetrieveUpdateAPIView):
    """GET or PATCH the logged-in operator's profile (for onboarding)."""
    permission_classes = [IsAuthenticated, IsOperator]
    serializer_class = OperatorProfileSerializer

    def get_object(self):
        op = get_operator(self.request)
        if not op:
            from rest_framework.exceptions import PermissionDenied
            raise PermissionDenied("Operator access required.")
        return op


class ScheduleDetailView(generics.RetrieveUpdateAPIView):
    """Retrieve or update a schedule (only if bus belongs to the operator).

    GET ?export=csv|pdf  →  single-trip booking manifest (same URL as schedule detail; avoids 404 on separate export path).
    """

    permission_classes = [IsAuthenticated, IsOperator]
    serializer_class = OperatorScheduleSerializer

    def retrieve(self, request, *args, **kwargs):
        export_fmt = (request.query_params.get("export") or "").strip().lower()
        if export_fmt in ("csv", "pdf"):
            schedule = self.get_object()
            op = get_operator(request)
            op_name = (op.name if op else None) or "Operator"
            bookings = (
                Booking.objects.filter(schedule_id=schedule.pk)
                .select_related(
                    "user",
                    "payment",
                    "schedule",
                    "schedule__route",
                    "boarding_point",
                    "dropping_point",
                )
                .order_by("id")
            )
            title = (
                f"{op_name} · {schedule.route.origin} → {schedule.route.destination} · "
                f"{schedule.departure_dt:%d %b %Y %H:%M}"
            )
            fname = f"manifest-schedule-{schedule.pk}.{export_fmt}"
            if export_fmt == "csv":
                return build_csv_response(bookings, fname, False)
            return build_pdf_response(bookings, title, fname, False)
        return super().retrieve(request, *args, **kwargs)

    def get_queryset(self):
        op = get_operator(self.request)
        if not op:
            return Schedule.objects.none()
        return (
            Schedule.objects.filter(bus__operator=op)
            .select_related("bus", "route", "route_pattern")
            .prefetch_related(
                Prefetch(
                    "route_pattern__stops",
                    queryset=RoutePatternStop.objects.order_by("order"),
                ),
                "boarding_points",
                "dropping_points",
                "bookings",
                "reservations",
            )
        )

    def get_serializer_context(self):
        ctx = super().get_serializer_context()
        ctx["operator"] = get_operator(self.request)
        return ctx


class ScheduleLocationView(APIView):
    """POST: operator/driver sends current GPS (lat, lng) for a schedule. Schedule must belong to operator."""
    permission_classes = [IsAuthenticated, IsOperator]

    def post(self, request, pk):
        op = get_operator(request)
        if not op:
            return Response({"detail": "Operator access required."}, status=403)
        schedule = Schedule.objects.filter(pk=pk, bus__operator=op).first()
        if not schedule:
            return Response({"detail": "Schedule not found."}, status=404)
        lat = request.data.get("lat")
        lng = request.data.get("lng")
        if lat is None or lng is None:
            return Response({"detail": "lat and lng are required."}, status=400)
        try:
            ScheduleLocation.objects.create(
                schedule=schedule,
                lat=float(lat),
                lng=float(lng),
            )
        except (TypeError, ValueError):
            return Response({"detail": "Invalid lat/lng."}, status=400)
        return Response({"detail": "Location recorded."}, status=201)


class OperatorScheduleBookingsListView(generics.ListAPIView):
    """GET: bookings for a schedule (manifest) — operator must own the bus."""

    permission_classes = [IsAuthenticated, IsOperator]
    serializer_class = OperatorBookingManifestSerializer

    def get_queryset(self):
        op = get_operator(self.request)
        schedule_id = self.kwargs["schedule_id"]
        if not op:
            return Booking.objects.none()
        if not Schedule.objects.filter(pk=schedule_id, bus__operator=op).exists():
            raise NotFound("Schedule not found.")
        return (
            Booking.objects.filter(schedule_id=schedule_id)
            .select_related(
                "user",
                "payment",
                "schedule",
                "schedule__route",
                "boarding_point",
                "dropping_point",
            )
            .order_by("-created_at")
        )


class OperatorBookingsExportView(APIView):
    """GET: CSV or PDF manifest. Provide exactly one of `schedule_id` or `date` (YYYY-MM-DD).

    Prefer URL path ``/api/operator/schedules/<id>/bookings/export/?format=csv`` (same prefix as
    the bookings list) so routing always hits this view. Legacy: ``/api/operator/bookings/export/?schedule_id=``.
    """

    permission_classes = [IsAuthenticated, IsOperator]

    def get(self, request, *args, **kwargs):
        op = get_operator(request)
        if not op:
            return Response({"detail": "Operator access required."}, status=403)

        fmt = (request.query_params.get("format") or "csv").strip().lower()
        path_sid = kwargs.get("schedule_id")
        if path_sid is not None:
            schedule_raw = str(path_sid).strip()
            day_raw = ""
        else:
            schedule_raw = (request.query_params.get("schedule_id") or "").strip()
            day_raw = (request.query_params.get("date") or "").strip()

        if bool(schedule_raw) == bool(day_raw):
            return Response(
                {"detail": "Provide exactly one of schedule_id or date."},
                status=400,
            )

        base_qs = Booking.objects.select_related(
            "user",
            "payment",
            "schedule",
            "schedule__route",
            "boarding_point",
            "dropping_point",
        )

        if schedule_raw:
            try:
                sid = int(schedule_raw)
            except ValueError:
                return Response({"detail": "Invalid schedule_id."}, status=400)
            sched = Schedule.objects.filter(pk=sid, bus__operator=op).select_related("route").first()
            if not sched:
                return Response({"detail": "Schedule not found."}, status=404)
            bookings = base_qs.filter(schedule_id=sid).order_by("id")
            op_name = op.name or "Operator"
            title = (
                f"{op_name} · {sched.route.origin} → {sched.route.destination} · "
                f"{sched.departure_dt:%d %b %Y %H:%M}"
            )
            fname = f"manifest-schedule-{sid}.{fmt}"
            include_schedule = False
        else:
            try:
                d = date.fromisoformat(day_raw)
            except ValueError:
                return Response({"detail": "Invalid date. Use YYYY-MM-DD."}, status=400)
            sched_ids = Schedule.objects.filter(bus__operator=op, departure_dt__date=d).values_list(
                "id", flat=True
            )
            bookings = base_qs.filter(schedule_id__in=sched_ids).order_by(
                "schedule__departure_dt", "id"
            )
            op_name = op.name or "Operator"
            title = f"{op_name} · All trips · {d.strftime('%d %b %Y')}"
            fname = f"manifest-day-{d.isoformat()}.{fmt}"
            include_schedule = True

        if fmt == "csv":
            return build_csv_response(bookings, fname, include_schedule)
        if fmt == "pdf":
            return build_pdf_response(bookings, title, fname, include_schedule)
        return Response({"detail": "format must be csv or pdf."}, status=400)


class OperatorSalesListView(generics.ListAPIView):
    """
    GET: sale lines derived from confirmed bookings (`OperatorSale`).
    Query: date_from, date_to (ISO date, filter on `confirmed_at`), active_only (1/true = exclude refunds/cancels).
    """

    permission_classes = [IsAuthenticated, IsOperator]
    serializer_class = OperatorSaleSerializer

    def get_queryset(self):
        op = get_operator(self.request)
        if not op:
            return OperatorSale.objects.none()
        qs = OperatorSale.objects.filter(operator=op).select_related(
            "booking", "schedule", "schedule__route"
        )
        params = self.request.query_params
        df = (params.get("date_from") or "").strip()
        dt = (params.get("date_to") or "").strip()
        if df:
            try:
                qs = qs.filter(confirmed_at__date__gte=date.fromisoformat(df))
            except ValueError:
                pass
        if dt:
            try:
                qs = qs.filter(confirmed_at__date__lte=date.fromisoformat(dt))
            except ValueError:
                pass
        active_only = (params.get("active_only") or "").strip().lower() in ("1", "true", "yes")
        if active_only:
            qs = qs.filter(reversal_status="")
        return qs.order_by("-confirmed_at", "-id")

    def list(self, request, *args, **kwargs):
        qs = self.filter_queryset(self.get_queryset())
        active_subset = qs.filter(reversal_status="")
        agg = active_subset.aggregate(
            total=Sum("gross_amount"),
            n=Count("id"),
            seats=Sum("seat_count"),
        )
        ser = self.get_serializer(qs, many=True)
        return Response(
            {
                "summary": {
                    "active_booking_count": agg["n"] or 0,
                    "gross_amount": str(agg["total"] or 0),
                    "seat_count": int(agg["seats"] or 0),
                },
                "results": ser.data,
            }
        )


class OperatorCancelBookingView(APIView):
    """
    POST /api/operator/schedules/{schedule_id}/bookings/{booking_id}/cancel/
    Body (optional): { "reason": "...", "refund_pct": 100 }
    Operator can cancel any booking on their schedule with optional refund override.
    """
    permission_classes = [IsAuthenticated, IsOperator]

    def post(self, request, schedule_id, booking_id):
        operator = get_operator(request)
        if not operator:
            return Response({"detail": "Operator account not found."}, status=403)
        from django.shortcuts import get_object_or_404
        booking = get_object_or_404(
            Booking.objects.select_related("schedule", "schedule__bus", "user"),
            pk=booking_id,
            schedule_id=schedule_id,
            schedule__bus__operator=operator,
        )
        reason = str(request.data.get("reason") or "")[:255]
        refund_pct = request.data.get("refund_pct")
        force_pct = None
        if refund_pct is not None:
            try:
                force_pct = max(0, min(100, int(refund_pct)))
            except (TypeError, ValueError):
                return Response({"detail": "refund_pct must be 0–100."}, status=400)

        from bookings.cancellation import cancel_booking
        try:
            result = cancel_booking(booking, by="operator", reason=reason, force_refund_pct=force_pct)
        except ValueError as e:
            return Response({"detail": str(e)}, status=400)
        return Response(result)


class OperatorCancelScheduleView(APIView):
    """
    POST /api/operator/schedules/{schedule_id}/cancel/
    Body (optional): { "reason": "...", "refund_pct": 100 }
    Cancels all CONFIRMED bookings on a schedule (e.g. bus breakdown).
    """
    permission_classes = [IsAuthenticated, IsOperator]

    def post(self, request, schedule_id):
        operator = get_operator(request)
        if not operator:
            return Response({"detail": "Operator account not found."}, status=403)
        from django.shortcuts import get_object_or_404
        schedule = get_object_or_404(
            Schedule.objects.select_related("bus"),
            pk=schedule_id,
            bus__operator=operator,
        )
        reason = str(request.data.get("reason") or "Schedule cancelled by operator")[:255]
        refund_pct = request.data.get("refund_pct")
        force_pct = 100  # default full refund when operator cancels entire schedule
        if refund_pct is not None:
            try:
                force_pct = max(0, min(100, int(refund_pct)))
            except (TypeError, ValueError):
                return Response({"detail": "refund_pct must be 0–100."}, status=400)

        bookings = Booking.objects.filter(
            schedule=schedule, status__in=("CONFIRMED", "PENDING")
        ).select_related("schedule", "schedule__bus", "user")

        results = []
        errors = []
        from bookings.cancellation import cancel_booking
        for b in bookings:
            try:
                results.append(cancel_booking(b, by="operator", reason=reason, force_refund_pct=force_pct))
            except ValueError as e:
                errors.append({"booking_id": b.id, "error": str(e)})

        # Mark schedule as CANCELLED
        schedule.status = "CANCELLED"
        schedule.save(update_fields=["status"])

        return Response({
            "schedule_id": schedule_id,
            "cancelled_bookings": len(results),
            "errors": errors,
            "results": results,
        })
