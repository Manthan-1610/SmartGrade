"""
Custom exception classes for SmartGrade.

Provides consistent error handling across the application.
"""
from typing import Optional, Any, Dict


class SmartGradeException(Exception):
    """Base exception for all SmartGrade errors."""
    
    def __init__(
        self,
        message: str,
        status_code: int = 500,
        detail: Optional[str] = None,
        errors: Optional[Dict[str, Any]] = None
    ):
        self.message = message
        self.status_code = status_code
        self.detail = detail or message
        self.errors = errors or {}
        super().__init__(self.message)


class ValidationException(SmartGradeException):
    """Raised when request validation fails."""
    
    def __init__(
        self,
        message: str = "Validation error",
        detail: Optional[str] = None,
        errors: Optional[Dict[str, Any]] = None
    ):
        super().__init__(
            message=message,
            status_code=400,
            detail=detail,
            errors=errors
        )


class NotFoundException(SmartGradeException):
    """Raised when a requested resource is not found."""
    
    def __init__(
        self,
        message: str = "Resource not found",
        detail: Optional[str] = None
    ):
        super().__init__(
            message=message,
            status_code=404,
            detail=detail
        )


class AuthenticationException(SmartGradeException):
    """Raised when authentication fails."""
    
    def __init__(
        self,
        message: str = "Authentication required",
        detail: Optional[str] = None
    ):
        super().__init__(
            message=message,
            status_code=401,
            detail=detail
        )


class AuthorizationException(SmartGradeException):
    """Raised when authorization fails."""
    
    def __init__(
        self,
        message: str = "Access denied",
        detail: Optional[str] = None
    ):
        super().__init__(
            message=message,
            status_code=403,
            detail=detail
        )


class RateLimitException(SmartGradeException):
    """Raised when rate limit is exceeded."""
    
    def __init__(
        self,
        message: str = "Rate limit exceeded",
        detail: Optional[str] = None
    ):
        super().__init__(
            message=message,
            status_code=429,
            detail=detail
        )


class ExternalServiceException(SmartGradeException):
    """Raised when an external service call fails."""
    
    def __init__(
        self,
        message: str = "External service error",
        detail: Optional[str] = None,
        service_name: Optional[str] = None
    ):
        super().__init__(
            message=message,
            status_code=502,
            detail=detail,
            errors={"service": service_name} if service_name else {}
        )


class FileUploadException(SmartGradeException):
    """Raised when file upload or processing fails."""
    
    def __init__(
        self,
        message: str = "File upload failed",
        detail: Optional[str] = None
    ):
        super().__init__(
            message=message,
            status_code=400,
            detail=detail
        )
