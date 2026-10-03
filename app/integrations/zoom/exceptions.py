"""
Custom Exceptions for Zoom Integration
"""

class ZoomException(Exception):
    """Base exception for Zoom errors."""
    def __init__(self, message: str, status_code: int = 500, details: dict = None):
        super().__init__(message)
        self.message = message
        self.status_code = status_code
        self.details = details or {}


class ZoomAuthError(ZoomException):
    """Raised when Server-to-Server OAuth fails or token is invalid."""
    pass


class ZoomApiError(ZoomException):
    """Raised when Zoom REST API returns a client or server error."""
    pass


class ZoomRateLimitError(ZoomException):
    """Raised when Zoom API rate limit is exceeded."""
    pass


class ZoomNotFoundError(ZoomException):
    """Raised when a meeting, recording, or participant resource is not found."""
    pass


class ZoomWebhookValidationError(ZoomException):
    """Raised when incoming webhook signature verification fails."""
    pass
