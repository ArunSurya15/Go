from django.urls import path
from .views import (
    BusListCreateView,
    BusDetailView,
    ScheduleListCreateView,
    ScheduleDetailView,
    ScheduleLocationView,
    OperatorProfileView,
)

urlpatterns = [
    path("me/", OperatorProfileView.as_view(), name="operator_profile"),
    path("buses/", BusListCreateView.as_view(), name="operator_bus_list_create"),
    path("buses/<int:pk>/", BusDetailView.as_view(), name="operator_bus_detail"),
    path("schedules/", ScheduleListCreateView.as_view(), name="operator_schedule_list_create"),
    path("schedules/<int:pk>/location/", ScheduleLocationView.as_view(), name="operator_schedule_location"),
    path("schedules/<int:pk>/", ScheduleDetailView.as_view(), name="operator_schedule_detail"),
]
