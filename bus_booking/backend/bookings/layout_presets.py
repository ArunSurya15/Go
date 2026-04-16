"""
Preset bus seat layouts: rows × cols with labels and types.
Notation: LxR = L columns left of aisle + aisle + R columns right of aisle.
Aisle is empty label and type "aisle".

Deck flags (stored in seat_map_json for ScheduleSeatMapView):
- has_upper_deck: false for full seater, full semi-sleeper, or full sleeper (single deck).
- has_upper_deck: true for mixed lower seater / upper sleeper; deck_split_row = row count on lower deck.
"""


def _seater_2x2_aisle(rows=12):
    """2x2: 2 columns left + aisle + 2 columns right. cols=5. Single deck (no upper berth)."""
    cols = 5
    labels = []
    types = []
    for r in range(1, rows + 1):
        labels.extend([f"{r}A", f"{r}B", "", f"{r}C", f"{r}D"])
        types.extend(["seater", "seater", "aisle", "seater", "seater"])
    return {
        "rows": rows,
        "cols": cols,
        "labels": labels,
        "types": types,
        "has_upper_deck": False,
    }


def _mixed_lower_seater_upper_sleeper_1x2(rows=12):
    """1x2: 1 column left + aisle + 2 columns right. Lower = seater, upper = sleeper (double deck)."""
    cols = 4
    half = rows // 2
    labels = []
    types = []
    for r in range(1, rows + 1):
        labels.extend([f"{r}A", "", f"{r}B", f"{r}C"])
        row_type = "seater" if r <= half else "sleeper"
        types.extend([row_type, "aisle", row_type, row_type])
    return {
        "rows": rows,
        "cols": cols,
        "labels": labels,
        "types": types,
        "has_upper_deck": True,
        "deck_split_row": half,
    }


def _sleeper_1x2_aisle(rows=6):
    """1x2: 1 column left + aisle + 2 columns right. All sleeper. Single deck (no upper berth)."""
    cols = 4
    labels = []
    types = []
    for r in range(1, rows + 1):
        labels.extend([f"{r}A", "", f"{r}B", f"{r}C"])
        types.extend(["sleeper", "aisle", "sleeper", "sleeper"])
    return {
        "rows": rows,
        "cols": cols,
        "labels": labels,
        "types": types,
        "has_upper_deck": False,
    }


def _semi_sleeper_2x2_aisle(rows=10):
    """2x2 with aisle. All semi-sleeper. Single deck (no upper berth)."""
    cols = 5
    labels = []
    types = []
    for r in range(1, rows + 1):
        labels.extend([f"{r}A", f"{r}B", "", f"{r}C", f"{r}D"])
        types.extend(["semi_sleeper", "semi_sleeper", "aisle", "semi_sleeper", "semi_sleeper"])
    return {
        "rows": rows,
        "cols": cols,
        "labels": labels,
        "types": types,
        "has_upper_deck": False,
    }


# Public presets for use in seeds and API
LAYOUT_SEATER_2X2_AISLE = _seater_2x2_aisle(12)  # 48 seats, 12 rows, single deck
LAYOUT_MIXED_SEATER_SLEEPER_1X2 = _mixed_lower_seater_upper_sleeper_1x2(12)  # 36 seats, lower/upper
LAYOUT_SLEEPER_1X2_AISLE = _sleeper_1x2_aisle(6)  # 18 seats, 6 rows, single deck
LAYOUT_SLEEPER_1X2_LARGE = _sleeper_1x2_aisle(6)  # 18 seats (same pattern; “large” = longer berth marketing in demo)
LAYOUT_SEMI_SLEEPER_2X2_AISLE = _semi_sleeper_2x2_aisle(10)  # 40 seats, 10 rows, single deck
