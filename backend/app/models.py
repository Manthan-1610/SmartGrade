"""
Database models for SmartGrade application.

Defines all SQLModel tables for users, organizations, classes, exams,
submissions, grading, and invitations.
"""
import uuid
from enum import Enum
from datetime import datetime
from typing import Optional, List
from sqlmodel import SQLModel, Field, Relationship, Column
from sqlalchemy import JSON


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


class InvitationStatus(str, Enum):
    """Class invitation status."""
    PENDING = "pending"
    ACCEPTED = "accepted"
    REJECTED = "rejected"


class EnrollmentStatus(str, Enum):
    """Student enrollment status within a class."""
    ACTIVE = "active"
    ARCHIVED = "archived"


class ExamStatus(str, Enum):
    """Lifecycle status of an exam."""
    DRAFT = "draft"
    SCHEDULED = "scheduled"
    ACTIVE = "active"
    ENDED = "ended"
    GRADING = "grading"
    PUBLISHED = "published"


class SubmissionStatus(str, Enum):
    """Student submission status."""
    NOT_SUBMITTED = "not_submitted"
    PENDING = "pending"
    PROCESSING = "processing"
    PENDING_VERIFICATION = "pending_verification"
    VERIFIED = "verified"
    GRADED = "graded"
    FAILED = "failed"


# ============ User Models ============

class User(SQLModel, table=True):
    """User account for authentication and authorization."""
    __tablename__ = "users"

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    email: str = Field(unique=True, index=True)

    # Profile
    name: str
    organization_name: Optional[str] = Field(default=None, index=True)

    # Authentication
    hashed_password: Optional[str] = None
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
    refresh_tokens: List["RefreshToken"] = Relationship(
        back_populates="user",
        sa_relationship_kwargs={"cascade": "all, delete-orphan"}
    )
    owned_organizations: List["Organization"] = Relationship(
        back_populates="owner",
        sa_relationship_kwargs={
            "foreign_keys": "[Organization.owner_id]",
            "cascade": "all, delete-orphan",
        }
    )
    taught_classes: List["Class"] = Relationship(
        back_populates="teacher",
        sa_relationship_kwargs={"foreign_keys": "[Class.teacher_id]"}
    )
    class_enrollments: List["ClassEnrollment"] = Relationship(
        back_populates="student",
        sa_relationship_kwargs={"foreign_keys": "[ClassEnrollment.student_id]"}
    )
    received_invitations: List["ClassInvitation"] = Relationship(
        back_populates="student",
        sa_relationship_kwargs={"foreign_keys": "[ClassInvitation.student_id]"}
    )
    created_exams: List["Exam"] = Relationship(
        back_populates="created_by_user",
        sa_relationship_kwargs={"foreign_keys": "[Exam.created_by]"}
    )
    submissions: List["Submission"] = Relationship(
        back_populates="student",
        sa_relationship_kwargs={"foreign_keys": "[Submission.student_id]"}
    )

    @property
    def is_teacher(self) -> bool:
        return self.role == UserRole.TEACHER.value

    @property
    def is_student(self) -> bool:
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

    user_agent: Optional[str] = None
    ip_address: Optional[str] = None

    user: Optional[User] = Relationship(back_populates="refresh_tokens")


# ============ Organization Models ============

class Organization(SQLModel, table=True):
    """Organization (coaching center, school, etc.)."""
    __tablename__ = "organizations"

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    name: str = Field(index=True)
    description: Optional[str] = None
    owner_id: uuid.UUID = Field(foreign_key="users.id", index=True)

    is_active: bool = Field(default=True)
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

    # Relationships
    owner: Optional[User] = Relationship(
        back_populates="owned_organizations",
        sa_relationship_kwargs={"foreign_keys": "[Organization.owner_id]"}
    )
    classes: List["Class"] = Relationship(
        back_populates="organization",
        sa_relationship_kwargs={"cascade": "all, delete-orphan"}
    )


# ============ Class Models ============

