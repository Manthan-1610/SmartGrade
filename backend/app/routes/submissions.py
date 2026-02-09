"""
Submission management endpoints.

Handles student exam paper uploads, OCR digitization, and verification.
"""
import os
import uuid as uuid_lib
import aiofiles
from datetime import datetime
from typing import List, Literal
from fastapi import APIRouter, Depends, UploadFile, File, Form, status
from fastapi.responses import FileResponse
from sqlmodel import Session, select

from ..config import get_settings
from ..database import get_session
from ..models import Exam, Submission, StudentAnswer
from ..schemas import (
    DigitizeResponse,
    SubmissionResponse,
    StudentAnswerResponse,
    VerifySubmissionRequest,
    SubmissionListResponse
)
from ..services.image_processing import preprocess_image, resize_for_api
from ..services.digitization import digitization_service
from ..exceptions import (
    NotFoundException,
    ValidationException,
    FileUploadException,
    ExternalServiceException
)
from ..logging_config import get_logger

router = APIRouter()
logger = get_logger(__name__)
settings = get_settings()

# Ensure upload directory exists
UPLOAD_DIR = os.path.join(
    os.path.dirname(os.path.dirname(os.path.dirname(__file__))),
    settings.upload_dir
)
os.makedirs(UPLOAD_DIR, exist_ok=True)


async def _save_image(image_bytes: bytes, filename: str) -> str:
    """
    Save image to upload directory securely.
    
    Args:
        image_bytes: Raw image data.
        filename: Target filename (should be sanitized).
        
    Returns:
        Absolute path to saved file.
    """
    # Sanitize filename to prevent directory traversal
    safe_filename = os.path.basename(filename)
    filepath = os.path.join(UPLOAD_DIR, safe_filename)
    
    async with aiofiles.open(filepath, 'wb') as f:
        await f.write(image_bytes)
    
    return filepath


def _build_submission_response(submission: Submission) -> SubmissionResponse:
    """Build standardized submission response from model."""
    return SubmissionResponse(
        id=submission.id,
        exam_id=submission.exam_id,
        student_name=submission.student_name,
        student_id=submission.student_id,
        status=submission.status,
        is_verified=submission.is_verified,
        original_image_url=f"/api/submissions/{submission.id}/image/original",
        created_at=submission.created_at,
        answers=[
            StudentAnswerResponse(
                id=ans.id,
                question_id=ans.question_id,
                question_number=ans.question_number,
                extracted_text=ans.extracted_text,
                verified_text=ans.verified_text,
                confidence=ans.confidence,
                marks_awarded=ans.marks_awarded
            )
            for ans in sorted(submission.answers, key=lambda x: x.question_number)
        ]
    )


@router.post(
    "/digitize-submission",
    response_model=DigitizeResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Upload and digitize submission",
    description="""
    Upload a handwritten exam paper for OCR processing.
    
    The system will:
    1. Validate the exam exists and is finalized
    2. Preprocess the image (deskew, enhance contrast)
    3. Extract text using AI vision
    4. Return extracted answers with confidence scores
    """
)
async def digitize_submission(
    exam_id: str = Form(..., description="UUID of the exam"),
    image: UploadFile = File(..., description="Image file of the answer sheet"),
    student_name: str = Form(None, description="Optional student name"),
    student_id: str = Form(None, description="Optional student ID/roll number"),
    session: Session = Depends(get_session)
) -> DigitizeResponse:
    """
    Upload and digitize a student's handwritten exam submission.
    
    Args:
        exam_id: UUID of the exam template.
        image: Uploaded image file.
        student_name: Optional student name.
        student_id: Optional student identifier.
        session: Database session (injected).
        
    Returns:
        Digitization results with extracted answers.
        
    Raises:
        ValidationException: If input validation fails.
        NotFoundException: If exam not found.
        FileUploadException: If image processing fails.
        ExternalServiceException: If AI extraction fails.
    """
    # Validate exam ID format
    try:
        exam_uuid = uuid_lib.UUID(exam_id)
    except ValueError:
        raise ValidationException(
            "Invalid exam ID format",
            detail=f"'{exam_id}' is not a valid UUID"
        )
    
    # Fetch and validate exam
    statement = select(Exam).where(Exam.id == exam_uuid)
    exam = session.exec(statement).first()
    
    if not exam:
        raise NotFoundException("Exam", exam_id)
    
    if not exam.is_finalized:
        raise ValidationException(
            "Exam template is not finalized",
            detail="Please finalize the exam template before accepting submissions"
        )
    
    # Validate image file
    if not image.content_type:
        raise FileUploadException("Could not determine file type")
    
    if image.content_type not in settings.allowed_image_types:
        raise FileUploadException(
            f"Unsupported image type: {image.content_type}. "
            f"Allowed types: {', '.join(settings.allowed_image_types)}"
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
        f"Processing submission for exam {exam.title} "
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
        student_name=student_name.strip() if student_name else None,
        student_id=student_id.strip() if student_id else None,
        original_image_path=original_path,
        processed_image_path=processed_path,
        status="processing"
    )
    session.add(submission)
    session.flush()
    
    # Prepare questions for extraction
    questions_data = [
        {
            "question_number": q.question_number,
            "text": q.text,
            "max_marks": q.max_marks
        }
        for q in sorted(exam.questions, key=lambda x: x.question_number)
    ]
    
    # Resize for API if needed
    api_image = resize_for_api(processed_bytes)
    
    # Extract answers using AI Vision
    try:
        extracted_answers = digitization_service.extract_answers(
            image_bytes=api_image,
            questions=questions_data,
            mime_type="image/png"
        )
    except Exception as e:
        logger.error(f"AI extraction failed: {e}")
        # Update status to failed
        submission.status = "failed"
        session.commit()
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
                confidence=ans.confidence
            )
            session.add(student_answer)
    
    # Update submission status
    submission.status = "pending_verification"
    session.commit()
    
    logger.info(
        f"Created submission {submission_uuid} with "
        f"{len(extracted_answers)} extracted answers"
    )
    
    return DigitizeResponse(
        submission_id=submission_uuid,
        answers=extracted_answers,
        original_image_url=f"/api/submissions/{submission_uuid}/image/original",
        processed_image_url=f"/api/submissions/{submission_uuid}/image/processed"
    )


