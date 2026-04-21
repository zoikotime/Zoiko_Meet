"""Tenant isolation primitives.

Layer 1 (this module): application-level repository filter. Every query
that hits connect_* tables MUST go through `TenantContext.apply_filter()`
or assert `resource.tenant_id == ctx.tenant_id` post-load.

Layer 2: Postgres RLS policies (see migrations/connect_v3_*.sql).
Layer 3: event bus validation (see connect.events.bus).

A legacy user without an organization membership gets a synthetic
`tenant_id = "personal:{user_id}"` so solo meetings still work; this keeps
the migration path open without forcing every dev to seed an org.
"""
from __future__ import annotations

from dataclasses import dataclass
from typing import Optional

from sqlalchemy.orm import Session

from app.connect.shared.errors import TenantMismatch, Unauthenticated
from app.models.organization import OrganizationMember
from app.models.user import User


@dataclass(frozen=True)
class TenantContext:
    user_id: int
    tenant_id: str
    role: str  # owner | admin | member | personal

    def require(self, resource_tenant_id: str) -> None:
        if resource_tenant_id != self.tenant_id:
            raise TenantMismatch("Resource belongs to a different tenant")


def resolve_tenant(db: Session, user: Optional[User]) -> TenantContext:
    """Resolve the active tenant for a user.

    Uses the first OrganizationMember row for now. Multi-tenant membership
    (user belongs to N orgs) is deferred — requires a tenant-switcher in the
    JWT and a `X-Tenant-Id` header on every request.
    """
    if user is None:
        raise Unauthenticated("No authenticated user")

    mem = (
        db.query(OrganizationMember)
        .filter(OrganizationMember.user_id == user.id)
        .order_by(OrganizationMember.joined_at.asc())
        .first()
    )
    if mem:
        return TenantContext(
            user_id=user.id,
            tenant_id=f"org:{mem.organization_id}",
            role=mem.role,
        )
    return TenantContext(
        user_id=user.id,
        tenant_id=f"personal:{user.id}",
        role="personal",
    )
