"""
Unified Zoom Service Layer for Acharya-LMS
Provides the high-level orchestration interface for classroom scheduling, attendance, recordings, and lifecycle.
"""
import logging
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional
from uuid import UUID

from app.integrations.zoom.auth import zoom_oauth_manager
from app.integrations.zoom.client import zoom_client
from app.integrations.zoom.exceptions import ZoomApiError, ZoomAuthError, ZoomException, ZoomNotFoundError
from app.integrations.zoom.meetings import zoom_meetings_service
from app.integrations.zoom.participants import zoom_participants_service
from app.integrations.zoom.recordings import zoom_recordings_service
from app.integrations.zoom.schemas import (
    ZoomClassSettings,
    ZoomMeetingCreateRequest,
    ZoomMeetingRecordings,
    ZoomMeetingResponse,
    ZoomMeetingUpdateRequest,
    ZoomParticipant,
)

logger = logging.getLogger(__name__)


class ZoomService:
    def __init__(self):
        self.oauth = zoom_oauth_manager
        self.client = zoom_client
        self.meetings = zoom_meetings_service
        self.participants = zoom_participants_service
        self.recordings = zoom_recordings_service

    def is_configured(self) -> bool:
        """Returns True if Zoom Server-to-Server OAuth credentials are configured."""
        return self.oauth.is_configured()

    async def create_meeting_for_class(
        self,
        topic: str,
        start_time_dt: datetime,
        duration_minutes: int,
        host_user_id: str = "me",
        agenda: Optional[str] = None,
        settings: Optional[ZoomClassSettings] = None,
    ) -> Optional[ZoomMeetingResponse]:
        """
        Creates a scheduled Zoom meeting for an LMS LiveClass session.
        Converts start_time to ISO 8601 UTC format.
        """
        if not self.is_configured():
            logger.info("Zoom credentials not configured; generating simulated LMS direct link.")
            return None

        # Convert to UTC ISO format
        if start_time_dt.tzinfo is None:
            utc_dt = start_time_dt.replace(tzinfo=timezone.utc)
        else:
            utc_dt = start_time_dt.astimezone(timezone.utc)
        start_time_iso = utc_dt.strftime("%Y-%m-%dT%H:%M:%SZ")

        req = ZoomMeetingCreateRequest(
            topic=topic,
            type=2,  # Scheduled meeting
            start_time=start_time_iso,
            duration=max(15, duration_minutes),
            timezone="UTC",
            agenda=agenda,
            settings=settings or ZoomClassSettings(
                auto_recording="cloud",
                waiting_room=True,
                mute_upon_entry=True,
                host_video=True,
                participant_video=True,
            ),
        )

        try:
            return await self.meetings.create_meeting(req, host_user_id=host_user_id)
        except Exception as err:
            logger.error("Failed to create Zoom meeting for '%s': %s", topic, err)
            raise

    async def update_meeting_for_class(
        self,
        meeting_id: int | str,
        topic: Optional[str] = None,
        start_time_dt: Optional[datetime] = None,
        duration_minutes: Optional[int] = None,
        agenda: Optional[str] = None,
    ) -> bool:
        """
        Updates an existing scheduled Zoom meeting.
        """
        if not self.is_configured():
            return False

        start_time_iso = None
        if start_time_dt:
            if start_time_dt.tzinfo is None:
                utc_dt = start_time_dt.replace(tzinfo=timezone.utc)
            else:
                utc_dt = start_time_dt.astimezone(timezone.utc)
            start_time_iso = utc_dt.strftime("%Y-%m-%dT%H:%M:%SZ")

        req = ZoomMeetingUpdateRequest(
            topic=topic,
            start_time=start_time_iso,
            duration=duration_minutes,
            agenda=agenda,
        )

        try:
            await self.meetings.update_meeting(meeting_id, req)
            return True
        except Exception as err:
            logger.error("Failed to update Zoom meeting %s: %s", meeting_id, err)
            return False

    async def cancel_meeting_for_class(self, meeting_id: int | str) -> bool:
        """
        Cancels/deletes an existing Zoom meeting.
        """
        if not self.is_configured():
            return False

        try:
            await self.meetings.delete_meeting(meeting_id)
            return True
        except Exception as err:
            logger.error("Failed to delete Zoom meeting %s: %s", meeting_id, err)
            return False

    async def get_past_participants(self, meeting_id_or_uuid: int | str) -> List[ZoomParticipant]:
        """
        Fetches all participants from past meeting report.
        """
        if not self.is_configured():
            return []
        return await self.participants.get_past_meeting_participants(meeting_id_or_uuid)

    async def get_recordings_and_transcript(self, meeting_id_or_uuid: int | str) -> tuple[Optional[ZoomMeetingRecordings], Optional[str]]:
        """
        Retrieves cloud recordings and downloads the audio transcript text if available.
        """
        recs, data = await self.get_recordings_and_transcript_data(meeting_id_or_uuid)
        raw_text = data.get("raw_text") if data else None
        return recs, raw_text

    async def get_recordings_and_transcript_data(self, meeting_id_or_uuid: int | str) -> tuple[Optional[ZoomMeetingRecordings], Optional[dict]]:
        """
        Retrieves cloud recordings and downloads full transcript data (text, segments, topics).
        """
        if not self.is_configured():
            return None, None

        try:
            recordings = await self.recordings.get_meeting_recordings(meeting_id_or_uuid)
            transcript_data = await self.recordings.download_transcript_data(recordings)
            return recordings, transcript_data
        except ZoomNotFoundError:
            logger.debug("Zoom cloud recording not available yet for meeting %s (404 — processing in progress)", meeting_id_or_uuid)
            return None, None
        except Exception as err:
            logger.warning("Could not fetch Zoom recordings/transcript for %s: %s", meeting_id_or_uuid, err)
            return None, None


# Global Zoom Service instance
zoom_service = ZoomService()
