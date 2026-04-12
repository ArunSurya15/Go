from django.urls import path
from .views import RouteListView, RoutePlaceSuggestView, BusFeatureCatalogView

urlpatterns = [
    path("routes/suggest/", RoutePlaceSuggestView.as_view(), name="route_place_suggest"),
    path('routes/', RouteListView.as_view(), name='route_list'),
    path('bus-features/', BusFeatureCatalogView.as_view(), name='bus_feature_catalog'),
]