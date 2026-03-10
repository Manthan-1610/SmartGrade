"""
Pydantic schemas for exam, submission, and grading API operations.

Supports flexible question numbering, time windows, AI grading,
and teacher review/publishing workflows.
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
    question_number: str = Field(..., min_length=1, max_length=20,
                                  description="Flexible: '1', '1a', 'I', etc.")
    text: str = Field(..., min_length=1)
    max_marks: float = Field(..., gt=0)
    ideal_answer: str = Field(..., min_length=1)
    evaluation_rubric: Optional[str] = None
    order: int = 0


class QuestionResponse(BaseModel):
    """Schema for question in API responses."""
    id: uuid.UUID
    question_number: str
    text: str
    max_marks: float
    ideal_answer: str
    evaluation_rubric: Optional[str] = None
    ai_rubric: Optional[str] = None
    order: int = 0

    model_config = {"from_attributes": True}


# ============ Exam Schemas ============

class ExamCreate(BaseModel):
    """Schema for creating a new exam."""
    title: str = Field(..., min_length=1)
    subject: str = Field(..., min_length=1)
    class_id: uuid.UUID
    start_time: Optional[datetime] = None
    end_time: Optional[datetime] = None
    grace_period_minutes: int = Field(default=5, ge=0)
    questions: List[QuestionCreate]

    @field_validator("end_time")
    @classmethod
    def end_after_start(cls, v: Optional[datetime], info) -> Optional[datetime]:
        start = info.data.get("start_time")
        if v and start and v <= start:
            raise ValueError("end_time must be after start_time")
        return v


class ExamUpdate(BaseModel):
    """Schema for updating an exam."""
    title: Optional[str] = Field(None, min_length=1)
    subject: Optional[str] = Field(None, min_length=1)
    start_time: Optional[datetime] = None
    end_time: Optional[datetime] = None
    grace_period_minutes: Optional[int] = Field(None, ge=0)


class ExamResponse(BaseModel):
    """Schema for exam in API responses."""
    id: uuid.UUID
    title: str
    subject: str
    class_id: uuid.UUID
    class_name: Optional[str] = None
    total_marks: float
    is_finalized: bool
    status: str
    start_time: Optional[datetime] = None
    end_time: Optional[datetime] = None
    grace_period_minutes: int = 5
    is_published: bool = False
    created_by: uuid.UUID
    created_at: datetime
    updated_at: datetime
    questions: List[QuestionResponse] = []

    model_config = {"from_attributes": True}


class ExamListResponse(BaseModel):
    """Schema for listing exams (without full question details)."""
    id: uuid.UUID
    title: str
    subject: str
    class_id: uuid.UUID
    class_name: Optional[str] = None
    total_marks: float
    is_finalized: bool
    status: str
    start_time: Optional[datetime] = None
    end_time: Optional[datetime] = None
    is_published: bool = False
    created_at: datetime
    question_count: int = 0
    submission_count: int = 0

    model_config = {"from_attributes": True}


class ExamTimeInfo(BaseModel):
    """
    Time information for a student taking an exam.
    
    Includes the student's effective deadline (with any extensions).
    Used by the frontend to show countdown timer.
    """
    exam_id: uuid.UUID
    exam_title: str
    start_time: Optional[datetime] = None
    end_time: Optional[datetime] = None
    effective_deadline: Optional[datetime] = None
    grace_period_minutes: int = 5
    has_extension: bool = False
    server_time: datetime
    is_open: bool = False
    is_expired: bool = False


# ============ Exam Extension Schemas ============

class ExamExtensionCreate(BaseModel):
    """Schema for granting a student an exam extension."""
    student_id: uuid.UUID
    extended_end_time: datetime
    reason: Optional[str] = Field(None, max_length=500)


class ExamExtensionResponse(BaseModel):
    """Response schema for an exam extension."""
    id: uuid.UUID
    exam_id: uuid.UUID
    student_id: uuid.UUID
    student_name: Optional[str] = None
    extended_end_time: datetime
    reason: Optional[str] = None
    granted_by: uuid.UUID
    created_at: datetime

    model_config = {"from_attributes": True}


# ============ Verification Schemas ============

class QuestionForVerification(BaseModel):
    """Question data sent for AI verification."""
    question_number: str
    text: str
    max_marks: float
    ideal_answer: str
    evaluation_rubric: Optional[str] = None


class VerifyTemplateRequest(BaseModel):
    """Request body for /verify-template endpoint."""
    title: str
    subject: str
    questions: List[QuestionForVerification]


class AIQuestionRubric(BaseModel):
    """AI-generated rubric for a single question."""
    question_number: str
    key_concepts: List[str]
    grading_criteria: str
    marks: float


class VerifyTemplateResponse(BaseModel):
    """Response from /verify-template endpoint."""
    questions: List[AIQuestionRubric]
    total_marks: float
    suggestions: List[str] = []
    raw_interpretation: Optional[str] = None


# ============ Finalize Schemas ============

class FinalizeExamRequest(BaseModel):
    """Request to finalize and save an exam."""
    title: str
    subject: str
    class_id: uuid.UUID
    start_time: Optional[datetime] = None
    end_time: Optional[datetime] = None
    grace_period_minutes: int = 5
    questions: List[QuestionCreate]
    ai_rubrics: List[AIQuestionRubric]


# ============ Submission Schemas ============

class ExtractedAnswer(BaseModel):
    """AI-extracted answer for a single question."""
    question_number: str
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
    question_number: str
    extracted_text: str
    verified_text: Optional[str] = None
    confidence: float

    # AI grading
    ai_marks: Optional[float] = None
    ai_feedback: Optional[str] = None
    ai_flagged_for_review: bool = False

    # Teacher grading
    teacher_marks: Optional[float] = None
    teacher_feedback: Optional[str] = None

    # Final result
    final_marks: Optional[float] = None
    is_published: bool = False

    model_config = {"from_attributes": True}


class SubmissionResponse(BaseModel):
    """Schema for submission in API responses."""
    id: uuid.UUID
    exam_id: uuid.UUID
    student_id: uuid.UUID
    student_name: Optional[str] = None
    status: str
    is_verified: bool
    file_paths: Optional[List[str]] = None
    original_image_url: Optional[str] = None
    digital_receipt_hash: Optional[str] = None
    submitted_at: datetime
    created_at: datetime
    answers: List[StudentAnswerResponse] = []

    model_config = {"from_attributes": True}


class VerifySubmissionRequest(BaseModel):
    """Request to verify and save corrected answers."""
    answers: List[dict]  # [{question_number: str, verified_text: str}]


class SubmissionListResponse(BaseModel):
    """Schema for listing submissions."""
    id: uuid.UUID
    exam_id: uuid.UUID
    exam_title: Optional[str] = None
    student_id: uuid.UUID
    student_name: Optional[str] = None
    student_email: Optional[str] = None
    status: str
    is_verified: bool
    is_missed: bool = False  # True if student didn't submit before deadline
    submitted_at: datetime
    created_at: datetime
    answer_count: int = 0
    total_marks: float = 0
    obtained_marks: float = 0

    model_config = {"from_attributes": True}


class MissedStudentResponse(BaseModel):
    """Schema for a student who missed (didn't submit) an exam."""
    student_id: uuid.UUID
    student_name: str
    student_email: str
    exam_id: uuid.UUID
    exam_title: str
    deadline: Optional[datetime] = None
    had_extension: bool = False
    extended_deadline: Optional[datetime] = None

    model_config = {"from_attributes": True}


class ExamSubmissionSummary(BaseModel):
    """Summary of exam submissions including missed students."""
    exam_id: uuid.UUID
    exam_title: str
    total_enrolled: int
    submitted_count: int
    missed_count: int
    graded_count: int
    published_count: int
    submissions: List[SubmissionListResponse] = []
    missed_students: List[MissedStudentResponse] = []

    model_config = {"from_attributes": True}


# ============ Grading Schemas ============

class GradeAnswerRequest(BaseModel):
    """Schema for a teacher grading a single answer."""
    teacher_marks: float = Field(..., ge=0)
    teacher_feedback: Optional[str] = Field(None, max_length=2000)


class BulkGradeRequest(BaseModel):
    """Schema for bulk grading multiple answers."""
    grades: List[dict]  # [{answer_id: uuid, teacher_marks: float, teacher_feedback: str}]


class PublishMarksRequest(BaseModel):
    """Schema for publishing marks (individual or bulk)."""
    submission_ids: Optional[List[uuid.UUID]] = None  # None = publish all
    publish: bool = True


# ============ Student Result Schemas ============

class StudentExamResult(BaseModel):
    """Schema for a student viewing their exam result."""
    exam_id: uuid.UUID
    exam_title: str
    subject: str
    total_marks: float
    obtained_marks: float
    percentage: float
    is_published: bool
    answers: List[StudentAnswerResponse] = []

    model_config = {"from_attributes": True}


class DigitalReceiptResponse(BaseModel):
    """Schema for a digital receipt."""
    id: uuid.UUID
    submission_id: uuid.UUID
    receipt_hash: str
    created_at: datetime

    model_config = {"from_attributes": True}
