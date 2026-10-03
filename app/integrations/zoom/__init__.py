"""
Zoom Integration Package for Acharya-LMS
"""
from app.integrations.zoom.auth import ZoomOAuthManager, zoom_oauth_manager
from app.integrations.zoom.client import ZoomClient, zoom_client
from app.integrations.zoom.exceptions import (
    ZoomApiError,
    ZoomAuthError,
    ZoomException,
    ZoomNotFoundError,
    ZoomRateLimitError,
    ZoomWebhookValidationError,
)
from app.integrations.zoom.meetings import ZoomMeetingsService, zoom_meetings_service
from app.integrations.zoom.participants import ZoomParticipantsService, zoom_participants_service
from app.integrations.zoom.recordings import ZoomRecordingsService, zoom_recordings_service
from app.integrations.zoom.schemas import (
    ZoomClassSettings,
    ZoomMeetingCreateRequest,
    ZoomMeetingRecordings,
    ZoomMeetingResponse,
    ZoomMeetingUpdateRequest,
    ZoomParticipant,
    ZoomRecordingFile,
)
from app.integrations.zoom.service import ZoomService, zoom_service
from app.integrations.zoom.webhooks import ZoomWebhookVerifier, zoom_webhook_verifier

__all__ = [
    "ZoomOAuthManager",
    "zoom_oauth_manager",
    "ZoomClient",
    "zoom_client",
    "ZoomMeetingsService",
    "zoom_meetings_service",
    "ZoomParticipantsService",
    "zoom_participants_service",
    "ZoomRecordingsService",
    "zoom_recordings_service",
    "ZoomService",
    "zoom_service",
    "ZoomWebhookVerifier",
    "zoom_webhook_verifier",
    "ZoomClassSettings",
    "ZoomMeetingCreateRequest",
    "ZoomMeetingResponse",
    "ZoomMeetingUpdateRequest",
    "ZoomParticipant",
    "ZoomRecordingFile",
    "ZoomMeetingRecordings",
    "ZoomException",
    "ZoomAuthError",
    "ZoomApiError",
    "ZoomNotFoundError",
    "ZoomRateLimitError",
    "ZoomWebhookValidationError",
]
