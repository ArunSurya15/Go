import uuid

import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("buses", "0004_operator_kyc_review"),
        ("users", "0005_user_operator_staff_role"),
    ]

    operations = [
        migrations.CreateModel(
            name="OperatorStaffInvite",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("email", models.EmailField(max_length=254)),
                (
                    "role",
                    models.CharField(
                        choices=[("MANAGER", "Manager"), ("DISPATCHER", "Dispatcher")],
                        max_length=20,
                    ),
                ),
                ("token", models.UUIDField(default=uuid.uuid4, editable=False, unique=True)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("expires_at", models.DateTimeField()),
                ("accepted_at", models.DateTimeField(blank=True, null=True)),
                (
                    "created_by",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="operator_staff_invites_sent",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
                (
                    "operator",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="staff_invites",
                        to="buses.operator",
                    ),
                ),
            ],
            options={
                "ordering": ["-created_at"],
            },
        ),
        migrations.AlterField(
            model_name="user",
            name="operator_staff_role",
            field=models.CharField(
                blank=True,
                choices=[
                    ("", "Owner (legacy default)"),
                    ("OWNER", "Owner"),
                    ("MANAGER", "Manager"),
                    ("DISPATCHER", "Dispatcher"),
                ],
                default="",
                help_text="OPERATOR: Dispatcher=read/manifest; Manager=fares & fleet; Owner=+company/KYC/invites; blank=legacy owner.",
                max_length=20,
            ),
        ),
    ]
