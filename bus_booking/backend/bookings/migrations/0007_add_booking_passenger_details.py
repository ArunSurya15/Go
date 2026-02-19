# Add passenger_details to Booking (per-seat gender for seat map display)

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("bookings", "0006_add_schedule_location"),
    ]

    operations = [
        migrations.AddField(
            model_name="booking",
            name="passenger_details",
            field=models.TextField(blank=True, default="{}"),
        ),
    ]
