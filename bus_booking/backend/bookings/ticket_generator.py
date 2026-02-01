import os
import qrcode
import hashlib
import hmac
from io import BytesIO
from datetime import datetime
from django.conf import settings
from django.core.files.base import ContentFile
from reportlab.lib.pagesizes import letter, A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, Image
from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_LEFT
from .models import Booking


def generate_ticket_signature(booking_id: int) -> str:
    """Generate HMAC signature for ticket verification"""
    secret = getattr(settings, 'TICKET_SECRET', 'default-secret-change-in-production')
    message = f"booking_{booking_id}_{datetime.now().strftime('%Y%m%d')}"
    signature = hmac.new(
        secret.encode('utf-8'),
        message.encode('utf-8'),
        hashlib.sha256
    ).hexdigest()[:16]  # First 16 chars
    return signature


def generate_qr_code(booking_id: int) -> BytesIO:
    """Generate QR code for booking verification"""
    signature = generate_ticket_signature(booking_id)
    qr_data = f"booking:{booking_id}:{signature}"
    
    qr = qrcode.QRCode(
        version=1,
        error_correction=qrcode.constants.ERROR_CORRECT_L,
        box_size=10,
        border=4,
    )
    qr.add_data(qr_data)
    qr.make(fit=True)
    
    img = qr.make_image(fill_color="black", back_color="white")
    
    # Convert PIL image to BytesIO
    img_buffer = BytesIO()
    img.save(img_buffer, format='PNG')
    img_buffer.seek(0)
    return img_buffer


def generate_ticket_pdf(booking: Booking) -> ContentFile:
    """Generate PDF ticket for a booking"""
    buffer = BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=A4, rightMargin=72, leftMargin=72, topMargin=72, bottomMargin=18)
    
    # Get styles
    styles = getSampleStyleSheet()
    
    # Custom styles
    title_style = ParagraphStyle(
        'CustomTitle',
        parent=styles['Heading1'],
        fontSize=24,
        spaceAfter=30,
        alignment=TA_CENTER,
        textColor=colors.darkblue
    )
    
    header_style = ParagraphStyle(
        'CustomHeader',
        parent=styles['Heading2'],
        fontSize=16,
        spaceAfter=12,
        textColor=colors.darkblue
    )
    
    normal_style = ParagraphStyle(
        'CustomNormal',
        parent=styles['Normal'],
        fontSize=12,
        spaceAfter=6
    )
    
    # Build content
    story = []
    
    # Title
    story.append(Paragraph("BUS BOOKING TICKET", title_style))
    story.append(Spacer(1, 20))
    
    # Booking details
    story.append(Paragraph("Booking Details", header_style))
    
    booking_data = [
        ['Booking ID:', f"#{booking.id}"],
        ['Passenger:', booking.user.get_full_name() or booking.user.username],
        ['Email:', booking.user.email],
        ['Booking Date:', booking.created_at.strftime('%B %d, %Y at %I:%M %p')],
        ['Status:', booking.get_status_display()],
    ]
    
    booking_table = Table(booking_data, colWidths=[2*inch, 3*inch])
    booking_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (0, -1), colors.lightgrey),
        ('TEXTCOLOR', (0, 0), (-1, -1), colors.black),
        ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
        ('FONTNAME', (0, 0), (-1, -1), 'Helvetica'),
        ('FONTSIZE', (0, 0), (-1, -1), 12),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 12),
        ('BACKGROUND', (1, 0), (1, -1), colors.beige),
        ('GRID', (0, 0), (-1, -1), 1, colors.black)
    ]))
    
    story.append(booking_table)
    story.append(Spacer(1, 20))
    
    # Journey details
    story.append(Paragraph("Journey Details", header_style))
    
    schedule = booking.schedule
    journey_data = [
        ['Route:', f"{schedule.route.origin} → {schedule.route.destination}"],
        ['Bus:', f"{schedule.bus.registration_no} ({schedule.bus.capacity} seats)"],
        ['Operator:', schedule.bus.operator.name],
        ['Departure:', schedule.departure_dt.strftime('%B %d, %Y at %I:%M %p')],
        ['Arrival:', schedule.arrival_dt.strftime('%B %d, %Y at %I:%M %p')],
        ['Seats:', ', '.join(booking.seats) if isinstance(booking.seats, list) else booking.seats],
        ['Fare:', f"₹{booking.amount}"],
    ]
    
    journey_table = Table(journey_data, colWidths=[2*inch, 3*inch])
    journey_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (0, -1), colors.lightgrey),
        ('TEXTCOLOR', (0, 0), (-1, -1), colors.black),
        ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
        ('FONTNAME', (0, 0), (-1, -1), 'Helvetica'),
        ('FONTSIZE', (0, 0), (-1, -1), 12),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 12),
        ('BACKGROUND', (1, 0), (1, -1), colors.beige),
        ('GRID', (0, 0), (-1, -1), 1, colors.black)
    ]))
    
    story.append(journey_table)
    story.append(Spacer(1, 30))
    
    # QR Code
    story.append(Paragraph("Ticket Verification", header_style))
    story.append(Paragraph("Scan this QR code for ticket verification:", normal_style))
    
    # Generate QR code
    qr_buffer = generate_qr_code(booking.id)
    qr_image = Image(qr_buffer, width=2*inch, height=2*inch)
    story.append(qr_image)
    story.append(Spacer(1, 20))
    
    # Footer
    story.append(Paragraph("Important Notes:", header_style))
    notes = [
        "• Please arrive at the bus stop 15 minutes before departure time",
        "• Carry a valid ID proof along with this ticket",
        "• This ticket is valid only for the specified journey and date",
        "• For cancellations, please contact the operator directly",
        "• Keep this ticket safe until the end of your journey"
    ]
    
    for note in notes:
        story.append(Paragraph(note, normal_style))
    
    # Build PDF
    doc.build(story)
    buffer.seek(0)
    
    # Return as ContentFile
    filename = f"ticket_{booking.id}_{datetime.now().strftime('%Y%m%d_%H%M%S')}.pdf"
    return ContentFile(buffer.getvalue(), name=filename)


def save_ticket_to_booking(booking: Booking) -> str:
    """Generate and save ticket PDF to booking, return filename"""
    pdf_content = generate_ticket_pdf(booking)
    
    # For now, save to local filesystem (later can be S3)
    tickets_dir = os.path.join(settings.BASE_DIR, 'tickets')
    os.makedirs(tickets_dir, exist_ok=True)
    
    filename = pdf_content.name
    filepath = os.path.join(tickets_dir, filename)
    
    with open(filepath, 'wb') as f:
        f.write(pdf_content.read())
    
    # Store filename in booking (you might want to add a ticket_file field to Booking model)
    # For now, we'll return the filename
    return filename
