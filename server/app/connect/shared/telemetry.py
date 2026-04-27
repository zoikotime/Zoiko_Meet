"""Correlation-ID propagation.

W3C Trace Context (`traceparent`) is the long-term goal; for now we extract
an `X-Correlation-Id` header (or generate one) and stash it in a contextvar
so services can stamp it onto events without threading it through call args.
"""
from __future__ import annotations

from contextvars import ContextVar

from app.connect.shared.ids import uuid7_str

_correlation_id: ContextVar[str | None] = ContextVar("correlation_id", default=None)


def set_correlation_id(value: str | None) -> str:
    cid = value or uuid7_str()
    _correlation_id.set(cid)
    return cid


def get_correlation_id() -> str | None:
    return _correlation_id.get()
