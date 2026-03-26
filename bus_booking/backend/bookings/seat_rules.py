"""Seat layout helpers and adjacent-seat gender rules (e.g. male cannot book next to booked female)."""
import json

from django.utils import timezone


def layout_labels_and_cols_from_bus(bus):
    """Parse seat_map_json into labels list (row-major) and column count."""
    try:
        layout = json.loads(bus.seat_map_json or "{}")
    except Exception:
        layout = {}
    rows = layout.get("rows") or 10
    cols = layout.get("cols") or 4
    labels = layout.get("labels")
    if not labels:
        labels = []
        for r in range(1, rows + 1):
            for c in range(cols):
                labels.append(f"{r}{chr(65 + c)}")
    total = rows * cols
    while len(labels) < total:
        labels.append("")
    return labels[:total], cols

from .models import Booking, Reservation


def horizontal_neighbor_labels(layout_labels, cols, seat_label):
    """Horizontally adjacent seat labels in the same row (left/right), skipping aisles."""
    if not layout_labels or seat_label is None:
        return []
    try:
        idx = layout_labels.index(seat_label)
    except ValueError:
        return []
    r, c = divmod(idx, cols)
    out = []
    for dc in (-1, 1):
        nc = c + dc
        if 0 <= nc < cols:
            ni = r * cols + nc
            if ni < len(layout_labels):
                lb = layout_labels[ni]
                if lb is not None and str(lb).strip() != "":
                    out.append(str(lb).strip())
    return out


def get_occupied_and_seat_genders(schedule):
    """
    Returns (occupied: set of str, seat_gender: dict seat -> 'M'|'F').
    Matches ScheduleSeatMapView / seat-map API.
    """
    occupied = set()
    seat_gender = {}
    for r in Reservation.objects.filter(
        schedule=schedule, status="PENDING", expires_at__gt=timezone.now()
    ).values_list("seat_no", flat=True):
        occupied.add(r)
    for b in Booking.objects.filter(
        schedule=schedule, status__in=["PENDING", "CONFIRMED"]
    ).only("seats", "passenger_details"):
        try:
            for s in json.loads(b.seats or "[]"):
                occupied.add(s)
                if s not in seat_gender:
                    try:
                        details = json.loads(b.passenger_details or "{}")
                        if isinstance(details, dict) and s in details:
                            g = details[s].get("gender") if isinstance(details[s], dict) else None
                            if g:
                                g = str(g).strip().upper()
                                if g in ("M", "F"):
                                    seat_gender[s] = g
                                elif g == "MALE":
                                    seat_gender[s] = "M"
                                elif g == "FEMALE":
                                    seat_gender[s] = "F"
                    except Exception:
                        pass
        except Exception:
            pass
    return occupied, seat_gender


def male_reserved_seat_adjacent_to_female(
    layout_labels, cols, seats_to_reserve, seat_gender, current_batch_seats
):
    """
    For a male booker: block if any reserved seat is horizontally adjacent to an
    already-booked female, excluding neighbors within the same reservation batch.
    """
    seats_set = set(current_batch_seats)
    for seat in seats_to_reserve:
        for n in horizontal_neighbor_labels(layout_labels, cols, seat):
            if n in seats_set:
                continue
            if seat_gender.get(n) == "F":
                return (
                    f"Seat {seat} is only available for female passengers "
                    "(adjacent to a female passenger)."
                )
    return None
