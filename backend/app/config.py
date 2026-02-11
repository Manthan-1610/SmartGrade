"""
Application configuration management.

Uses Pydantic Settings for type-safe environment variable handling.
All sensitive values should be provided via environment variables or .env file.
"""
from typing import List, Union
from functools import lru_cache
from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """
    Application settings loaded from environment variables.
    
    Environment variables take precedence over .env file values.
    Never commit sensitive values to version control.
    
    All sensitive credentials MUST be provided via .env file or environment variables.
    """
    
    # Application
    app_name: str = "SmartGrade"
    app_version: str = "1.0.0"
    debug: bool = False
    environment: str = "development"
    
    # API Security
    api_key_header: str = "X-API-Key"
    allowed_origins: str = "http://localhost:5173,http://127.0.0.1:5173"
    
    # Database - MUST be set in .env
    database_url: str = ""
    db_echo_queries: bool = False
    db_pool_size: int = 5
    db_max_overflow: int = 10
    
    # AI Services - MUST be set in .env
    gemini_api_key: str = ""
    gemini_model: str = "gemini-3-pro-preview"
    
    # File Storage
    upload_dir: str = "uploads"
    max_upload_size_mb: int = 10
    allowed_image_types: str = "image/jpeg,image/png,image/webp,image/heic"
    
    # Rate Limiting
    rate_limit_requests: int = 100
    rate_limit_window_seconds: int = 60
    
    # Authentication - MUST be set in .env for production
    jwt_secret_key: str = ""
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 2880
    refresh_token_expire_days: int = 7
    
    # Google OAuth - Optional, set in .env if using Google Sign-In
    google_client_id: str = ""
    google_client_secret: str = ""
    google_redirect_uri: str = "http://localhost:5173/auth/google/callback"

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore"
    )
    
    @property
    def allowed_origins_list(self) -> List[str]:
        """Get allowed origins as a list."""
        return [origin.strip() for origin in self.allowed_origins.split(",") if origin.strip()]
    
    @property
    def allowed_image_types_list(self) -> List[str]:
        """Get allowed image types as a list."""
        return [t.strip() for t in self.allowed_image_types.split(",") if t.strip()]
    
    def validate_required_settings(self) -> None:
        """Validate that required settings are configured."""
        missing = []
        if not self.database_url:
            missing.append("DATABASE_URL")
        if not self.jwt_secret_key:
            missing.append("JWT_SECRET_KEY")
        if missing:
            raise ValueError(
                f"Missing required environment variables: {', '.join(missing)}. "
                f"Please configure them in your .env file."
            )
    
    @property
    def is_production(self) -> bool:
        """Check if running in production environment."""
        return self.environment.lower() == "production"
    
    @property
    def max_upload_size_bytes(self) -> int:
        """Get maximum upload size in bytes."""
        return self.max_upload_size_mb * 1024 * 1024


@lru_cache()
def get_settings() -> Settings:
    """
    Get cached application settings.
    
    Returns:
        Settings instance with values from environment.
    """
    return Settings()
