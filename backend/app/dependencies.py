"""
FastAPI dependencies for authentication and authorization.

Provides reusable dependency injection for route handlers.
"""
import uuid
from typing import Optional
from fastapi import Request, Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlmodel import Session, select

from .database import get_session
from .models import User, UserRole
from .services.auth import auth_service
from .exceptions import AuthenticationException, AuthorizationException


# Security scheme for Swagger UI
security = HTTPBearer(auto_error=False)


async def get_current_user(
    request: Request,
    session: Session = Depends(get_session),
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security)
) -> User:
    """
    Dependency to get the current authenticated user.
    
    Extracts JWT from Authorization header and validates it.
    
    Args:
        request: FastAPI request object.
        session: Database session.
        credentials: HTTP Bearer credentials.
        
    Returns:
        Authenticated User instance.
        
    Raises:
        HTTPException: If authentication fails.
    """
    if not credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authorization header missing",
            headers={"WWW-Authenticate": "Bearer"}
        )
    
    token = credentials.credentials
    payload = auth_service.decode_access_token(token)
    
    if not payload:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
            headers={"WWW-Authenticate": "Bearer"}
        )
    
    # Get user from database
    try:
        user_id = uuid.UUID(payload.get("sub"))
    except (ValueError, TypeError):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token payload",
            headers={"WWW-Authenticate": "Bearer"}
        )
    
    user = session.exec(
        select(User).where(User.id == user_id)
    ).first()
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found",
            headers={"WWW-Authenticate": "Bearer"}
        )
    
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User account is deactivated"
        )
    
    return user


async def get_current_user_optional(
    request: Request,
    session: Session = Depends(get_session),
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security)
) -> Optional[User]:
    """
    Dependency to optionally get the current user.
    
    Returns None if no valid auth token is provided instead of raising an error.
    """
    if not credentials:
        return None
    
    try:
        return await get_current_user(request, session, credentials)
    except HTTPException:
        return None


async def require_teacher(
    user: User = Depends(get_current_user)
) -> User:
    """
    Dependency to require teacher role.
    
    Args:
        user: Current authenticated user.
        
    Returns:
        User if they are a teacher.
        
    Raises:
        HTTPException: If user is not a teacher.
    """
    if user.role != UserRole.TEACHER.value:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="This action requires teacher privileges"
        )
    return user


async def require_student(
    user: User = Depends(get_current_user)
) -> User:
    """
    Dependency to require student role.
    
    Args:
        user: Current authenticated user.
        
    Returns:
        User if they are a student.
        
    Raises:
        HTTPException: If user is not a student.
    """
    if user.role != UserRole.STUDENT.value:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="This action requires student role"
        )
    return user


async def require_admin(
    user: User = Depends(get_current_user)
) -> User:
    """
    Dependency to require admin role.
    
    Args:
        user: Current authenticated user.
        
    Returns:
        User if they are an admin.
        
    Raises:
        HTTPException: If user is not an admin.
    """
    if user.role != UserRole.ADMIN.value:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="This action requires admin privileges"
        )
    return user


def require_roles(*roles: UserRole):
    """
    Factory for role-checking dependency.
    
    Args:
        *roles: Allowed roles for the endpoint.
        
    Returns:
        Dependency function that checks user role.
    """
    async def check_role(user: User = Depends(get_current_user)) -> User:
        role_values = [r.value for r in roles]
        if user.role not in role_values:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"This action requires one of: {', '.join(role_values)}"
            )
        return user
    
    return check_role
