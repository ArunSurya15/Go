import json
import time
from django.conf import settings

try:
    import redis
    _redis = redis.Redis.from_url(settings.REDIS_URL, decode_responses=True)
    _redis.ping()
    REDIS_OK = True
except Exception:
    _redis = None
    REDIS_OK = False

def seat_key(schedule_id: int, seat_no: str) -> str:
    return f"res:{schedule_id}:{seat_no}"

def try_hold_seats(schedule_id: int, seats: list, user_id: int, ttl=None):
    """
    Atomically try to hold all seats. Returns (ok, failed_seat or None).
    Uses SET NX with TTL. On any failure, releases acquired seats.
    """
    if not REDIS_OK:
        return (None, None)  # signal fallback

    ttl = ttl or settings.SEAT_HOLD_TTL_SECONDS
    acquired = []
    try:
        pipe = _redis.pipeline()
        now = int(time.time())
        val = json.dumps({"user": user_id, "ts": now})
        # try all
        for s in seats:
            k = seat_key(schedule_id, s)
            # SET NX PX
            # redis-py: set(name, value, nx=True, ex=seconds)
            pipe.set(k, val, nx=True, ex=ttl)
        results = pipe.execute()
        for idx, ok in enumerate(results):
            if ok:
                acquired.append(seats[idx])
            else:
                # Failed on this seat
                failed = seats[idx]
                # release acquired
                if acquired:
                    p2 = _redis.pipeline()
                    for s in acquired:
                        p2.delete(seat_key(schedule_id, s))
                    p2.execute()
                return (False, failed)
        return (True, None)
    except Exception:
        # On error, best-effort cleanup
        if acquired:
            p2 = _redis.pipeline()
            for s in acquired:
                p2.delete(seat_key(schedule_id, s))
            p2.execute()
        return (None, None)

def release_seats(schedule_id: int, seats: list):
    if not REDIS_OK:
        return
    try:
        pipe = _redis.pipeline()
        for s in seats:
            pipe.delete(seat_key(schedule_id, s))
        pipe.execute()
    except Exception:
        pass