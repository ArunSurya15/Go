from datetime import timedelta
from django.utils import timezone
from rest_framework import generics, status
from rest_framework.response import Response
from rest_framework.permissions import AllowAny, IsAuthenticated
from .models import Schedule, ScheduleLocation, BoardingPoint, DroppingPoint, Reservation, Booking, Payment
from .serializers import (
    ScheduleSerializer, BoardingPointSerializer, DroppingPointSerializer,
    ReservationSerializer, BookingSerializer, PaymentSerializer,
)

import razorpay
from django.conf import settings
from decimal import Decimal
from rest_framework import generics
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from .models import Schedule, Booking, Payment
from django.utils import timezone

from .lock import try_hold_seats, release_seats

class ScheduleListView(generics.ListAPIView):
    serializer_class = ScheduleSerializer
    permission_classes = [AllowAny]

    def get_queryset(self):
        qs = Schedule.objects.select_related('route', 'bus', 'bus__operator').filter(status='ACTIVE')
        route_id = self.request.query_params.get('route_id')
        date = self.request.query_params.get('date')
        if route_id:
            qs = qs.filter(route_id=route_id)
        if date:
            qs = qs.filter(departure_dt__date=date)
        return qs


class BoardingPointListView(generics.ListAPIView):
    serializer_class = BoardingPointSerializer
    permission_classes = [AllowAny]

    def get_queryset(self):
        qs = BoardingPoint.objects.all()
        schedule_id = self.request.query_params.get('schedule_id')
        if schedule_id:
            qs = qs.filter(schedule_id=schedule_id)
        return qs.order_by('time')


class DroppingPointListView(generics.ListAPIView):
    serializer_class = DroppingPointSerializer
    permission_classes = [AllowAny]

    def get_queryset(self):
        qs = DroppingPoint.objects.all()
        schedule_id = self.request.query_params.get('schedule_id')
        if schedule_id:
            qs = qs.filter(schedule_id=schedule_id)
        return qs.order_by('time')


class ScheduleSeatMapView(generics.GenericAPIView):
    """GET schedule seat layout and occupied seats for visual seat selection."""
    permission_classes = [AllowAny]

    def get(self, request, pk):
        import json
        schedule = Schedule.objects.select_related('bus').filter(pk=pk).first()
        if not schedule:
            return Response({'detail': 'Schedule not found'}, status=404)
        if schedule.status != 'ACTIVE':
            return Response({'detail': 'Schedule is not available'}, status=404)
        bus = schedule.bus
        try:
            layout = json.loads(bus.seat_map_json or '{}')
        except Exception:
            layout = {}
        rows = layout.get('rows') or 10
        cols = layout.get('cols') or 4
        labels = layout.get('labels')
        types = layout.get('types')
        if not labels:
            labels = []
            for r in range(1, rows + 1):
                for c in range(cols):
                    labels.append(f"{r}{chr(65 + c)}")
        if not types or len(types) != rows * cols:
            types = ['seater'] * (rows * cols)
        occupied = set()
        for r in Reservation.objects.filter(schedule=schedule, status='PENDING', expires_at__gt=timezone.now()).values_list('seat_no', flat=True):
            occupied.add(r)
        for b in Booking.objects.filter(schedule=schedule, status__in=['PENDING', 'CONFIRMED']).only('seats'):
            try:
                for s in json.loads(b.seats or '[]'):
                    occupied.add(s)
            except Exception:
                pass
        return Response({
            'layout': {'rows': rows, 'cols': cols, 'labels': labels, 'types': types},
            'occupied': list(occupied),
            'fare': str(schedule.fare),
        })


