from rest_framework import generics
from rest_framework.exceptions import NotFound
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

import json
from datetime import date, timedelta

from django.db.models import Count, Prefetch, Sum, Q
from django.utils import timezone

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
        # Hide archived unless explicitly requested
        show_archived = (params.get("show_archived") or "").strip().lower() in ("1", "true", "yes")
        if not show_archived:
            qs = qs.filter(archived=False)
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


class OperatorDuplicateScheduleView(APIView):
    """
    POST /api/operator/schedules/{pk}/duplicate/
    Body: { "departure_date": "YYYY-MM-DD" }
    Clones a schedule to a new date, keeping same bus/route/fare/points.
    Arrival date is shifted by the same offset as departure.
    """
    permission_classes = [IsAuthenticated, IsOperator]

    def post(self, request, pk):
        from django.shortcuts import get_object_or_404
        from datetime import datetime, timedelta
        import pytz

        operator = get_operator(request)
        if not operator:
            return Response({"detail": "Operator account not found."}, status=403)

        src = get_object_or_404(
            Schedule.objects.select_related("bus", "route", "route_pattern").prefetch_related(
                "boarding_points", "dropping_points"
            ),
            pk=pk,
            bus__operator=operator,
        )

        new_date_str = (request.data.get("departure_date") or "").strip()
        if not new_date_str:
            return Response({"detail": "departure_date (YYYY-MM-DD) is required."}, status=400)
        try:
            new_date = date.fromisoformat(new_date_str)
        except ValueError:
            return Response({"detail": "Invalid date format. Use YYYY-MM-DD."}, status=400)

        # Shift departure & arrival by the day delta
        src_dep = src.departure_dt
        src_arr = src.arrival_dt
        src_date = src_dep.date()
        delta_days = (new_date - src_date).days

        new_dep = src_dep + timedelta(days=delta_days)
        new_arr = src_arr + timedelta(days=delta_days)

        new_schedule = Schedule.objects.create(
            bus=src.bus,
            route=src.route,
            route_pattern=src.route_pattern,
            departure_dt=new_dep,
            arrival_dt=new_arr,
            fare=src.fare,
            fare_original=src.fare_original,
            operator_promo_title=src.operator_promo_title,
            operator_offer_style=src.operator_offer_style,
            seat_fares_json=src.seat_fares_json,
            status="PENDING",
        )

        # Copy boarding/dropping points
        from bookings.models import BoardingPoint, DroppingPoint
        for bp in src.boarding_points.all():
            BoardingPoint.objects.create(
                schedule=new_schedule,
                location_name=bp.location_name,
                time=bp.time,
                landmark=bp.landmark or "",
            )
        for dp in src.dropping_points.all():
            DroppingPoint.objects.create(
                schedule=new_schedule,
                location_name=dp.location_name,
                time=dp.time,
                description=dp.description or "",
            )

        return Response({
            "id": new_schedule.id,
            "departure_dt": new_dep.isoformat(),
            "arrival_dt": new_arr.isoformat(),
            "status": new_schedule.status,
            "message": f"Schedule duplicated to {new_date_str}. Status: PENDING (awaiting approval).",
        }, status=201)


