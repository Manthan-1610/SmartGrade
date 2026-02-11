"""
Submission management endpoints.

Handles student exam paper uploads, OCR digitization, and verification.
Updated for class-based exam system with authenticated student submissions.
"""
import os
import uuid as uuid_lib
import json
import aiofiles
from datetime import datetime
from typing import List, Literal
from fastapi import APIRouter, Depends, UploadFile, File, Form, status
from fastapi.responses import FileResponse
from sqlmodel import Session, select
from sqlalchemy import and_

from ..config import get_settings
from ..database import get_session
from ..dependencies import require_student, get_current_user
from ..models import (
    Exam,
    Submission,
    StudentAnswer,
    SubmissionStatus,
    User,
    ExamExtension,
)
from ..schemas.exam import (
    DigitizeResponse,
    SubmissionResponse,
    StudentAnswerResponse,
    VerifySubmissionRequest,
    SubmissionListResponse,
)
from ..services.image_processing import preprocess_image, resize_for_api
from ..services.digitization import digitization_service
from ..services.classroom import verify_student_enrolled
from ..services.grading import generate_receipt
from ..exceptions import (
    NotFoundException,
    ValidationException,
    FileUploadException,
    ExternalServiceException,
)
from ..logging_config import get_logger

router = APIRouter(tags=["Submissions"])
logger = get_logger(__name__)
settings = get_settings()

# Ensure upload directory exists
UPLOAD_DIR = os.path.join(
    os.path.dirname(os.path.dirname(os.path.dirname(__file__))),
    settings.upload_dir,
)
os.makedirs(UPLOAD_DIR, exist_ok=True)


async def _save_image(image_bytes: bytes, filename: str) -> str:
    """Save image to upload directory securely."""
    safe_filename = os.path.basename(filename)
    filepath = os.path.join(UPLOAD_DIR, safe_filename)
    async with aiofiles.open(filepath, "wb") as f:
        await f.write(image_bytes)
    return filepath


@router.post(
    "/digitize-submission",
    response_model=DigitizeResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Upload and digitize submission",
    description="""
    Upload a handwritten exam paper for OCR processing.
    
    The system will:
    1. Validate the exam exists, is finalized, and is within time window
    2. Verify the student is enrolled in the class
    3. Preprocess the image (deskew, enhance contrast)
    4. Extract text using AI vision
    5. Return extracted answers with confidence scores
    6. Generate a digital receipt
    """,
)
async def digitize_submission(
    exam_id: str = Form(..., description="UUID of the exam"),
    image: UploadFile = File(..., description="Image file of the answer sheet"),
    current_user: User = Depends(require_student),
    session: Session = Depends(get_session),
) -> DigitizeResponse:
    """Upload and digitize a student's handwritten exam submission."""
    # Validate exam ID format
    try:
        exam_uuid = uuid_lib.UUID(exam_id)
    except ValueError:
        raise ValidationException(
            "Invalid exam ID format",
            detail=f"'{exam_id}' is not a valid UUID",
        )

    # Fetch and validate exam
    exam = session.exec(select(Exam).where(Exam.id == exam_uuid)).first()
    if not exam:
        raise NotFoundException("Exam", exam_id)
    if not exam.is_finalized:
        raise ValidationException(
            "Exam template is not finalized",
            detail="Please finalize the exam template before accepting submissions",
        )

    # Verify student is enrolled in the class
    if not verify_student_enrolled(exam.class_id, current_user.id, session):
        raise ValidationException("You are not enrolled in this exam's class")

    # Check time window
    now = datetime.utcnow()
    if exam.start_time and now < exam.start_time:
        raise ValidationException("This exam has not started yet")

    # Check deadline (with extensions)
    effective_deadline = exam.end_time
    extension = session.exec(
        select(ExamExtension).where(
            and_(
                ExamExtension.exam_id == exam_uuid,
                ExamExtension.student_id == current_user.id,
            )
        )
    ).first()
    if extension:
        effective_deadline = extension.extended_end_time

    if effective_deadline:
        from datetime import timedelta

        grace_end = effective_deadline + timedelta(minutes=exam.grace_period_minutes)
        if now > grace_end:
            raise ValidationException(
                "The submission deadline has passed (including grace period)"
            )

    # Check for existing submission
    existing = session.exec(
        select(Submission).where(
            and_(
                Submission.exam_id == exam_uuid,
                Submission.student_id == current_user.id,
            )
        )
    ).first()
    if existing:
        raise ValidationException(
            "You have already submitted for this exam. "
            "Contact your teacher if you need to resubmit."
        )

    # Validate image file
    if not image.content_type:
        raise FileUploadException("Could not determine file type")

    allowed_types = settings.allowed_image_types_list
    if image.content_type not in allowed_types:
        raise FileUploadException(
            f"Unsupported image type: {image.content_type}. "
            f"Allowed types: {', '.join(allowed_types)}"
        )

    # Read image
    image_bytes = await image.read()
    if len(image_bytes) == 0:
        raise FileUploadException("Empty image file")
    if len(image_bytes) > settings.max_upload_size_bytes:
        raise FileUploadException(
            f"File too large. Maximum size is {settings.max_upload_size_mb}MB"
        )

    logger.info(
        f"Processing submission for exam '{exam.title}' by student {current_user.id} "
        f"({len(image_bytes) / 1024:.1f}KB)"
    )

    # Preprocess image
    try:
        processed_bytes, original_bytes = preprocess_image(image_bytes)
    except ValueError as e:
        raise FileUploadException(f"Invalid image: {str(e)}")
    except Exception as e:
        logger.error(f"Image preprocessing failed: {e}")
        raise FileUploadException("Failed to process image")

    # Generate secure filenames
    submission_uuid = uuid_lib.uuid4()
    original_filename = f"{submission_uuid}_original.png"
    processed_filename = f"{submission_uuid}_processed.png"

    # Save images
    original_path = await _save_image(original_bytes, original_filename)
    processed_path = await _save_image(processed_bytes, processed_filename)

    # Create submission record
    submission = Submission(
        id=submission_uuid,
        exam_id=exam_uuid,
        student_id=current_user.id,
        original_image_path=original_path,
        processed_image_path=processed_path,
        status=SubmissionStatus.PROCESSING.value,
        file_paths=json.dumps([original_path]),
    )
    session.add(submission)
    session.flush()

    # Prepare questions for extraction
    questions_data = [
        {
            "question_number": q.question_number,
            "text": q.text,
            "max_marks": q.max_marks,
        }
        for q in sorted(exam.questions, key=lambda x: x.order)
    ]

    # Resize for API if needed
    api_image = resize_for_api(processed_bytes)

    # Extract answers using AI Vision
    try:
        extracted_answers = digitization_service.extract_answers(
            image_bytes=api_image,
            questions=questions_data,
            mime_type="image/png",
        )
    except Exception as e:
        logger.error(f"AI extraction failed: {e}")
        submission.status = SubmissionStatus.FAILED.value
        session.flush()
        raise ExternalServiceException("AI Vision", "Failed to extract text from image")

    # Create question lookup
    question_map = {q.question_number: q for q in exam.questions}

    # Save extracted answers to database
    for ans in extracted_answers:
        question = question_map.get(ans.question_number)
        if question:
            student_answer = StudentAnswer(
                submission_id=submission_uuid,
                question_id=question.id,
                question_number=ans.question_number,
                extracted_text=ans.extracted_text,
                confidence=ans.confidence,
                ai_flagged_for_review=(ans.confidence < 0.7),
            )
            session.add(student_answer)

    # Update submission status
    submission.status = SubmissionStatus.PENDING_VERIFICATION.value
    session.flush()

    # Generate digital receipt
    generate_receipt(submission, session)

    logger.info(
        f"Created submission {submission_uuid} with "
        f"{len(extracted_answers)} extracted answers"
    )

    return DigitizeResponse(
        submission_id=submission_uuid,
        answers=extracted_answers,
        original_image_url=f"/api/submissions/{submission_uuid}/image/original",
        processed_image_url=f"/api/submissions/{submission_uuid}/image/processed",
    )


