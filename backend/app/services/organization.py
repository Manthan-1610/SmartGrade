"""
Service layer for organization management.

Each teacher has exactly one organization, created automatically during signup.
This service provides read and update operations for the teacher's organization.
"""
import uuid
from datetime import datetime
from typing import Optional
import logging

from sqlmodel import Session, select, func
from sqlalchemy import and_

from ..models import Organization, User, Class
from ..schemas.organization import (
    OrganizationUpdate,
    OrganizationDetailResponse,
)
from ..exceptions import NotFoundException, AuthorizationException

logger = logging.getLogger(__name__)


def get_teacher_organization(
    teacher: User,
    session: Session,
) -> OrganizationDetailResponse:
    """
    Get the teacher's organization with class count.
    
    Each teacher has exactly one organization created during signup.
    
    Args:
        teacher: The authenticated teacher.
        session: Database session.
        
    Returns:
        Organization details with class count.
        
    Raises:
        NotFoundException: If teacher has no organization (shouldn't happen).
    """
    org = session.exec(
        select(Organization).where(
            and_(
                Organization.owner_id == teacher.id,
                Organization.is_active == True,
            )
        )
    ).first()
    
    if not org:
        raise NotFoundException(
            "Organization not found. Please contact support."
        )
    
    class_count = session.exec(
        select(func.count(Class.id)).where(
            and_(
                Class.organization_id == org.id,
                Class.is_archived == False,
            )
        )
    ).one()
    
    return OrganizationDetailResponse(
        id=org.id,
        name=org.name,
        description=org.description,
        owner_id=org.owner_id,
        is_active=org.is_active,
        created_at=org.created_at,
        updated_at=org.updated_at,
        class_count=class_count,
        owner_name=teacher.name,
    )


def update_teacher_organization(
    data: OrganizationUpdate,
    teacher: User,
    session: Session,
) -> Organization:
    """
    Update the teacher's organization.
    
    Args:
        data: Update data (name and/or description).
        teacher: The authenticated teacher.
        session: Database session.
        
    Returns:
        Updated organization.
        
    Raises:
        NotFoundException: If teacher has no organization.
    """
    org = session.exec(
        select(Organization).where(
            and_(
                Organization.owner_id == teacher.id,
                Organization.is_active == True,
            )
        )
    ).first()
    
    if not org:
        raise NotFoundException(
            "Organization not found. Please contact support."
        )
    
    if data.name is not None:
        org.name = data.name
        # Keep user's organization_name in sync
        teacher.organization_name = data.name
        session.add(teacher)
        
    if data.description is not None:
        org.description = data.description
        
    org.updated_at = datetime.utcnow()
    session.add(org)
    session.flush()
    session.refresh(org)
    
    logger.info(f"Organization '{org.name}' updated by teacher {teacher.id}")
    return org


def get_organization_by_id(
    org_id: uuid.UUID,
    session: Session,
) -> Organization:
    """
    Get an organization by ID.
    
    Internal helper for other services.
    
    Args:
        org_id: Organization UUID.
        session: Database session.
        
    Returns:
        Organization instance.
        
    Raises:
        NotFoundException: If organization doesn't exist or is inactive.
    """
    org = session.get(Organization, org_id)
    if not org or not org.is_active:
        raise NotFoundException(f"Organization not found")
    return org


def verify_org_owner(
    org_id: uuid.UUID,
    user: User,
    session: Session,
) -> Organization:
    """
    Verify the user owns the organization.
    
    Args:
        org_id: Organization UUID to verify.
        user: User to verify ownership.
        session: Database session.
        
    Returns:
        Organization if user is the owner.
        
    Raises:
        NotFoundException: If organization doesn't exist.
        AuthorizationException: If user is not the owner.
    """
    org = get_organization_by_id(org_id, session)
    
    if org.owner_id != user.id:
        raise AuthorizationException(
            "You don't have permission to access this organization"
        )
    
    return org


def get_teacher_org_id(
    teacher: User,
    session: Session,
) -> uuid.UUID:
    """
    Get the teacher's organization ID.
    
    Convenience function for other services that need the org ID.
    
    Args:
        teacher: The authenticated teacher.
        session: Database session.
        
    Returns:
        Organization UUID.
        
    Raises:
        NotFoundException: If teacher has no organization.
    """
    org = session.exec(
        select(Organization).where(
            and_(
                Organization.owner_id == teacher.id,
                Organization.is_active == True,
            )
        )
    ).first()
    
    if not org:
        raise NotFoundException(
            "Organization not found. Please contact support."
        )
    
    return org.id
