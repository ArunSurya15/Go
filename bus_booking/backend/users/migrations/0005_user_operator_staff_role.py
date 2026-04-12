from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("users", "0004_profile_fields_and_saved_passengers"),
    ]

    operations = [
        migrations.AddField(
            model_name="user",
            name="operator_staff_role",
            field=models.CharField(
                blank=True,
                choices=[
                    ("", "Owner (legacy default)"),
                    ("OWNER", "Owner"),
                    ("DISPATCHER", "Dispatcher"),
                ],
                default="",
                help_text="For OPERATOR users only. Empty is treated as Owner for backwards compatibility.",
                max_length=20,
            ),
        ),
    ]
