"""
API routes for exam management.

Provides endpoints for exam CRUD, extensions, and exam lifecycle.
"""
import uuid
from typing import List, Optional
from fastapi import APIRouter, Depends, Query
from sqlmodel import Session

from ..database import get_session
from ..dependencies import require_teacher, require_student, get_current_user
from ..models import User
from ..schemas.exam import (
    ExamCreate,
    ExamUpdate,
    ExamResponse,
    ExamListResponse,
    ExamTimeInfo,
    ExamExtensionCreate,
    ExamExtensionResponse,
    FinalizeExamRequest,
    SuccessResponse,
)
from ..services import exam as exam_service

router = APIRouter(prefix="/exams", tags=["Exams"])


# ============ Teacher Exam Management ============

@router.post(
    "/",
    response_model=ExamResponse,
    status_code=201,
    summary="Create an exam",
)
async def create_exam(
    data: ExamCreate,
    current_user: User = Depends(require_teacher),
    session: Session = Depends(get_session),
) -> ExamResponse:
    """Create a new exam within a class."""
    return exam_service.create_exam(data, current_user, session)


@router.post(
    "/finalize",
    response_model=ExamResponse,
    status_code=201,
    summary="Create and finalize an exam",
)
async def finalize_exam(
    data: FinalizeExamRequest,
    current_user: User = Depends(require_teacher),
    session: Session = Depends(get_session),
) -> ExamResponse:
    """Create and finalize an exam with AI rubrics."""
    return exam_service.finalize_exam(data, current_user, session)


@router.get(
    "/teaching",
    response_model=List[ExamListResponse],
    summary="List exams I created",
)
async def list_teacher_exams(
    class_id: Optional[uuid.UUID] = Query(None, description="Filter by class"),
    current_user: User = Depends(require_teacher),
    session: Session = Depends(get_session),
) -> List[ExamListResponse]:
    """Get all exams created by the current teacher."""
    return exam_service.get_teacher_exams(current_user, session, class_id)


@router.get(
    "/student",
    response_model=List[ExamListResponse],
    summary="List my exams as a student",
)
async def list_student_exams(
    class_id: Optional[uuid.UUID] = Query(None, description="Filter by class"),
    current_user: User = Depends(require_student),
    session: Session = Depends(get_session),
) -> List[ExamListResponse]:
    """Get exams from enrolled classes."""
    return exam_service.get_student_exams(current_user, class_id, session)


@router.get(
    "/{exam_id}/time-info",
    response_model=ExamTimeInfo,
    summary="Get exam time info for student",
)
async def get_exam_time_info(
    exam_id: uuid.UUID,
    current_user: User = Depends(require_student),
    session: Session = Depends(get_session),
) -> ExamTimeInfo:
    """
    Get exam timing information including effective deadline.
    
    Checks for student-specific extensions and returns the effective
    deadline for countdown timer display.
    """
    return exam_service.get_exam_time_info(exam_id, current_user, session)


@router.get(
    "/class/{class_id}",
    response_model=List[ExamListResponse],
    summary="List exams for a class",
)
async def list_class_exams(
    class_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> List[ExamListResponse]:
    """Get all exams for a specific class."""
    return exam_service.get_class_exams(class_id, current_user, session)


@router.get(
    "/{exam_id}",
    response_model=ExamResponse,
    summary="Get exam details",
)
async def get_exam(
    exam_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> ExamResponse:
    """Get detailed information about an exam."""
    return exam_service.get_exam_response(exam_id, current_user, session)


@router.put(
    "/{exam_id}",
    response_model=ExamResponse,
    summary="Update an exam",
)
async def update_exam(
    exam_id: uuid.UUID,
    data: ExamUpdate,
    current_user: User = Depends(require_teacher),
    session: Session = Depends(get_session),
) -> ExamResponse:
    """Update an exam. Cannot update if finalized."""
    return exam_service.update_exam(exam_id, data, current_user, session)


@router.delete(
    "/{exam_id}",
    response_model=SuccessResponse,
    summary="Delete an exam",
)
async def delete_exam(
    exam_id: uuid.UUID,
    current_user: User = Depends(require_teacher),
    session: Session = Depends(get_session),
) -> SuccessResponse:
    """Delete a draft exam."""
    exam_service.delete_exam(exam_id, current_user, session)
    return SuccessResponse(message="Exam deleted successfully")


# ============ Extensions ============

@router.post(
    "/{exam_id}/extensions",
    response_model=ExamExtensionResponse,
    status_code=201,
    summary="Grant a student an extension",
)
async def grant_extension(
    exam_id: uuid.UUID,
    data: ExamExtensionCreate,
    current_user: User = Depends(require_teacher),
    session: Session = Depends(get_session),
) -> ExamExtensionResponse:
    """Grant an individual exam time extension to a student."""
    return exam_service.grant_extension(exam_id, data, current_user, session)


@router.get(
    "/{exam_id}/extensions",
    response_model=List[ExamExtensionResponse],
    summary="List exam extensions",
)
async def list_extensions(
    exam_id: uuid.UUID,
    current_user: User = Depends(require_teacher),
    session: Session = Depends(get_session),
) -> List[ExamExtensionResponse]:
    """Get all extensions granted for an exam."""
    return exam_service.get_exam_extensions(exam_id, current_user, session)
