from django.urls import path
from .views import ScheduleListView, ReserveView, CreatePaymentView, PaymentWebhookView, TicketView, TicketDownloadView

urlpatterns = [
    path('schedules/', ScheduleListView.as_view(), name='schedule_list'),
    path('reserve/', ReserveView.as_view(), name='reserve'),
    path('create-payment/', CreatePaymentView.as_view(), name='create_payment'),
    path('payment/webhook/', PaymentWebhookView.as_view(), name='payment_webhook'),
    path('bookings/<int:pk>/ticket/', TicketView.as_view(), name='ticket'),
    path('tickets/download/<int:pk>/', TicketDownloadView.as_view(), name='ticket_download'),
]