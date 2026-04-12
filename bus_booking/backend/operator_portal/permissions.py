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


def _operator_staff_role(user) -> str:
    return (getattr(user, "operator_staff_role", None) or "").strip()


class IsOperatorOpsLead(permissions.BasePermission):
    """
    Day-to-day commercial & fleet control: legacy owner, explicit OWNER, or MANAGER.
    (Fares, schedules, buses, refunds, sales — not company KYC/bank only.)
    """

    message = "This action requires manager access or higher on the operator account."

    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
        user = request.user
        if getattr(user, "role", None) != "OPERATOR" or not getattr(user, "operator_id", None):
            return False
        r = _operator_staff_role(user)
        return r in ("", "OWNER", "MANAGER")


class IsOperatorOrgOwner(permissions.BasePermission):
    """
    Legal / business owner: company profile (KYC), inviting staff. Legacy blank role counts as owner.
    """

    message = "This action requires the operator business owner."

    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
        user = request.user
        if getattr(user, "role", None) != "OPERATOR" or not getattr(user, "operator_id", None):
            return False
        r = _operator_staff_role(user)
        return r in ("", "OWNER")
