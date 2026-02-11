"""Pydantic schemas for organization-related API operations."""
import uuid
from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, Field


# ============ Organization Schemas ============

class OrganizationCreate(BaseModel):
    """Schema for creating a new organization."""
    name: str = Field(..., min_length=2, max_length=200)
    description: Optional[str] = Field(None, max_length=1000)


class OrganizationUpdate(BaseModel):
    """Schema for updating an existing organization."""
    name: Optional[str] = Field(None, min_length=2, max_length=200)
    description: Optional[str] = Field(None, max_length=1000)


class OrganizationResponse(BaseModel):
    """Response schema for an organization."""
    id: uuid.UUID
    name: str
    description: Optional[str]
    owner_id: uuid.UUID
    is_active: bool
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class OrganizationDetailResponse(OrganizationResponse):
    """Detailed response with member/class counts."""
    member_count: int = 0
    class_count: int = 0
    owner_name: Optional[str] = None


class OrganizationMemberResponse(BaseModel):
    """Response schema for an organization member."""
    id: uuid.UUID
    user_id: uuid.UUID
    user_name: str
    user_email: str
    role: str
    created_at: datetime

    model_config = {"from_attributes": True}


class AddMemberRequest(BaseModel):
    """Schema for adding a teacher to an organization."""
    email: str = Field(..., description="Email of the teacher to add")
    role: str = Field(default="teacher", pattern="^(teacher|owner)$")
