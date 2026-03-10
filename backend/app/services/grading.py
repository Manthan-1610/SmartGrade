"""
Service layer for grading workflows.

Handles AI grading, teacher review, mark publishing, and result aggregation.
"""
import uuid
import hashlib
import json
from datetime import datetime
from typing import List, Optional
import logging

from sqlmodel import Session, select, func
from sqlalchemy import and_

from ..models import (
    Submission,
    StudentAnswer,
    Exam,
    Question,
    DigitalReceipt,
    SubmissionStatus,
    ExamStatus,
    EnrollmentStatus,
    User,
    Class,
    ClassEnrollment,
    ExamExtension,
)
from ..schemas.exam import (
    StudentAnswerResponse,
    SubmissionResponse,
    SubmissionListResponse,
    GradeAnswerRequest,
    PublishMarksRequest,
    StudentExamResult,
    DigitalReceiptResponse,
    MissedStudentResponse,
    ExamSubmissionSummary,
)
from ..exceptions import (
    NotFoundException,
    AuthorizationException,
    ValidationException,
)
from .classroom import _verify_class_teacher, verify_student_enrolled
from .exam import get_exam

logger = logging.getLogger(__name__)


# ============ Teacher Grading ============

def get_exam_submissions(
    exam_id: uuid.UUID,
    teacher: User,
    session: Session,
) -> List[SubmissionListResponse]:
    """Get all submissions for an exam (teacher view)."""
    exam = get_exam(exam_id, session)
    cls = session.get(Class, exam.class_id)
    _verify_class_teacher(cls, teacher, session)

    stmt = (
        select(Submission, User)
        .join(User, Submission.student_id == User.id)
        .where(Submission.exam_id == exam_id)
        .order_by(Submission.submitted_at.desc())
    )
    results = session.exec(stmt).all()

    return [
        SubmissionListResponse(
            id=sub.id,
            exam_id=sub.exam_id,
            exam_title=exam.title,
            student_id=sub.student_id,
            student_name=student.name,
            status=sub.status,
            is_verified=sub.is_verified,
            submitted_at=sub.submitted_at,
            created_at=sub.created_at,
            answer_count=session.exec(
                select(func.count(StudentAnswer.id))
                .where(StudentAnswer.submission_id == sub.id)
            ).one(),
        )
        for sub, student in results
    ]


def get_submission_detail(
    submission_id: uuid.UUID,
    user: User,
    session: Session,
) -> SubmissionResponse:
    """Get full submission with answers."""
    submission = session.get(Submission, submission_id)
    if not submission:
        raise NotFoundException("Submission not found")

    # Verify access
    exam = session.get(Exam, submission.exam_id)
    cls = session.get(Class, exam.class_id)

    is_teacher = cls.teacher_id == user.id or (cls.organization and cls.organization.owner_id == user.id)
    is_student_owner = submission.student_id == user.id

    if not is_teacher and not is_student_owner:
        raise AuthorizationException("You don't have access to this submission")

    student = session.get(User, submission.student_id)
    answers = session.exec(
        select(StudentAnswer)
        .where(StudentAnswer.submission_id == submission_id)
        .order_by(StudentAnswer.question_number)
    ).all()

    # Parse file_paths JSON
    file_paths = None
    if submission.file_paths:
        try:
            file_paths = json.loads(submission.file_paths)
        except json.JSONDecodeError:
            file_paths = [submission.file_paths]

    return SubmissionResponse(
        id=submission.id,
        exam_id=submission.exam_id,
        student_id=submission.student_id,
        student_name=student.name if student else None,
        status=submission.status,
        is_verified=submission.is_verified,
        file_paths=file_paths,
        original_image_url=submission.original_image_path,
        digital_receipt_hash=submission.digital_receipt_hash,
        submitted_at=submission.submitted_at,
        created_at=submission.created_at,
        answers=[
            StudentAnswerResponse(
                id=a.id,
                question_id=a.question_id,
                question_number=a.question_number,
                extracted_text=a.extracted_text,
                verified_text=a.verified_text,
                confidence=a.confidence,
                ai_marks=a.ai_marks,
                ai_feedback=a.ai_feedback,
                ai_flagged_for_review=a.ai_flagged_for_review,
                teacher_marks=a.teacher_marks,
                teacher_feedback=a.teacher_feedback,
                final_marks=a.final_marks,
                is_published=a.is_published,
            )
            for a in answers
        ],
    )


