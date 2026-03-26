from django.urls import path
from .views import RouteListView, BusFeatureCatalogView

urlpatterns = [
    path('routes/', RouteListView.as_view(), name='route_list'),
    path('bus-features/', BusFeatureCatalogView.as_view(), name='bus_feature_catalog'),
]