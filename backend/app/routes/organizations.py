"""
API routes for organization management.

Provides endpoints for CRUD operations on organizations
and their member management.
"""
import uuid
from typing import List
from fastapi import APIRouter, Depends
from sqlmodel import Session

from ..database import get_session
from ..dependencies import require_teacher
from ..models import User
from ..schemas.organization import (
    OrganizationCreate,
    OrganizationUpdate,
    OrganizationResponse,
    OrganizationDetailResponse,
    OrganizationMemberResponse,
    AddMemberRequest,
)
from ..schemas.exam import SuccessResponse
from ..services import organization as org_service

router = APIRouter(prefix="/organizations", tags=["Organizations"])


@router.post(
    "/",
    response_model=OrganizationResponse,
    status_code=201,
    summary="Create an organization",
)
async def create_organization(
    data: OrganizationCreate,
    current_user: User = Depends(require_teacher),
    session: Session = Depends(get_session),
) -> OrganizationResponse:
    """Create a new organization. Only teachers can create organizations."""
    org = org_service.create_organization(data, current_user, session)
    return OrganizationResponse.model_validate(org)


@router.get(
    "/",
    response_model=List[OrganizationDetailResponse],
    summary="List my organizations",
)
async def list_organizations(
    current_user: User = Depends(require_teacher),
    session: Session = Depends(get_session),
) -> List[OrganizationDetailResponse]:
    """Get all organizations the current user belongs to."""
    return org_service.get_user_organizations(current_user, session)


@router.get(
    "/{org_id}",
    response_model=OrganizationDetailResponse,
    summary="Get organization details",
)
async def get_organization(
    org_id: uuid.UUID,
    current_user: User = Depends(require_teacher),
    session: Session = Depends(get_session),
) -> OrganizationDetailResponse:
    """Get details of a specific organization."""
    orgs = org_service.get_user_organizations(current_user, session)
    for org in orgs:
        if org.id == org_id:
            return org
    from ..exceptions import NotFoundException
    raise NotFoundException("Organization not found or you don't have access")


@router.put(
    "/{org_id}",
    response_model=OrganizationResponse,
    summary="Update organization",
)
async def update_organization(
    org_id: uuid.UUID,
    data: OrganizationUpdate,
    current_user: User = Depends(require_teacher),
    session: Session = Depends(get_session),
) -> OrganizationResponse:
    """Update an organization. Only the owner can update."""
    org = org_service.update_organization(org_id, data, current_user, session)
    return OrganizationResponse.model_validate(org)


@router.delete(
    "/{org_id}",
    response_model=SuccessResponse,
    summary="Delete organization",
)
async def delete_organization(
    org_id: uuid.UUID,
    current_user: User = Depends(require_teacher),
    session: Session = Depends(get_session),
) -> SuccessResponse:
    """Deactivate an organization. Only the owner can delete."""
    org_service.delete_organization(org_id, current_user, session)
    return SuccessResponse(message="Organization deactivated successfully")


# ============ Member Management ============

@router.get(
    "/{org_id}/members",
    response_model=List[OrganizationMemberResponse],
    summary="List organization members",
)
async def list_members(
    org_id: uuid.UUID,
    current_user: User = Depends(require_teacher),
    session: Session = Depends(get_session),
) -> List[OrganizationMemberResponse]:
    """Get all members of an organization."""
    return org_service.get_org_members(org_id, current_user, session)


@router.post(
    "/{org_id}/members",
    response_model=OrganizationMemberResponse,
    status_code=201,
    summary="Add a member",
)
async def add_member(
    org_id: uuid.UUID,
    data: AddMemberRequest,
    current_user: User = Depends(require_teacher),
    session: Session = Depends(get_session),
) -> OrganizationMemberResponse:
    """Add a teacher as a member of the organization. Only the owner can add members."""
    return org_service.add_member(org_id, data.email, data.role, current_user, session)


@router.delete(
    "/{org_id}/members/{member_id}",
    response_model=SuccessResponse,
    summary="Remove a member",
)
async def remove_member(
    org_id: uuid.UUID,
    member_id: uuid.UUID,
    current_user: User = Depends(require_teacher),
    session: Session = Depends(get_session),
) -> SuccessResponse:
    """Remove a member from the organization. Only the owner can remove."""
    org_service.remove_member(org_id, member_id, current_user, session)
    return SuccessResponse(message="Member removed successfully")