@router.get(
    "/submissions/{submission_id}/image/{image_type}",
    summary="Get submission image",
)
async def get_submission_image(
    submission_id: uuid_lib.UUID,
    image_type: Literal["original", "processed"],
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> FileResponse:
    """Serve submission images (requires authentication)."""
    submission = session.exec(
        select(Submission).where(Submission.id == submission_id)
    ).first()
    if not submission:
        raise NotFoundException("Submission", submission_id)

    # Verify access
    if submission.student_id != current_user.id:
        # Allow teachers of the class to view as well
        exam = session.get(Exam, submission.exam_id)
        if exam:
            from ..models import Class
            cls = session.get(Class, exam.class_id)
            if not cls or cls.teacher_id != current_user.id:
                from ..exceptions import AuthorizationException
                raise AuthorizationException("You don't have access to this submission")

    image_path = (
        submission.original_image_path
        if image_type == "original"
        else submission.processed_image_path
    )

    if not image_path or not os.path.exists(image_path):
        raise NotFoundException("Image file")

    return FileResponse(
        image_path,
        media_type="image/png",
        headers={"Cache-Control": "private, max-age=3600"},
    )


@router.post(
    "/submissions/{submission_id}/verify",
    response_model=SubmissionResponse,
    summary="Verify submission answers",
)
async def verify_submission(
    submission_id: uuid_lib.UUID,
    request: VerifySubmissionRequest,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> SubmissionResponse:
    """Verify and save teacher-corrected answers."""
    submission = session.exec(
        select(Submission).where(Submission.id == submission_id)
    ).first()
    if not submission:
        raise NotFoundException("Submission", submission_id)

    logger.info(f"Verifying submission {submission_id}")

    answer_map = {ans.question_number: ans for ans in submission.answers}

    for verified in request.answers:
        question_num = verified.get("question_number")
        verified_text = verified.get("verified_text", "")
        if question_num in answer_map:
            answer_map[question_num].verified_text = verified_text

    submission.is_verified = True
    submission.status = SubmissionStatus.VERIFIED.value
    submission.updated_at = datetime.utcnow()

    session.flush()
    session.refresh(submission)

    logger.info(f"Submission {submission_id} verified successfully")

    student = session.get(User, submission.student_id)
    return SubmissionResponse(
        id=submission.id,
        exam_id=submission.exam_id,
        student_id=submission.student_id,
        student_name=student.name if student else None,
        status=submission.status,
        is_verified=submission.is_verified,
        original_image_url=f"/api/submissions/{submission.id}/image/original",
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
            for a in sorted(submission.answers, key=lambda x: x.question_number)
        ],
    )
