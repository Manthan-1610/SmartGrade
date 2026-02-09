"""
Database configuration and session management.

Provides SQLModel engine setup and dependency injection for database sessions.
"""
from typing import Generator
from sqlmodel import SQLModel, create_engine, Session
from sqlalchemy.pool import QueuePool

from .config import get_settings
from .logging_config import get_logger

settings = get_settings()
logger = get_logger(__name__)

# Create engine with connection pooling
engine = create_engine(
    settings.database_url,
    echo=settings.db_echo_queries,
    poolclass=QueuePool,
    pool_size=settings.db_pool_size,
    max_overflow=settings.db_max_overflow,
    pool_pre_ping=True,  # Verify connections before use
)


def init_db() -> None:
    """
    Initialize database tables.
    
    Creates all tables defined in SQLModel models if they don't exist.
    Should be called once on application startup.
    """
    logger.info("Initializing database tables...")
    try:
        SQLModel.metadata.create_all(engine)
        logger.info("Database tables initialized successfully")
    except Exception as e:
        logger.error(f"Failed to initialize database: {e}")
        raise


def get_session() -> Generator[Session, None, None]:
    """
    Dependency for getting database sessions.
    
    Yields:
        Database session that auto-commits on success and rolls back on error.
        
    Usage:
        @app.get("/items")
        def get_items(session: Session = Depends(get_session)):
            ...
    """
    with Session(engine) as session:
        try:
            yield session
            session.commit()
        except Exception:
            session.rollback()
            raise


def get_session_context() -> Session:
    """
    Get a session for use outside of request context.
    
    Returns:
        Database session (caller must manage commit/rollback).
    """
    return Session(engine)
