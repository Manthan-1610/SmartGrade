"""
Authentication endpoints.

Handles user registration, login, OAuth, and token management.
"""
import httpx
from typing import Optional
from fastapi import APIRouter, Depends, Request, status, Response
from fastapi.responses import RedirectResponse
from fastapi.security import HTTPAuthorizationCredentials
from sqlmodel import Session

from ..config import get_settings
from ..database import get_session
from ..dependencies import security
from ..models import UserRole
from ..schemas.auth import (
    TeacherSignupRequest,
    StudentSignupRequest,
    LoginRequest,
    RefreshTokenRequest,
    GoogleAuthCallbackRequest,
    UserResponse,
    AuthTokenResponse,
    TokenRefreshResponse,
    MessageResponse
)
from ..services.auth import auth_service
from ..exceptions import ValidationException, AuthorizationException
from ..logging_config import get_logger

router = APIRouter()
settings = get_settings()
logger = get_logger(__name__)


def _get_client_info(request: Request) -> tuple[Optional[str], Optional[str]]:
    """Extract client information from request."""
    user_agent = request.headers.get("user-agent")
    
    # Get real IP (consider X-Forwarded-For for proxies)
    forwarded_for = request.headers.get("x-forwarded-for")
    if forwarded_for:
        ip_address = forwarded_for.split(",")[0].strip()
    else:
        ip_address = request.client.host if request.client else None
    
    return user_agent, ip_address


def _create_auth_response(
    session: Session,
    user,
    request: Request
) -> AuthTokenResponse:
    """Create authentication response with tokens."""
    user_agent, ip_address = _get_client_info(request)
    
    access_token, refresh_token = auth_service.create_session_tokens(
        session=session,
        user=user,
        user_agent=user_agent,
        ip_address=ip_address
    )
    
    return AuthTokenResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        token_type="bearer",
        expires_in=settings.access_token_expire_minutes * 60,
        user=UserResponse.model_validate(user)
    )


# ============ Registration ============

@router.post(
    "/signup/teacher",
    response_model=AuthTokenResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Register as a teacher",
    description="Create a new teacher account with organization details."
)
async def signup_teacher(
    request_data: TeacherSignupRequest,
    request: Request,
    session: Session = Depends(get_session)
) -> AuthTokenResponse:
    """
    Register a new teacher account.
    
    Requires organization name for teacher accounts.
    Returns access and refresh tokens on successful registration.
    """
    logger.info(f"Teacher signup attempt: {request_data.email}")
    
    user = auth_service.register_user(
        session=session,
        email=request_data.email,
        password=request_data.password,
        name=request_data.name,
        role=UserRole.TEACHER,
        organization_name=request_data.organization_name
    )
    
    return _create_auth_response(session, user, request)


@router.post(
    "/signup/student",
    response_model=AuthTokenResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Register as a student",
    description="Create a new student account."
)
async def signup_student(
    request_data: StudentSignupRequest,
    request: Request,
    session: Session = Depends(get_session)
) -> AuthTokenResponse:
    """
    Register a new student account.
    
    Returns access and refresh tokens on successful registration.
    """
    logger.info(f"Student signup attempt: {request_data.email}")
    
    user = auth_service.register_user(
        session=session,
        email=request_data.email,
        password=request_data.password,
        name=request_data.name,
        role=UserRole.STUDENT
    )
    
    return _create_auth_response(session, user, request)


# ============ Login ============

@router.post(
    "/login",
    response_model=AuthTokenResponse,
    summary="Login with email and password",
    description="Authenticate with email and password to receive access tokens."
)
async def login(
    request_data: LoginRequest,
    request: Request,
    session: Session = Depends(get_session)
) -> AuthTokenResponse:
    """
    Authenticate user with email and password.
    
    Returns access and refresh tokens on successful authentication.
    """
    logger.info(f"Login attempt: {request_data.email}")
    
    user = auth_service.authenticate_user(
        session=session,
        email=request_data.email,
        password=request_data.password
    )
    
    return _create_auth_response(session, user, request)


# ============ Token Management ============

