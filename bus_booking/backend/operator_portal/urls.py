from django.urls import path
from .views import (
    BusListCreateView,
    BusDetailView,
    ScheduleListCreateView,
    ScheduleDetailView,
    ScheduleLocationView,
    OperatorProfileView,
    OperatorRoutePatternListView,
    OperatorScheduleBookingsListView,
    OperatorBookingsExportView,
    OperatorSalesListView,
    OperatorCancelBookingView,
    OperatorCancelScheduleView,
)

urlpatterns = [
    # Must stay: requests hit /api/operator/manifest/day/ via include("operator_portal.urls") —
    # the remainder is "manifest/day/". Without this, Django returns 404.
    path("manifest/day/", OperatorBookingsExportView.as_view(), name="operator_manifest_day_included"),
    path("me/", OperatorProfileView.as_view(), name="operator_profile"),
    path("buses/", BusListCreateView.as_view(), name="operator_bus_list_create"),
    path("buses/<int:pk>/", BusDetailView.as_view(), name="operator_bus_detail"),
    path("route-patterns/", OperatorRoutePatternListView.as_view(), name="operator_route_patterns"),
    path("sales/", OperatorSalesListView.as_view(), name="operator_sales_list"),
    path("bookings/export/", OperatorBookingsExportView.as_view(), name="operator_bookings_export"),
    path("schedules/", ScheduleListCreateView.as_view(), name="operator_schedule_list_create"),
    # Day manifest URL is registered in project urls.py as api/operator/manifest/day/
    # Per-trip manifest — must be before schedules/<id>/bookings/
    path(
        "schedules/<int:schedule_id>/bookings/export/",
        OperatorBookingsExportView.as_view(),
        name="operator_schedule_bookings_export",
    ),
    path("schedules/<int:schedule_id>/bookings/", OperatorScheduleBookingsListView.as_view(), name="operator_schedule_bookings"),
    path("schedules/<int:schedule_id>/bookings/<int:booking_id>/cancel/", OperatorCancelBookingView.as_view(), name="operator_cancel_booking"),
    path("schedules/<int:schedule_id>/cancel/", OperatorCancelScheduleView.as_view(), name="operator_cancel_schedule"),
    path("schedules/<int:pk>/location/", ScheduleLocationView.as_view(), name="operator_schedule_location"),
    path("schedules/<int:pk>/", ScheduleDetailView.as_view(), name="operator_schedule_detail"),
]
