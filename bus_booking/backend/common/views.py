from rest_framework import generics
from .models import Route
from .serializers import RouteSerializer
from rest_framework.permissions import AllowAny

class RouteListView(generics.ListAPIView):
    queryset = Route.objects.all()
    serializer_class = RouteSerializer
    permission_classes = [AllowAny]

    def get_queryset(self):
        qs = super().get_queryset()
        origin = self.request.query_params.get('from')
        dest = self.request.query_params.get('to')
        if origin:
            qs = qs.filter(origin__icontains=origin)
        if dest:
            qs = qs.filter(destination__icontains=dest)
        return qs