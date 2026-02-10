from typing import Optional
from rest_framework import generics
from .models import Route
from .serializers import RouteSerializer
from rest_framework.permissions import AllowAny
from django.db.models import Q

class RouteListView(generics.ListAPIView):
    queryset = Route.objects.all()
    serializer_class = RouteSerializer
    permission_classes = [AllowAny]

    @staticmethod
    def _normalize(city: Optional[str]) -> Optional[str]:
        if not city:
            return city
        c = city.strip().lower()
        synonyms = {
            "bangalore": "bengaluru",
            "bengaluru": "bengaluru",
            "mysore": "mysuru",
            "mysuru": "mysuru",
            "pondy": "pondicherry",
            "puducherry": "pondicherry",
        }
        return synonyms.get(c, city)

    def get_queryset(self):
        qs = super().get_queryset()
        origin = self.request.query_params.get('from')
        dest = self.request.query_params.get('to')
        if origin:
            norm_o = self._normalize(origin)
            q_origin = Q(origin__icontains=origin)
            if norm_o and norm_o != origin:
                q_origin |= Q(origin__icontains=norm_o)
            qs = qs.filter(q_origin)
        if dest:
            norm_d = self._normalize(dest)
            q_dest = Q(destination__icontains=dest)
            if norm_d and norm_d != dest:
                q_dest |= Q(destination__icontains=norm_d)
            qs = qs.filter(q_dest)
        return qs