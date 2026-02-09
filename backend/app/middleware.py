"""
Custom middleware for request processing.

Includes security headers, request logging, and performance monitoring.
"""
import time
import uuid
from typing import Callable
from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware

from .logging_config import get_logger
from .config import get_settings

settings = get_settings()
logger = get_logger(__name__)


class RequestLoggingMiddleware(BaseHTTPMiddleware):
    """Log all incoming requests with timing information."""
    
    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        # Generate request ID for tracing
        request_id = str(uuid.uuid4())[:8]
        
        # Start timing
        start_time = time.perf_counter()
        
        # Add request ID to state for use in handlers
        request.state.request_id = request_id
        
        # Log request
        logger.info(
            f"[{request_id}] {request.method} {request.url.path} "
            f"- Client: {request.client.host if request.client else 'unknown'}"
        )
        
        try:
            response = await call_next(request)
            
            # Calculate duration
            duration_ms = (time.perf_counter() - start_time) * 1000
            
            # Log response
            logger.info(
                f"[{request_id}] Completed {response.status_code} "
                f"in {duration_ms:.2f}ms"
            )
            
            # Add request ID to response headers
            response.headers["X-Request-ID"] = request_id
            response.headers["X-Response-Time"] = f"{duration_ms:.2f}ms"
            
            return response
            
        except Exception as e:
            duration_ms = (time.perf_counter() - start_time) * 1000
            logger.error(
                f"[{request_id}] Failed after {duration_ms:.2f}ms - {str(e)}"
            )
            raise


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    """Add security headers to all responses."""
    
    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        response = await call_next(request)
        
        # Security headers
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["X-XSS-Protection"] = "1; mode=block"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        
        # Only add HSTS in production
        if settings.is_production:
            response.headers["Strict-Transport-Security"] = (
                "max-age=31536000; includeSubDomains"
            )
        
        return response


class FileSizeLimitMiddleware(BaseHTTPMiddleware):
    """Limit request body size for file uploads."""
    
    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        # Check content length header
        content_length = request.headers.get("content-length")
        
        if content_length:
            content_length = int(content_length)
            if content_length > settings.max_upload_size_bytes:
                from fastapi.responses import JSONResponse
                return JSONResponse(
                    status_code=413,
                    content={
                        "success": False,
                        "error": f"File too large. Maximum size is {settings.max_upload_size_mb}MB",
                        "code": "FILE_TOO_LARGE"
                    }
                )
        
        return await call_next(request)
