"""
SmartGrade API - Main Application Entry Point

AI-powered exam grading assistant for teachers.
Provides endpoints for exam template management, submission digitization, and grading.
"""
from contextlib import asynccontextmanager
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from .config import get_settings
from .database import init_db
from .logging_config import setup_logging, get_logger
from .exceptions import SmartGradeException
from .routes import exams, verify, submissions, auth

# Initialize settings and logging
settings = get_settings()
setup_logging()
logger = get_logger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Application lifecycle manager.
    
    Handles startup and shutdown events for resource initialization
    and cleanup.
    """
    # Startup
    logger.info(f"Starting {settings.app_name} v{settings.app_version}")
    logger.info(f"Environment: {settings.environment}")
    
    try:
        init_db()
        logger.info("Application startup complete")
    except Exception as e:
        logger.critical(f"Failed to start application: {e}")
        raise
    
    yield
    
    # Shutdown
    logger.info("Application shutting down...")


# Create FastAPI application
app = FastAPI(
    title=settings.app_name,
    description="""
## SmartGrade API

AI-powered exam grading assistant that helps teachers:

- **Create Exam Templates** - Define questions, marks, and ideal answers
- **AI Rubric Generation** - Get intelligent grading criteria suggestions
- **Digitize Submissions** - OCR for handwritten answer sheets
- **Semantic Grading** - AI-powered answer evaluation (coming soon)

### Authentication
Currently in development mode. Production will require API key authentication.

### Rate Limiting
API calls are rate-limited to prevent abuse.
    """,
    version=settings.app_version,
    lifespan=lifespan,
    docs_url="/docs" if not settings.is_production else None,
    redoc_url="/redoc" if not settings.is_production else None,
)

# ============ Middleware ============

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins_list,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["*"],
    expose_headers=["X-Request-ID", "X-Response-Time"],
)


# ============ Exception Handlers ============

from fastapi.responses import JSONResponse
from fastapi import Request

@app.exception_handler(SmartGradeException)
async def smartgrade_exception_handler(request: Request, exc: SmartGradeException):
    """Handle custom SmartGrade exceptions."""
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "success": False,
            "message": exc.message,
            "detail": exc.detail,
            "errors": exc.errors
        }
    )


@app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException):
    """Handle FastAPI HTTP exceptions."""
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "success": False,
            "message": exc.detail,
            "detail": exc.detail
        }
    )


@app.exception_handler(Exception)
async def general_exception_handler(request: Request, exc: Exception):
    """Handle unexpected exceptions."""
    logger.exception(f"Unhandled exception: {exc}")
    return JSONResponse(
        status_code=500,
        content={
            "success": False,
            "message": "Internal server error",
            "detail": str(exc) if settings.debug else "An unexpected error occurred"
        }
    )

# ============ Routes ============

app.include_router(
    auth.router,
    prefix="/api/auth",
    tags=["Authentication"]
)
app.include_router(
    exams.router,
    prefix="/api",
    tags=["Exams"]
)
app.include_router(
    verify.router,
    prefix="/api",
    tags=["AI Verification"]
)
app.include_router(
    submissions.router,
    prefix="/api",
    tags=["Submissions"]
)


# ============ Health & Info Endpoints ============

@app.get("/", tags=["System"])
async def root():
    """API root - returns basic service information."""
    return {
        "service": settings.app_name,
        "version": settings.app_version,
        "status": "running",
        "docs": "/docs" if not settings.is_production else "disabled"
    }


@app.get("/health", tags=["System"])
async def health_check():
    """
    Health check endpoint for load balancers and monitoring.
    
    Returns:
        Health status and basic system info.
    """
    return {
        "status": "healthy",
        "version": settings.app_version,
        "environment": settings.environment
    }
