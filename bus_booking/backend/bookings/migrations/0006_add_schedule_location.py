# Generated manually for ScheduleLocation (live tracking)

from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ("bookings", "0005_schedule_pending_status"),
    ]

    operations = [
        migrations.CreateModel(
            name="ScheduleLocation",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("lat", models.DecimalField(decimal_places=6, max_digits=9)),
                ("lng", models.DecimalField(decimal_places=6, max_digits=9)),
                ("recorded_at", models.DateTimeField(auto_now_add=True)),
                ("schedule", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="locations", to="bookings.schedule")),
            ],
            options={
                "ordering": ["-recorded_at"],
            },
        ),
        migrations.AddIndex(
            model_name="schedulelocation",
            index=models.Index(fields=["schedule", "-recorded_at"], name="bookings_sc_schedul_8a0b0d_idx"),
        ),
    ]
