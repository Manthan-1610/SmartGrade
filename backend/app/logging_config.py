"""
Logging configuration for SmartGrade.

Provides structured logging with configurable levels.
"""
import logging
import sys
from typing import Optional

from .config import get_settings

settings = get_settings()


def setup_logging() -> None:
    """Configure application logging."""
    log_level = logging.DEBUG if settings.debug else logging.INFO
    
    # Configure root logger
    logging.basicConfig(
        level=log_level,
        format="%(asctime)s | %(levelname)-8s | %(name)s | %(message)s",
        datefmt="%Y-%m-%d %H:%M:%S",
        handlers=[
            logging.StreamHandler(sys.stdout)
        ]
    )
    
    # Reduce noise from third-party libraries
    logging.getLogger("httpx").setLevel(logging.WARNING)
    logging.getLogger("httpcore").setLevel(logging.WARNING)
    logging.getLogger("urllib3").setLevel(logging.WARNING)
    logging.getLogger("sqlalchemy.engine").setLevel(
        logging.INFO if settings.db_echo_queries else logging.WARNING
    )


def get_logger(name: str) -> logging.Logger:
    """
    Get a logger instance for a module.
    
    Args:
        name: Logger name (usually __name__).
        
    Returns:
        Configured Logger instance.
    """
    return logging.getLogger(name)
