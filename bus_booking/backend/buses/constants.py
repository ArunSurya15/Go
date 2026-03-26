"""Catalog of bus amenities passengers can filter on — operators tick these when adding a bus."""

BUS_FEATURE_DEFINITIONS = [
    {"id": "ac", "label": "AC"},
    {"id": "wifi", "label": "Wi-Fi"},
    {"id": "water", "label": "Water bottle"},
    {"id": "charging", "label": "Charging point"},
    {"id": "blanket", "label": "Blanket / bedding"},
    {"id": "toilet", "label": "Washroom"},
    {"id": "entertainment", "label": "Entertainment"},
    {"id": "live_tracking", "label": "Live tracking"},
    {"id": "reading_lamp", "label": "Reading lamp"},
    {"id": "snacks", "label": "Snacks on board"},
]

VALID_FEATURE_IDS = frozenset(d["id"] for d in BUS_FEATURE_DEFINITIONS)
