# Generated manually: add User.phone for OTP / operator lookup

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("users", "0002_add_user_operator_link"),
    ]

    operations = [
        migrations.AddField(
            model_name="user",
            name="phone",
            field=models.CharField(blank=True, max_length=20),
        ),
    ]
