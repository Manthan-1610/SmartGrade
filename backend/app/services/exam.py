"""
Service layer for exam management.

Handles exam CRUD, extensions, and exam lifecycle transitions.
"""
import uuid
from datetime import datetime
from typing import List, Optional
import logging

from sqlmodel import Session, select, func
from sqlalchemy import and_

from ..models import (
    Exam,
    Question,
    ExamExtension,
    ExamStatus,
    Class,
    Submission,
    User,
    ClassEnrollment,
    EnrollmentStatus,
)
from ..schemas.exam import (
    ExamCreate,
    ExamUpdate,
    ExamResponse,
    ExamListResponse,
    QuestionResponse,
    ExamExtensionCreate,
    ExamExtensionResponse,
    FinalizeExamRequest,
    AIQuestionRubric,
)
from ..exceptions import (
    NotFoundException,
    AuthorizationException,
    ValidationException,
)
from .classroom import _verify_class_teacher, get_class

logger = logging.getLogger(__name__)


# ============ Exam CRUD ============

def create_exam(
    data: ExamCreate,
    teacher: User,
    session: Session,
) -> ExamResponse:
    """Create a new exam within a class."""
    cls = get_class(data.class_id, session)
    _verify_class_teacher(cls, teacher, session)

    total_marks = sum(q.max_marks for q in data.questions)

    exam = Exam(
        class_id=data.class_id,
        title=data.title,
        subject=data.subject,
        total_marks=total_marks,
        start_time=data.start_time,
        end_time=data.end_time,
        grace_period_minutes=data.grace_period_minutes,
        status=ExamStatus.DRAFT.value,
        created_by=teacher.id,
    )
    session.add(exam)
    session.flush()

    # Create questions
    for idx, q_data in enumerate(data.questions):
        question = Question(
            exam_id=exam.id,
            question_number=q_data.question_number,
            text=q_data.text,
            max_marks=q_data.max_marks,
            ideal_answer=q_data.ideal_answer,
            evaluation_rubric=q_data.evaluation_rubric,
            order=q_data.order if q_data.order else idx,
        )
        session.add(question)

    session.flush()
    session.refresh(exam)

    logger.info(f"Exam '{exam.title}' created for class {data.class_id} by teacher {teacher.id}")
    return _exam_to_response(exam, session)


def finalize_exam(
    data: FinalizeExamRequest,
    teacher: User,
    session: Session,
) -> ExamResponse:
    """Create and finalize an exam with AI rubrics baked in."""
    cls = get_class(data.class_id, session)
    _verify_class_teacher(cls, teacher, session)

    total_marks = sum(q.max_marks for q in data.questions)

    exam = Exam(
        class_id=data.class_id,
        title=data.title,
        subject=data.subject,
        total_marks=total_marks,
        start_time=data.start_time,
        end_time=data.end_time,
        grace_period_minutes=data.grace_period_minutes,
        is_finalized=True,
        status=ExamStatus.SCHEDULED.value if data.start_time else ExamStatus.DRAFT.value,
        created_by=teacher.id,
    )
    session.add(exam)
    session.flush()

    # Map AI rubrics by question_number
    rubric_map = {r.question_number: r for r in data.ai_rubrics}

    for idx, q_data in enumerate(data.questions):
        rubric = rubric_map.get(q_data.question_number)
        question = Question(
            exam_id=exam.id,
            question_number=q_data.question_number,
            text=q_data.text,
            max_marks=q_data.max_marks,
            ideal_answer=q_data.ideal_answer,
            evaluation_rubric=q_data.evaluation_rubric,
            ai_rubric=rubric.grading_criteria if rubric else None,
            order=q_data.order if q_data.order else idx,
        )
        session.add(question)

    session.flush()
    session.refresh(exam)
    logger.info(f"Exam '{exam.title}' finalized for class {data.class_id}")
    return _exam_to_response(exam, session)


def get_exam(
    exam_id: uuid.UUID,
    session: Session,
) -> Exam:
    """Get an exam by ID."""
    exam = session.get(Exam, exam_id)
    if not exam:
        raise NotFoundException(f"Exam {exam_id} not found")
    return exam


def get_exam_response(
    exam_id: uuid.UUID,
    user: User,
    session: Session,
) -> ExamResponse:
    """Get full exam details. Teachers get everything; students get limited view."""
    exam = get_exam(exam_id, session)
    return _exam_to_response(exam, session)


