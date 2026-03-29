from django.contrib import admin
from .models import Route, RoutePattern, RoutePatternStop


@admin.register(Route)
class RouteAdmin(admin.ModelAdmin):
    list_display = ("id", "origin", "destination", "distance_km")


class RoutePatternStopInline(admin.TabularInline):
    model = RoutePatternStop
    extra = 0
    ordering = ("order",)


@admin.register(RoutePattern)
class RoutePatternAdmin(admin.ModelAdmin):
    list_display = ("id", "route", "name")
    list_filter = ("route",)
    inlines = (RoutePatternStopInline,)