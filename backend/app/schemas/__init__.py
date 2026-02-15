"""
SmartGrade API Schemas.

Re-exports all schemas for convenient imports throughout the application.
"""
# Base schemas
from .exam import SuccessResponse, PaginatedResponse

# Auth schemas
from .auth import (
    TeacherSignupRequest,
    StudentSignupRequest,
    LoginRequest,
    AuthTokenResponse,
    TokenRefreshResponse,
    MessageResponse,
    UserResponse,
    RefreshTokenRequest,
    GoogleAuthCallbackRequest,
)

# Organization schemas
from .organization import (
    OrganizationUpdate,
    OrganizationResponse,
    OrganizationDetailResponse,
)

# Classroom schemas
from .classroom import (
    ClassCreate,
    ClassUpdate,
    ClassResponse,
    ClassDetailResponse,
    InviteStudentRequest,
    InvitationResponse,
    InvitationActionRequest,
    EnrollmentResponse,
    EnrollmentStatusUpdate,
)

# Exam schemas
from .exam import (
    QuestionCreate,
    QuestionResponse,
    ExamCreate,
    ExamUpdate,
    ExamResponse,
    ExamListResponse,
    ExamTimeInfo,
    ExamExtensionCreate,
    ExamExtensionResponse,
    QuestionForVerification,
    VerifyTemplateRequest,
    AIQuestionRubric,
    VerifyTemplateResponse,
    FinalizeExamRequest,
    ExtractedAnswer,
    DigitizeResponse,
    StudentAnswerResponse,
    SubmissionResponse,
    VerifySubmissionRequest,
    SubmissionListResponse,
    GradeAnswerRequest,
    BulkGradeRequest,
    PublishMarksRequest,
    StudentExamResult,
    DigitalReceiptResponse,
)

__all__ = [
    # Base
    "SuccessResponse",
    "PaginatedResponse",
    # Auth
    "TeacherSignupRequest",
    "StudentSignupRequest",
    "LoginRequest",
    "AuthTokenResponse",
    "TokenRefreshResponse",
    "MessageResponse",
    "UserResponse",
    "RefreshTokenRequest",
    "GoogleAuthCallbackRequest",
    # Organization
    "OrganizationUpdate",
    "OrganizationResponse",
    "OrganizationDetailResponse",
    # Classroom
    "ClassCreate",
    "ClassUpdate",
    "ClassResponse",
    "ClassDetailResponse",
    "InviteStudentRequest",
    "InvitationResponse",
    "InvitationActionRequest",
    "EnrollmentResponse",
    "EnrollmentStatusUpdate",
    # Exam
    "QuestionCreate",
    "QuestionResponse",
    "ExamCreate",
    "ExamUpdate",
    "ExamResponse",
    "ExamListResponse",
    "ExamTimeInfo",
    "ExamExtensionCreate",
    "ExamExtensionResponse",
    "QuestionForVerification",
    "VerifyTemplateRequest",
    "AIQuestionRubric",
    "VerifyTemplateResponse",
    "FinalizeExamRequest",
    "ExtractedAnswer",
    "DigitizeResponse",
    "StudentAnswerResponse",
    "SubmissionResponse",
    "VerifySubmissionRequest",
    "SubmissionListResponse",
    "GradeAnswerRequest",
    "BulkGradeRequest",
    "PublishMarksRequest",
    "StudentExamResult",
    "DigitalReceiptResponse",
]
