from django.contrib import admin
from django.urls import path, include

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/users/', include('users.urls')),
    path('api/operator/', include('operator_portal.urls')),
    path('api/', include('common.urls')),
    path('api/', include('bookings.urls')),
]