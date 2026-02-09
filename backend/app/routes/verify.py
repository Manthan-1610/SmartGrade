"""
AI verification endpoints.

Provides AI-powered analysis of exam templates for rubric generation.
"""
from fastapi import APIRouter

from ..schemas import VerifyTemplateRequest, VerifyTemplateResponse
from ..services.gemini import gemini_service
from ..exceptions import ValidationException, ExternalServiceException
from ..logging_config import get_logger

router = APIRouter()
logger = get_logger(__name__)


@router.post(
    "/verify-template",
    response_model=VerifyTemplateResponse,
    summary="Analyze exam template with AI",
    description="""
    Submit an exam template for AI analysis.
    
    The AI will analyze each question and ideal answer to generate:
    - Key concepts that should be present in student answers
    - Suggested grading criteria
    - Recommendations for improving question clarity
    """
)
async def verify_template(request: VerifyTemplateRequest) -> VerifyTemplateResponse:
    """
    Verify an exam template using AI.
    
    Sends the exam questions and ideal answers to Gemini AI,
    which returns a structured grading rubric for teacher review.
    
    Args:
        request: Exam template with questions and ideal answers.
        
    Returns:
        AI-generated grading rubric with key concepts and criteria.
        
    Raises:
        ValidationException: If request validation fails.
        ExternalServiceException: If AI service fails.
    """
    # Validate request
    if not request.questions:
        raise ValidationException(
            "At least one question is required",
            detail="Cannot analyze an empty exam template"
        )
    
    if not request.title.strip():
        raise ValidationException("Exam title is required")
    
    if not request.subject.strip():
        raise ValidationException("Subject is required")
    
    # Validate each question
    for q in request.questions:
        if q.max_marks <= 0:
            raise ValidationException(
                f"Question {q.question_number} must have positive marks",
                detail=f"Current value: {q.max_marks}"
            )
        if not q.text.strip():
            raise ValidationException(
                f"Question {q.question_number} text cannot be empty"
            )
        if not q.ideal_answer.strip():
            raise ValidationException(
                f"Question {q.question_number} ideal answer cannot be empty"
            )
    
    logger.info(
        f"Analyzing exam template: {request.title} "
        f"({len(request.questions)} questions)"
    )
    
    # Generate AI rubric
    try:
        response = gemini_service.generate_rubric(
            title=request.title.strip(),
            subject=request.subject.strip(),
            questions=request.questions
        )
        
        logger.info(
            f"Generated rubric for {request.title}: "
            f"{response.total_marks} total marks"
        )
        
        return response
        
    except Exception as e:
        logger.error(f"AI verification failed: {e}")
        raise ExternalServiceException(
            "Gemini AI",
            "Failed to generate grading rubric. Please try again."
        )
