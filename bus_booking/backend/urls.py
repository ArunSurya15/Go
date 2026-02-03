from django.contrib import admin
from django.urls import path, include
from django.views.generic import RedirectView

urlpatterns = [
    path("", RedirectView.as_view(url="/api/docs/", permanent=False)),
    path('admin/', admin.site.urls),
    path('api/users/', include('users.urls')),
    path('api/operator/', include('operator_portal.urls')),
    path('api/', include('common.urls')),
    path('api/', include('bookings.urls')),
]