class ScheduleTrackView(generics.GenericAPIView):
    """GET live tracking for a schedule. Active from 1 hour before departure until arrival."""
    permission_classes = [AllowAny]

    def get(self, request, pk):
        schedule = Schedule.objects.select_related('route').filter(pk=pk, status='ACTIVE').first()
        if not schedule:
            return Response({'detail': 'Schedule not found'}, status=404)
        tracking_start = schedule.departure_dt - timedelta(hours=1)
        tracking_end = schedule.arrival_dt
        now = timezone.now()
        if now < tracking_start:
            return Response({
                'active': False,
                'message': 'Tracking starts 1 hour before departure.',
                'tracking_starts_at': tracking_start.isoformat(),
                'tracking_ends_at': tracking_end.isoformat(),
                'schedule_id': schedule.id,
                'route': f'{schedule.route.origin} → {schedule.route.destination}',
                'locations': [],
            })
        if now > tracking_end:
            return Response({
                'active': False,
                'message': 'Trip has ended.',
                'tracking_starts_at': tracking_start.isoformat(),
                'tracking_ends_at': tracking_end.isoformat(),
                'schedule_id': schedule.id,
                'route': f'{schedule.route.origin} → {schedule.route.destination}',
                'locations': [],
            })
        locations = list(
            ScheduleLocation.objects.filter(schedule=schedule)
            .order_by('-recorded_at')[:100]
            .values('lat', 'lng', 'recorded_at')
        )
        for loc in locations:
            loc['recorded_at'] = loc['recorded_at'].isoformat()
            loc['lat'] = str(loc['lat'])
            loc['lng'] = str(loc['lng'])
        return Response({
            'active': True,
            'tracking_starts_at': tracking_start.isoformat(),
            'tracking_ends_at': tracking_end.isoformat(),
            'schedule_id': schedule.id,
            'route': f'{schedule.route.origin} → {schedule.route.destination}',
            'locations': locations,
        })


class ReserveView(generics.CreateAPIView):
    serializer_class = ReservationSerializer
    permission_classes = [IsAuthenticated]

    def create(self, request, *args, **kwargs):
        schedule_id = request.data.get('schedule_id')
        seats = request.data.get('seats', [])
        if not schedule_id or not seats:
            return Response({'detail': 'schedule_id and seats[] required'}, status=400)

        schedule = Schedule.objects.filter(id=schedule_id).first()
        if not schedule:
            return Response({'detail': 'Invalid schedule_id'}, status=404)
        if schedule.status != 'ACTIVE':
            return Response({'detail': 'Schedule is not available for booking'}, status=400)

        ttl_minutes = 10
        expires_at = timezone.now() + timedelta(minutes=ttl_minutes)
        
        ok, failed = try_hold_seats(schedule.id, seats, request.user.id, ttl=ttl_minutes * 60)
        if ok is False:
            return Response({'detail': f'Seat {failed} not available'}, status=409)
        # ok == True -> held in Redis
        # ok is None -> Redis unavailable; fallback to DB check (existing code)
        use_db_check = (ok is None)

        created = []
        try:
            for seat in seats:
                if use_db_check:
                    conflict = Reservation.objects.filter(
                        schedule=schedule,
                        seat_no=seat,
                        status='PENDING',
                        expires_at__gt=timezone.now()
                    ).exists()
                    if not conflict:
                        import json
                        occupied = set()
                        for b in Booking.objects.filter(schedule=schedule, status__in=['PENDING','CONFIRMED']).only('seats'):
                            try:
                                for s in json.loads(b.seats or '[]'):
                                    occupied.add(s)
                            except Exception:
                                pass
                        conflict = seat in occupied
                    if conflict:
                        return Response({'detail': f'Seat {seat} not available'}, status=409)

                r = Reservation.objects.create(
                    schedule=schedule,
                    seat_no=seat,
                    reserved_by=request.user,
                    expires_at=expires_at,
                    status='PENDING'
                )
                created.append(r.id)
            return Response({'reservation_ids': created, 'ttl_minutes': ttl_minutes}, status=201)
        except Exception:
            # On any failure, release Redis holds
            if not use_db_check:
                release_seats(schedule.id, seats)
            raise

