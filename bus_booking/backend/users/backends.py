"""
Authentication backend that accepts email, phone number, or username at login.
'Surya', 'surya', 'suryarun15@gmail.com', and '+919943373588' all work.
"""
import re
from django.contrib.auth.backends import ModelBackend
from django.contrib.auth import get_user_model
from django.db.models import Q


def _normalise_phone(value: str) -> str:
    digits = re.sub(r"\D", "", value)
    if len(digits) == 10:
        return "+91" + digits
    if len(digits) == 12 and digits.startswith("91"):
        return "+" + digits
    return value


class CaseInsensitiveBackend(ModelBackend):
    def authenticate(self, request, username=None, password=None, **kwargs):
        User = get_user_model()
        if username is None or password is None:
            return None
        value = username.strip()
        # Build query: try username, email, and phone (normalised)
        q = Q(username__iexact=value) | Q(email__iexact=value)
        # If it looks like a phone number, also try normalised form
        if re.search(r"\d{7,}", value):
            q |= Q(phone=value) | Q(phone=_normalise_phone(value))
        # Use filter + ordering so duplicates (dev data) never crash; pick most recent active user
        user = (
            User.objects.filter(q)
            .order_by("-date_joined")
            .first()
        )
        if user is None:
            return None
        if user.check_password(password) and self.user_can_authenticate(user):
            return user
        return None
