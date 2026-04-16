import json
from datetime import datetime, time, timedelta
from decimal import Decimal

from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand
from django.utils import timezone

from bookings.layout_presets import (
    LAYOUT_MIXED_SEATER_SLEEPER_1X2,
    LAYOUT_SEATER_2X2_AISLE,
    LAYOUT_SLEEPER_1X2_AISLE,
    LAYOUT_SLEEPER_1X2_LARGE,
    LAYOUT_SEMI_SLEEPER_2X2_AISLE,
)
from bookings.models import BoardingPoint, DroppingPoint, Schedule
from buses.models import Bus, Operator
from common.models import Route, RoutePattern, RoutePatternStop

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

        demo_pattern, _ = RoutePattern.objects.get_or_create(
            route=route, name="Via Thindivanam (NH)"
        )
        if demo_pattern.stops.count() == 0:
            via_stops = [
                ("Bengaluru", "12.971600", "77.594600"),
                ("Krishnagiri", "12.518600", "78.213700"),
                ("Tiruvannamalai", "12.225300", "79.074700"),
                ("Thindivanam", "12.234400", "79.650600"),
                ("Pondicherry", "11.941600", "79.808300"),
            ]
            for i, (nm, la, ln) in enumerate(via_stops):
                RoutePatternStop.objects.create(
                    pattern=demo_pattern, order=i, name=nm, lat=la, lng=ln
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

        # Five bus types: full seater, mixed (seater + sleeper), full sleeper, large sleeper, semi-sleeper
        # Layouts: seater 12 rows (2+2, single deck); semi 10 rows (single deck); sleeper 6 rows (single deck);
        # mixed 12 rows with explicit upper berth. Capacities = bookable seats (excl. aisle cells).
        # Varied demo ratings: green (≥4), yellow (3–<4), red (<3) — see schedule card star badges
        buses_data = [
            ('KA01AB1234', LAYOUT_SEATER_2X2_AISLE, 48, 'Seater 2x2', 'Bharat Benz A/C Seater (2+2)', Decimal('4.65'), 320),
            ('KA02ST5678', LAYOUT_MIXED_SEATER_SLEEPER_1X2, 36, 'Mixed (lower seater, upper sleeper)', 'Volvo Multi-Axle (2+1)', Decimal('3.35'), 180),
            ('KA03SL9012', LAYOUT_SLEEPER_1X2_AISLE, 18, 'Sleeper 1x2', 'Bharat Benz A/C Sleeper (2+1)', Decimal('4.20'), 504),
            ('KA04SL3456', LAYOUT_SLEEPER_1X2_LARGE, 18, 'Sleeper (large)', 'Scania Sleeper (2+1)', Decimal('2.55'), 210),
            ('KA05SS7890', LAYOUT_SEMI_SLEEPER_2X2_AISLE, 40, 'Semi-sleeper 2x2', 'Mercedes Semi-Sleeper (2+2)', Decimal('3.70'), 95),
        ]
        buses = []
        bus_seater = bus_mixed = bus_sleeper = bus_sleeper_large = bus_semi = None
        bus_features = [
            json.dumps(["ac", "wifi", "charging", "water"]),
            json.dumps(["ac", "wifi", "blanket", "live_tracking"]),
            json.dumps(["ac", "wifi", "water", "blanket", "toilet"]),
            json.dumps(["ac", "wifi", "charging", "entertainment", "blanket"]),
            json.dumps(["ac", "wifi", "charging", "reading_lamp", "snacks"]),
        ]
        for idx, (reg_no, seat_map, capacity, _, service_name, rating_avg, rating_count) in enumerate(buses_data):
            bus, _ = Bus.objects.update_or_create(
                registration_no=reg_no,
                defaults={
                    'operator': op,
                    'capacity': capacity,
                    'seat_map_json': json.dumps(seat_map),
                    'features_json': bus_features[idx % len(bus_features)],
                    'extras_note': 'Priority boarding on request' if idx == 0 else '',
                    'service_name': service_name,
                    'rating_avg': rating_avg,
                    'rating_count': rating_count,
                }
            )
            buses.append(bus)
        bus_seater, bus_mixed, bus_sleeper, bus_sleeper_large, bus_semi = buses[0], buses[1], buses[2], buses[3], buses[4]

        # Schedules for the next 30 days (1 month): mix of seater, mixed, sleeper, semi-sleeper
        now = timezone.now()
        created_count = 0
        schedule_times = [
            (6, 30, bus_seater, '849.00'),   # Early seater
            (7, 0, bus_seater, '899.00'),    # Seater 2x2
            (8, 0, bus_semi, '929.00'),      # Semi-sleeper
            (10, 0, bus_mixed, '950.00'),    # Mixed: lower seater, upper sleeper
            (11, 30, bus_sleeper, '979.00'), # Sleeper
            (14, 0, bus_sleeper, '999.00'),  # Sleeper
            (15, 0, bus_sleeper_large, '1049.00'),  # Large sleeper
            (18, 0, bus_semi, '969.00'),     # Semi-sleeper evening
            (20, 0, bus_mixed, '989.00'),    # Mixed night
            (22, 0, bus_seater, '999.00'),   # Seater night
            (23, 0, bus_sleeper, '1099.00'), # Sleeper overnight
        ]
        for day in range(0, 30):
            base = (now + timedelta(days=day)).date()
            for dep_h, dep_m, bus, fare in schedule_times:
                dep = timezone.make_aware(datetime.combine(base, time(dep_h, dep_m)))
                arr = dep + timedelta(hours=8)
                s, created = Schedule.objects.get_or_create(
                    bus=bus,
                    route=route,
                    departure_dt=dep,
                    defaults={
                        'arrival_dt': arr,
                        'fare': fare,
                        'status': 'ACTIVE',
                        'route_pattern': demo_pattern,
                    },
                )
                if not created and s.route_pattern_id is None:
                    s.route_pattern = demo_pattern
                    s.save(update_fields=['route_pattern'])
                if created:
                    created_count += 1

        # Sample operator / platform promos and MRP (strikethrough fare) on some rows
        for i, s in enumerate(
            Schedule.objects.filter(route=route, status='ACTIVE').order_by('id')[:80]
        ):
            uf = []
            if i % 6 == 0:
                s.fare_original = (s.fare * Decimal('1.11')).quantize(Decimal('0.01'))
                s.operator_promo_title = 'Exclusive ₹100 OFF'
                uf.extend(['fare_original', 'operator_promo_title'])
            if i % 7 == 0:
                s.platform_promo_title = 'Min. 10% OFF on 3 or more seats'
                uf.append('platform_promo_title')
            if uf:
                s.save(update_fields=uf)

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
            f"Seeded: Route {route}, Operator {op.name}, 5 buses, {created_count} schedules (next 30 days)"
        ))
        self.stdout.write(self.style.SUCCESS(
            "Buses: KA01AB1234 (Seater 12×2+2, single deck) | KA02ST5678 (Mixed 12 rows, upper berth) | "
            "KA03SL9012 & KA04SL3456 (Sleeper 6 rows, single deck) | KA05SS7890 (Semi 10×2+2, single deck)"
        ))
        self.stdout.write(self.style.SUCCESS("Done."))