from django.conf import settings
from django.db import models


class AdminAuditLog(models.Model):
    """
    Immutable record of admin actions (approvals, KYC changes) for accountability.
    """

    ACTION_SCHEDULE_APPROVED = "schedule_approved"
    ACTION_SCHEDULE_REJECTED = "schedule_rejected"
    ACTION_OPERATOR_UPDATED = "operator_updated"
    ACTION_OPERATOR_CLARIFICATION_SENT = "operator_clarification_sent"

    ACTION_CHOICES = (
        (ACTION_SCHEDULE_APPROVED, "Schedule approved"),
        (ACTION_SCHEDULE_REJECTED, "Schedule rejected"),
        (ACTION_OPERATOR_UPDATED, "Operator updated"),
        (ACTION_OPERATOR_CLARIFICATION_SENT, "Operator clarification request sent"),
    )

    TARGET_SCHEDULE = "schedule"
    TARGET_OPERATOR = "operator"

    TARGET_TYPE_CHOICES = (
        (TARGET_SCHEDULE, "Schedule"),
        (TARGET_OPERATOR, "Operator"),
    )

    actor = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="admin_audit_logs",
    )
    action = models.CharField(max_length=64, choices=ACTION_CHOICES)
    target_type = models.CharField(max_length=32, choices=TARGET_TYPE_CHOICES)
    target_id = models.PositiveIntegerField()
    details = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["-created_at"]),
            models.Index(fields=["target_type", "target_id"]),
            models.Index(fields=["action", "-created_at"]),
        ]

    def __str__(self):
        return f"{self.action} by {self.actor_id} @ {self.created_at:%Y-%m-%d %H:%M}"


def log_admin_action(actor, action: str, target_type: str, target_id: int, details: dict | None = None):
    """Append-only audit row. Never raises to callers."""
    try:
        AdminAuditLog.objects.create(
            actor=actor if getattr(actor, "is_authenticated", False) else None,
            action=action,
            target_type=target_type,
            target_id=target_id,
            details=details or {},
        )
    except Exception:
        import logging

        logging.getLogger(__name__).exception("Failed to write AdminAuditLog")
