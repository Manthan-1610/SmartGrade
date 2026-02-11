"""
API routes for grading, submission review, and mark publishing.

Provides endpoints for teacher grading workflow and student results.
"""
import uuid
from typing import List
from fastapi import APIRouter, Depends
from sqlmodel import Session

from ..database import get_session
from ..dependencies import require_teacher, require_student, get_current_user
from ..models import User
from ..schemas.exam import (
    SubmissionResponse,
    SubmissionListResponse,
    GradeAnswerRequest,
    BulkGradeRequest,
    PublishMarksRequest,
    StudentAnswerResponse,
    StudentExamResult,
    SuccessResponse,
)
from ..services import grading as grading_service

router = APIRouter(prefix="/grading", tags=["Grading"])


# ============ Teacher Grading ============

@router.get(
    "/exams/{exam_id}/submissions",
    response_model=List[SubmissionListResponse],
    summary="List exam submissions",
)
async def list_exam_submissions(
    exam_id: uuid.UUID,
    current_user: User = Depends(require_teacher),
    session: Session = Depends(get_session),
) -> List[SubmissionListResponse]:
    """Get all submissions for an exam (teacher view)."""
    return grading_service.get_exam_submissions(exam_id, current_user, session)


@router.get(
    "/submissions/{submission_id}",
    response_model=SubmissionResponse,
    summary="Get submission detail",
)
async def get_submission_detail(
    submission_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> SubmissionResponse:
    """Get full submission with answers and grading."""
    return grading_service.get_submission_detail(submission_id, current_user, session)


@router.put(
    "/answers/{answer_id}",
    response_model=StudentAnswerResponse,
    summary="Grade an answer",
)
async def grade_answer(
    answer_id: uuid.UUID,
    data: GradeAnswerRequest,
    current_user: User = Depends(require_teacher),
    session: Session = Depends(get_session),
) -> StudentAnswerResponse:
    """Grade a single student answer."""
    return grading_service.grade_answer(answer_id, data, current_user, session)


@router.post(
    "/submissions/{submission_id}/bulk-grade",
    response_model=SubmissionResponse,
    summary="Bulk grade a submission",
)
async def bulk_grade(
    submission_id: uuid.UUID,
    data: BulkGradeRequest,
    current_user: User = Depends(require_teacher),
    session: Session = Depends(get_session),
) -> SubmissionResponse:
    """Grade all answers for a submission at once."""
    return grading_service.bulk_grade(submission_id, data.grades, current_user, session)


# ============ Publishing ============

@router.post(
    "/exams/{exam_id}/publish",
    summary="Publish marks",
)
async def publish_marks(
    exam_id: uuid.UUID,
    data: PublishMarksRequest,
    current_user: User = Depends(require_teacher),
    session: Session = Depends(get_session),
) -> dict:
    """Publish or unpublish marks for an exam."""
    return grading_service.publish_marks(exam_id, data, current_user, session)


# ============ Student Results ============

@router.get(
    "/results",
    response_model=List[StudentExamResult],
    summary="My results overview",
)
async def my_results_overview(
    current_user: User = Depends(require_student),
    session: Session = Depends(get_session),
) -> List[StudentExamResult]:
    """Get an overview of all published exam results."""
    return grading_service.get_student_results_overview(current_user, session)


@router.get(
    "/results/{exam_id}",
    response_model=StudentExamResult,
    summary="Get exam result",
)
async def get_exam_result(
    exam_id: uuid.UUID,
    current_user: User = Depends(require_student),
    session: Session = Depends(get_session),
) -> StudentExamResult:
    """Get a student's result for a specific exam."""
    return grading_service.get_student_result(exam_id, current_user, session)
