"""
Zoom Participants & Meeting Reports Service
Retrieves live and past meeting participant data for attendance reconciliation.
"""
import logging
from typing import Any, Dict, List, Optional

from app.integrations.zoom.client import ZoomClient, zoom_client
from app.integrations.zoom.schemas import ZoomParticipant

logger = logging.getLogger(__name__)


class ZoomParticipantsService:
    def __init__(self, client: Optional[ZoomClient] = None):
        self.client = client or zoom_client

    async def get_past_meeting_participants(
        self,
        meeting_id_or_uuid: int | str,
        page_size: int = 300,
    ) -> List[ZoomParticipant]:
        """
        Retrieves participant records for a completed meeting from Zoom Reports API.
        Handles pagination across multiple pages if class size is large.
        """
        participants: List[ZoomParticipant] = []
        next_page_token: Optional[str] = None
        
        # Double URL encode UUID if it starts with / or contains //
        meeting_param = str(meeting_id_or_uuid)
        if meeting_param.startswith("/") or "//" in meeting_param:
            import urllib.parse
            meeting_param = urllib.parse.quote(urllib.parse.quote(meeting_param, safe=""), safe="")

        while True:
            params: Dict[str, Any] = {"page_size": page_size}
            if next_page_token:
                params["next_page_token"] = next_page_token

            try:
                # First try the report endpoint (provides full join/leave timestamps and duration)
                data = await self.client.get(
                    f"/report/meetings/{meeting_param}/participants",
                    params=params,
                )
            except Exception as err:
                logger.debug("Report endpoint unavailable for %s (%s). Falling back to /past_meetings participants...", meeting_param, err)
                # Fallback to past meetings endpoint
                data = await self.client.get(
                    f"/past_meetings/{meeting_param}/participants",
                    params=params,
                )

            raw_list = data.get("participants", [])
            for item in raw_list:
                try:
                    participants.append(ZoomParticipant.model_validate(item))
                except Exception as parse_err:
                    logger.error("Failed to parse Zoom participant record: %s (Raw: %s)", parse_err, item)

            next_page_token = data.get("next_page_token")
            if not next_page_token or not raw_list:
                break

        logger.info("Fetched %d participant entries for Zoom meeting %s", len(participants), meeting_id_or_uuid)
        return participants

    async def get_past_meeting_details(self, meeting_id_or_uuid: int | str) -> Dict[str, Any]:
        """
        Retrieves summary metrics for a past meeting session (start, end, total duration, participant count).
        """
        meeting_param = str(meeting_id_or_uuid)
        if meeting_param.startswith("/") or "//" in meeting_param:
            import urllib.parse
            meeting_param = urllib.parse.quote(urllib.parse.quote(meeting_param, safe=""), safe="")

        try:
            return await self.client.get(f"/past_meetings/{meeting_param}")
        except Exception:
            return await self.client.get(f"/report/meetings/{meeting_param}")


# Global Participants Service instance
zoom_participants_service = ZoomParticipantsService()