def grade_answer(
    answer_id: uuid.UUID,
    data: GradeAnswerRequest,
    teacher: User,
    session: Session,
) -> StudentAnswerResponse:
    """Grade a single student answer (teacher review)."""
    answer = session.get(StudentAnswer, answer_id)
    if not answer:
        raise NotFoundException("Answer not found")

    submission = session.get(Submission, answer.submission_id)
    exam = session.get(Exam, submission.exam_id)
    cls = session.get(Class, exam.class_id)
    _verify_class_teacher(cls, teacher, session)

    # Validate marks don't exceed max
    question = session.get(Question, answer.question_id)
    if question and data.teacher_marks > question.max_marks:
        raise ValidationException(
            f"Marks ({data.teacher_marks}) cannot exceed max marks ({question.max_marks})"
        )

    answer.teacher_marks = data.teacher_marks
    answer.teacher_feedback = data.teacher_feedback
    session.add(answer)
    session.flush()
    session.refresh(answer)

    logger.info(f"Answer {answer_id} graded: {data.teacher_marks} marks by teacher {teacher.id}")

    return StudentAnswerResponse(
        id=answer.id,
        question_id=answer.question_id,
        question_number=answer.question_number,
        extracted_text=answer.extracted_text,
        verified_text=answer.verified_text,
        confidence=answer.confidence,
        ai_marks=answer.ai_marks,
        ai_feedback=answer.ai_feedback,
        ai_flagged_for_review=answer.ai_flagged_for_review,
        teacher_marks=answer.teacher_marks,
        teacher_feedback=answer.teacher_feedback,
        final_marks=answer.final_marks,
        is_published=answer.is_published,
    )


def bulk_grade(
    submission_id: uuid.UUID,
    grades: List[dict],
    teacher: User,
    session: Session,
) -> SubmissionResponse:
    """Bulk grade multiple answers for a submission."""
    submission = session.get(Submission, submission_id)
    if not submission:
        raise NotFoundException("Submission not found")

    exam = session.get(Exam, submission.exam_id)
    cls = session.get(Class, exam.class_id)
    _verify_class_teacher(cls, teacher, session)

    for grade_item in grades:
        answer_id = uuid.UUID(str(grade_item["answer_id"]))
        answer = session.get(StudentAnswer, answer_id)
        if not answer or answer.submission_id != submission_id:
            continue

        question = session.get(Question, answer.question_id)
        marks = float(grade_item["teacher_marks"])
        if question and marks > question.max_marks:
            raise ValidationException(
                f"Marks ({marks}) for question {answer.question_number} "
                f"exceed max ({question.max_marks})"
            )

        answer.teacher_marks = marks
        answer.teacher_feedback = grade_item.get("teacher_feedback")
        session.add(answer)

    # Update submission status
    submission.status = SubmissionStatus.GRADED.value
    submission.updated_at = datetime.utcnow()
    session.add(submission)
    session.flush()

    logger.info(f"Submission {submission_id} bulk graded by teacher {teacher.id}")
    return get_submission_detail(submission_id, teacher, session)


# ============ Publishing ============

def publish_marks(
    exam_id: uuid.UUID,
    data: PublishMarksRequest,
    teacher: User,
    session: Session,
) -> dict:
    """
    Publish marks for an exam (individual or bulk).
    
    If submission_ids is provided, publishes only those submissions.
    Otherwise, publishes all graded submissions.
    """
    exam = get_exam(exam_id, session)
    cls = session.get(Class, exam.class_id)
    _verify_class_teacher(cls, teacher, session)

    if data.submission_ids:
        submissions = session.exec(
            select(Submission).where(
                and_(
                    Submission.id.in_(data.submission_ids),
                    Submission.exam_id == exam_id,
                )
            )
        ).all()
    else:
        submissions = session.exec(
            select(Submission).where(
                and_(
                    Submission.exam_id == exam_id,
                    Submission.status == SubmissionStatus.GRADED.value,
                )
            )
        ).all()

    published_count = 0
    for sub in submissions:
        answers = session.exec(
            select(StudentAnswer).where(StudentAnswer.submission_id == sub.id)
        ).all()
        for answer in answers:
            answer.is_published = data.publish
            session.add(answer)
        published_count += 1

    # Update exam status if all submissions are published
    if not data.submission_ids:
        exam.is_published = data.publish
        exam.status = ExamStatus.PUBLISHED.value if data.publish else ExamStatus.GRADING.value
        session.add(exam)

    session.flush()

    action = "Published" if data.publish else "Unpublished"
    logger.info(f"{action} marks for {published_count} submissions in exam {exam_id}")

    return {
        "published_count": published_count,
        "exam_id": str(exam_id),
        "action": action.lower(),
    }


