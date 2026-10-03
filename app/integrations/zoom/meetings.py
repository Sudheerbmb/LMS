"""
Zoom Meetings API Service
Handles meeting lifecycle: creation, update, retrieval, deletion, and ending.
"""
import logging
from typing import Any, Dict, List, Optional

from app.integrations.zoom.client import ZoomClient, zoom_client
from app.integrations.zoom.schemas import (
    ZoomMeetingCreateRequest,
    ZoomMeetingResponse,
    ZoomMeetingUpdateRequest,
)

logger = logging.getLogger(__name__)


class ZoomMeetingsService:
    def __init__(self, client: Optional[ZoomClient] = None):
        self.client = client or zoom_client

    async def create_meeting(
        self,
        request: ZoomMeetingCreateRequest,
        host_user_id: str = "me",
    ) -> ZoomMeetingResponse:
        """
        Creates a scheduled Zoom meeting under the specified host user ID (defaults to 'me').
        """
        payload = request.model_dump(exclude_none=True)
        # Flatten settings if provided as object
        if "settings" in payload and isinstance(payload["settings"], dict):
            payload["settings"] = {k: v for k, v in payload["settings"].items() if v is not None}

        logger.info("Creating Zoom meeting for host %s: %s at %s", host_user_id, request.topic, request.start_time)
        data = await self.client.post(f"/users/{host_user_id}/meetings", json_data=payload)
        return ZoomMeetingResponse.model_validate(data)

    async def get_meeting(self, meeting_id: int | str) -> ZoomMeetingResponse:
        """
        Fetches live/scheduled meeting details.
        """
        data = await self.client.get(f"/meetings/{meeting_id}")
        return ZoomMeetingResponse.model_validate(data)

    async def update_meeting(
        self,
        meeting_id: int | str,
        request: ZoomMeetingUpdateRequest,
    ) -> None:
        """
        Updates an existing scheduled Zoom meeting.
        """
        payload = request.model_dump(exclude_none=True)
        if "settings" in payload and isinstance(payload["settings"], dict):
            payload["settings"] = {k: v for k, v in payload["settings"].items() if v is not None}

        logger.info("Updating Zoom meeting %s: %s", meeting_id, payload)
        await self.client.patch(f"/meetings/{meeting_id}", json_data=payload)

    async def delete_meeting(self, meeting_id: int | str) -> None:
        """
        Deletes/cancels a Zoom meeting.
        """
        logger.info("Deleting Zoom meeting %s", meeting_id)
        await self.client.delete(f"/meetings/{meeting_id}")

    async def end_meeting(self, meeting_id: int | str) -> None:
        """
        Forcefully ends an active Zoom meeting session for all participants.
        """
        logger.info("Ending Zoom meeting session %s", meeting_id)
        await self.client.put(f"/meetings/{meeting_id}/status", json_data={"action": "end"})


# Global Meetings Service instance
zoom_meetings_service = ZoomMeetingsService()
