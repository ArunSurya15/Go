from rest_framework import generics
from rest_framework.response import Response
from rest_framework.views import APIView
from .models import Route
from .serializers import RouteSerializer
from rest_framework.permissions import AllowAny
from django.db.models import Q

from buses.constants import BUS_FEATURE_DEFINITIONS
from .city_search import city_icontains_q

class RouteListView(generics.ListAPIView):
    queryset = Route.objects.all()
    serializer_class = RouteSerializer
    permission_classes = [AllowAny]

    def get_queryset(self):
        qs = super().get_queryset()
        origin = self.request.query_params.get('from')
        dest = self.request.query_params.get('to')
        if origin:
            qs = qs.filter(city_icontains_q("origin", origin))
        if dest:
            qs = qs.filter(city_icontains_q("destination", dest))
        return qs


class RoutePlaceSuggestView(APIView):
    """
    Lightweight city suggestions for autocomplete (distinct names only, no full Route rows).
    GET ?q=B&field=origin|destination&from=Bengaluru (optional, narrows destinations)
    """

    permission_classes = [AllowAny]

    def get(self, request):
        q = (request.query_params.get("q") or "").strip()
        field = (request.query_params.get("field") or "origin").lower()
        origin_ctx = (request.query_params.get("from") or "").strip()
        try:
            limit = int(request.query_params.get("limit", 28))
        except ValueError:
            limit = 28
        limit = max(1, min(limit, 50))

        if len(q) < 1:
            return Response({"results": []})

        if field == "destination":
            qs = Route.objects.filter(city_icontains_q("destination", q))
            if origin_ctx:
                qs = qs.filter(city_icontains_q("origin", origin_ctx))
            names = qs.values_list("destination", flat=True).distinct()[:limit]
        else:
            qo = city_icontains_q("origin", q)
            names = Route.objects.filter(qo).values_list("origin", flat=True).distinct()[:limit]

        results = sorted({str(n).strip() for n in names if str(n).strip()}, key=lambda s: s.lower())
        return Response({"results": results})


class BusFeatureCatalogView(APIView):
    """Public list of amenity ids/labels for operators (add bus) and passengers (filters)."""

    permission_classes = [AllowAny]

    def get(self, request):
        return Response({"features": BUS_FEATURE_DEFINITIONS})