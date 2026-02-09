"""
Exam management endpoints.

Provides CRUD operations for exam templates including questions and AI rubrics.
"""
from typing import List
from uuid import UUID
from fastapi import APIRouter, Depends, status
from sqlmodel import Session, select

from ..database import get_session
from ..models import Exam, Question
from ..schemas import (
    ExamResponse,
    ExamListResponse,
    FinalizeExamRequest,
    QuestionResponse,
    SuccessResponse
)
from ..exceptions import NotFoundException, ValidationException
from ..logging_config import get_logger

router = APIRouter()
logger = get_logger(__name__)


def _build_exam_response(exam: Exam) -> ExamResponse:
    """Build standardized exam response from model."""
    return ExamResponse(
        id=exam.id,
        title=exam.title,
        subject=exam.subject,
        total_marks=exam.total_marks,
        is_finalized=exam.is_finalized,
        created_at=exam.created_at,
        updated_at=exam.updated_at,
        questions=[
            QuestionResponse(
                id=q.id,
                question_number=q.question_number,
                text=q.text,
                max_marks=q.max_marks,
                ideal_answer=q.ideal_answer,
                ai_rubric=q.ai_rubric
            )
            for q in sorted(exam.questions, key=lambda x: x.question_number)
        ]
    )


@router.get(
    "/exams",
    response_model=List[ExamListResponse],
    summary="List all exams",
    description="Retrieve a list of all exams with basic information and question count."
)
async def list_exams(
    session: Session = Depends(get_session),
    finalized_only: bool = False
) -> List[ExamListResponse]:
    """
    List all exams with basic info.
    
    Args:
        session: Database session (injected).
        finalized_only: If True, only return finalized exams.
        
    Returns:
        List of exams with question counts.
    """
    statement = select(Exam).order_by(Exam.created_at.desc())
    
    if finalized_only:
        statement = statement.where(Exam.is_finalized == True)
    
    exams = session.exec(statement).all()
    
    logger.debug(f"Retrieved {len(exams)} exams")
    
    return [
        ExamListResponse(
            id=exam.id,
            title=exam.title,
            subject=exam.subject,
            total_marks=exam.total_marks,
            is_finalized=exam.is_finalized,
            created_at=exam.created_at,
            question_count=len(exam.questions)
        )
        for exam in exams
    ]


@router.get(
    "/exams/{exam_id}",
    response_model=ExamResponse,
    summary="Get exam details",
    description="Retrieve a single exam with all questions and rubrics."
)
async def get_exam(
    exam_id: UUID,
    session: Session = Depends(get_session)
) -> ExamResponse:
    """
    Get a single exam with all questions.
    
    Args:
        exam_id: Unique identifier of the exam.
        session: Database session (injected).
        
    Returns:
        Complete exam data with questions.
        
    Raises:
        NotFoundException: If exam doesn't exist.
    """
    statement = select(Exam).where(Exam.id == exam_id)
    exam = session.exec(statement).first()
    
    if not exam:
        logger.warning(f"Exam not found: {exam_id}")
        raise NotFoundException("Exam", exam_id)
    
    logger.debug(f"Retrieved exam: {exam.title}")
    return _build_exam_response(exam)


@router.post(
    "/exams",
    response_model=ExamResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create and finalize exam",
    description="Create a new exam with questions and AI-generated rubrics."
)
async def create_exam(
    request: FinalizeExamRequest,
    session: Session = Depends(get_session)
) -> ExamResponse:
    """
    Create and finalize a new exam.
    
    This endpoint is called after the teacher has reviewed and approved
    the AI-generated rubric. The exam is immediately marked as finalized.
    
    Args:
        request: Exam creation request with questions and rubrics.
        session: Database session (injected).
        
    Returns:
        Created exam data.
        
    Raises:
        ValidationException: If validation fails.
    """
    # Validation
    if not request.questions:
        raise ValidationException(
            "At least one question is required",
            detail="Exam must contain at least one question"
        )
    
    if not request.title.strip():
        raise ValidationException("Exam title cannot be empty")
    
    if not request.subject.strip():
        raise ValidationException("Subject cannot be empty")
    
    # Calculate total marks
    total_marks = sum(q.max_marks for q in request.questions)
    
    logger.info(f"Creating exam: {request.title} ({total_marks} marks)")
    
    # Create exam
    exam = Exam(
        title=request.title.strip(),
        subject=request.subject.strip(),
        total_marks=total_marks,
        is_finalized=True
    )
    session.add(exam)
    session.flush()
    
    # Create questions with AI rubrics
    ai_rubrics_map = {r.question_number: r for r in request.ai_rubrics}
    
    for q in request.questions:
        ai_rubric = ai_rubrics_map.get(q.question_number)
        rubric_text = None
        
        if ai_rubric:
            rubric_text = (
                f"Key concepts: {', '.join(ai_rubric.key_concepts)}. "
                f"{ai_rubric.grading_criteria}"
            )
        
        question = Question(
            exam_id=exam.id,
            question_number=q.question_number,
            text=q.text.strip(),
            max_marks=q.max_marks,
            ideal_answer=q.ideal_answer.strip(),
            ai_rubric=rubric_text
        )
        session.add(question)
    
    session.commit()
    session.refresh(exam)
    
    logger.info(f"Created exam {exam.id} with {len(request.questions)} questions")
    
    return _build_exam_response(exam)


@router.delete(
    "/exams/{exam_id}",
    response_model=SuccessResponse,
    summary="Delete exam",
    description="Delete an exam and all associated questions."
)
async def delete_exam(
    exam_id: UUID,
    session: Session = Depends(get_session)
) -> SuccessResponse:
    """
    Delete an exam and all its questions.
    
    Args:
        exam_id: Unique identifier of the exam.
        session: Database session (injected).
        
    Returns:
        Success confirmation message.
        
    Raises:
        NotFoundException: If exam doesn't exist.
    """
    statement = select(Exam).where(Exam.id == exam_id)
    exam = session.exec(statement).first()
    
    if not exam:
        raise NotFoundException("Exam", exam_id)
    
    exam_title = exam.title
    session.delete(exam)
    session.commit()
    
    logger.info(f"Deleted exam: {exam_title} ({exam_id})")
    
    return SuccessResponse(message="Exam deleted successfully")
