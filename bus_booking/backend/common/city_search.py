"""Match typed city names to Route origin/destination (handles common spelling variants)."""

from __future__ import annotations

from django.db.models import Q

# Lowercase tokens: when the user query matches a group, we OR icontains for every member
# so e.g. "Bengaluru" still matches DB rows that say "Bangalore".
_CITY_EQUIVALENT_GROUPS: tuple[frozenset[str], ...] = (
    frozenset({"bangalore", "bengaluru"}),
    frozenset({"mysore", "mysuru"}),
    frozenset({"pondicherry", "puducherry", "pondy"}),
    frozenset({"chennai", "madras"}),
)


def _matches_city_group(low: str, group: frozenset[str]) -> bool:
    if len(low) < 2:
        return False
    for g in group:
        if low == g:
            return True
        if len(low) >= 3 and (low in g or g in low):
            return True
    return False


def city_match_terms(user_text: str) -> list[str]:
    """Distinct strings to use with OR + icontains against Route text fields."""
    raw = (user_text or "").strip()
    if not raw:
        return []
    low = raw.lower()
    terms: set[str] = {raw, low}
    for group in _CITY_EQUIVALENT_GROUPS:
        if _matches_city_group(low, group):
            terms.update(group)
    return list(terms)


def city_icontains_q(field: str, user_text: str) -> Q:
    """Combine icontains on `field` for the raw input plus any expanded spellings."""
    terms = city_match_terms(user_text)
    if not terms:
        return Q(pk__in=[])
    q = Q()
    for t in terms:
        q |= Q(**{f"{field}__icontains": t})
    return q
