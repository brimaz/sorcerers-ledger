"""
Shared logger module for consistent timestamped logging across all scripts.
All components should use this logger instead of print() statements.
"""

import logging
from datetime import datetime


class TimestampFormatter(logging.Formatter):
    """Custom formatter that uses [YYYY-MM-DD HH:MM:SS] format for timestamps."""
    
    def format(self, record):
        timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        # Format: [YYYY-MM-DD HH:MM:SS] message
        return f"[{timestamp}] {record.getMessage()}"


def setup_logger(name: str = None) -> logging.Logger:
    """
    Set up and return a logger with timestamp formatting.
    
    Args:
        name: Optional logger name (defaults to root logger)
        
    Returns:
        Configured logger instance
    """
    logger = logging.getLogger(name)
    
    # Only configure if not already configured
    if not logger.handlers:
        handler = logging.StreamHandler()
        handler.setFormatter(TimestampFormatter())
        logger.addHandler(handler)
        logger.setLevel(logging.INFO)
        # Prevent propagation to root logger to avoid duplicate messages
        logger.propagate = False
    
    return logger


# Create a default logger instance for convenience
logger = setup_logger("card_game_pricing")


def log(message: str):
    """
    Convenience function to log a message with timestamp.
    This is a drop-in replacement for print() statements.
    
    Args:
        message: The message to log
    """
    logger.info(message)

