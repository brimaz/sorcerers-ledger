"""
Shared logger module for consistent timestamped logging across all scripts.
All components should use this logger instead of print() statements.
"""

import logging
import os
import sys
from datetime import datetime
from pathlib import Path


class TimestampFormatter(logging.Formatter):
    """Custom formatter that uses [YYYY-MM-DD HH:MM:SS] format for timestamps."""
    
    def format(self, record):
        timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        # Format: [YYYY-MM-DD HH:MM:SS] message
        return f"[{timestamp}] {record.getMessage()}"


def setup_logger(name: str = None, log_file_path: str = None) -> logging.Logger:
    """
    Set up and return a logger with timestamp formatting.
    
    Args:
        name: Optional logger name (defaults to root logger)
        log_file_path: Optional path to log file. If provided, logs will be written to file.
                      If None, logs will only go to console (stdout).
        
    Returns:
        Configured logger instance
    """
    logger = logging.getLogger(name)
    
    # Only configure if not already configured
    if not logger.handlers:
        # Always add console handler (stdout)
        console_handler = logging.StreamHandler(sys.stdout)
        console_handler.setFormatter(TimestampFormatter())
        logger.addHandler(console_handler)
        
        # Add file handler if log file path is provided
        if log_file_path:
            # Ensure log directory exists
            log_dir = os.path.dirname(log_file_path)
            if log_dir:
                os.makedirs(log_dir, exist_ok=True)
            
            file_handler = logging.FileHandler(log_file_path, encoding='utf-8')
            file_handler.setFormatter(TimestampFormatter())
            logger.addHandler(file_handler)
        
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