def get_class_exams(
    class_id: uuid.UUID,
    user: User,
    session: Session,
) -> List[ExamListResponse]:
    """Get all exams for a class."""
    cls = get_class(class_id, session)

    stmt = (
        select(Exam)
        .where(Exam.class_id == class_id)
        .order_by(Exam.created_at.desc())
    )
    exams = session.exec(stmt).all()

    results = []
    for exam in exams:
        q_count = session.exec(
            select(func.count(Question.id)).where(Question.exam_id == exam.id)
        ).one()
        s_count = session.exec(
            select(func.count(Submission.id)).where(Submission.exam_id == exam.id)
        ).one()
        results.append(ExamListResponse(
            id=exam.id,
            title=exam.title,
            subject=exam.subject,
            class_id=exam.class_id,
            class_name=cls.name,
            total_marks=exam.total_marks,
            is_finalized=exam.is_finalized,
            status=exam.status,
            start_time=exam.start_time,
            end_time=exam.end_time,
            is_published=exam.is_published,
            created_at=exam.created_at,
            question_count=q_count,
            submission_count=s_count,
        ))

    return results


def get_teacher_exams(
    teacher: User,
    session: Session,
    class_id: Optional[uuid.UUID] = None,
) -> List[ExamListResponse]:
    """Get all exams created by a teacher, optionally filtered by class."""
    stmt = select(Exam).where(Exam.created_by == teacher.id)
    if class_id:
        stmt = stmt.where(Exam.class_id == class_id)
    stmt = stmt.order_by(Exam.created_at.desc())
    exams = session.exec(stmt).all()

    results = []
    for exam in exams:
        cls = session.get(Class, exam.class_id)
        q_count = session.exec(
            select(func.count(Question.id)).where(Question.exam_id == exam.id)
        ).one()
        s_count = session.exec(
            select(func.count(Submission.id)).where(Submission.exam_id == exam.id)
        ).one()
        results.append(ExamListResponse(
            id=exam.id,
            title=exam.title,
            subject=exam.subject,
            class_id=exam.class_id,
            class_name=cls.name if cls else None,
            total_marks=exam.total_marks,
            is_finalized=exam.is_finalized,
            status=exam.status,
            start_time=exam.start_time,
            end_time=exam.end_time,
            is_published=exam.is_published,
            created_at=exam.created_at,
            question_count=q_count,
            submission_count=s_count,
        ))

    return results


def update_exam(
    exam_id: uuid.UUID,
    data: ExamUpdate,
    teacher: User,
    session: Session,
) -> ExamResponse:
    """Update an exam. Cannot update if finalized (unless unlocked)."""
    exam = get_exam(exam_id, session)
    cls = get_class(exam.class_id, session)
    _verify_class_teacher(cls, teacher, session)

    if exam.is_finalized:
        raise ValidationException("Cannot update a finalized exam. Please create a new one.")

    if data.title is not None:
        exam.title = data.title
    if data.subject is not None:
        exam.subject = data.subject
    if data.start_time is not None:
        exam.start_time = data.start_time
    if data.end_time is not None:
        exam.end_time = data.end_time
    if data.grace_period_minutes is not None:
        exam.grace_period_minutes = data.grace_period_minutes
    exam.updated_at = datetime.utcnow()

    session.add(exam)
    session.flush()
    session.refresh(exam)
    return _exam_to_response(exam, session)


def delete_exam(
    exam_id: uuid.UUID,
    teacher: User,
    session: Session,
) -> None:
    """Delete an exam. Only possible if not finalized."""
    exam = get_exam(exam_id, session)
    cls = get_class(exam.class_id, session)
    _verify_class_teacher(cls, teacher, session)

    if exam.is_finalized:
        raise ValidationException("Cannot delete a finalized exam")

    session.delete(exam)
    session.flush()
    logger.info(f"Exam '{exam.title}' deleted by teacher {teacher.id}")


# ============ Exam Extensions ============

def grant_extension(
    exam_id: uuid.UUID,
    data: ExamExtensionCreate,
    teacher: User,
    session: Session,
) -> ExamExtensionResponse:
    """Grant a student an individual extension for an exam."""
    exam = get_exam(exam_id, session)
    cls = get_class(exam.class_id, session)
    _verify_class_teacher(cls, teacher, session)

    # Verify the student is enrolled
    enrollment = session.exec(
        select(ClassEnrollment).where(
            and_(
                ClassEnrollment.class_id == exam.class_id,
                ClassEnrollment.student_id == data.student_id,
                ClassEnrollment.status == EnrollmentStatus.ACTIVE.value,
            )
        )
    ).first()
    if not enrollment:
        raise ValidationException("Student is not enrolled in this class")

    # Check existing extension
    existing = session.exec(
        select(ExamExtension).where(
            and_(
                ExamExtension.exam_id == exam_id,
                ExamExtension.student_id == data.student_id,
            )
        )
    ).first()
    if existing:
        # Update existing extension
        existing.extended_end_time = data.extended_end_time
        existing.reason = data.reason
        existing.granted_by = teacher.id
        session.add(existing)
        session.flush()
        session.refresh(existing)
        ext = existing
    else:
        ext = ExamExtension(
            exam_id=exam_id,
            student_id=data.student_id,
            extended_end_time=data.extended_end_time,
            reason=data.reason,
            granted_by=teacher.id,
        )
        session.add(ext)
        session.flush()
        session.refresh(ext)

    student = session.get(User, data.student_id)
    return ExamExtensionResponse(
        id=ext.id,
        exam_id=ext.exam_id,
        student_id=ext.student_id,
        student_name=student.name if student else None,
        extended_end_time=ext.extended_end_time,
        reason=ext.reason,
        granted_by=ext.granted_by,
        created_at=ext.created_at,
    )


