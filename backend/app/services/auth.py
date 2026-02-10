"""
Authentication service for user management and JWT tokens.

Handles password hashing, JWT token generation/validation, and OAuth flows.
"""
import uuid
import secrets
from datetime import datetime, timedelta
from typing import Optional, Tuple
from passlib.context import CryptContext
from jose import JWTError, jwt
from sqlmodel import Session, select

from ..config import get_settings
from ..models import User, RefreshToken, UserRole, AuthProvider
from ..logging_config import get_logger
from ..exceptions import (
    ValidationException,
    AuthorizationException,
    NotFoundException
)

settings = get_settings()
logger = get_logger(__name__)

# Password hashing context - using argon2 for better security and support for longer passwords
pwd_context = CryptContext(schemes=["argon2"], deprecated="auto")


class AuthService:
    """Service for authentication operations."""
    
    # ============ Password Operations ============
    
    @staticmethod
    def hash_password(password: str) -> str:
        """
        Hash a password using argon2.
        
        Args:
            password: Plain text password (supports unlimited length).
            
        Returns:
            Hashed password string.
        """
        return pwd_context.hash(password)
    
    @staticmethod
    def verify_password(plain_password: str, hashed_password: str) -> bool:
        """
        Verify a password against its hash.
        
        Args:
            plain_password: Plain text password to verify (supports unlimited length).
            hashed_password: Stored hash to verify against.
            
        Returns:
            True if password matches, False otherwise.
        """
        return pwd_context.verify(plain_password, hashed_password)
    
    # ============ Token Operations ============
    
    @staticmethod
    def create_access_token(
        user_id: str,
        email: str,
        role: str,
        expires_delta: Optional[timedelta] = None
    ) -> str:
        """
        Create a JWT access token.
        
        Args:
            user_id: User's UUID string.
            email: User's email.
            role: User's role.
            expires_delta: Optional custom expiration time.
            
        Returns:
            Encoded JWT token string.
        """
        if expires_delta:
            expire = datetime.utcnow() + expires_delta
        else:
            expire = datetime.utcnow() + timedelta(
                minutes=settings.access_token_expire_minutes
            )
        
        payload = {
            "sub": user_id,
            "email": email,
            "role": role,
            "exp": expire,
            "type": "access"
        }
        
        return jwt.encode(
            payload,
            settings.jwt_secret_key,
            algorithm=settings.jwt_algorithm
        )
    
    @staticmethod
    def create_refresh_token() -> Tuple[str, datetime]:
        """
        Create a refresh token.
        
        Returns:
            Tuple of (token_string, expiration_datetime).
        """
        token = secrets.token_urlsafe(64)
        expires_at = datetime.utcnow() + timedelta(
            days=settings.refresh_token_expire_days
        )
        return token, expires_at
    
    @staticmethod
    def decode_access_token(token: str) -> Optional[dict]:
        """
        Decode and validate a JWT access token.
        
        Args:
            token: JWT token string.
            
        Returns:
            Decoded payload dict, or None if invalid.
        """
        try:
            payload = jwt.decode(
                token,
                settings.jwt_secret_key,
                algorithms=[settings.jwt_algorithm]
            )
            if payload.get("type") != "access":
                return None
            return payload
        except JWTError as e:
            logger.debug(f"JWT decode error: {e}")
            return None
    
    # ============ User Operations ============
    
    def register_user(
        self,
        session: Session,
        email: str,
        password: str,
        name: str,
        role: UserRole,
        organization_name: Optional[str] = None
    ) -> User:
        """
        Register a new user with email and password.
        
        Args:
            session: Database session.
            email: User's email address.
            password: Plain text password.
            name: User's display name.
            role: User role (teacher/student).
            organization_name: Organization name (required for teachers).
            
        Returns:
            Created User instance.
            
        Raises:
            ValidationException: If validation fails or email exists.
        """
        # Validate email doesn't exist
        existing = session.exec(
            select(User).where(User.email == email.lower())
        ).first()
        
        if existing:
            raise ValidationException(
                "Email already registered",
                detail="An account with this email already exists"
            )
        
        # Validate organization for teachers
        if role == UserRole.TEACHER and not organization_name:
            raise ValidationException(
                "Organization name is required for teachers"
            )
        
        # Create user
        user = User(
            email=email.lower(),
            name=name,
            hashed_password=self.hash_password(password),
            role=role.value,
            organization_name=organization_name,
            auth_provider=AuthProvider.LOCAL.value,
            is_verified=False  # Email verification can be added later
        )
        
        session.add(user)
        session.flush()  # Write to DB within transaction
        session.refresh(user)
        
        logger.info(f"Registered new user: {email} as {role.value}")
        return user
    
    def authenticate_user(
        self,
        session: Session,
        email: str,
        password: str
    ) -> User:
        """
        Authenticate a user with email and password.
        
        Args:
            session: Database session.
            email: User's email.
            password: Plain text password.
            
        Returns:
            Authenticated User instance.
            
        Raises:
            AuthorizationException: If credentials are invalid.
        """
        user = session.exec(
            select(User).where(User.email == email.lower())
        ).first()
        
        if not user:
            # Use same error to prevent email enumeration
            raise AuthorizationException("Invalid email or password")
        
        if not user.hashed_password:
            raise AuthorizationException(
                "This account uses Google Sign-In. Please log in with Google."
            )
        
        if not self.verify_password(password, user.hashed_password):
            raise AuthorizationException("Invalid email or password")
        
        if not user.is_active:
            raise AuthorizationException("Account is deactivated")
        
        # Update last login
        user.last_login_at = datetime.utcnow()
        # Commit handled by session dependency
        
        logger.info(f"User authenticated: {email}")
        return user
    
    def create_session_tokens(
        self,
        session: Session,
        user: User,
        user_agent: Optional[str] = None,
        ip_address: Optional[str] = None
    ) -> Tuple[str, str]:
        """
        Create access and refresh tokens for a user session.
        
        Args:
            session: Database session.
            user: Authenticated user.
            user_agent: Client user agent string.
            ip_address: Client IP address.
            
        Returns:
            Tuple of (access_token, refresh_token).
        """
        # Create access token
        access_token = self.create_access_token(
            user_id=str(user.id),
            email=user.email,
            role=user.role
        )
        
        # Create and store refresh token
        refresh_token_str, expires_at = self.create_refresh_token()
        
        refresh_token = RefreshToken(
            user_id=user.id,
            token=refresh_token_str,
            expires_at=expires_at,
            user_agent=user_agent,
            ip_address=ip_address
        )
        session.add(refresh_token)
        session.flush()  # Ensure token is written before returning
        
        return access_token, refresh_token_str
    
    def refresh_access_token(
        self,
        session: Session,
        refresh_token_str: str
    ) -> Tuple[str, str]:
        """
        Refresh an access token using a refresh token.
        
        Args:
            session: Database session.
            refresh_token_str: Refresh token string.
            
        Returns:
            Tuple of (new_access_token, new_refresh_token).
            
        Raises:
            AuthorizationException: If refresh token is invalid.
        """
        # Find refresh token
        refresh_token = session.exec(
            select(RefreshToken).where(RefreshToken.token == refresh_token_str)
        ).first()
        
        if not refresh_token:
            raise AuthorizationException("Invalid refresh token")
        
        if refresh_token.is_revoked:
            raise AuthorizationException("Refresh token has been revoked")
        
        if refresh_token.expires_at < datetime.utcnow():
            raise AuthorizationException("Refresh token has expired")
        
        # Get user
        user = session.exec(
            select(User).where(User.id == refresh_token.user_id)
        ).first()
        
        if not user or not user.is_active:
            raise AuthorizationException("User account is not active")
        
        # Revoke old refresh token (rotation)
        refresh_token.is_revoked = True
        
        # Create new tokens
        return self.create_session_tokens(
            session,
            user,
            refresh_token.user_agent,
            refresh_token.ip_address
        )
    
    def revoke_refresh_token(
        self,
        session: Session,
        refresh_token_str: str
    ) -> None:
        """
        Revoke a refresh token (logout).
        
        Args:
            session: Database session.
            refresh_token_str: Refresh token to revoke.
        """
        refresh_token = session.exec(
            select(RefreshToken).where(RefreshToken.token == refresh_token_str)
        ).first()
        
        if refresh_token:
            refresh_token.is_revoked = True
            # Commit handled by session dependency
            logger.info(f"Revoked refresh token for user {refresh_token.user_id}")
    
    def revoke_all_user_tokens(
        self,
        session: Session,
        user_id: uuid.UUID
    ) -> None:
        """
        Revoke all refresh tokens for a user (logout everywhere).
        
        Args:
            session: Database session.
            user_id: User's UUID.
        """
        tokens = session.exec(
            select(RefreshToken).where(
                (RefreshToken.user_id == user_id) & (RefreshToken.is_revoked == False)
            )
        ).all()
        
        for token in tokens:
            token.is_revoked = True
        
        # Commit handled by session dependency
        logger.info(f"Revoked all tokens for user {user_id}")
    
    # ============ Google OAuth ============
    
    def get_or_create_google_user(
        self,
        session: Session,
        google_id: str,
        email: str,
        name: str,
        role: UserRole
    ) -> User:
        """
        Get existing user or create new one from Google OAuth.
        
        Args:
            session: Database session.
            google_id: Google user ID.
            email: User's email from Google.
            name: User's name from Google.
            role: Selected role (teacher/student).
            
        Returns:
            User instance.
        """
        # First check by Google ID
        user = session.exec(
            select(User).where(User.google_id == google_id)
        ).first()
        
        if user:
            user.last_login_at = datetime.utcnow()
            # Commit handled by session dependency
            return user
        
        # Check by email (user might have registered with email first)
        user = session.exec(
            select(User).where(User.email == email.lower())
        ).first()
        
        if user:
            # Link Google account to existing user
            user.google_id = google_id
            user.auth_provider = AuthProvider.GOOGLE.value
            user.last_login_at = datetime.utcnow()
            # Commit handled by session dependency
            return user
        
        # Create new user
        user = User(
            email=email.lower(),
            name=name,
            google_id=google_id,
            auth_provider=AuthProvider.GOOGLE.value,
            role=role.value,
            is_verified=True  # Google accounts are pre-verified
        )
        
        session.add(user)
        session.flush()  # Write to DB within transaction
        session.refresh(user)
        
        logger.info(f"Created Google user: {email} as {role.value}")
        return user


# Singleton instance
auth_service = AuthService()