@router.get(
    "/submissions/{submission_id}/image/{image_type}",
    summary="Get submission image",
    description="Retrieve the original or processed image for a submission."
)
async def get_submission_image(
    submission_id: uuid_lib.UUID,
    image_type: Literal["original", "processed"],
    session: Session = Depends(get_session)
) -> FileResponse:
    """
    Serve submission images.
    
    Args:
        submission_id: UUID of the submission.
        image_type: Either 'original' or 'processed'.
        session: Database session (injected).
        
    Returns:
        Image file response.
        
    Raises:
        NotFoundException: If submission or image not found.
        ValidationException: If invalid image type.
    """
    statement = select(Submission).where(Submission.id == submission_id)
    submission = session.exec(statement).first()
    
    if not submission:
        raise NotFoundException("Submission", submission_id)
    
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
        headers={"Cache-Control": "private, max-age=3600"}
    )


@router.get(
    "/submissions/{submission_id}",
    response_model=SubmissionResponse,
    summary="Get submission details",
    description="Retrieve submission details with all extracted answers."
)
async def get_submission(
    submission_id: uuid_lib.UUID,
    session: Session = Depends(get_session)
) -> SubmissionResponse:
    """
    Get submission details with extracted answers.
    
    Args:
        submission_id: UUID of the submission.
        session: Database session (injected).
        
    Returns:
        Complete submission data with answers.
        
    Raises:
        NotFoundException: If submission not found.
    """
    statement = select(Submission).where(Submission.id == submission_id)
    submission = session.exec(statement).first()
    
    if not submission:
        raise NotFoundException("Submission", submission_id)
    
    return _build_submission_response(submission)


@router.get(
    "/exams/{exam_id}/submissions",
    response_model=List[SubmissionListResponse],
    summary="List exam submissions",
    description="Get all submissions for a specific exam."
)
async def list_exam_submissions(
    exam_id: uuid_lib.UUID,
    session: Session = Depends(get_session)
) -> List[SubmissionListResponse]:
    """
    List all submissions for an exam.
    
    Args:
        exam_id: UUID of the exam.
        session: Database session (injected).
        
    Returns:
        List of submissions with basic info.
        
    Raises:
        NotFoundException: If exam not found.
    """
    statement = select(Exam).where(Exam.id == exam_id)
    exam = session.exec(statement).first()
    
    if not exam:
        raise NotFoundException("Exam", exam_id)
    
    return [
        SubmissionListResponse(
            id=sub.id,
            exam_id=sub.exam_id,
            exam_title=exam.title,
            student_name=sub.student_name,
            status=sub.status,
            is_verified=sub.is_verified,
            created_at=sub.created_at,
            answer_count=len(sub.answers)
        )
        for sub in sorted(exam.submissions, key=lambda x: x.created_at, reverse=True)
    ]


@router.post(
    "/submissions/{submission_id}/verify",
    response_model=SubmissionResponse,
    summary="Verify submission",
    description="Save teacher-verified answers and mark submission as verified."
)
async def verify_submission(
    submission_id: uuid_lib.UUID,
    request: VerifySubmissionRequest,
    session: Session = Depends(get_session)
) -> SubmissionResponse:
    """
    Verify and save teacher-corrected answers.
    
    Args:
        submission_id: UUID of the submission.
        request: Verified answers from teacher.
        session: Database session (injected).
        
    Returns:
        Updated submission data.
        
    Raises:
        NotFoundException: If submission not found.
    """
    statement = select(Submission).where(Submission.id == submission_id)
    submission = session.exec(statement).first()
    
    if not submission:
        raise NotFoundException("Submission", submission_id)
    
    logger.info(f"Verifying submission {submission_id}")
    
    # Create lookup for answers by question number
    answer_map = {ans.question_number: ans for ans in submission.answers}
    
    # Update verified text for each answer
    for verified in request.answers:
        question_num = verified.get("question_number")
        verified_text = verified.get("verified_text", "")
        
        if question_num in answer_map:
            answer_map[question_num].verified_text = verified_text
    
    # Mark submission as verified
    submission.is_verified = True
    submission.status = "verified"
    submission.updated_at = datetime.utcnow()
    
    session.commit()
    session.refresh(submission)
    
    logger.info(f"Submission {submission_id} verified successfully")
    
    return _build_submission_response(submission)