class CreatePaymentView(generics.GenericAPIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        schedule_id = request.data.get('schedule_id')
        seats = request.data.get('seats', [])
        amount = request.data.get('amount')  # optional, we’ll compute if missing
        if not schedule_id or not seats:
            return Response({'detail': 'schedule_id and seats[] required'}, status=400)

        # Compute amount from fare if not provided
        schedule = Schedule.objects.filter(id=schedule_id).first()
        if not schedule:
            return Response({'detail': 'Invalid schedule_id'}, status=404)
        if schedule.status != 'ACTIVE':
            return Response({'detail': 'Schedule is not available for booking'}, status=400)
        if not amount:
            amount = str(Decimal(schedule.fare) * Decimal(len(seats)))

        import json
        booking_kw = {
            'user': request.user,
            'schedule_id': schedule_id,
            'seats': json.dumps(seats),
            'amount': amount,
            'status': 'PENDING',
            'contact_phone': request.data.get('contact_phone', ''),
            'state_of_residence': request.data.get('state_of_residence', ''),
            'whatsapp_opt_in': request.data.get('whatsapp_opt_in', False),
        }
        bp_id = request.data.get('boarding_point_id')
        dp_id = request.data.get('dropping_point_id')
        if bp_id:
            booking_kw['boarding_point_id'] = bp_id
        if dp_id:
            booking_kw['dropping_point_id'] = dp_id

        use_demo = getattr(settings, 'DEMO_PAYMENTS', False) or not (settings.RAZORPAY_KEY_ID and settings.RAZORPAY_KEY_SECRET)
        if use_demo:
            booking = Booking.objects.create(**booking_kw)
            payment = Payment.objects.create(booking=booking, gateway_order_id=f"order_demo_{booking.id}", status='CREATED')
            return Response({
                'booking_id': booking.id, 'order_id': payment.gateway_order_id,
                'amount': int(Decimal(amount) * 100), 'currency': 'INR', 'key_id': 'rzp_test_demo'
            }, status=201)

        # Create booking (PENDING)
        booking = Booking.objects.create(**booking_kw)

        # Create Razorpay order (amount in paise)
        client = razorpay.Client(auth=(settings.RAZORPAY_KEY_ID, settings.RAZORPAY_KEY_SECRET))
        order = client.order.create({
            'amount': int(Decimal(amount) * 100),
            'currency': 'INR',
            'receipt': str(booking.id),
            'payment_capture': 1,  # auto-capture
            'notes': {'booking_id': str(booking.id)}
        })

        payment = Payment.objects.create(
            booking=booking,
            gateway_order_id=order['id'],
            status='CREATED'
        )

        # Return data needed for Razorpay Checkout on frontend
        return Response({
            'booking_id': booking.id,
            'order_id': order['id'],
            'amount': order['amount'],
            'currency': order['currency'],
            'key_id': settings.RAZORPAY_KEY_ID
        }, status=201)

class PaymentWebhookView(generics.GenericAPIView):
    permission_classes = [AllowAny]
    authentication_classes = []  # Razorpay calls this URL without JWT; verify via signature

    def post(self, request):
        # Raw body and signature header for verification (Razorpay signs the raw body)
        raw = request.body
        signature = request.headers.get('X-Razorpay-Signature', '')

        # Optional: allow skipping in dev
        verified = True
        if settings.RAZORPAY_VERIFY_WEBHOOK:
            try:
                razorpay.Utility.verify_webhook_signature(raw, signature, settings.RAZORPAY_WEBHOOK_SECRET)
                verified = True
            except razorpay.errors.SignatureVerificationError:
                verified = False

        # Parse event and find payment by order_id
        event = request.data.get('event')
        payload = request.data.get('payload', {})
        order_id = None
        payment_id = None

        # payment.captured payload
        if 'payment' in payload and payload['payment'] and payload['payment'].get('entity'):
            entity = payload['payment']['entity']
            payment_id = entity.get('id')
            order_id = entity.get('order_id')

        # order.paid payload (alternative)
        if not order_id and 'order' in payload and payload['order'] and payload['order'].get('entity'):
            entity = payload['order']['entity']
            order_id = entity.get('id')

        if not order_id:
            return Response({'detail': 'order_id not found in payload'}, status=400)

        try:
            payment = Payment.objects.select_related('booking').get(gateway_order_id=order_id)
        except Payment.DoesNotExist:
            return Response({'detail': 'Payment not found for order_id'}, status=404)

        # Idempotency: if already processed, return OK
        if payment.status == 'SUCCESS':
            return Response({'ok': True})

        # If signature invalid, mark failed
        import json
        raw_response_str = json.dumps(request.data) if request.data else '{}'
        if not verified:
            payment.status = 'FAILED'
            payment.gateway_payment_id = payment_id or ''
            payment.raw_response = raw_response_str
            payment.save()
            return Response({'detail': 'signature verification failed'}, status=400)

        # Mark success and confirm booking
        payment.status = 'SUCCESS'
        payment.gateway_payment_id = payment_id or ''
        payment.raw_response = raw_response_str
        payment.save()

        booking = payment.booking
        if booking.status != 'CONFIRMED':
            booking.status = 'CONFIRMED'
            booking.payment_id = payment.gateway_payment_id
            booking.save()

        # Optional: update related Reservations to CONFIRMED as before
        try:
            booked_seats = json.loads(booking.seats or '[]')
        except Exception:
            booked_seats = []
        from .models import Reservation
        Reservation.objects.filter(
            schedule=booking.schedule,
            seat_no__in=booked_seats,
            reserved_by=booking.user,
            status='PENDING'
        ).update(status='CONFIRMED')

        # Generate ticket PDF on successful payment
        if not booking.ticket_file:
            try:
                from .ticket_generator import save_ticket_to_booking
                filename = save_ticket_to_booking(booking)
                booking.ticket_file = filename
                booking.save()
            except Exception as e:
                # Log error but don't fail the webhook
                print(f"Failed to generate ticket for booking {booking.id}: {str(e)}")

        return Response({'ok': True})

class BookingListView(generics.ListAPIView):
    """GET: List authenticated user's bookings."""
    permission_classes = [IsAuthenticated]
    serializer_class = BookingSerializer

    def get_queryset(self):
        return Booking.objects.filter(user=self.request.user).select_related(
            'schedule', 'schedule__route', 'schedule__bus', 'schedule__bus__operator',
            'boarding_point', 'dropping_point'
        ).order_by('-created_at')


class TicketView(generics.RetrieveAPIView):
    permission_classes = [IsAuthenticated]
    queryset = Booking.objects.all()
    serializer_class = BookingSerializer
    lookup_field = 'pk'

    def retrieve(self, request, *args, **kwargs):
        booking = self.get_object()
        if booking.user_id != request.user.id:
            return Response({'detail': 'Forbidden'}, status=403)
        
        # Check if booking is confirmed
        if booking.status != 'CONFIRMED':
            return Response({'detail': 'Ticket not available for unconfirmed bookings'}, status=400)
        
        # Generate ticket if not already generated
        if not booking.ticket_file:
            from .ticket_generator import save_ticket_to_booking
            try:
                filename = save_ticket_to_booking(booking)
                booking.ticket_file = filename
                booking.save()
            except Exception as e:
                return Response({'detail': f'Failed to generate ticket: {str(e)}'}, status=500)
        
        # Return ticket URL (for now, local file path)
        ticket_url = f'/api/tickets/download/{booking.id}/'
        return Response({'ticket_url': ticket_url})


class TicketDownloadView(generics.RetrieveAPIView):
    permission_classes = [IsAuthenticated]
    queryset = Booking.objects.all()
    lookup_field = 'pk'

    def retrieve(self, request, *args, **kwargs):
        booking = self.get_object()
        if booking.user_id != request.user.id:
            return Response({'detail': 'Forbidden'}, status=403)
        
        if not booking.ticket_file:
            return Response({'detail': 'Ticket not found'}, status=404)
        
        # Serve the PDF file
        import os
        from django.http import FileResponse
        from django.conf import settings
        
        filepath = os.path.join(settings.BASE_DIR, 'tickets', booking.ticket_file)
        if not os.path.exists(filepath):
            return Response({'detail': 'Ticket file not found'}, status=404)
        
        response = FileResponse(
            open(filepath, 'rb'),
            content_type='application/pdf',
            filename=booking.ticket_file
        )
        response['Content-Disposition'] = f'attachment; filename="{booking.ticket_file}"'
        return response