def get_exam_extensions(
    exam_id: uuid.UUID,
    teacher: User,
    session: Session,
) -> List[ExamExtensionResponse]:
    """Get all extensions for an exam."""
    exam = get_exam(exam_id, session)
    cls = get_class(exam.class_id, session)
    _verify_class_teacher(cls, teacher, session)

    stmt = (
        select(ExamExtension, User)
        .join(User, ExamExtension.student_id == User.id)
        .where(ExamExtension.exam_id == exam_id)
        .order_by(ExamExtension.created_at.desc())
    )
    results = session.exec(stmt).all()

    return [
        ExamExtensionResponse(
            id=ext.id,
            exam_id=ext.exam_id,
            student_id=ext.student_id,
            student_name=student.name,
            extended_end_time=ext.extended_end_time,
            reason=ext.reason,
            granted_by=ext.granted_by,
            created_at=ext.created_at,
        )
        for ext, student in results
    ]


def get_student_exam_deadline(
    exam: Exam,
    student_id: uuid.UUID,
    session: Session,
) -> Optional[datetime]:
    """Get the effective deadline for a student (extension or global end_time)."""
    extension = session.exec(
        select(ExamExtension).where(
            and_(
                ExamExtension.exam_id == exam.id,
                ExamExtension.student_id == student_id,
            )
        )
    ).first()
    if extension:
        return extension.extended_end_time
    return exam.end_time


# ============ Student Exam Access ============

def get_student_exams(
    student: User,
    class_id: Optional[uuid.UUID],
    session: Session,
) -> List[ExamListResponse]:
    """Get exams visible to a student (from enrolled classes with finalized status)."""
    # Get classes the student is enrolled in
    stmt = select(ClassEnrollment.class_id).where(
        and_(
            ClassEnrollment.student_id == student.id,
            ClassEnrollment.status == EnrollmentStatus.ACTIVE.value,
        )
    )
    if class_id:
        stmt = stmt.where(ClassEnrollment.class_id == class_id)
    enrolled_class_ids = session.exec(stmt).all()

    if not enrolled_class_ids:
        return []

    # Get finalized exams from those classes
    exams_stmt = (
        select(Exam)
        .where(
            and_(
                Exam.class_id.in_(enrolled_class_ids),
                Exam.is_finalized == True,
            )
        )
        .order_by(Exam.start_time.desc().nullslast(), Exam.created_at.desc())
    )
    exams = session.exec(exams_stmt).all()

    results = []
    for exam in exams:
        cls = session.get(Class, exam.class_id)
        q_count = session.exec(
            select(func.count(Question.id)).where(Question.exam_id == exam.id)
        ).one()
        results.append(ExamListResponse(
            id=exam.id,
            title=exam.title,
            subject=exam.subject,
            class_id=exam.class_id,
            class_name=cls.name if cls else None,
            total_marks=exam.total_marks,
            is_finalized=exam.is_finalized,
            status=exam.status,
            start_time=exam.start_time,
            end_time=exam.end_time,
            is_published=exam.is_published,
            created_at=exam.created_at,
            question_count=q_count,
            submission_count=0,
        ))

    return results


# ============ Helpers ============

def _exam_to_response(exam: Exam, session: Session) -> ExamResponse:
    """Convert an Exam model to ExamResponse with questions."""
    cls = session.get(Class, exam.class_id)
    questions = session.exec(
        select(Question)
        .where(Question.exam_id == exam.id)
        .order_by(Question.order)
    ).all()

    return ExamResponse(
        id=exam.id,
        title=exam.title,
        subject=exam.subject,
        class_id=exam.class_id,
        class_name=cls.name if cls else None,
        total_marks=exam.total_marks,
        is_finalized=exam.is_finalized,
        status=exam.status,
        start_time=exam.start_time,
        end_time=exam.end_time,
        grace_period_minutes=exam.grace_period_minutes,
        is_published=exam.is_published,
        created_by=exam.created_by,
        created_at=exam.created_at,
        updated_at=exam.updated_at,
        questions=[
            QuestionResponse(
                id=q.id,
                question_number=q.question_number,
                text=q.text,
                max_marks=q.max_marks,
                ideal_answer=q.ideal_answer,
                evaluation_rubric=q.evaluation_rubric,
                ai_rubric=q.ai_rubric,
                order=q.order,
            )
            for q in questions
        ],
    )