class OperatorBulkCreateSchedulesView(APIView):
    """
    POST /api/operator/schedules/bulk-create/
    Body: {
      "bus": <id>,
      "route": <id>,
      "route_pattern": <id> | null,
      "departure_time": "HH:MM",
      "arrival_time": "HH:MM",
      "arrival_next_day": bool,
      "fare": "500",
      "date_from": "YYYY-MM-DD",
      "date_to": "YYYY-MM-DD",
      "days_of_week": [0,1,2,3,4,5,6]  // 0=Mon … 6=Sun
    }
    Creates one schedule per matching day in the range.
    Skips dates where a schedule with same bus+departure_dt already exists.
    """
    permission_classes = [IsAuthenticated, IsOperator]

    def post(self, request):
        from datetime import datetime, timedelta
        operator = get_operator(request)
        if not operator:
            return Response({"detail": "Operator account not found."}, status=403)

        d = request.data
        try:
            bus_id = int(d["bus"])
            route_id = int(d["route"])
        except (KeyError, TypeError, ValueError):
            return Response({"detail": "bus and route are required integers."}, status=400)

        # Validate bus belongs to operator
        from buses.models import Bus as BusModel
        from django.shortcuts import get_object_or_404
        bus = get_object_or_404(BusModel, pk=bus_id, operator=operator)

        dep_time_str = (d.get("departure_time") or "09:00").strip()
        arr_time_str = (d.get("arrival_time") or "18:00").strip()
        arrival_next_day = bool(d.get("arrival_next_day", False))

        try:
            date_from = date.fromisoformat(str(d["date_from"]))
            date_to = date.fromisoformat(str(d["date_to"]))
        except (KeyError, ValueError):
            return Response({"detail": "date_from and date_to (YYYY-MM-DD) are required."}, status=400)

        if date_to < date_from:
            return Response({"detail": "date_to must be >= date_from."}, status=400)
        if (date_to - date_from).days > 365:
            return Response({"detail": "Range cannot exceed 365 days."}, status=400)

        days_of_week = d.get("days_of_week")
        if not days_of_week:
            days_of_week = list(range(7))
        try:
            days_of_week = [int(x) for x in days_of_week if 0 <= int(x) <= 6]
        except (TypeError, ValueError):
            return Response({"detail": "days_of_week must be a list of ints 0-6."}, status=400)

        fare = str(d.get("fare") or "0").strip()
        fare_original = str(d.get("fare_original") or "").strip() or None
        route_pattern_id = d.get("route_pattern")
        from common.models import Route, RoutePattern
        route = get_object_or_404(Route, pk=route_id)
        route_pattern = None
        if route_pattern_id:
            try:
                route_pattern = RoutePattern.objects.get(pk=int(route_pattern_id))
            except (RoutePattern.DoesNotExist, ValueError):
                pass

        def make_dt(day: date, time_str: str, extra_days: int = 0) -> str:
            h, m = (time_str.split(":") + ["0"])[:2]
            dt = datetime(day.year, day.month, day.day, int(h), int(m)) + timedelta(days=extra_days)
            return dt.isoformat()

        created = []
        skipped = []
        cur = date_from
        while cur <= date_to:
            if cur.weekday() in days_of_week:
                dep_dt = make_dt(cur, dep_time_str)
                arr_extra = 1 if arrival_next_day else 0
                arr_dt = make_dt(cur, arr_time_str, arr_extra)
                # Skip if duplicate
                exists = Schedule.objects.filter(bus=bus, departure_dt=dep_dt).exists()
                if exists:
                    skipped.append(str(cur))
                else:
                    s = Schedule.objects.create(
                        bus=bus,
                        route=route,
                        route_pattern=route_pattern,
                        departure_dt=dep_dt,
                        arrival_dt=arr_dt,
                        fare=fare,
                        **({"fare_original": fare_original} if fare_original else {}),
                        status="PENDING",
                    )
                    created.append({"id": s.id, "date": str(cur), "departure_dt": dep_dt})
            cur += timedelta(days=1)

        return Response({
            "created": len(created),
            "skipped": len(skipped),
            "schedules": created,
        }, status=201)


class OperatorArchiveScheduleView(APIView):
    """
    POST /api/operator/schedules/{pk}/archive/
    Body: { "archived": true | false }
    Toggles the archived flag on a schedule.
    """
    permission_classes = [IsAuthenticated, IsOperator]

    def post(self, request, pk):
        from django.shortcuts import get_object_or_404
        operator = get_operator(request)
        if not operator:
            return Response({"detail": "Operator account not found."}, status=403)

        schedule = get_object_or_404(Schedule, pk=pk, bus__operator=operator)
        archived = bool(request.data.get("archived", True))
        schedule.archived = archived
        schedule.save(update_fields=["archived"])
        return Response({"id": schedule.id, "archived": schedule.archived})


