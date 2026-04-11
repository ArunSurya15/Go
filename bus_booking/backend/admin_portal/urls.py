from django.urls import path

from .views import (
    AdminStatsView,
    AdminAuditLogListView,
    AdminPendingSchedulesView,
    AdminScheduleApproveView,
    AdminScheduleRejectView,
    AdminOperatorListView,
    AdminOperatorDetailView,
    AdminOperatorRequestInfoView,
)

urlpatterns = [
    path("stats/", AdminStatsView.as_view(), name="admin_stats"),
    path("audit/", AdminAuditLogListView.as_view(), name="admin_audit_log"),
    path("schedules/pending/", AdminPendingSchedulesView.as_view(), name="admin_schedules_pending"),
    path("schedules/<int:pk>/approve/", AdminScheduleApproveView.as_view(), name="admin_schedule_approve"),
    path("schedules/<int:pk>/reject/", AdminScheduleRejectView.as_view(), name="admin_schedule_reject"),
    path("operators/", AdminOperatorListView.as_view(), name="admin_operators"),
    path("operators/<int:pk>/", AdminOperatorDetailView.as_view(), name="admin_operator_detail"),
    path(
        "operators/<int:pk>/request-info/",
        AdminOperatorRequestInfoView.as_view(),
        name="admin_operator_request_info",
    ),
]
