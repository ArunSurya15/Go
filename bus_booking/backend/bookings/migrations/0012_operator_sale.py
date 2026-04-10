import json

from django.db import migrations, models
import django.db.models.deletion


def backfill_operator_sales(apps, schema_editor):
    Booking = apps.get_model("bookings", "Booking")
    OperatorSale = apps.get_model("bookings", "OperatorSale")
    for b in Booking.objects.filter(status="CONFIRMED").select_related("schedule__bus"):
        if OperatorSale.objects.filter(booking_id=b.id).exists():
            continue
        try:
            seats = json.loads(b.seats or "[]")
        except Exception:
            seats = []
        n = len(seats) if seats else 1
        OperatorSale.objects.create(
            booking_id=b.id,
            operator_id=b.schedule.bus.operator_id,
            schedule_id=b.schedule_id,
            gross_amount=b.amount,
            seat_count=max(1, n),
            currency="INR",
            confirmed_at=b.created_at,
            reversal_status="",
        )


def noop_reverse(apps, schema_editor):
    pass


class Migration(migrations.Migration):

    dependencies = [
        ("bookings", "0011_schedule_seat_fares"),
        ("buses", "0003_bus_service_and_ratings"),
    ]

    operations = [
        migrations.CreateModel(
            name="OperatorSale",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("gross_amount", models.DecimalField(decimal_places=2, max_digits=10)),
                ("seat_count", models.PositiveSmallIntegerField(default=1)),
                ("currency", models.CharField(default="INR", max_length=3)),
                (
                    "confirmed_at",
                    models.DateTimeField(
                        help_text="When the sale was first recognized (payment succeeded / booking confirmed)."
                    ),
                ),
                (
                    "reversal_status",
                    models.CharField(
                        blank=True,
                        choices=[("", "Active"), ("REFUNDED", "Refunded"), ("CANCELLED", "Cancelled")],
                        db_index=True,
                        default="",
                        max_length=20,
                    ),
                ),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                (
                    "booking",
                    models.OneToOneField(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="operator_sale",
                        to="bookings.booking",
                    ),
                ),
                (
                    "operator",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="sales",
                        to="buses.operator",
                    ),
                ),
                (
                    "schedule",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.PROTECT,
                        related_name="operator_sales",
                        to="bookings.schedule",
                    ),
                ),
            ],
            options={
                "ordering": ["-confirmed_at", "-id"],
                "indexes": [
                    models.Index(
                        fields=["operator", "-confirmed_at"],
                        name="bookings_osale_op_cf_idx",
                    ),
                    models.Index(
                        fields=["operator", "reversal_status", "-confirmed_at"],
                        name="bookings_osale_op_rev_cf_idx",
                    ),
                ],
            },
        ),
        migrations.RunPython(backfill_operator_sales, noop_reverse),
    ]
