# Generated manually

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("buses", "0002_bus_features_extras"),
    ]

    operations = [
        migrations.AddField(
            model_name="bus",
            name="service_name",
            field=models.CharField(blank=True, default="", max_length=200),
        ),
        migrations.AddField(
            model_name="bus",
            name="rating_avg",
            field=models.DecimalField(blank=True, decimal_places=2, max_digits=3, null=True),
        ),
        migrations.AddField(
            model_name="bus",
            name="rating_count",
            field=models.PositiveIntegerField(default=0),
        ),
    ]
