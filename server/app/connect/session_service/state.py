"""Session lifecycle state machine.

  scheduled ──▶ pending_start ──▶ active ──▶ ended ──▶ archived
                                   │
                                   └──▶ cancelled

Rejects illegal transitions at the service boundary — the DB CHECK only
validates the value, it can't validate the transition.
"""
from __future__ import annotations

from app.connect.shared.errors import Conflict

_ALLOWED = {
    "scheduled":      {"pending_start", "cancelled"},
    "pending_start":  {"active", "cancelled"},
    "active":         {"ended"},
    "ended":          {"archived"},
    "archived":       set(),
    "cancelled":      set(),
}


def assert_transition(current: str, target: str) -> None:
    if target not in _ALLOWED.get(current, set()):
        raise Conflict(
            f"Illegal session transition: {current} -> {target}",
            details={"from": current, "to": target},
        )


_MEMBER_ALLOWED = {
    "invited":           {"pending_admission", "admitted", "denied", "left"},
    "pending_admission": {"admitted", "denied", "kicked", "left"},
    "admitted":          {"disconnected", "kicked", "left"},
    "disconnected":      {"admitted", "kicked", "left"},
    "denied":            set(),
    "kicked":            set(),
    "left":              {"admitted"},          # allow rejoin
}


def assert_member_transition(current: str, target: str) -> None:
    if target not in _MEMBER_ALLOWED.get(current, set()):
        raise Conflict(
            f"Illegal member transition: {current} -> {target}",
            details={"from": current, "to": target},
        )
