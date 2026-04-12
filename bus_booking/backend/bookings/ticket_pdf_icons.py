"""
Ticket PDF icons: **Lucide** artwork (same shapes as `lucide-react` in the app).

SVG sources match `lucide-static` v0.460.0 paths (ISC). Rendered via `svglib` + ReportLab.
"""

from __future__ import annotations

from pathlib import Path

from reportlab.platypus import Paragraph, Table, TableStyle

_ASSETS = Path(__file__).resolve().parent / "assets" / "ticket_icons"


def _lucide_rlg(basename: str, size_pt: float) -> object:
    """
    Return a scaled ReportLab Drawing whose `.width` and `.height` reflect
    the scaled size (svglib does NOT update those after `.scale()`).
    """
    from svglib.svglib import svg2rlg

    path = _ASSETS / f"{basename}.svg"
    if not path.is_file():
        raise FileNotFoundError(f"Missing ticket icon SVG: {path}")
    drawing = svg2rlg(str(path))
    if drawing is None:
        raise RuntimeError(f"svglib could not parse: {path}")
    w, h = float(drawing.width or size_pt), float(drawing.height or size_pt)
    if w > 0 and h > 0:
        s = min(size_pt / w, size_pt / h)
        drawing.scale(s, s)
        # CRITICAL: update metadata so ReportLab allocates the correct bounding box.
        drawing.width = w * s
        drawing.height = h * s
    return drawing


def label_row_with_icon(
    basename: str,
    label_paragraph: Paragraph,
    left_col_width: float,
    icon_size_pt: float = 12.5,
    icon_slot_w: float = 20.0,
) -> Table:
    """One row: Lucide icon (correctly sized) + label paragraph, both MIDDLE-aligned."""
    text_w = max(36.0, float(left_col_width) - icon_slot_w - 2.0)
    drawing = _lucide_rlg(basename, icon_size_pt)
    # After the fix above, drawing.height == icon_size_pt (approx).
    dh = float(drawing.height)

    # Measure paragraph at its actual column width.
    _pw, lh = label_paragraph.wrap(text_w, 9999)
    lh = float(lh)

    row_h = max(dh, lh, 11.0)

    tbl = Table([[drawing, label_paragraph]], colWidths=[icon_slot_w, text_w], rowHeights=[row_h])
    tbl.setStyle(
        TableStyle(
            [
                # Center icon vertically; center label vertically too so both mid-lines coincide.
                ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                ("ALIGN", (0, 0), (0, 0), "CENTER"),
                ("LEFTPADDING", (0, 0), (-1, -1), 0),
                ("RIGHTPADDING", (0, 0), (0, 0), 4),
                ("RIGHTPADDING", (1, 0), (1, 0), 0),
                ("TOPPADDING", (0, 0), (-1, -1), 0),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 0),
            ]
        )
    )
    return tbl
