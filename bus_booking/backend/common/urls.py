from django.urls import path
from .views import RouteListView

urlpatterns = [
    path('routes/', RouteListView.as_view(), name='route_list'),
]