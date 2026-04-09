from rest_framework import generics
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from django.db.models import Prefetch

from buses.models import Bus, Operator
from bookings.models import Schedule, ScheduleLocation
from common.models import Route, RoutePattern, RoutePatternStop
from common.serializers import RoutePatternSerializer

from .permissions import IsOperator
from .serializers import OperatorBusSerializer, OperatorScheduleSerializer, OperatorProfileSerializer


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
    """List schedules for the operator's buses; create a schedule (bus must belong to operator)."""
    permission_classes = [IsAuthenticated, IsOperator]
    serializer_class = OperatorScheduleSerializer

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
            )
            .order_by("-departure_dt")
        )

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
    """Retrieve or update a schedule (only if bus belongs to the operator)."""
    permission_classes = [IsAuthenticated, IsOperator]
    serializer_class = OperatorScheduleSerializer

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
