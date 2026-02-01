# Generated manually: add PENDING to Schedule.status, default new schedules to PENDING.
# Existing schedules keep current value (ACTIVE).

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("bookings", "0004_boarding_dropping_points"),
    ]

    operations = [
        migrations.AlterField(
            model_name="schedule",
            name="status",
            field=models.CharField(
                choices=[
                    ("PENDING", "Pending"),
                    ("ACTIVE", "Active"),
                    ("CANCELLED", "Cancelled"),
                ],
                default="PENDING",
                max_length=20,
            ),
        ),
    ]
