import json


def infer_layout_kind(seat_map_json_str: str) -> str:
    """Derive a simple category from seat map types: seater, sleeper, semi, or mixed."""
    try:
        m = json.loads(seat_map_json_str or "{}")
        types = [t for t in (m.get("types") or []) if t and t not in ("aisle", "blank")]
        if not types:
            return "mixed"
        uniq = set(types)
        if uniq <= {"seater"}:
            return "seater"
        if uniq <= {"sleeper"}:
            return "sleeper"
        if uniq <= {"semi_sleeper"}:
            return "semi"
        return "mixed"
    except Exception:
        return "mixed"
