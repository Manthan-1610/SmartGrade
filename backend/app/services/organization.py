"""
Service layer for organization management.

Handles CRUD operations for organizations and their members.
"""
import uuid
from datetime import datetime
from typing import List, Optional
import logging

from sqlmodel import Session, select, func
from sqlalchemy import and_

from ..models import (
    Organization,
    OrganizationMember,
    OrganizationRole,
    User,
    UserRole,
    Class,
)
from ..schemas.organization import (
    OrganizationCreate,
    OrganizationUpdate,
    OrganizationResponse,
    OrganizationDetailResponse,
    OrganizationMemberResponse,
)
from ..exceptions import (
    NotFoundException,
    AuthorizationException,
    ValidationException,
)

logger = logging.getLogger(__name__)


def create_organization(
    data: OrganizationCreate,
    owner: User,
    session: Session,
) -> Organization:
    """
    Create a new organization. The owner is automatically added as a member.
    
    Args:
        data: Organization creation data.
        owner: The user creating the organization.
        session: Database session.
        
    Returns:
        Created organization.
        
    Raises:
        AuthorizationException: If user is not a teacher.
    """
    if owner.role != UserRole.TEACHER.value:
        raise AuthorizationException("Only teachers can create organizations")

    org = Organization(
        name=data.name,
        description=data.description,
        owner_id=owner.id,
    )
    session.add(org)
    session.flush()

    # Add the owner as a member with the "owner" role
    member = OrganizationMember(
        organization_id=org.id,
        user_id=owner.id,
        role=OrganizationRole.OWNER.value,
    )
    session.add(member)
    session.flush()
    session.refresh(org)

    logger.info(f"Organization '{org.name}' created by user {owner.id}")
    return org


def get_organization(
    org_id: uuid.UUID,
    session: Session,
) -> Organization:
    """Get an organization by ID."""
    org = session.get(Organization, org_id)
    if not org or not org.is_active:
        raise NotFoundException(f"Organization {org_id} not found")
    return org


def get_user_organizations(
    user: User,
    session: Session,
) -> List[OrganizationDetailResponse]:
    """Get all organizations the user belongs to (as owner or member)."""
    stmt = (
        select(Organization, OrganizationMember)
        .join(OrganizationMember, Organization.id == OrganizationMember.organization_id)
        .where(
            and_(
                OrganizationMember.user_id == user.id,
                Organization.is_active == True,
            )
        )
        .order_by(Organization.created_at.desc())
    )
    results = session.exec(stmt).all()

    orgs = []
    for org, membership in results:
        # Count members
        member_count = session.exec(
            select(func.count(OrganizationMember.id))
            .where(OrganizationMember.organization_id == org.id)
        ).one()
        # Count classes
        class_count = session.exec(
            select(func.count(Class.id))
            .where(and_(Class.organization_id == org.id, Class.is_archived == False))
        ).one()

        orgs.append(OrganizationDetailResponse(
            id=org.id,
            name=org.name,
            description=org.description,
            owner_id=org.owner_id,
            is_active=org.is_active,
            created_at=org.created_at,
            updated_at=org.updated_at,
            member_count=member_count,
            class_count=class_count,
            owner_name=org.owner.name if org.owner else None,
        ))

    return orgs


def update_organization(
    org_id: uuid.UUID,
    data: OrganizationUpdate,
    user: User,
    session: Session,
) -> Organization:
    """Update an organization. Only the owner can update."""
    org = get_organization(org_id, session)
    _verify_org_owner(org, user)

    if data.name is not None:
        org.name = data.name
    if data.description is not None:
        org.description = data.description
    org.updated_at = datetime.utcnow()

    session.add(org)
    session.flush()
    session.refresh(org)
    return org


def delete_organization(
    org_id: uuid.UUID,
    user: User,
    session: Session,
) -> None:
    """Soft-delete an organization (sets is_active=False). Only the owner can delete."""
    org = get_organization(org_id, session)
    _verify_org_owner(org, user)

    org.is_active = False
    org.updated_at = datetime.utcnow()
    session.add(org)
    session.flush()
    logger.info(f"Organization '{org.name}' deactivated by user {user.id}")


def add_member(
    org_id: uuid.UUID,
    email: str,
    role: str,
    current_user: User,
    session: Session,
) -> OrganizationMemberResponse:
    """Add a teacher to an organization."""
    org = get_organization(org_id, session)
    _verify_org_owner(org, current_user)

    # Find the user
    target_user = session.exec(
        select(User).where(User.email == email)
    ).first()
    if not target_user:
        raise NotFoundException(f"No user found with email '{email}'")
    if target_user.role != UserRole.TEACHER.value:
        raise ValidationException("Only teachers can be added as organization members")

    # Check if already a member
    existing = session.exec(
        select(OrganizationMember).where(
            and_(
                OrganizationMember.organization_id == org_id,
                OrganizationMember.user_id == target_user.id,
            )
        )
    ).first()
    if existing:
        raise ValidationException(f"User '{email}' is already a member of this organization")

    member = OrganizationMember(
        organization_id=org_id,
        user_id=target_user.id,
        role=role,
    )
    session.add(member)
    session.flush()

    return OrganizationMemberResponse(
        id=member.id,
        user_id=target_user.id,
        user_name=target_user.name,
        user_email=target_user.email,
        role=member.role,
        created_at=member.created_at,
    )


def get_org_members(
    org_id: uuid.UUID,
    user: User,
    session: Session,
) -> List[OrganizationMemberResponse]:
    """Get all members of an organization."""
    org = get_organization(org_id, session)
    _verify_org_member(org_id, user, session)

    stmt = (
        select(OrganizationMember, User)
        .join(User, OrganizationMember.user_id == User.id)
        .where(OrganizationMember.organization_id == org_id)
        .order_by(OrganizationMember.created_at)
    )
    results = session.exec(stmt).all()

    return [
        OrganizationMemberResponse(
            id=m.id,
            user_id=u.id,
            user_name=u.name,
            user_email=u.email,
            role=m.role,
            created_at=m.created_at,
        )
        for m, u in results
    ]


def remove_member(
    org_id: uuid.UUID,
    member_id: uuid.UUID,
    current_user: User,
    session: Session,
) -> None:
    """Remove a member from an organization. Only the owner can remove."""
    org = get_organization(org_id, session)
    _verify_org_owner(org, current_user)

    member = session.get(OrganizationMember, member_id)
    if not member or member.organization_id != org_id:
        raise NotFoundException("Member not found in this organization")
    if member.role == OrganizationRole.OWNER.value:
        raise ValidationException("Cannot remove the owner from the organization")

    session.delete(member)
    session.flush()


# ============ Helpers ============

def _verify_org_owner(org: Organization, user: User) -> None:
    """Verify user is the org owner."""
    if org.owner_id != user.id:
        raise AuthorizationException("Only the organization owner can perform this action")


def _verify_org_member(org_id: uuid.UUID, user: User, session: Session) -> OrganizationMember:
    """Verify user is an org member and return membership."""
    member = session.exec(
        select(OrganizationMember).where(
            and_(
                OrganizationMember.organization_id == org_id,
                OrganizationMember.user_id == user.id,
            )
        )
    ).first()
    if not member:
        raise AuthorizationException("You are not a member of this organization")
    return member


def verify_org_teacher(org_id: uuid.UUID, user: User, session: Session) -> OrganizationMember:
    """Verify user is a teacher/owner in the org. Public helper used by other services."""
    member = _verify_org_member(org_id, user, session)
    return member
