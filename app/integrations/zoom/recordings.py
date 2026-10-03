"""
Zoom Cloud Recordings & Transcripts Service
Handles recording metadata, download tokens, and VTT audio transcript downloads.
"""
import logging
import urllib.parse
from typing import Optional

import httpx

from app.integrations.zoom.client import ZoomClient, zoom_client
from app.integrations.zoom.exceptions import ZoomNotFoundError
from app.integrations.zoom.schemas import ZoomMeetingRecordings, ZoomRecordingFile

logger = logging.getLogger(__name__)


class ZoomRecordingsService:
    def __init__(self, client: Optional[ZoomClient] = None):
        self.client = client or zoom_client

    async def get_meeting_recordings(self, meeting_id_or_uuid: int | str) -> ZoomMeetingRecordings:
        """
        Retrieves all cloud recording files and download tokens for a Zoom meeting.
        """
        meeting_param = str(meeting_id_or_uuid)
        if meeting_param.startswith("/") or "//" in meeting_param:
            meeting_param = urllib.parse.quote(urllib.parse.quote(meeting_param, safe=""), safe="")

        data = await self.client.get(f"/meetings/{meeting_param}/recordings")
        return ZoomMeetingRecordings.model_validate(data)

    async def download_recording_file(
        self,
        download_url: str,
        download_access_token: Optional[str] = None,
    ) -> bytes:
        """
        Downloads a recording or transcript file using Zoom's bearer or download access token.
        """
        bearer_token = await self.client.auth.get_access_token()
        headers = {"Authorization": f"Bearer {bearer_token}"}
        
        target_url = download_url
        if download_access_token:
            separator = "&" if "?" in target_url else "?"
            target_url = f"{target_url}{separator}access_token={download_access_token}"

        async with httpx.AsyncClient(timeout=120.0, follow_redirects=True) as client:
            resp = await client.get(target_url, headers=headers)
            resp.raise_for_status()
            return resp.content

    async def download_transcript_text(
        self,
        recordings: ZoomMeetingRecordings,
    ) -> Optional[str]:
        """
        Locates the VTT audio transcript file from the recording payload and downloads its text.
        """
        transcript_file: Optional[ZoomRecordingFile] = None
        for f in recordings.recording_files:
            if f.file_type in ("TRANSCRIPT", "TIMELINE") or f.recording_type == "audio_transcript":
                transcript_file = f
                break

        if not transcript_file or not transcript_file.download_url:
            logger.info("No audio transcript file found in Zoom recordings for meeting %s", recordings.id)
            return None

        content_bytes = await self.download_recording_file(
            transcript_file.download_url,
            download_access_token=recordings.download_access_token,
        )
        return content_bytes.decode("utf-8", errors="replace")


# Global Recordings Service instance
zoom_recordings_service = ZoomRecordingsService()
