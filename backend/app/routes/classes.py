"""
API routes for class management, invitations, and enrollments.

Provides endpoints for class CRUD, student invitations, and enrollment lifecycle.
"""
import uuid
from typing import List, Optional
from fastapi import APIRouter, Depends, Query
from sqlmodel import Session

from ..database import get_session
from ..dependencies import require_teacher, require_student, get_current_user
from ..models import User
from ..schemas.classroom import (
    ClassCreate,
    ClassUpdate,
    ClassResponse,
    ClassDetailResponse,
    InviteStudentRequest,
    InvitationResponse,
    InvitationActionRequest,
    EnrollmentResponse,
    EnrollmentStatusUpdate,
)
from ..schemas.exam import SuccessResponse
from ..services import classroom as class_service

router = APIRouter(prefix="/classes", tags=["Classes"])


# ============ Class CRUD ============

@router.post(
    "/",
    response_model=ClassResponse,
    status_code=201,
    summary="Create a class",
)
async def create_class(
    data: ClassCreate,
    current_user: User = Depends(require_teacher),
    session: Session = Depends(get_session),
) -> ClassResponse:
    """Create a new class within an organization."""
    return class_service.create_class(data, current_user, session)


@router.get(
    "/teaching",
    response_model=List[ClassResponse],
    summary="List classes I teach",
)
async def list_teaching_classes(
    org_id: Optional[uuid.UUID] = Query(None, description="Filter by organization"),
    current_user: User = Depends(require_teacher),
    session: Session = Depends(get_session),
) -> List[ClassResponse]:
    """Get all classes taught by the current teacher."""
    return class_service.get_teacher_classes(current_user, org_id, session)


@router.get(
    "/enrolled",
    response_model=List[ClassResponse],
    summary="List classes I'm enrolled in",
)
async def list_enrolled_classes(
    current_user: User = Depends(require_student),
    session: Session = Depends(get_session),
) -> List[ClassResponse]:
    """Get all classes the current student is enrolled in."""
    return class_service.get_student_classes(current_user, session)


@router.get(
    "/{class_id}",
    response_model=ClassDetailResponse,
    summary="Get class details",
)
async def get_class_detail(
    class_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> ClassDetailResponse:
    """Get detailed information about a class."""
    return class_service.get_class_detail(class_id, current_user, session)


@router.put(
    "/{class_id}",
    response_model=ClassResponse,
    summary="Update a class",
)
async def update_class(
    class_id: uuid.UUID,
    data: ClassUpdate,
    current_user: User = Depends(require_teacher),
    session: Session = Depends(get_session),
) -> ClassResponse:
    """Update a class. Only the class teacher or org owner can update."""
    return class_service.update_class(class_id, data, current_user, session)


@router.post(
    "/{class_id}/archive",
    response_model=ClassResponse,
    summary="Archive a class",
)
async def archive_class(
    class_id: uuid.UUID,
    current_user: User = Depends(require_teacher),
    session: Session = Depends(get_session),
) -> ClassResponse:
    """Archive a class (soft delete)."""
    return class_service.archive_class(class_id, current_user, session)


# ============ Invitations (Teacher Side) ============

@router.post(
    "/{class_id}/invitations",
    response_model=InvitationResponse,
    status_code=201,
    summary="Invite a student",
)
async def invite_student(
    class_id: uuid.UUID,
    data: InviteStudentRequest,
    current_user: User = Depends(require_teacher),
    session: Session = Depends(get_session),
) -> InvitationResponse:
    """Invite a student to join a class by email."""
    return class_service.invite_student(class_id, data.email, current_user, session)


@router.get(
    "/{class_id}/invitations",
    response_model=List[InvitationResponse],
    summary="List class invitations",
)
async def list_class_invitations(
    class_id: uuid.UUID,
    status: Optional[str] = Query(None, description="Filter by status"),
    current_user: User = Depends(require_teacher),
    session: Session = Depends(get_session),
) -> List[InvitationResponse]:
    """Get all invitations for a class."""
    return class_service.get_class_invitations(class_id, current_user, session, status)


# ============ Enrollments ============

@router.put(
    "/enrollments/{enrollment_id}",
    response_model=EnrollmentResponse,
    summary="Update enrollment status",
)
async def update_enrollment(
    enrollment_id: uuid.UUID,
    data: EnrollmentStatusUpdate,
    current_user: User = Depends(require_teacher),
    session: Session = Depends(get_session),
) -> EnrollmentResponse:
    """Update enrollment status (e.g., archive a student)."""
    return class_service.update_enrollment_status(enrollment_id, data.status, current_user, session)


@router.delete(
    "/enrollments/{enrollment_id}",
    response_model=SuccessResponse,
    summary="Remove a student from class",
)
async def remove_enrollment(
    enrollment_id: uuid.UUID,
    current_user: User = Depends(require_teacher),
    session: Session = Depends(get_session),
) -> SuccessResponse:
    """Remove a student from a class entirely."""
    class_service.remove_enrollment(enrollment_id, current_user, session)
    return SuccessResponse(message="Student removed from class")


# ============ Student Invitations ============

invitations_router = APIRouter(prefix="/invitations", tags=["Invitations"])


@invitations_router.get(
    "/",
    response_model=List[InvitationResponse],
    summary="List my invitations",
)
async def list_my_invitations(
    status: Optional[str] = Query(None, description="Filter by status"),
    current_user: User = Depends(require_student),
    session: Session = Depends(get_session),
) -> List[InvitationResponse]:
    """Get all invitations received by the current student."""
    return class_service.get_student_invitations(current_user, session, status)


@invitations_router.post(
    "/{invitation_id}/respond",
    response_model=InvitationResponse,
    summary="Respond to an invitation",
)
async def respond_to_invitation(
    invitation_id: uuid.UUID,
    data: InvitationActionRequest,
    current_user: User = Depends(require_student),
    session: Session = Depends(get_session),
) -> InvitationResponse:
    """Accept or reject a class invitation."""
    return class_service.respond_to_invitation(invitation_id, data.action, current_user, session)
