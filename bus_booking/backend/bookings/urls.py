from django.urls import path
from .views import (
    ScheduleListView, BoardingPointListView, DroppingPointListView,
    ScheduleSeatMapView,
    ReserveView, CreatePaymentView, PaymentWebhookView, TicketView, TicketDownloadView,
)

urlpatterns = [
    path('schedules/', ScheduleListView.as_view(), name='schedule_list'),
    path('schedules/<int:pk>/seat-map/', ScheduleSeatMapView.as_view(), name='schedule_seat_map'),
    path('boarding-points/', BoardingPointListView.as_view(), name='boarding_point_list'),
    path('dropping-points/', DroppingPointListView.as_view(), name='dropping_point_list'),
    path('reserve/', ReserveView.as_view(), name='reserve'),
    path('create-payment/', CreatePaymentView.as_view(), name='create_payment'),
    path('payment/webhook/', PaymentWebhookView.as_view(), name='payment_webhook'),
    path('bookings/<int:pk>/ticket/', TicketView.as_view(), name='ticket'),
    path('tickets/download/<int:pk>/', TicketDownloadView.as_view(), name='ticket_download'),
]