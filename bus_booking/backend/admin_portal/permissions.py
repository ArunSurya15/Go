from rest_framework import permissions


class IsAdmin(permissions.BasePermission):
    """Only users with role=ADMIN."""

    message = "Admin access required."

    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
        return getattr(request.user, "role", None) == "ADMIN"
