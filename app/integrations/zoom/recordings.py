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
        
        # 1. Prioritize true VTT / TRANSCRIPT files (exclude raw TIMELINE JSON)
        for f in recordings.recording_files:
            file_t = (f.file_type or "").upper()
            rec_t = (f.recording_type or "").lower()
            if file_t in ("TRANSCRIPT", "CC") or rec_t in ("audio_transcript", "closed_caption"):
                transcript_file = f
                break

        if not transcript_file or not transcript_file.download_url:
            logger.info("No audio transcript file found in Zoom recordings for meeting %s", recordings.id)
            return None

        content_bytes = await self.download_recording_file(
            transcript_file.download_url,
            download_access_token=recordings.download_access_token,
        )
        raw_text = content_bytes.decode("utf-8", errors="replace").strip()

        # If raw text is JSON timeline, discard it
        if raw_text.startswith("{") and "timeline" in raw_text:
            return None

        # Clean VTT markup if present
        return self.clean_vtt_text(raw_text)

    @staticmethod
    def clean_vtt_text(vtt_content: str) -> str:
        """Parses WebVTT format into clean, readable lecture dialogue with timestamps."""
        lines = vtt_content.splitlines()
        cleaned_blocks: list[str] = []
        current_time = ""
        
        for line in lines:
            line_str = line.strip()
            if not line_str or line_str.startswith("WEBVTT") or line_str.startswith("NOTE"):
                continue
            if "-->" in line_str:
                # Timestamp line: e.g. 00:00:01.500 --> 00:00:04.200
                parts = line_str.split("-->")
                start_ts = parts[0].strip().split(".")[0]
                if start_ts.startswith("00:"):
                    start_ts = start_ts[3:]  # Convert 00:01:23 to 01:23
                current_time = f"[{start_ts}]"
            elif line_str.isdigit():
                continue  # Cue number
            else:
                if current_time:
                    cleaned_blocks.append(f"{current_time} {line_str}")
                    current_time = ""
                else:
                    cleaned_blocks.append(line_str)

        return "\n".join(cleaned_blocks) if cleaned_blocks else vtt_content

    async def get_mp4_video_stream_url(
        self,
        meeting_id_or_uuid: int | str,
    ) -> Optional[str]:
        """Returns the authenticated MP4 download URL for video streaming."""
        try:
            recordings = await self.get_meeting_recordings(meeting_id_or_uuid)
            for f in recordings.recording_files:
                if (f.file_type or "").upper() == "MP4" and f.download_url:
                    bearer_token = await self.client.auth.get_access_token()
                    separator = "&" if "?" in f.download_url else "?"
                    token_param = recordings.download_access_token or bearer_token
                    return f"{f.download_url}{separator}access_token={token_param}"
        except ZoomNotFoundError:
            logger.debug("Zoom MP4 recording not available yet for meeting %s (404 — cloud recording still processing)", meeting_id_or_uuid)
        except Exception as err:
            logger.warning("Error resolving MP4 video stream for %s: %s", meeting_id_or_uuid, err)
        return None


# Global Recordings Service instance
zoom_recordings_service = ZoomRecordingsService()