class Class(SQLModel, table=True):
    """A class/group within an organization, managed by a teacher."""
    __tablename__ = "classes"

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    organization_id: uuid.UUID = Field(foreign_key="organizations.id", index=True)
    name: str
    description: Optional[str] = None
    teacher_id: uuid.UUID = Field(foreign_key="users.id", index=True)
    is_archived: bool = Field(default=False)
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

    # Relationships
    organization: Optional[Organization] = Relationship(back_populates="classes")
    teacher: Optional[User] = Relationship(
        back_populates="taught_classes",
        sa_relationship_kwargs={"foreign_keys": "[Class.teacher_id]"}
    )
    enrollments: List["ClassEnrollment"] = Relationship(
        back_populates="class_",
        sa_relationship_kwargs={"cascade": "all, delete-orphan"}
    )
    invitations: List["ClassInvitation"] = Relationship(
        back_populates="class_",
        sa_relationship_kwargs={"cascade": "all, delete-orphan"}
    )
    exams: List["Exam"] = Relationship(
        back_populates="class_",
        sa_relationship_kwargs={"cascade": "all, delete-orphan"}
    )


class ClassInvitation(SQLModel, table=True):
    """Invitation sent by a teacher to a student to join a class."""
    __tablename__ = "class_invitations"

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    class_id: uuid.UUID = Field(foreign_key="classes.id", index=True)
    student_id: uuid.UUID = Field(foreign_key="users.id", index=True)
    invited_by: uuid.UUID = Field(foreign_key="users.id", index=True)
    status: str = Field(default=InvitationStatus.PENDING.value, index=True)
    created_at: datetime = Field(default_factory=datetime.utcnow)
    responded_at: Optional[datetime] = None

    # Relationships
    class_: Optional[Class] = Relationship(back_populates="invitations")
    student: Optional[User] = Relationship(
        back_populates="received_invitations",
        sa_relationship_kwargs={"foreign_keys": "[ClassInvitation.student_id]"}
    )
    invited_by_user: Optional[User] = Relationship(
        sa_relationship_kwargs={"foreign_keys": "[ClassInvitation.invited_by]"}
    )


class ClassEnrollment(SQLModel, table=True):
    """Enrollment of a student in a class (created after invitation is accepted)."""
    __tablename__ = "class_enrollments"

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    class_id: uuid.UUID = Field(foreign_key="classes.id", index=True)
    student_id: uuid.UUID = Field(foreign_key="users.id", index=True)
    status: str = Field(default=EnrollmentStatus.ACTIVE.value, index=True)
    enrolled_at: datetime = Field(default_factory=datetime.utcnow)
    archived_at: Optional[datetime] = None

    # Relationships
    class_: Optional[Class] = Relationship(back_populates="enrollments")
    student: Optional[User] = Relationship(
        back_populates="class_enrollments",
        sa_relationship_kwargs={"foreign_keys": "[ClassEnrollment.student_id]"}
    )


# ============ Exam Models ============

class Exam(SQLModel, table=True):
    """Exam template with time windows, belonging to a class."""
    __tablename__ = "exams"

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    class_id: uuid.UUID = Field(foreign_key="classes.id", index=True)
    title: str = Field(index=True)
    subject: str
    total_marks: float = 0
    is_finalized: bool = Field(default=False)

    # Time windows
    start_time: Optional[datetime] = None
    end_time: Optional[datetime] = None
    grace_period_minutes: int = Field(default=5)

    # Publishing
    status: str = Field(default=ExamStatus.DRAFT.value, index=True)
    is_published: bool = Field(default=False)

    # Creator (teacher)
    created_by: uuid.UUID = Field(foreign_key="users.id", index=True)

    # Timestamps
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

    # Relationships
    class_: Optional[Class] = Relationship(back_populates="exams")
    created_by_user: Optional[User] = Relationship(
        back_populates="created_exams",
        sa_relationship_kwargs={"foreign_keys": "[Exam.created_by]"}
    )
    questions: List["Question"] = Relationship(
        back_populates="exam",
        sa_relationship_kwargs={"cascade": "all, delete-orphan"}
    )
    submissions: List["Submission"] = Relationship(
        back_populates="exam",
        sa_relationship_kwargs={"cascade": "all, delete-orphan"}
    )
    extensions: List["ExamExtension"] = Relationship(
        back_populates="exam",
        sa_relationship_kwargs={"cascade": "all, delete-orphan"}
    )


class Question(SQLModel, table=True):
    """Individual exam question with grading criteria."""
    __tablename__ = "questions"

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    exam_id: uuid.UUID = Field(foreign_key="exams.id", index=True)
    question_number: str  # Flexible: "1", "1a", "I", "II", etc.
    text: str
    max_marks: float
    ideal_answer: str
    evaluation_rubric: Optional[str] = None
    ai_rubric: Optional[str] = None
    order: int = Field(default=0)

    # Relationships
    exam: Optional[Exam] = Relationship(back_populates="questions")
    student_answers: List["StudentAnswer"] = Relationship(back_populates="question")


