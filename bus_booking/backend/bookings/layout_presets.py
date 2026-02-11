"""
Preset bus seat layouts: rows × cols with labels and types.
Notation: LxR = L columns left of aisle + aisle + R columns right of aisle.
Aisle is empty label and type "aisle".
Lower/upper deck: first half of rows = lower, second half = upper.
"""


def _seater_2x2_aisle(rows=10):
    """2x2: 2 columns left + aisle + 2 columns right. cols=5."""
    cols = 5
    labels = []
    types = []
    for r in range(1, rows + 1):
        labels.extend([f"{r}A", f"{r}B", "", f"{r}C", f"{r}D"])
        types.extend(["seater", "seater", "aisle", "seater", "seater"])
    return {"rows": rows, "cols": cols, "labels": labels, "types": types}


def _mixed_lower_seater_upper_sleeper_1x2(rows=10):
    """1x2: 1 column left + aisle + 2 columns right. Lower deck = seater, upper = sleeper."""
    cols = 4
    half = rows // 2
    labels = []
    types = []
    for r in range(1, rows + 1):
        labels.extend([f"{r}A", "", f"{r}B", f"{r}C"])
        row_type = "seater" if r <= half else "sleeper"
        types.extend([row_type, "aisle", row_type, row_type])
    return {"rows": rows, "cols": cols, "labels": labels, "types": types}


def _sleeper_1x2_aisle(rows=10):
    """1x2: 1 column left + aisle + 2 columns right. All sleeper."""
    cols = 4
    labels = []
    types = []
    for r in range(1, rows + 1):
        labels.extend([f"{r}A", "", f"{r}B", f"{r}C"])
        types.extend(["sleeper", "aisle", "sleeper", "sleeper"])
    return {"rows": rows, "cols": cols, "labels": labels, "types": types}


# Public presets for use in seeds and API
LAYOUT_SEATER_2X2_AISLE = _seater_2x2_aisle(10)      # 40 seats (2+2 per row)
LAYOUT_MIXED_SEATER_SLEEPER_1X2 = _mixed_lower_seater_upper_sleeper_1x2(10)  # 30 seats (1+2 per row)
LAYOUT_SLEEPER_1X2_AISLE = _sleeper_1x2_aisle(10)    # 30 seats (1+2 per row)
