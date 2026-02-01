from django.core.management.base import BaseCommand
from django.contrib.auth import get_user_model
from django.utils import timezone
from datetime import timedelta, datetime, time

from common.models import Route
from buses.models import Operator, Bus
from bookings.models import Schedule, BoardingPoint, DroppingPoint

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
        seat_map = {
            "rows": 10,
            "cols": 4,
            "labels": ["1A","1B","1C","1D","2A","2B","2C","2D","3A","3B","3C","3D","4A","4B","4C","4D",
                       "5A","5B","5C","5D","6A","6B","6C","6D","7A","7B","7C","7D","8A","8B","8C","8D",
                       "9A","9B","9C","9D","10A","10B","10C","10D"]
        }
        import json
        bus, _ = Bus.objects.get_or_create(
            registration_no='KA01AB1234',
            defaults={'operator': op, 'capacity': 40, 'seat_map_json': json.dumps(seat_map)}
        )

        # Schedules for next 3 days (two per day)
        now = timezone.now()
        created_count = 0
        for day in range(0, 3):
            base = (now + timedelta(days=day)).date()
            dep1 = timezone.make_aware(datetime.combine(base, datetime.min.time())) + timedelta(hours=7)   # 07:00
            arr1 = dep1 + timedelta(hours=8)
            dep2 = timezone.make_aware(datetime.combine(base, datetime.min.time())) + timedelta(hours=22)  # 22:00
            arr2 = dep2 + timedelta(hours=8)

            for dep, arr, fare in [(dep1, arr1, '899.00'), (dep2, arr2, '999.00')]:
                s, created = Schedule.objects.get_or_create(
                    bus=bus,
                    route=route,
                    departure_dt=dep,
                    defaults={'arrival_dt': arr, 'fare': fare, 'status': 'ACTIVE'}
                )
                if created:
                    created_count += 1

        # Ensure all schedules for this route have boarding/dropping points
        for s in Schedule.objects.filter(route=route, bus=bus).select_related('route', 'bus'):
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
            f"Seeded: Route {route}, Operator {op.name}, Bus {bus.registration_no}, Schedules created: {created_count}"
        ))
        self.stdout.write(self.style.SUCCESS("Done."))