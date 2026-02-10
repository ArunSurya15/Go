from django.core.management.base import BaseCommand
from django.contrib.auth import get_user_model
from django.utils import timezone
from datetime import timedelta, datetime, time
import json

from common.models import Route
from buses.models import Operator, Bus
from bookings.models import Schedule, BoardingPoint, DroppingPoint

class Command(BaseCommand):
    help = "Add test buses and schedules for testing (full Feb & Mar 2026 + a live-tracking demo)"

    def handle(self, *args, **options):
        User = get_user_model()

        # Get or create demo operator
        op, _ = Operator.objects.get_or_create(
            name='Demo Travels',
            defaults={'contact_info': json.dumps({'phone': '080-123456', 'email': 'demo@demo.com'}), 'kyc_status': 'APPROVED'}
        )
        demo_op_user = User.objects.filter(username='demo_operator').first()
        if demo_op_user and not demo_op_user.operator_id:
            demo_op_user.operator = op
            demo_op_user.save(update_fields=['operator'])

        # Create multiple routes
        routes_data = [
            {'origin': 'Bengaluru', 'destination': 'Pondicherry', 'distance_km': 310},
            {'origin': 'Bengaluru', 'destination': 'Chennai', 'distance_km': 350},
            {'origin': 'Bengaluru', 'destination': 'Mysore', 'distance_km': 150},
            {'origin': 'Chennai', 'destination': 'Pondicherry', 'distance_km': 160},
            {'origin': 'Mysore', 'destination': 'Bengaluru', 'distance_km': 150},
        ]
        routes = {}
        for r_data in routes_data:
            route, _ = Route.objects.get_or_create(
                origin=r_data['origin'],
                destination=r_data['destination'],
                defaults={'distance_km': r_data['distance_km']}
            )
            routes[f"{r_data['origin']}_{r_data['destination']}"] = route

        # Create buses with different layouts
        buses_data = [
            {
                'reg': 'KA01AB1234',
                'capacity': 40,
                'layout': {'rows': 10, 'cols': 4, 'layout_type': 'standard_2_2'},
                'labels': [f"{r}{c}" for r in range(1, 11) for c in "ABCD"]
            },
            {
                'reg': 'KA02CD5678',
                'capacity': 36,
                'layout': {'rows': 9, 'cols': 4, 'layout_type': 'standard_2_2'},
                'labels': [f"{r}{c}" for r in range(1, 10) for c in "ABCD"]
            },
            {
                'reg': 'KA03EF9012',
                'capacity': 30,
                'layout': {'rows': 10, 'cols': 3, 'layout_type': 'sleeper_1_1_1_lower'},
                'labels': [f"{r}{c}" for r in range(1, 11) for c in "ABC"]
            },
            {
                'reg': 'KA04GH3456',
                'capacity': 27,
                'layout': {'rows': 9, 'cols': 3, 'layout_type': 'standard_2_1'},
                'labels': [f"{r}{c}" for r in range(1, 10) for c in "ABC"]
            },
        ]
        buses = {}
        for b_data in buses_data:
            bus, _ = Bus.objects.get_or_create(
                registration_no=b_data['reg'],
                defaults={
                    'operator': op,
                    'capacity': b_data['capacity'],
                    'seat_map_json': json.dumps({**b_data['layout'], 'labels': b_data['labels']})
                }
            )
            buses[b_data['reg']] = bus

        # Initialize counter
        created_count = 0

        # Create a demo schedule departing in 30 minutes (for tracking test)
        now = timezone.now()
        demo_departure = now + timedelta(minutes=30)
        demo_arrival = demo_departure + timedelta(hours=8)
        route_demo = routes.get('Bengaluru_Pondicherry')
        s_demo = None
        if route_demo:
            bus_demo = buses['KA01AB1234']
            # Delete any existing schedule at this exact time to avoid conflicts
            Schedule.objects.filter(bus=bus_demo, route=route_demo, departure_dt=demo_departure).delete()
            s_demo = Schedule.objects.create(
                bus=bus_demo,
                route=route_demo,
                departure_dt=demo_departure,
                arrival_dt=demo_arrival,
                fare='899.00',
                status='ACTIVE'
            )
            created_count += 1
            # Add boarding/dropping points
            BoardingPoint.objects.get_or_create(
                schedule=s_demo, time=demo_departure.time(),
                defaults={'location_name': 'Yelahanka', 'landmark': 'Mahindra Show Room Opp'}
            )
            DroppingPoint.objects.get_or_create(
                schedule=s_demo, time=demo_arrival.time(),
                defaults={'location_name': 'Pondicherry Bus Stand', 'description': 'Main bus stand'}
            )
        
        # Full-month range: Feb 1, 2026 through Mar 31, 2026
        start_date = datetime(2026, 2, 1).date()
        end_date = datetime(2026, 3, 31).date()
        total_days = (end_date - start_date).days + 1

        # Create schedules for every day in the range
        for day_offset in range(total_days):
            schedule_date = start_date + timedelta(days=day_offset)
            
            # Bengaluru → Pondicherry (multiple times per day)
            route_key = 'Bengaluru_Pondicherry'
            if route_key in routes:
                route = routes[route_key]
                bus = buses['KA01AB1234']
                times_fares = [
                    (7, 0, 8, 0, '899.00'),   # 7 AM departure, 8 hour journey
                    (22, 0, 8, 0, '999.00'),  # 10 PM departure, 8 hour journey
                    (14, 0, 7, 30, '950.00'), # 2 PM departure
                ]
                for dep_h, dep_m, dur_h, dur_m, fare in times_fares:
                    dep_dt = timezone.make_aware(datetime.combine(schedule_date, time(dep_h, dep_m)))
                    arr_dt = dep_dt + timedelta(hours=dur_h, minutes=dur_m)
                    s, created = Schedule.objects.get_or_create(
                        bus=bus,
                        route=route,
                        departure_dt=dep_dt,
                        defaults={'arrival_dt': arr_dt, 'fare': fare, 'status': 'ACTIVE'}
                    )
                    if created:
                        created_count += 1
                        # Add boarding/dropping points
                        if not s.boarding_points.exists():
                            BoardingPoint.objects.get_or_create(
                                schedule=s, time=time(21, 0),
                                defaults={'location_name': 'Yelahanka', 'landmark': 'Mahindra Show Room Opp'}
                            )
                            BoardingPoint.objects.get_or_create(
                                schedule=s, time=time(21, 10),
                                defaults={'location_name': 'Phoenix Mall', 'landmark': 'Opp. Shell Petrol Bunk'}
                            )
                        if not s.dropping_points.exists():
                            DroppingPoint.objects.get_or_create(
                                schedule=s, time=time(4, 55),
                                defaults={'location_name': 'Morattandi Toll', 'description': 'Next to toll plaza'}
                            )
                            DroppingPoint.objects.get_or_create(
                                schedule=s, time=time(5, 15),
                                defaults={'location_name': 'Pondicherry Bus Stand', 'description': 'Main bus stand'}
                            )

            # Bengaluru → Chennai
            route_key = 'Bengaluru_Chennai'
            if route_key in routes:
                route = routes[route_key]
                bus = buses['KA02CD5678']
                times_fares = [
                    (8, 0, 6, 0, '750.00'),
                    (20, 0, 6, 0, '850.00'),
                ]
                for dep_h, dep_m, dur_h, dur_m, fare in times_fares:
                    dep_dt = timezone.make_aware(datetime.combine(schedule_date, time(dep_h, dep_m)))
                    arr_dt = dep_dt + timedelta(hours=dur_h, minutes=dur_m)
                    s, created = Schedule.objects.get_or_create(
                        bus=bus,
                        route=route,
                        departure_dt=dep_dt,
                        defaults={'arrival_dt': arr_dt, 'fare': fare, 'status': 'ACTIVE'}
                    )
                    if created:
                        created_count += 1

            # Bengaluru → Mysore
            route_key = 'Bengaluru_Mysore'
            if route_key in routes:
                route = routes[route_key]
                bus = buses['KA03EF9012']
                times_fares = [
                    (9, 0, 3, 0, '450.00'),
                    (15, 0, 3, 0, '450.00'),
                    (18, 0, 3, 0, '500.00'),
                ]
                for dep_h, dep_m, dur_h, dur_m, fare in times_fares:
                    dep_dt = timezone.make_aware(datetime.combine(schedule_date, time(dep_h, dep_m)))
                    arr_dt = dep_dt + timedelta(hours=dur_h, minutes=dur_m)
                    s, created = Schedule.objects.get_or_create(
                        bus=bus,
                        route=route,
                        departure_dt=dep_dt,
                        defaults={'arrival_dt': arr_dt, 'fare': fare, 'status': 'ACTIVE'}
                    )
                    if created:
                        created_count += 1

        self.stdout.write(self.style.SUCCESS(
            f"Created {created_count} schedules for Feb–Mar 2026 (plus demo schedule departing in 30 mins)"
        ))
        self.stdout.write(self.style.SUCCESS(
            f"Routes: {len(routes)} | Buses: {len(buses)} | Operator: {op.name}"
        ))
        if s_demo:
            demo_date_str = demo_departure.strftime('%Y-%m-%d')
            demo_time_str = demo_departure.strftime('%H:%M')
            self.stdout.write(self.style.SUCCESS(
                f"\n🎯 DEMO TRACKING BUS: Schedule ID {s_demo.id}"
            ))
            self.stdout.write(self.style.SUCCESS(
                f"   Departs: {demo_date_str} at {demo_time_str} (in ~30 minutes)"
            ))
            self.stdout.write(self.style.SUCCESS(
                f"   Route: Bengaluru → Pondicherry"
            ))
            self.stdout.write(self.style.SUCCESS(
                f"   Search for Bengaluru → Pondicherry on {demo_date_str} to find it!"
            ))
            self.stdout.write(self.style.SUCCESS(
                f"   Tracking will be ACTIVE immediately (within 1 hour of departure)"
            ))
        self.stdout.write(self.style.SUCCESS("\nTest data ready! Search across Feb–Mar 2026."))
