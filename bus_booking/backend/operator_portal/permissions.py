from rest_framework import permissions


class IsOperator(permissions.BasePermission):
    """Only users with role=OPERATOR and a linked operator can access."""

    message = "Operator access required."

    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
        return (
            getattr(request.user, "role", None) == "OPERATOR"
            and getattr(request.user, "operator_id", None) is not None
        )
