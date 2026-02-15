"""
Pydantic schemas for organization-related API operations.

Each teacher has exactly one organization created during signup.
These schemas support viewing and updating organization details.
"""
import uuid
from datetime import datetime
from typing import Optional
from pydantic import BaseModel, Field


class OrganizationUpdate(BaseModel):
    """Schema for updating organization details."""
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
    """Detailed response including class count and owner info."""
    class_count: int = 0
    owner_name: Optional[str] = None
