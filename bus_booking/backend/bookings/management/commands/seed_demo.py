import json
from datetime import datetime, time, timedelta

from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand
from django.utils import timezone

from bookings.layout_presets import (
    LAYOUT_MIXED_SEATER_SLEEPER_1X2,
    LAYOUT_SEATER_2X2_AISLE,
    LAYOUT_SLEEPER_1X2_AISLE,
)
from bookings.models import BoardingPoint, DroppingPoint, Schedule
from buses.models import Bus, Operator
from common.models import Route

class Command(BaseCommand):
    help = "Seed demo data: user, route, operator, bus, schedules"

    def handle(self, *args, **options):
        User = get_user_model()

        # Demo users
        demo_users = [
            dict(username='demo_passenger', email='passenger@example.com', role='PASSENGER'),
            dict(username='demo_operator', email='operator@example.com', role='OPERATOR'),
            dict(username='demo_admin', email='admin@example.com', role='ADMIN'),
        ]
        for u in demo_users:
            user, created = User.objects.get_or_create(username=u['username'], defaults=u)
            if created:
                user.set_password('Passw0rd!')
                user.save()
        self.stdout.write(self.style.SUCCESS("Users: demo_passenger / demo_operator / demo_admin (password: Passw0rd!)"))

        # Route
        route, _ = Route.objects.get_or_create(
            origin='Bengaluru',
            destination='Pondicherry',
            defaults={'distance_km': 310}
        )

        # Operator and Bus
        op, _ = Operator.objects.get_or_create(
            name='Demo Travels',
            defaults={'contact_info': '080-123456', 'kyc_status': 'APPROVED'}
        )
        # Link demo_operator user to this operator (if not already)
        User = get_user_model()
        demo_op_user = User.objects.filter(username='demo_operator').first()
        if demo_op_user and not demo_op_user.operator_id:
            demo_op_user.operator = op
            demo_op_user.save(update_fields=['operator'])

        # Three bus types: seater 2x2, mixed (lower seater / upper sleeper), all sleeper
        buses_data = [
            ('KA01AB1234', LAYOUT_SEATER_2X2_AISLE, 40, 'Seater 2x2'),
            ('KA02ST5678', LAYOUT_MIXED_SEATER_SLEEPER_1X2, 30, 'Mixed (lower seater, upper sleeper)'),
            ('KA03SL9012', LAYOUT_SLEEPER_1X2_AISLE, 30, 'Sleeper 1x2'),
        ]
        buses = []
        bus_seater = bus_mixed = bus_sleeper = None
        for reg_no, seat_map, capacity, _ in buses_data:
            bus, _ = Bus.objects.update_or_create(
                registration_no=reg_no,
                defaults={'operator': op, 'capacity': capacity, 'seat_map_json': json.dumps(seat_map)}
            )
            buses.append(bus)
        bus_seater, bus_mixed, bus_sleeper = buses[0], buses[1], buses[2]

        # Schedules for next 3 days: each day has one schedule per bus type so all three are bookable
        # 7:00 = Seater, 10:00 = Mixed, 14:00 = Sleeper, 22:00 = Seater again
        now = timezone.now()
        created_count = 0
        schedule_times = [
            (7, 0, bus_seater, '899.00'),    # Seater 2x2
            (10, 0, bus_mixed, '950.00'),    # Mixed: lower seater, upper sleeper
            (14, 0, bus_sleeper, '999.00'),  # Sleeper
            (22, 0, bus_seater, '999.00'),   # Seater night
        ]
        for day in range(0, 3):
            base = (now + timedelta(days=day)).date()
            for dep_h, dep_m, bus, fare in schedule_times:
                dep = timezone.make_aware(datetime.combine(base, time(dep_h, dep_m)))
                arr = dep + timedelta(hours=8)
                s, created = Schedule.objects.get_or_create(
                    bus=bus,
                    route=route,
                    departure_dt=dep,
                    defaults={'arrival_dt': arr, 'fare': fare, 'status': 'ACTIVE'}
                )
                if created:
                    created_count += 1

        # Ensure all schedules for this route have boarding/dropping points
        for s in Schedule.objects.filter(route=route).select_related('route', 'bus'):
            if not s.boarding_points.exists():
                for t, loc, land in [
                    (time(21, 0), 'Yelahanka', 'Mahindra Show Room Opp'),
                    (time(21, 10), 'Phoenix Mall of Asia', 'Opp. Shell Petrol Bunk Towards Hebbal'),
                    (time(21, 20), 'Hebbal Esteem Mall', 'In Front Of Esteem Mall'),
                ]:
                    BoardingPoint.objects.get_or_create(schedule=s, time=t, defaults={'location_name': loc, 'landmark': land})
            if not s.dropping_points.exists():
                for t, loc, desc in [
                    (time(4, 55), 'Morattandi Toll Plaza', 'Next to toll plaza'),
                    (time(5, 0), 'Jipmer', 'Infront Of Jipmer Hospital Main Gate'),
                    (time(5, 15), 'Pondicherry Bus Stand', 'Opp to Main bus stand exit gate'),
                ]:
                    DroppingPoint.objects.get_or_create(schedule=s, time=t, defaults={'location_name': loc, 'description': desc})

        self.stdout.write(self.style.SUCCESS(
            f"Seeded: Route {route}, Operator {op.name}, 3 buses, {created_count} schedules"
        ))
        self.stdout.write(self.style.SUCCESS(
            "Buses: KA01AB1234 (Seater 2x2) | KA02ST5678 (Mixed: lower seater, upper sleeper) | KA03SL9012 (Sleeper)"
        ))
        self.stdout.write(self.style.SUCCESS("Done."))