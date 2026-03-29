from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ("common", "0002_route_pattern"),
        ("bookings", "0008_schedule_promos_and_bus_rating"),
    ]

    operations = [
        migrations.AddField(
            model_name="schedule",
            name="route_pattern",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name="schedules",
                to="common.routepattern",
            ),
        ),
    ]
