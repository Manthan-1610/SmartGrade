"""Pydantic schemas for class management API operations."""
import uuid
from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, Field


# ============ Class Schemas ============

class ClassCreate(BaseModel):
    """
    Schema for creating a new class.
    
    The class is automatically assigned to the teacher's organization.
    """
    name: str = Field(..., min_length=1, max_length=200)
    description: Optional[str] = Field(None, max_length=1000)


class ClassUpdate(BaseModel):
    """Schema for updating an existing class."""
    name: Optional[str] = Field(None, min_length=1, max_length=200)
    description: Optional[str] = Field(None, max_length=1000)


class ClassResponse(BaseModel):
    """Response schema for a class."""
    id: uuid.UUID
    name: str
    description: Optional[str]
    organization_id: uuid.UUID
    organization_name: Optional[str] = None
    teacher_id: uuid.UUID
    teacher_name: Optional[str] = None
    is_archived: bool
    created_at: datetime
    updated_at: datetime
    student_count: int = 0
    exam_count: int = 0

    model_config = {"from_attributes": True}


class ClassDetailResponse(ClassResponse):
    """Detailed class response with student/exam listings."""
    students: List["EnrollmentResponse"] = []
    pending_invitations: int = 0


# ============ Invitation Schemas ============

class InviteStudentRequest(BaseModel):
    """Schema for inviting a student to a class."""
    email: str = Field(..., description="Email of the student to invite")


class InvitationResponse(BaseModel):
    """Response schema for an invitation."""
    id: uuid.UUID
    class_id: uuid.UUID
    class_name: Optional[str] = None
    organization_name: Optional[str] = None
    student_id: uuid.UUID
    student_name: Optional[str] = None
    student_email: Optional[str] = None
    invited_by: uuid.UUID
    invited_by_name: Optional[str] = None
    status: str
    created_at: datetime
    responded_at: Optional[datetime] = None

    model_config = {"from_attributes": True}


class InvitationActionRequest(BaseModel):
    """Schema for accepting/rejecting an invitation."""
    action: str = Field(..., pattern="^(accept|reject)$")


# ============ Enrollment Schemas ============

class EnrollmentResponse(BaseModel):
    """Response schema for a class enrollment."""
    id: uuid.UUID
    class_id: uuid.UUID
    student_id: uuid.UUID
    student_name: Optional[str] = None
    student_email: Optional[str] = None
    status: str
    enrolled_at: datetime
    archived_at: Optional[datetime] = None

    model_config = {"from_attributes": True}


class EnrollmentStatusUpdate(BaseModel):
    """Schema for updating enrollment status (e.g., archive)."""
    status: str = Field(..., pattern="^(active|archived)$")


# Resolve forward reference
ClassDetailResponse.model_rebuild()
