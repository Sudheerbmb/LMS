import traceback

from fastapi import Request, status
from fastapi.responses import JSONResponse
from sqlalchemy.exc import IntegrityError, SQLAlchemyError

from app.platform.logging import get_logger

logger = get_logger(__name__)


# ── Domain exceptions ─────────────────────────────────────────────────────────

class LMSError(Exception):
    """Base class for all LMS domain errors."""
    status_code: int = status.HTTP_400_BAD_REQUEST

    def __init__(self, message: str) -> None:
        super().__init__(message)
        self.message = message


class NotFoundError(LMSError):
    status_code = status.HTTP_404_NOT_FOUND


class ConflictError(LMSError):
    status_code = status.HTTP_409_CONFLICT


class ForbiddenError(LMSError):
    status_code = status.HTTP_403_FORBIDDEN


class UnauthorizedError(LMSError):
    status_code = status.HTTP_401_UNAUTHORIZED


class ValidationError(LMSError):
    status_code = status.HTTP_422_UNPROCESSABLE_CONTENT


class RateLimitError(LMSError):
    status_code = status.HTTP_429_TOO_MANY_REQUESTS


# ── Exception handlers ────────────────────────────────────────────────────────

async def lms_error_handler(request: Request, exc: LMSError) -> JSONResponse:
    return JSONResponse(
        status_code=exc.status_code,
        content={"detail": exc.message, "error_type": type(exc).__name__},
    )


async def integrity_error_handler(request: Request, exc: IntegrityError) -> JSONResponse:
    orig_str = str(getattr(exc, "orig", ""))
    logger.warning("database_integrity_error", error=orig_str, path=request.url.path)
    if "ix_users_phone_number" in orig_str or "phone_number" in orig_str:
        detail_msg = "An account with this phone number already exists."
    elif "ix_users_email" in orig_str or "email" in orig_str:
        detail_msg = "An account with this email address already exists."
    else:
        detail_msg = "A resource with that value already exists."

    return JSONResponse(
        status_code=status.HTTP_409_CONFLICT,
        content={"detail": detail_msg, "error_type": "ConflictError"},
    )


async def database_error_handler(request: Request, exc: SQLAlchemyError) -> JSONResponse:
    """Return a CORS-compatible structured response while keeping details in logs."""
    logger.error("database_error", error=str(exc), path=request.url.path, traceback=traceback.format_exc())
    return JSONResponse(
        status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
        content={"detail": "Learning data is temporarily unavailable. Please retry.", "error_type": "DatabaseError"},
    )


async def unhandled_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    logger.error(
        "unhandled_exception",
        path=request.url.path,
        method=request.method,
        error=str(exc),
        traceback=traceback.format_exc(),
    )
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={"detail": "An internal server error occurred.", "error_type": "InternalError"},
    )


def register_error_handlers(app) -> None:
    app.add_exception_handler(LMSError, lms_error_handler)
    app.add_exception_handler(IntegrityError, integrity_error_handler)
    app.add_exception_handler(SQLAlchemyError, database_error_handler)
    app.add_exception_handler(Exception, unhandled_exception_handler)

