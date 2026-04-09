from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("bookings", "0010_schedule_operator_offer_style"),
    ]

    operations = [
        migrations.AddField(
            model_name="schedule",
            name="seat_fares_json",
            field=models.TextField(blank=True, default="{}"),
        ),
    ]
