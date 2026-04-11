from django.urls import path
from .views import (
    RegisterView, RegisterConfirmView, RegisterOperatorView,
    MeView, ChangePasswordView,
    SavedPassengerView, SavedPassengerDetailView,
    SendOtpView, VerifyOtpView,
)
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView

urlpatterns = [
    path('register/', RegisterView.as_view(), name='register'),
    path('register/confirm/', RegisterConfirmView.as_view(), name='register_confirm'),
    path('register-operator/', RegisterOperatorView.as_view(), name='register_operator'),
    path('send-otp/', SendOtpView.as_view(), name='send_otp'),
    path('verify-otp/', VerifyOtpView.as_view(), name='verify_otp'),
    path('login/', TokenObtainPairView.as_view(), name='login'),
    path('token/refresh/', TokenRefreshView.as_view(), name='token_refresh'),
    path('me/', MeView.as_view(), name='me'),
    path('me/change-password/', ChangePasswordView.as_view(), name='change_password'),
    path('me/saved-passengers/', SavedPassengerView.as_view(), name='saved_passengers'),
    path('me/saved-passengers/<int:pk>/', SavedPassengerDetailView.as_view(), name='saved_passenger_detail'),
]
