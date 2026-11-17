"""Helpers for the optional off-peak download window."""

from datetime import datetime

DEFAULT_START = "01:00"
DEFAULT_STOP = "07:00"


def parse_hhmm(value: str, fallback: str) -> int:
    """Return minutes since midnight for HH:MM, or the fallback on bad input."""
    for candidate in (value, fallback, "00:00"):
        try:
            hours, minutes = str(candidate).strip().split(":", 1)
            hours, minutes = int(hours), int(minutes)
            if 0 <= hours <= 23 and 0 <= minutes <= 59:
                return hours * 60 + minutes
        except (AttributeError, TypeError, ValueError):
            continue
    return 0


def is_allowed_now(
    start: str = DEFAULT_START,
    stop: str = DEFAULT_STOP,
    enabled: bool = False,
    now: datetime = None,
) -> bool:
    """True when new downloads may start.

    Overnight windows (start > stop) wrap past midnight. A start equal to stop
    means "all day" so the setting cannot accidentally block the queue forever.
    """
    if not enabled:
        return True

    start_min = parse_hhmm(start, DEFAULT_START)
    stop_min = parse_hhmm(stop, DEFAULT_STOP)
    if start_min == stop_min:
        return True

    current = now or datetime.now()
    now_min = current.hour * 60 + current.minute
    if start_min < stop_min:
        return start_min <= now_min < stop_min
    return now_min >= start_min or now_min < stop_min