# ============ Student Results ============

def get_student_result(
    exam_id: uuid.UUID,
    student: User,
    session: Session,
) -> StudentExamResult:
    """Get a student's result for an exam."""
    exam = get_exam(exam_id, session)

    # Verify student is enrolled
    if not verify_student_enrolled(exam.class_id, student.id, session):
        raise AuthorizationException("You are not enrolled in this class")

    submission = session.exec(
        select(Submission).where(
            and_(
                Submission.exam_id == exam_id,
                Submission.student_id == student.id,
            )
        )
    ).first()

    if not submission:
        raise NotFoundException("No submission found for this exam")

    answers = session.exec(
        select(StudentAnswer)
        .where(StudentAnswer.submission_id == submission.id)
        .order_by(StudentAnswer.question_number)
    ).all()

    # Only show published answers
    published_answers = [a for a in answers if a.is_published]
    if not published_answers and not exam.is_published:
        raise ValidationException("Results have not been published yet")

    obtained = sum(a.final_marks or 0 for a in published_answers)
    percentage = (obtained / exam.total_marks * 100) if exam.total_marks > 0 else 0

    return StudentExamResult(
        exam_id=exam.id,
        exam_title=exam.title,
        subject=exam.subject,
        total_marks=exam.total_marks,
        obtained_marks=obtained,
        percentage=round(percentage, 2),
        is_published=exam.is_published,
        answers=[
            StudentAnswerResponse(
                id=a.id,
                question_id=a.question_id,
                question_number=a.question_number,
                extracted_text=a.extracted_text,
                verified_text=a.verified_text,
                confidence=a.confidence,
                ai_marks=a.ai_marks,
                ai_feedback=a.ai_feedback,
                ai_flagged_for_review=a.ai_flagged_for_review,
                teacher_marks=a.teacher_marks,
                teacher_feedback=a.teacher_feedback,
                final_marks=a.final_marks,
                is_published=a.is_published,
            )
            for a in published_answers
        ],
    )


def get_student_results_overview(
    student: User,
    session: Session,
) -> List[StudentExamResult]:
    """Get a summary of all published exam results for a student."""
    submissions = session.exec(
        select(Submission)
        .where(Submission.student_id == student.id)
        .order_by(Submission.submitted_at.desc())
    ).all()

    results = []
    for sub in submissions:
        exam = session.get(Exam, sub.exam_id)
        if not exam:
            continue

        answers = session.exec(
            select(StudentAnswer).where(
                and_(
                    StudentAnswer.submission_id == sub.id,
                    StudentAnswer.is_published == True,
                )
            )
        ).all()

        if not answers:
            continue

        obtained = sum(a.final_marks or 0 for a in answers)
        percentage = (obtained / exam.total_marks * 100) if exam.total_marks > 0 else 0

        results.append(StudentExamResult(
            exam_id=exam.id,
            exam_title=exam.title,
            subject=exam.subject,
            total_marks=exam.total_marks,
            obtained_marks=obtained,
            percentage=round(percentage, 2),
            is_published=exam.is_published,
            answers=[],  # Omit answers in overview
        ))

    return results


# ============ Digital Receipt ============