class ExamExtension(SQLModel, table=True):
    """Individual time extension granted to a student for an exam."""
    __tablename__ = "exam_extensions"

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    exam_id: uuid.UUID = Field(foreign_key="exams.id", index=True)
    student_id: uuid.UUID = Field(foreign_key="users.id", index=True)
    extended_end_time: datetime
    reason: Optional[str] = None
    granted_by: uuid.UUID = Field(foreign_key="users.id")
    created_at: datetime = Field(default_factory=datetime.utcnow)

    # Relationships
    exam: Optional[Exam] = Relationship(back_populates="extensions")
    student: Optional[User] = Relationship(
        sa_relationship_kwargs={"foreign_keys": "[ExamExtension.student_id]"}
    )
    granted_by_user: Optional[User] = Relationship(
        sa_relationship_kwargs={"foreign_keys": "[ExamExtension.granted_by]"}
    )


# ============ Submission Models ============

class Submission(SQLModel, table=True):
    """A student's exam submission (photos or PDF)."""
    __tablename__ = "submissions"

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    exam_id: uuid.UUID = Field(foreign_key="exams.id", index=True)
    student_id: uuid.UUID = Field(foreign_key="users.id", index=True)

    # File storage
    file_paths: Optional[str] = None  # JSON array of file paths
    original_image_path: Optional[str] = None  # Legacy single image
    processed_image_path: Optional[str] = None

    # File metadata (JSON) — used for security checks (e.g., EXIF timestamps)
    file_metadata: Optional[str] = None  # JSON string

    # Digital receipt
    digital_receipt_hash: Optional[str] = None

    # Status tracking
    status: str = Field(default=SubmissionStatus.PENDING.value, index=True)
    is_verified: bool = Field(default=False)
    is_missed: bool = Field(default=False, index=True)  # True if student didn't submit before deadline

    # Timestamps
    server_received_at: datetime = Field(default_factory=datetime.utcnow)
    submitted_at: datetime = Field(default_factory=datetime.utcnow)
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

    # Relationships
    exam: Optional[Exam] = Relationship(back_populates="submissions")
    student: Optional[User] = Relationship(
        back_populates="submissions",
        sa_relationship_kwargs={"foreign_keys": "[Submission.student_id]"}
    )
    answers: List["StudentAnswer"] = Relationship(
        back_populates="submission",
        sa_relationship_kwargs={"cascade": "all, delete-orphan"}
    )
    receipt: Optional["DigitalReceipt"] = Relationship(
        back_populates="submission",
        sa_relationship_kwargs={"cascade": "all, delete-orphan", "uselist": False}
    )


class StudentAnswer(SQLModel, table=True):
    """Extracted and graded answer for a specific question."""
    __tablename__ = "student_answers"

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    submission_id: uuid.UUID = Field(foreign_key="submissions.id", index=True)
    question_id: uuid.UUID = Field(foreign_key="questions.id", index=True)
    question_number: str

    # Extracted text
    extracted_text: str = ""
    verified_text: Optional[str] = None

    # AI grading
    confidence: float = 0.0
    ai_marks: Optional[float] = None
    ai_feedback: Optional[str] = None
    ai_flagged_for_review: bool = Field(default=False)

    # Teacher grading
    teacher_marks: Optional[float] = None
    teacher_feedback: Optional[str] = None

    # Publishing
    is_published: bool = Field(default=False)

    created_at: datetime = Field(default_factory=datetime.utcnow)

    # Relationships
    submission: Optional[Submission] = Relationship(back_populates="answers")
    question: Optional[Question] = Relationship(back_populates="student_answers")

    @property
    def final_marks(self) -> Optional[float]:
        """Get final marks: teacher override takes precedence over AI."""
        if self.teacher_marks is not None:
            return self.teacher_marks
        return self.ai_marks


class DigitalReceipt(SQLModel, table=True):
    """Digital receipt generated upon successful submission upload."""
    __tablename__ = "digital_receipts"

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    submission_id: uuid.UUID = Field(foreign_key="submissions.id", unique=True, index=True)
    student_id: uuid.UUID = Field(foreign_key="users.id", index=True)
    exam_id: uuid.UUID = Field(foreign_key="exams.id", index=True)
    receipt_hash: str = Field(unique=True, index=True)
    file_metadata_snapshot: Optional[str] = None  # JSON
    created_at: datetime = Field(default_factory=datetime.utcnow)

    # Relationships
    submission: Optional[Submission] = Relationship(back_populates="receipt")
