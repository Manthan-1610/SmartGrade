"""
Database models for SmartGrade application.

Defines all SQLModel tables for users, exams, submissions, and answers.
"""
import uuid
from enum import Enum
from datetime import datetime
from typing import Optional, List
from sqlmodel import SQLModel, Field, Relationship


# ============ Enums ============

class UserRole(str, Enum):
    """User role enumeration."""
    TEACHER = "teacher"
    STUDENT = "student"
    ADMIN = "admin"


class AuthProvider(str, Enum):
    """Authentication provider enumeration."""
    LOCAL = "local"
    GOOGLE = "google"


# ============ User Models ============

class User(SQLModel, table=True):
    """User account for authentication and authorization."""
    __tablename__ = "users"
    
    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    email: str = Field(unique=True, index=True)
    
    # Profile
    name: str
    organization_name: Optional[str] = None  # Required for teachers
    
    # Authentication
    hashed_password: Optional[str] = None  # Null for OAuth-only users
    auth_provider: str = Field(default=AuthProvider.LOCAL.value)
    google_id: Optional[str] = Field(default=None, unique=True, index=True)
    
    # Role and permissions
    role: str = Field(default=UserRole.STUDENT.value, index=True)
    is_active: bool = Field(default=True)
    is_verified: bool = Field(default=False)
    
    # Timestamps
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
    last_login_at: Optional[datetime] = None
    
    # Relationships
    exams: List["Exam"] = Relationship(back_populates="created_by_user")
    submissions: List["Submission"] = Relationship(back_populates="submitted_by_user")
    refresh_tokens: List["RefreshToken"] = Relationship(
        back_populates="user",
        sa_relationship_kwargs={"cascade": "all, delete-orphan"}
    )
    
    @property
    def is_teacher(self) -> bool:
        """Check if user is a teacher."""
        return self.role == UserRole.TEACHER.value
    
    @property
    def is_student(self) -> bool:
        """Check if user is a student."""
        return self.role == UserRole.STUDENT.value


class RefreshToken(SQLModel, table=True):
    """Refresh token for JWT authentication."""
    __tablename__ = "refresh_tokens"
    
    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    user_id: uuid.UUID = Field(foreign_key="users.id", index=True)
    token: str = Field(unique=True, index=True)
    expires_at: datetime
    is_revoked: bool = Field(default=False)
    created_at: datetime = Field(default_factory=datetime.utcnow)
    
    # Device/session info
    user_agent: Optional[str] = None
    ip_address: Optional[str] = None
    
    # Relationship
    user: Optional[User] = Relationship(back_populates="refresh_tokens")


# ============ Exam Models ============

class Question(SQLModel, table=True):
    """Individual exam question with grading criteria."""
    __tablename__ = "questions"
    
    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    exam_id: uuid.UUID = Field(foreign_key="exams.id", index=True)
    question_number: int
    text: str
    max_marks: int
    ideal_answer: str
    ai_rubric: Optional[str] = None  # Stores AI-generated grading criteria
    
    # Relationship back to exam
    exam: Optional["Exam"] = Relationship(back_populates="questions")
    # Relationship to student answers
    student_answers: List["StudentAnswer"] = Relationship(back_populates="question")


class Exam(SQLModel, table=True):
    """Exam template containing multiple questions."""
    __tablename__ = "exams"
    
    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    title: str = Field(index=True)
    subject: str
    total_marks: int = 0
    is_finalized: bool = Field(default=False)
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
    
    # Creator (teacher)
    created_by: Optional[uuid.UUID] = Field(default=None, foreign_key="users.id", index=True)
    
    # Relationship to questions
    questions: List[Question] = Relationship(
        back_populates="exam",
        sa_relationship_kwargs={"cascade": "all, delete-orphan"}
    )
    # Relationship to submissions
    submissions: List["Submission"] = Relationship(back_populates="exam")
    # Relationship to creator
    created_by_user: Optional[User] = Relationship(back_populates="exams")


class Submission(SQLModel, table=True):
    """A student's exam submission containing multiple answer images."""
    __tablename__ = "submissions"
    
    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    exam_id: uuid.UUID = Field(foreign_key="exams.id", index=True)
    student_name: Optional[str] = None
    student_id: Optional[str] = None
    
    # Submitted by (student user)
    submitted_by: Optional[uuid.UUID] = Field(default=None, foreign_key="users.id", index=True)
    
    # Image storage paths
    original_image_path: str
    processed_image_path: Optional[str] = None
    
    # Status tracking
    status: str = Field(default="pending")  # pending, processing, verified, graded
    is_verified: bool = Field(default=False)
    
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
    
    # Relationships
    exam: Optional[Exam] = Relationship(back_populates="submissions")
    submitted_by_user: Optional[User] = Relationship(back_populates="submissions")
    answers: List["StudentAnswer"] = Relationship(
        back_populates="submission",
        sa_relationship_kwargs={"cascade": "all, delete-orphan"}
    )


class StudentAnswer(SQLModel, table=True):
    """Extracted answer for a specific question from a submission."""
    __tablename__ = "student_answers"
    
    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    submission_id: uuid.UUID = Field(foreign_key="submissions.id", index=True)
    question_id: uuid.UUID = Field(foreign_key="questions.id", index=True)
    question_number: int
    
    # Extracted text
    extracted_text: str = ""
    verified_text: Optional[str] = None  # Teacher-corrected text
    
    # AI confidence score (0-1)
    confidence: float = 0.0
    
    # Grading (Phase 3)
    marks_awarded: Optional[int] = None
    ai_feedback: Optional[str] = None
    
    created_at: datetime = Field(default_factory=datetime.utcnow)
    
    # Relationships
    submission: Optional[Submission] = Relationship(back_populates="answers")
    question: Optional[Question] = Relationship(back_populates="student_answers")