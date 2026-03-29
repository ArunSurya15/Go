from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ("common", "0001_initial"),
    ]

    operations = [
        migrations.CreateModel(
            name="RoutePattern",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("name", models.CharField(default="Standard", max_length=120)),
                (
                    "route",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="patterns",
                        to="common.route",
                    ),
                ),
            ],
            options={
                "ordering": ["route", "name"],
            },
        ),
        migrations.CreateModel(
            name="RoutePatternStop",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("order", models.PositiveSmallIntegerField()),
                ("name", models.CharField(max_length=120)),
                ("lat", models.DecimalField(blank=True, decimal_places=6, max_digits=9, null=True)),
                ("lng", models.DecimalField(blank=True, decimal_places=6, max_digits=9, null=True)),
                (
                    "pattern",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="stops",
                        to="common.routepattern",
                    ),
                ),
            ],
            options={
                "ordering": ["pattern", "order"],
                "unique_together": {("pattern", "order")},
            },
        ),
        migrations.AddConstraint(
            model_name="routepattern",
            constraint=models.UniqueConstraint(fields=("route", "name"), name="common_routepattern_route_name_uniq"),
        ),
    ]
