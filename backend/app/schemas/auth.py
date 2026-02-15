"""
Authentication request/response schemas.

Defines all Pydantic models for auth-related API operations.
"""
import uuid
import re
from datetime import datetime
from typing import Optional
from pydantic import BaseModel, Field, field_validator, EmailStr

from ..models import UserRole


# ============ Validators ============

def validate_password(password: str) -> str:
    """
    Validate password strength.
    
    Requirements:
    - Minimum 8 characters
    - At least one uppercase letter
    - At least one lowercase letter
    - At least one digit
    """
    if len(password) < 8:
        raise ValueError("Password must be at least 8 characters long")
    if not re.search(r"[A-Z]", password):
        raise ValueError("Password must contain at least one uppercase letter")
    if not re.search(r"[a-z]", password):
        raise ValueError("Password must contain at least one lowercase letter")
    if not re.search(r"\d", password):
        raise ValueError("Password must contain at least one digit")
    return password


# ============ Request Schemas ============

class TeacherSignupRequest(BaseModel):
    """Request schema for teacher registration."""
    name: str = Field(..., min_length=2, max_length=100)
    email: EmailStr
    organization_name: str = Field(..., min_length=2, max_length=200)
    password: str = Field(..., min_length=8, max_length=100)
    confirm_password: str = Field(..., min_length=8, max_length=100)
    
    @field_validator('password')
    @classmethod
    def password_strength(cls, v: str) -> str:
        return validate_password(v)
    
    @field_validator('confirm_password')
    @classmethod
    def passwords_match(cls, v: str, info) -> str:
        if 'password' in info.data and v != info.data['password']:
            raise ValueError("Passwords do not match")
        return v


class StudentSignupRequest(BaseModel):
    """Request schema for student registration."""
    name: str = Field(..., min_length=2, max_length=100)
    email: EmailStr
    password: str = Field(..., min_length=8, max_length=100)
    confirm_password: str = Field(..., min_length=8, max_length=100)
    
    @field_validator('password')
    @classmethod
    def password_strength(cls, v: str) -> str:
        return validate_password(v)
    
    @field_validator('confirm_password')
    @classmethod
    def passwords_match(cls, v: str, info) -> str:
        if 'password' in info.data and v != info.data['password']:
            raise ValueError("Passwords do not match")
        return v


class LoginRequest(BaseModel):
    """Request schema for email/password login."""
    email: EmailStr
    password: str


class RefreshTokenRequest(BaseModel):
    """Request schema for token refresh."""
    refresh_token: str


class GoogleAuthRequest(BaseModel):
    """Request schema for Google OAuth callback."""
    code: str
    role: UserRole = UserRole.STUDENT


class GoogleAuthCallbackRequest(BaseModel):
    """Request schema for Google OAuth with ID token (frontend flow)."""
    id_token: str
    role: UserRole = UserRole.STUDENT
    organization_name: Optional[str] = Field(
        None,
        min_length=2,
        max_length=200,
        description="Required for teacher signup"
    )


# ============ Response Schemas ============

class UserResponse(BaseModel):
    """User data in API responses."""
    id: uuid.UUID
    email: str
    name: str
    organization_name: Optional[str] = None
    role: str
    is_verified: bool
    auth_provider: str
    created_at: datetime
    
    class Config:
        from_attributes = True


class AuthTokenResponse(BaseModel):
    """Authentication tokens response."""
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    expires_in: int  # seconds
    user: UserResponse


class TokenRefreshResponse(BaseModel):
    """Token refresh response."""
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    expires_in: int


class MessageResponse(BaseModel):
    """Simple message response."""
    success: bool = True
    message: str
