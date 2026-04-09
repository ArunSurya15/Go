"""Per-seat fare helpers (schedule base fare + optional overrides)."""
import json
from decimal import Decimal, InvalidOperation


def seat_fares_dict_from_schedule(schedule) -> dict[str, str]:
    """Parse Schedule.seat_fares_json into a dict of label -> price string."""
    raw = getattr(schedule, "seat_fares_json", None) or "{}"
    if isinstance(raw, dict):
        return {str(k): str(v) for k, v in raw.items()}
    try:
        d = json.loads(raw)
        if isinstance(d, dict):
            return {str(k): str(v) for k, v in d.items()}
    except Exception:
        pass
    return {}


def fare_for_seat(schedule, seat_label: str) -> Decimal:
    """Price for one bookable seat label; falls back to schedule.fare."""
    label = (seat_label or "").strip()
    if not label:
        return Decimal(schedule.fare)
    overrides = seat_fares_dict_from_schedule(schedule)
    if label in overrides:
        try:
            return Decimal(str(overrides[label])).quantize(Decimal("0.01"))
        except (InvalidOperation, TypeError, ValueError):
            pass
    return Decimal(schedule.fare)


def total_fare_for_seats(schedule, seat_labels: list[str]) -> Decimal:
    total = Decimal("0.00")
    for s in seat_labels:
        total += fare_for_seat(schedule, s)
    return total.quantize(Decimal("0.01"))


def merged_seat_fare_map(
    schedule, labels: list, types: list | None
) -> dict[str, str]:
    """
    Full map bookable label -> price string for seat-map API.
    labels/types are parallel row-major lists from bus layout.
    """
    out: dict[str, str] = {}
    for i, lb in enumerate(labels):
        label = (lb or "").strip()
        if not label:
            continue
        t = None
        if types and i < len(types):
            t = types[i]
        if t in ("aisle", "blank"):
            continue
        out[label] = str(fare_for_seat(schedule, label))
    return out
