"""Domain exceptions — translated to HTTP by the router layer.

Services raise these; API code maps them to status codes. Keeps services
HTTP-agnostic so they can be invoked from WS, background jobs, or tests.
"""


class DomainError(Exception):
    status_code: int = 500
    code: str = "internal_error"

    def __init__(self, message: str, *, details: dict | None = None):
        super().__init__(message)
        self.message = message
        self.details = details or {}


class NotFound(DomainError):
    status_code = 404
    code = "not_found"


class Forbidden(DomainError):
    status_code = 403
    code = "forbidden"


class Conflict(DomainError):
    status_code = 409
    code = "conflict"


class Invalid(DomainError):
    status_code = 400
    code = "invalid_argument"


class Unauthenticated(DomainError):
    status_code = 401
    code = "unauthenticated"


class TenantMismatch(Forbidden):
    code = "tenant_mismatch"
