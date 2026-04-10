from django.apps import AppConfig


class BookingsConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "bookings"

    def ready(self):
        # Register signal handlers (OperatorSale sync).
        from . import signals  # noqa: F401