def generate_receipt(
    submission: Submission,
    session: Session,
) -> DigitalReceipt:
    """Generate a digital receipt for a submission."""
    receipt_data = f"{submission.id}|{submission.exam_id}|{submission.student_id}|{submission.submitted_at.isoformat()}"
    receipt_hash = hashlib.sha256(receipt_data.encode()).hexdigest()

    receipt = DigitalReceipt(
        submission_id=submission.id,
        student_id=submission.student_id,
        exam_id=submission.exam_id,
        receipt_hash=receipt_hash,
        file_metadata_snapshot=submission.file_metadata,
    )
    session.add(receipt)

    submission.digital_receipt_hash = receipt_hash
    session.add(submission)
    session.flush()

    return receipt


# ============ Missed Students ============

def get_missed_students(
    exam_id: uuid.UUID,
    teacher: User,
    session: Session,
) -> List[MissedStudentResponse]:
    """
    Get list of students who didn't submit for an exam after the deadline.
    
    A student is considered "missed" if:
    1. They are enrolled in the exam's class
    2. The exam deadline has passed (including their personal extension if any)
    3. They have no submission record
    """
    exam = get_exam(exam_id, session)
    cls = session.get(Class, exam.class_id)
    _verify_class_teacher(cls, teacher, session)

    # Check if exam has ended
    now = datetime.utcnow()
    if exam.end_time and now < exam.end_time:
        # Exam hasn't ended yet — no missed students
        return []

    # Get all enrolled students in this class
    enrolled = session.exec(
        select(ClassEnrollment, User)
        .join(User, ClassEnrollment.student_id == User.id)
        .where(
            and_(
                ClassEnrollment.class_id == exam.class_id,
                ClassEnrollment.status == EnrollmentStatus.ACTIVE.value,
            )
        )
    ).all()

    # Get all student IDs who have submitted
    submitted_ids = set(
        session.exec(
            select(Submission.student_id)
            .where(Submission.exam_id == exam_id)
        ).all()
    )

    # Get extensions for this exam
    extensions = session.exec(
        select(ExamExtension)
        .where(ExamExtension.exam_id == exam_id)
    ).all()
    extension_map = {ext.student_id: ext for ext in extensions}

    missed = []
    for enrollment, student in enrolled:
        if student.id in submitted_ids:
            continue

        # Check if student has an extension that hasn't passed yet
        ext = extension_map.get(student.id)
        student_deadline = exam.end_time
        had_extension = False
        extended_deadline = None

        if ext:
            had_extension = True
            extended_deadline = ext.extended_end_time
            student_deadline = ext.extended_end_time

        # If student's personal deadline hasn't passed, they're not missed yet
        if student_deadline and now < student_deadline:
            continue

        missed.append(MissedStudentResponse(
            student_id=student.id,
            student_name=student.name,
            student_email=student.email,
            exam_id=exam.id,
            exam_title=exam.title,
            deadline=exam.end_time,
            had_extension=had_extension,
            extended_deadline=extended_deadline,
        ))

    logger.info(f"Found {len(missed)} missed students for exam {exam_id}")
    return missed


def get_exam_submission_summary(
    exam_id: uuid.UUID,
    teacher: User,
    session: Session,
) -> ExamSubmissionSummary:
    """
    Get a comprehensive summary of an exam's submissions and missed students.
    
    Includes counts, submission list, and missed student list.
    """
    exam = get_exam(exam_id, session)
    cls = session.get(Class, exam.class_id)
    _verify_class_teacher(cls, teacher, session)

    # Get enrolled count
    total_enrolled = session.exec(
        select(func.count(ClassEnrollment.id))
        .where(
            and_(
                ClassEnrollment.class_id == exam.class_id,
                ClassEnrollment.status == EnrollmentStatus.ACTIVE.value,
            )
        )
    ).one()

    # Get submissions with student info
    stmt = (
        select(Submission, User)
        .join(User, Submission.student_id == User.id)
        .where(Submission.exam_id == exam_id)
        .order_by(Submission.submitted_at.desc())
    )
    results = session.exec(stmt).all()

    submissions = []
    graded_count = 0
    published_count = 0

    for sub, student in results:
        # Get answer stats
        answers = session.exec(
            select(StudentAnswer)
            .where(StudentAnswer.submission_id == sub.id)
        ).all()

        answer_count = len(answers)
        obtained_marks = sum(a.final_marks or 0 for a in answers)
        is_graded = sub.status == SubmissionStatus.GRADED.value
        is_published = all(a.is_published for a in answers) if answers else False

        if is_graded:
            graded_count += 1
        if is_published:
            published_count += 1

        submissions.append(SubmissionListResponse(
            id=sub.id,
            exam_id=sub.exam_id,
            exam_title=exam.title,
            student_id=sub.student_id,
            student_name=student.name,
            student_email=student.email,
            status=sub.status,
            is_verified=sub.is_verified,
            is_missed=sub.is_missed,  # Use database field
            submitted_at=sub.submitted_at,
            created_at=sub.created_at,
            answer_count=answer_count,
            total_marks=exam.total_marks,
            obtained_marks=obtained_marks,
        ))

    # Get missed students
    missed_students = get_missed_students(exam_id, teacher, session)

    return ExamSubmissionSummary(
        exam_id=exam.id,
        exam_title=exam.title,
        total_enrolled=total_enrolled,
        submitted_count=len(submissions),
        missed_count=len(missed_students),
        graded_count=graded_count,
        published_count=published_count,
        submissions=submissions,
        missed_students=missed_students,
    )


