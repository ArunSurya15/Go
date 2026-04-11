"""
India KYC format helpers — pattern checks only (not government / bank verification).

Real legitimacy checks need regulated APIs (e.g. NSDL PAN, UIDAI e-KYC, penny-drop payout).
"""

import re

_PAN_RE = re.compile(r"^[A-Z]{5}[0-9]{4}[A-Z]$")
# GSTIN: 15 chars (state + PAN block + entity + Z + checksum) — format only.
_GSTIN_RE = re.compile(r"^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$", re.IGNORECASE)


def pan_format_ok(value: str | None) -> bool:
    s = (value or "").strip().upper()
    return bool(s and _PAN_RE.match(s))


def gstin_format_ok(value: str | None) -> bool:
    s = (value or "").strip().upper()
    return bool(s and len(s) == 15 and _GSTIN_RE.match(s))


def aadhaar_digits_only_ok(value: str | None) -> bool:
    """12 digits only — use for last-4 or masked workflows; do not treat as UIDAI verification."""
    s = re.sub(r"\s+", "", str(value or ""))
    return bool(re.fullmatch(r"\d{12}", s))


def aadhaar_last_four_ok(value: str | None) -> bool:
    s = re.sub(r"\s+", "", str(value or ""))
    return bool(re.fullmatch(r"\d{4}", s))


def ifsc_format_ok(value: str | None) -> bool:
    s = (value or "").strip().upper()
    return bool(re.fullmatch(r"[A-Z]{4}0[A-Z0-9]{6}", s))
