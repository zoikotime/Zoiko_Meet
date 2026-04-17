import json

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select, func
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import get_current_user
from app.core.email import send_email
from app.core.config import get_settings
from app.models.user import User
from app.models.organization import (
    Organization,
    OrganizationMember,
    Notification,
    ORG_ROLE_OWNER,
    ORG_ROLE_ADMIN,
    ORG_ROLE_MEMBER,
    NOTIF_ORG_INVITE,
)
from app.schemas.organization import (
    OrgCreate,
    OrgUpdate,
    OrgOut,
    OrgMemberOut,
    OrgInviteIn,
)

router = APIRouter(prefix="/api/orgs", tags=["organizations"])


def _org_out(org: Organization, db: Session) -> dict:
    count = db.scalar(
        select(func.count()).where(OrganizationMember.organization_id == org.id)
    )
    return {
        "id": org.id,
        "name": org.name,
        "slug": org.slug,
        "owner_id": org.owner_id,
        "logo_url": org.logo_url,
        "created_at": org.created_at,
        "member_count": count or 0,
    }


def _require_admin(org: Organization, user: User, db: Session) -> None:
    if org.owner_id == user.id:
        return
    member = db.scalar(
        select(OrganizationMember).where(
            OrganizationMember.organization_id == org.id,
            OrganizationMember.user_id == user.id,
            OrganizationMember.role.in_([ORG_ROLE_OWNER, ORG_ROLE_ADMIN]),
        )
    )
    if not member:
        raise HTTPException(status_code=403, detail="Admin access required")


# ── CRUD ──────────────────────────────────────────────────────────────────

@router.post("", response_model=OrgOut, status_code=201)
def create_org(
    data: OrgCreate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    existing = db.scalar(select(Organization).where(Organization.slug == data.slug))
    if existing:
        raise HTTPException(status_code=409, detail="Organization slug already taken")

    org = Organization(name=data.name, slug=data.slug, owner_id=user.id)
    db.add(org)
    db.flush()

    # Auto-add creator as owner member
    member = OrganizationMember(
        organization_id=org.id, user_id=user.id, role=ORG_ROLE_OWNER
    )
    db.add(member)
    db.commit()
    db.refresh(org)
    return _org_out(org, db)


@router.get("", response_model=list[OrgOut])
def list_orgs(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    stmt = (
        select(Organization)
        .join(OrganizationMember, OrganizationMember.organization_id == Organization.id)
        .where(OrganizationMember.user_id == user.id)
        .order_by(Organization.name)
    )
    return [_org_out(o, db) for o in db.scalars(stmt).all()]


@router.get("/{slug}", response_model=OrgOut)
def get_org(
    slug: str,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    org = db.scalar(select(Organization).where(Organization.slug == slug))
    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")
    # Must be a member
    is_member = db.scalar(
        select(OrganizationMember).where(
            OrganizationMember.organization_id == org.id,
            OrganizationMember.user_id == user.id,
        )
    )
    if not is_member:
        raise HTTPException(status_code=403, detail="You are not a member")
    return _org_out(org, db)


@router.patch("/{slug}", response_model=OrgOut)
def update_org(
    slug: str,
    data: OrgUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    org = db.scalar(select(Organization).where(Organization.slug == slug))
    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")
    _require_admin(org, user, db)

    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(org, field, value)
    db.commit()
    db.refresh(org)
    return _org_out(org, db)


@router.delete("/{slug}", status_code=204)
def delete_org(
    slug: str,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    org = db.scalar(select(Organization).where(Organization.slug == slug))
    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")
    if org.owner_id != user.id:
        raise HTTPException(status_code=403, detail="Only the owner can delete the organization")
    db.delete(org)
    db.commit()


# ── Members ───────────────────────────────────────────────────────────────

@router.get("/{slug}/members", response_model=list[OrgMemberOut])
def list_members(
    slug: str,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    org = db.scalar(select(Organization).where(Organization.slug == slug))
    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")

    members = db.scalars(
        select(OrganizationMember).where(OrganizationMember.organization_id == org.id)
    ).all()

    result = []
    for m in members:
        u = db.get(User, m.user_id)
        result.append({
            "id": m.id,
            "user_id": m.user_id,
            "role": m.role,
            "joined_at": m.joined_at,
            "user_name": u.name if u else None,
            "user_email": u.email if u else None,
            "avatar_color": u.avatar_color if u else None,
        })
    return result


@router.post("/{slug}/invite", status_code=201)
def invite_member(
    slug: str,
    data: OrgInviteIn,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    org = db.scalar(select(Organization).where(Organization.slug == slug))
    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")
    _require_admin(org, user, db)

    invitee = db.scalar(select(User).where(User.email == data.email))
    if not invitee:
        # Send external invite email
        settings = get_settings()
        send_email(
            data.email,
            f"You've been invited to {org.name} on Zoiko Meet",
            f'<p>{user.name} invited you to join <strong>{org.name}</strong> on Zoiko Meet.</p>'
            f'<p><a href="{settings.frontend_url}/register">Sign up to join</a></p>',
        )
        return {"detail": "Invite email sent", "email": data.email}

    # Check if already a member
    existing = db.scalar(
        select(OrganizationMember).where(
            OrganizationMember.organization_id == org.id,
            OrganizationMember.user_id == invitee.id,
        )
    )
    if existing:
        raise HTTPException(status_code=409, detail="User is already a member")

    member = OrganizationMember(
        organization_id=org.id, user_id=invitee.id, role=data.role
    )
    db.add(member)

    # Create in-app notification
    notif = Notification(
        user_id=invitee.id,
        type=NOTIF_ORG_INVITE,
        title=f"You've been added to {org.name}",
        body=f"{user.name} added you to the organization {org.name}.",
        data=json.dumps({"org_slug": org.slug, "org_name": org.name}),
    )
    db.add(notif)
    db.commit()

    return {"detail": "Member added", "user_id": invitee.id}


@router.delete("/{slug}/members/{user_id}", status_code=204)
def remove_member(
    slug: str,
    user_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    org = db.scalar(select(Organization).where(Organization.slug == slug))
    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")

    if user_id == org.owner_id:
        raise HTTPException(status_code=403, detail="Cannot remove the owner")

    # Allow self-removal or admin removal
    if user_id != user.id:
        _require_admin(org, user, db)

    member = db.scalar(
        select(OrganizationMember).where(
            OrganizationMember.organization_id == org.id,
            OrganizationMember.user_id == user_id,
        )
    )
    if not member:
        raise HTTPException(status_code=404, detail="Member not found")

    db.delete(member)
    db.commit()