def create_missed_submission(
    exam_id: uuid.UUID,
    student_id: uuid.UUID,
    teacher: User,
    session: Session,
) -> SubmissionListResponse:
    """
    Create a "missed" submission record for a student who didn't submit.
    
    This marks the student with zero marks for all questions.
    """
    exam = get_exam(exam_id, session)
    cls = session.get(Class, exam.class_id)
    _verify_class_teacher(cls, teacher, session)

    # Check if submission already exists
    existing = session.exec(
        select(Submission).where(
            and_(
                Submission.exam_id == exam_id,
                Submission.student_id == student_id,
            )
        )
    ).first()

    if existing:
        raise ValidationException("Student already has a submission")

    student = session.get(User, student_id)
    if not student:
        raise NotFoundException("Student not found")

    # Create a "missed" submission
    submission = Submission(
        exam_id=exam_id,
        student_id=student_id,
        status=SubmissionStatus.GRADED.value,  # Already graded (zero)
        is_verified=True,
        is_missed=True,  # Flag as missed submission
        submitted_at=datetime.utcnow(),
    )
    session.add(submission)
    session.flush()

    # Create zero-mark answers for all questions
    questions = session.exec(
        select(Question)
        .where(Question.exam_id == exam_id)
        .order_by(Question.order)
    ).all()

    for q in questions:
        answer = StudentAnswer(
            submission_id=submission.id,
            question_id=q.id,
            question_number=q.question_number,
            extracted_text="[No submission - Exam missed]",
            verified_text="[No submission - Exam missed]",
            confidence=1.0,
            ai_marks=0,
            ai_feedback="Student did not submit for this exam.",
            teacher_marks=0,
            teacher_feedback="Absent / No submission",
            ai_flagged_for_review=False,
        )
        session.add(answer)

    session.flush()
    session.refresh(submission)

    logger.info(f"Created missed submission for student {student_id} in exam {exam_id}")

    return SubmissionListResponse(
        id=submission.id,
        exam_id=submission.exam_id,
        exam_title=exam.title,
        student_id=submission.student_id,
        student_name=student.name,
        student_email=student.email,
        status=submission.status,
        is_verified=True,
        is_missed=True,
        submitted_at=submission.submitted_at,
        created_at=submission.created_at,
        answer_count=len(questions),
        total_marks=exam.total_marks,
        obtained_marks=0,
    )


def mark_all_missed_as_zero(
    exam_id: uuid.UUID,
    teacher: User,
    session: Session,
) -> dict:
    """
    Bulk action to mark all missed students with zero grades.
    
    Creates submission records for all students who didn't submit.
    """
    missed = get_missed_students(exam_id, teacher, session)

    created_count = 0
    for m in missed:
        try:
            create_missed_submission(exam_id, m.student_id, teacher, session)
            created_count += 1
        except ValidationException:
            # Already has a submission — skip
            continue

    logger.info(f"Marked {created_count} missed students with zero for exam {exam_id}")

    return {
        "exam_id": str(exam_id),
        "marked_count": created_count,
        "message": f"Created zero-grade submissions for {created_count} students",
    }
