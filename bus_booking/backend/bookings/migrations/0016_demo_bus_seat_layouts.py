# Data migration: align demo bus seat maps with updated presets (rows / single deck).

import json

from django.db import migrations


def apply_demo_layouts(apps, schema_editor):
    from bookings import layout_presets as lp

    Bus = apps.get_model("buses", "Bus")
    rows = [
        ("KA01AB1234", lp.LAYOUT_SEATER_2X2_AISLE, 48),
        ("KA02ST5678", lp.LAYOUT_MIXED_SEATER_SLEEPER_1X2, 36),
        ("KA03SL9012", lp.LAYOUT_SLEEPER_1X2_AISLE, 18),
        ("KA04SL3456", lp.LAYOUT_SLEEPER_1X2_LARGE, 18),
        ("KA05SS7890", lp.LAYOUT_SEMI_SLEEPER_2X2_AISLE, 40),
    ]
    for reg, layout, capacity in rows:
        Bus.objects.filter(registration_no=reg).update(
            seat_map_json=json.dumps(layout),
            capacity=capacity,
        )


class Migration(migrations.Migration):
    dependencies = [
        ("bookings", "0015_add_schedule_archived"),
    ]

    operations = [
        migrations.RunPython(apply_demo_layouts, migrations.RunPython.noop),
    ]
