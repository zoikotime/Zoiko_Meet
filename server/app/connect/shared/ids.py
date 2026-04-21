"""UUID v7 generator — time-ordered, monotonically increasing within a ms.

Spec §6 mandates UUID v7 for all connect_* PKs so indexes stay hot under
high insert rates and cross-tenant IDs remain non-enumerable.

Python's stdlib `uuid` does not yet implement v7 (as of 3.12); this is a
minimal RFC 9562 draft-04-compatible implementation.
"""
import os
import time
import uuid
from threading import Lock

_lock = Lock()
_last_ms = 0
_last_seq = 0


def uuid7() -> uuid.UUID:
    """Generate a UUID v7 (unix_ts_ms || rand_a || rand_b)."""
    global _last_ms, _last_seq
    with _lock:
        ms = int(time.time() * 1000)
        if ms == _last_ms:
            _last_seq += 1
        else:
            _last_ms = ms
            _last_seq = 0
        seq = _last_seq & 0x0FFF

    rand = os.urandom(8)
    b = bytearray(16)
    b[0] = (ms >> 40) & 0xFF
    b[1] = (ms >> 32) & 0xFF
    b[2] = (ms >> 24) & 0xFF
    b[3] = (ms >> 16) & 0xFF
    b[4] = (ms >> 8) & 0xFF
    b[5] = ms & 0xFF
    b[6] = 0x70 | ((seq >> 8) & 0x0F)  # version 7
    b[7] = seq & 0xFF
    b[8] = 0x80 | (rand[0] & 0x3F)     # variant 10
    b[9:16] = rand[1:8]
    return uuid.UUID(bytes=bytes(b))


def uuid7_str() -> str:
    return str(uuid7())
