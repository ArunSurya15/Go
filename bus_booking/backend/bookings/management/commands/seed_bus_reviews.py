"""
Insert sample BusRating rows so the schedules UI can show passenger reviews.

Requires seed_demo (or equivalent): buses KA01AB1234–KA05SS7890 and route Bengaluru → Pondicherry.

Idempotent: skips if reviews already exist for the seeded buses (unless --force).
"""
import json
from datetime import datetime, timedelta
from decimal import Decimal

from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand
from django.utils import timezone

from bookings.models import Booking, BusRating, Schedule
from bookings.rating_utils import refresh_bus_rating_aggregate
from buses.models import Bus
from common.models import Route

SEED_PAYMENT_ID = "seed_bus_review_v1"

# Matches seed_demo.py registration numbers
DEMO_BUS_REGS = (
    "KA01AB1234",
    "KA02ST5678",
    "KA03SL9012",
    "KA04SL3456",
    "KA05SS7890",
)

REVIEWS = (
    # (reg_no, username_suffix, stars, comment) — varied lengths and one empty comment
    ("KA01AB1234", "ananya_k", 5, "Smooth ride, reached on time. Driver was careful on the ghats."),
    ("KA01AB1234", "rahul_m", 4, "Good value. Seats could be a bit cleaner."),
    ("KA02ST5678", "priya_s", 3, "Mixed feelings — upper berth was fine, lower was noisy near the engine."),
    ("KA02ST5678", "vikram_t", 5, "Excellent staff. Blanket and water provided as promised."),
    ("KA03SL9012", "deepa_r", 5, "Best sleeper I’ve taken on this route. Toilet was usable."),
    ("KA03SL9012", "suresh_p", 4, ""),
    ("KA04SL3456", "meena_l", 2, "AC too cold and arrived 45 min late. Won’t book again soon."),
    ("KA04SL3456", "arjun_b", 3, "Okay for the price. Entertainment screen didn’t work."),
    ("KA05SS7890", "kavitha_n", 5, "Comfortable semi-sleeper, charging ports worked on every seat."),
    ("KA05SS7890", "imran_h", 4, "Pleasant journey. Snacks would have been a nice touch."),
)


class Command(BaseCommand):
    help = "Create sample bus ratings/reviews for demo buses (linked to past CONFIRMED bookings)."

    def add_arguments(self, parser):
        parser.add_argument(
            "--force",
            action="store_true",
            help="Remove previous seed bookings/ratings (payment_id=%s) and re-seed." % SEED_PAYMENT_ID,
        )

    def handle(self, *args, **options):
        User = get_user_model()
        force = options["force"]

        route = Route.objects.filter(origin="Bengaluru", destination="Pondicherry").first()
        if not route:
            self.stdout.write(
                self.style.ERROR("Route Bengaluru → Pondicherry not found. Run seed_demo first.")
            )
            return

        buses = {b.registration_no: b for b in Bus.objects.filter(registration_no__in=DEMO_BUS_REGS)}
        missing = [r for r in DEMO_BUS_REGS if r not in buses]
        if missing:
            self.stdout.write(
                self.style.WARNING("Missing demo buses (run seed_demo): %s" % ", ".join(missing))
            )

        if not force and Booking.objects.filter(payment_id=SEED_PAYMENT_ID).exists():
            self.stdout.write(
                self.style.WARNING(
                    "Sample reviews already seeded (bookings with payment_id=%s). Use --force to replace."
                    % SEED_PAYMENT_ID
                )
            )
            return

        if force:
            qs = Booking.objects.filter(payment_id=SEED_PAYMENT_ID)
            n = qs.count()
            qs.delete()
            if n:
                self.stdout.write(self.style.NOTICE("Removed %s seed bookings (and linked ratings)." % n))

        # One shared “completed” schedule per bus so bookings are realistic
        base_dep = timezone.now() - timedelta(days=21)
        schedules = {}
        for reg, bus in buses.items():
            dep = timezone.make_aware(
                datetime.combine(base_dep.date(), datetime.min.time().replace(hour=10, minute=30))
            ) + timedelta(seconds=hash(reg) % 3600)
            arr = dep + timedelta(hours=8)
            sch, _ = Schedule.objects.get_or_create(
                bus=bus,
                route=route,
                departure_dt=dep,
                defaults={
                    "arrival_dt": arr,
                    "fare": Decimal("899.00"),
                    "status": "ACTIVE",
                },
            )
            schedules[reg] = sch

        def seat_labels(bus):
            try:
                data = json.loads(bus.seat_map_json or "{}")
                labels = data.get("labels")
                if isinstance(labels, list) and labels:
                    return labels
            except (json.JSONDecodeError, TypeError):
                pass
            return ["1A", "1B", "2A", "2B", "3A", "3B", "4A", "4B", "5A", "5B"]

        def seats_taken(schedule):
            taken = set()
            for b in Booking.objects.filter(schedule=schedule).only("seats"):
                try:
                    taken.update(json.loads(b.seats or "[]"))
                except (json.JSONDecodeError, TypeError):
                    pass
            return taken

        created_ratings = 0
        seat_idx = 0

        for reg, username, stars, comment in REVIEWS:
            bus = buses.get(reg)
            if not bus:
                continue
            sch = schedules.get(reg)
            if not sch:
                continue

            labels = seat_labels(bus)
            taken = seats_taken(sch)
            seat = None
            for i in range(len(labels)):
                cand = labels[(seat_idx + i) % len(labels)]
                if cand not in taken:
                    seat = cand
                    break
            seat_idx += 1
            if seat is None:
                self.stdout.write(self.style.WARNING("No free seat on schedule for %s; skipping one review." % reg))
                continue
            taken.add(seat)

            uname = "demo_reviewer_%s" % username
            user, u_created = User.objects.get_or_create(
                username=uname,
                defaults={
                    "email": "%s@example.invalid" % uname,
                    "role": "PASSENGER",
                },
            )
            if u_created:
                user.set_unusable_password()
                user.save()

            booking = Booking.objects.create(
                user=user,
                schedule=sch,
                seats=json.dumps([seat]),
                amount=sch.fare,
                status="CONFIRMED",
                payment_id=SEED_PAYMENT_ID,
            )

            # Stagger review dates (newest first in UI)
            days_ago = created_ratings
            created_at = timezone.now() - timedelta(days=days_ago, hours=created_ratings % 12)

            br = BusRating.objects.create(
                booking=booking,
                bus=bus,
                user=user,
                stars=stars,
                comment=comment[:500],
            )
            BusRating.objects.filter(pk=br.pk).update(created_at=created_at)
            created_ratings += 1

        for bus in buses.values():
            refresh_bus_rating_aggregate(bus)

        self.stdout.write(
            self.style.SUCCESS(
                "Created %s passenger reviews. Open a schedule card → rating badge → Passenger reviews."
                % created_ratings
            )
        )
