"""
Pydantic schemas for request/response validation.

Defines all API input and output schemas with validation rules.
"""
import uuid
from datetime import datetime
from typing import Optional, List, Any
from pydantic import BaseModel, Field, field_validator


# ============ Base Schemas ============

class SuccessResponse(BaseModel):
    """Standard success response."""
    success: bool = True
    message: str


class PaginatedResponse(BaseModel):
    """Base for paginated responses."""
    total: int
    page: int
    page_size: int
    has_more: bool


# ============ Question Schemas ============

class QuestionCreate(BaseModel):
    """Schema for creating a new question."""
    question_number: int
    text: str = Field(..., min_length=1)
    max_marks: int = Field(..., gt=0)
    ideal_answer: str = Field(..., min_length=1)


class QuestionResponse(BaseModel):
    """Schema for question in API responses."""
    id: uuid.UUID
    question_number: int
    text: str
    max_marks: int
    ideal_answer: str
    ai_rubric: Optional[str] = None

    class Config:
        from_attributes = True


# ============ Exam Schemas ============

class ExamCreate(BaseModel):
    """Schema for creating a new exam."""
    title: str = Field(..., min_length=1)
    subject: str = Field(..., min_length=1)
    questions: List[QuestionCreate]


class ExamResponse(BaseModel):
    """Schema for exam in API responses."""
    id: uuid.UUID
    title: str
    subject: str
    total_marks: int
    is_finalized: bool
    created_at: datetime
    updated_at: datetime
    questions: List[QuestionResponse] = []

    class Config:
        from_attributes = True


class ExamListResponse(BaseModel):
    """Schema for listing exams (without full question details)."""
    id: uuid.UUID
    title: str
    subject: str
    total_marks: int
    is_finalized: bool
    created_at: datetime
    question_count: int = 0

    class Config:
        from_attributes = True


# ============ Verification Schemas ============

class QuestionForVerification(BaseModel):
    """Question data sent for AI verification."""
    question_number: int
    text: str
    max_marks: int
    ideal_answer: str


class VerifyTemplateRequest(BaseModel):
    """Request body for /verify-template endpoint."""
    title: str
    subject: str
    questions: List[QuestionForVerification]


class AIQuestionRubric(BaseModel):
    """AI-generated rubric for a single question."""
    question_number: int
    key_concepts: List[str]
    grading_criteria: str
    marks: int


class VerifyTemplateResponse(BaseModel):
    """Response from /verify-template endpoint."""
    questions: List[AIQuestionRubric]
    total_marks: int
    suggestions: List[str] = []
    raw_interpretation: Optional[str] = None


# ============ Finalize Schemas ============

class FinalizeExamRequest(BaseModel):
    """Request to finalize and save an exam."""
    title: str
    subject: str
    questions: List[QuestionCreate]
    ai_rubrics: List[AIQuestionRubric]


# ============ Submission & Digitization Schemas ============

class ExtractedAnswer(BaseModel):
    """AI-extracted answer for a single question."""
    question_number: int
    extracted_text: str
    confidence: float = Field(..., ge=0, le=1)


class DigitizeResponse(BaseModel):
    """Response from /digitize-submission endpoint."""
    submission_id: uuid.UUID
    answers: List[ExtractedAnswer]
    original_image_url: str
    processed_image_url: Optional[str] = None


class StudentAnswerResponse(BaseModel):
    """Schema for student answer in API responses."""
    id: uuid.UUID
    question_id: uuid.UUID
    question_number: int
    extracted_text: str
    verified_text: Optional[str] = None
    confidence: float
    marks_awarded: Optional[int] = None

    class Config:
        from_attributes = True


class SubmissionResponse(BaseModel):
    """Schema for submission in API responses."""
    id: uuid.UUID
    exam_id: uuid.UUID
    student_name: Optional[str] = None
    student_id: Optional[str] = None
    status: str
    is_verified: bool
    original_image_url: str
    created_at: datetime
    answers: List[StudentAnswerResponse] = []

    class Config:
        from_attributes = True


class VerifySubmissionRequest(BaseModel):
    """Request to verify and save corrected answers."""
    answers: List[dict]  # [{question_number: int, verified_text: str}]


class SubmissionListResponse(BaseModel):
    """Schema for listing submissions."""
    id: uuid.UUID
    exam_id: uuid.UUID
    exam_title: str
    student_name: Optional[str] = None
    status: str
    is_verified: bool
    created_at: datetime
    answer_count: int = 0

    class Config:
        from_attributes = True
