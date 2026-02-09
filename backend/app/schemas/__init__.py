"""
Pydantic schemas package.

Re-exports all schemas for convenient importing.
"""
# Re-export from auth schemas
from .auth import (
    TeacherSignupRequest,
    StudentSignupRequest,
    LoginRequest,
    RefreshTokenRequest,
    GoogleAuthRequest,
    GoogleAuthCallbackRequest,
    UserResponse,
    AuthTokenResponse,
    TokenRefreshResponse,
    MessageResponse
)

# Re-export from exam schemas
from .exam import (
    SuccessResponse,
    PaginatedResponse,
    QuestionCreate,
    QuestionResponse,
    ExamCreate,
    ExamResponse,
    ExamListResponse,
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
    SubmissionListResponse
)