@router.post(
    "/refresh",
    response_model=TokenRefreshResponse,
    summary="Refresh access token",
    description="Get a new access token using a valid refresh token."
)
async def refresh_token(
    request_data: RefreshTokenRequest,
    session: Session = Depends(get_session)
) -> TokenRefreshResponse:
    """
    Refresh access token using refresh token.
    
    The old refresh token is revoked and a new one is issued (rotation).
    """
    access_token, new_refresh_token = auth_service.refresh_access_token(
        session=session,
        refresh_token_str=request_data.refresh_token
    )
    
    return TokenRefreshResponse(
        access_token=access_token,
        refresh_token=new_refresh_token,
        token_type="bearer",
        expires_in=settings.access_token_expire_minutes * 60
    )


@router.post(
    "/logout",
    response_model=MessageResponse,
    summary="Logout",
    description="Revoke the refresh token to end the session."
)
async def logout(
    request_data: RefreshTokenRequest,
    session: Session = Depends(get_session)
) -> MessageResponse:
    """
    Logout by revoking the refresh token.
    
    The access token remains valid until expiration but cannot be refreshed.
    """
    auth_service.revoke_refresh_token(
        session=session,
        refresh_token_str=request_data.refresh_token
    )
    
    return MessageResponse(message="Successfully logged out")


# ============ Google OAuth ============

@router.get(
    "/google/url",
    summary="Get Google OAuth URL",
    description="Get the URL to redirect users to for Google Sign-In."
)
async def get_google_auth_url(role: str = "student"):
    """
    Get Google OAuth authorization URL.
    
    Frontend should redirect the user to this URL for Google Sign-In.
    """
    if not settings.google_client_id:
        raise ValidationException(
            "Google OAuth is not configured",
            detail="Please configure GOOGLE_CLIENT_ID in environment"
        )
    
    # Validate role
    try:
        UserRole(role)
    except ValueError:
        raise ValidationException(f"Invalid role: {role}")
    
    # Build OAuth URL
    params = {
        "client_id": settings.google_client_id,
        "redirect_uri": settings.google_redirect_uri,
        "response_type": "code",
        "scope": "openid email profile",
        "state": role,  # Pass role through state parameter
        "access_type": "offline",
        "prompt": "consent"
    }
    
    query_string = "&".join(f"{k}={v}" for k, v in params.items())
    auth_url = f"https://accounts.google.com/o/oauth2/v2/auth?{query_string}"
    
    return {"auth_url": auth_url}


@router.post(
    "/google/callback",
    response_model=AuthTokenResponse,
    summary="Google OAuth callback",
    description="Handle Google OAuth callback with authorization code."
)
async def google_callback(
    request_data: GoogleAuthCallbackRequest,
    request: Request,
    session: Session = Depends(get_session)
) -> AuthTokenResponse:
    """
    Handle Google OAuth with ID token from frontend.
    
    Frontend should use Google Sign-In button to get the ID token.
    """
    if not settings.google_client_id:
        raise ValidationException("Google OAuth is not configured")
    
    try:
        # Verify ID token with Google
        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"https://oauth2.googleapis.com/tokeninfo?id_token={request_data.id_token}"
            )
            
            if response.status_code != 200:
                raise AuthorizationException("Invalid Google token")
            
            google_data = response.json()
            
            # Verify audience
            if google_data.get("aud") != settings.google_client_id:
                raise AuthorizationException("Token audience mismatch")
        
        # Get or create user
        user = auth_service.get_or_create_google_user(
            session=session,
            google_id=google_data["sub"],
            email=google_data["email"],
            name=google_data.get("name", google_data["email"].split("@")[0]),
            role=request_data.role
        )
        
        return _create_auth_response(session, user, request)
        
    except httpx.RequestError as e:
        logger.error(f"Google OAuth error: {e}")
        raise AuthorizationException("Failed to verify Google token")


# ============ Current User ============

@router.get(
    "/me",
    response_model=UserResponse,
    summary="Get current user",
    description="Get the currently authenticated user's profile."
)
async def get_me(
    request: Request,
    session: Session = Depends(get_session),
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security)
) -> UserResponse:
    """
    Get current authenticated user's profile.
    
    Requires valid access token in Authorization header.
    """
    from ..dependencies import get_current_user as get_user_dep
    
    user = await get_user_dep(request, session, credentials)
    return UserResponse.model_validate(user)
