"""
API routes for organization management.

Each teacher has exactly one organization, created automatically during signup.
These endpoints allow the teacher to view and update their organization details.
"""
from fastapi import APIRouter, Depends
from sqlmodel import Session

from ..database import get_session
from ..dependencies import require_teacher
from ..models import User
from ..schemas.organization import (
    OrganizationUpdate,
    OrganizationResponse,
    OrganizationDetailResponse,
)
from ..services import organization as org_service

router = APIRouter(prefix="/organizations", tags=["Organizations"])


@router.get(
    "/me",
    response_model=OrganizationDetailResponse,
    summary="Get my organization",
    description="Get the current teacher's organization details.",
)
async def get_my_organization(
    current_user: User = Depends(require_teacher),
    session: Session = Depends(get_session),
) -> OrganizationDetailResponse:
    """
    Get the current teacher's organization.
    
    Every teacher has exactly one organization, created during signup.
    """
    return org_service.get_teacher_organization(current_user, session)


@router.put(
    "/me",
    response_model=OrganizationResponse,
    summary="Update my organization",
    description="Update the current teacher's organization name or description.",
)
async def update_my_organization(
    data: OrganizationUpdate,
    current_user: User = Depends(require_teacher),
    session: Session = Depends(get_session),
) -> OrganizationResponse:
    """
    Update the current teacher's organization.
    
    Allows updating the organization name and description.
    """
    org = org_service.update_teacher_organization(data, current_user, session)
    return OrganizationResponse.model_validate(org)