class OperatorDashboardStatsView(APIView):
    """
    GET /api/operator/dashboard-stats/
    Returns KPI summary for the operator dashboard:
      - today_trips: list of today's schedules with fill data
      - week_trips: next 7 days schedules (brief)
      - kpi: { trips_today, seats_sold_today, seats_total_today,
               revenue_today, revenue_week, revenue_month,
               pending_approval, total_buses, active_schedules }
    """
    permission_classes = [IsAuthenticated, IsOperator]

    def get(self, request):
        operator = get_operator(request)
        if not operator:
            return Response({"detail": "Operator account not found."}, status=403)

        now = timezone.now()
        today = now.date()
        week_end = today + timedelta(days=7)
        month_start = today.replace(day=1)

        # ── schedules ────────────────────────────────────────────────────────
        base_qs = Schedule.objects.filter(
            bus__operator=operator
        ).select_related("bus", "route")

        today_schedules = list(
            base_qs.filter(departure_dt__date=today).order_by("departure_dt")
        )
        week_schedules = list(
            base_qs.filter(
                departure_dt__date__gt=today,
                departure_dt__date__lte=week_end,
            ).order_by("departure_dt")[:20]
        )

        # ── bookings for today's trips ────────────────────────────────────────
        today_sched_ids = [s.id for s in today_schedules]
        confirmed_bookings_today = list(
            Booking.objects.filter(
                schedule_id__in=today_sched_ids,
                status__in=("CONFIRMED", "REFUNDED"),
            ).values("schedule_id", "seats", "amount")
        )

        # Build per-schedule maps
        seats_sold_map: dict[int, int] = {}
        rev_map: dict[int, float] = {}
        for b in confirmed_bookings_today:
            sid = b["schedule_id"]
            try:
                seat_list = json.loads(b["seats"] or "[]")
                cnt = len(seat_list) if isinstance(seat_list, list) else 1
            except Exception:
                cnt = 1
            seats_sold_map[sid] = seats_sold_map.get(sid, 0) + cnt
            rev_map[sid] = rev_map.get(sid, 0) + float(b["amount"] or 0)

        # ── today trip details ────────────────────────────────────────────────
        today_trip_list = []
        seats_sold_today_total = 0
        seats_capacity_today_total = 0
        revenue_today = 0.0

        for s in today_schedules:
            sold = seats_sold_map.get(s.id, 0)
            cap = s.bus.capacity or 0
            rev = rev_map.get(s.id, 0)
            seats_sold_today_total += sold
            seats_capacity_today_total += cap
            revenue_today += rev
            today_trip_list.append({
                "id": s.id,
                "route": f"{s.route.origin} → {s.route.destination}",
                "departure_dt": s.departure_dt.isoformat(),
                "status": s.status,
                "bus_reg": s.bus.registration_no,
                "seats_sold": sold,
                "seats_total": cap,
                "fill_pct": round(sold / cap * 100) if cap else 0,
                "revenue": round(rev, 2),
            })

        # ── week trip details ─────────────────────────────────────────────────
        week_sched_ids = [s.id for s in week_schedules]
        week_sold_qs = list(
            Booking.objects.filter(
                schedule_id__in=week_sched_ids,
                status__in=("CONFIRMED", "REFUNDED"),
            ).values("schedule_id", "seats")
        )
        week_seats_map: dict[int, int] = {}
        for b in week_sold_qs:
            sid = b["schedule_id"]
            try:
                cnt = len(json.loads(b["seats"] or "[]"))
            except Exception:
                cnt = 1
            week_seats_map[sid] = week_seats_map.get(sid, 0) + cnt

        week_trip_list = []
        for s in week_schedules:
            sold = week_seats_map.get(s.id, 0)
            cap = s.bus.capacity or 0
            week_trip_list.append({
                "id": s.id,
                "route": f"{s.route.origin} → {s.route.destination}",
                "departure_dt": s.departure_dt.isoformat(),
                "status": s.status,
                "seats_sold": sold,
                "seats_total": cap,
                "fill_pct": round(sold / cap * 100) if cap else 0,
            })

        # ── revenue aggregates via OperatorSale ───────────────────────────────
        sale_qs = OperatorSale.objects.filter(operator=operator, reversal_status="")
        rev_week = float(
            sale_qs.filter(confirmed_at__date__gte=today - timedelta(days=7)).aggregate(t=Sum("gross_amount"))["t"] or 0
        )
        rev_month = float(
            sale_qs.filter(confirmed_at__date__gte=month_start).aggregate(t=Sum("gross_amount"))["t"] or 0
        )

        # ── other counts ─────────────────────────────────────────────────────
        pending_count = base_qs.filter(status="PENDING").count()
        total_buses = base_qs.values("bus_id").distinct().count()
        active_schedules = base_qs.filter(
            status="ACTIVE", departure_dt__date__gte=today
        ).count()

        return Response({
            "kpi": {
                "trips_today": len(today_schedules),
                "seats_sold_today": seats_sold_today_total,
                "seats_total_today": seats_capacity_today_total,
                "fill_pct_today": round(seats_sold_today_total / seats_capacity_today_total * 100) if seats_capacity_today_total else 0,
                "revenue_today": round(revenue_today, 2),
                "revenue_week": round(rev_week, 2),
                "revenue_month": round(rev_month, 2),
                "pending_approval": pending_count,
                "total_buses": total_buses,
                "active_schedules": active_schedules,
            },
            "today_trips": today_trip_list,
            "week_trips": week_trip_list,
        })
