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

    async def download_transcript_data(
        self,
        recordings: ZoomMeetingRecordings,
    ) -> Optional[dict]:
        """
        Locates the VTT audio transcript file from Zoom cloud recordings, downloads it,
        and parses it into clean text, structured timestamped segments, and chapter topics.
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
        raw_vtt = content_bytes.decode("utf-8", errors="replace").strip()

        if raw_vtt.startswith("{") and "timeline" in raw_vtt:
            return None

        clean_text = self.clean_vtt_text(raw_vtt)
        segments = self.parse_vtt_to_segments(raw_vtt)
        topics = self.extract_topics_from_segments(segments, clean_text)

        return {
            "raw_text": clean_text,
            "vtt_content": raw_vtt,
            "segments": segments,
            "topics": topics,
        }

    async def download_transcript_text(
        self,
        recordings: ZoomMeetingRecordings,
    ) -> Optional[str]:
        """Backward-compatible helper returning cleaned transcript text."""
        data = await self.download_transcript_data(recordings)
        return data["raw_text"] if data else None

    @staticmethod
    def parse_vtt_to_segments(vtt_content: str) -> list[dict]:
        """Parses WebVTT format into structured transcript segments with seconds and timestamps."""
        lines = vtt_content.splitlines()
        segments: list[dict] = []
        current_start_ts = ""
        current_end_ts = ""
        current_seconds = 0
        current_lines: list[str] = []

        def _flush_segment():
            nonlocal current_start_ts, current_end_ts, current_seconds, current_lines
            if current_start_ts and current_lines:
                full_text = " ".join(current_lines).strip()
                speaker = "Teacher"
                clean_text = full_text
                if ":" in full_text:
                    parts = full_text.split(":", 1)
                    if len(parts[0].strip().split()) <= 4:
                        speaker = parts[0].strip()
                        clean_text = parts[1].strip()

                segments.append({
                    "timestamp": current_start_ts,
                    "seconds": current_seconds,
                    "end_timestamp": current_end_ts,
                    "speaker": speaker,
                    "text": clean_text,
                })
                current_start_ts = ""
                current_end_ts = ""
                current_seconds = 0
                current_lines = []

        for line in lines:
            line_str = line.strip()
            if not line_str or line_str.startswith("WEBVTT") or line_str.startswith("NOTE"):
                continue
            if "-->" in line_str:
                _flush_segment()
                parts = line_str.split("-->")
                raw_start = parts[0].strip()
                raw_end = parts[1].strip() if len(parts) > 1 else ""

                start_main = raw_start.split(".")[0]
                start_sub = start_main[3:] if start_main.startswith("00:") else start_main
                current_start_ts = start_sub

                t_parts = start_main.split(":")
                if len(t_parts) == 3:
                    current_seconds = int(t_parts[0]) * 3600 + int(t_parts[1]) * 60 + int(t_parts[2])
                elif len(t_parts) == 2:
                    current_seconds = int(t_parts[0]) * 60 + int(t_parts[1])
                else:
                    current_seconds = 0

                end_main = raw_end.split(".")[0]
                current_end_ts = end_main[3:] if end_main.startswith("00:") else end_main
            elif line_str.isdigit():
                continue
            else:
                current_lines.append(line_str)

        _flush_segment()
        return segments

    @staticmethod
    def extract_topics_from_segments(segments: list[dict], raw_text: str = "") -> list[dict]:
        """Generates concise topic/chapter breakdown with exact timestamps from transcript segments."""
        if not segments:
            return []

        topics: list[dict] = []
        first_seg = segments[0]
        initial_title = "Introduction & Overview"
        if first_seg.get("text"):
            t = first_seg["text"]
            if "welcome" in t.lower() or "today" in t.lower() or "start" in t.lower():
                initial_title = "Introduction & Lecture Kickoff"
            else:
                initial_title = t.split(".")[0][:50]

        topics.append({
            "title": initial_title,
            "timestamp": first_seg.get("timestamp", "00:00"),
            "seconds": first_seg.get("seconds", 0),
        })

        last_sec = first_seg.get("seconds", 0)
        for seg in segments[1:]:
            sec = seg.get("seconds", 0)
            if sec - last_sec >= 180:  # Group into chapters every 3-4 minutes
                text = seg.get("text", "")
                title = text.split(".")[0].strip()
                if len(title) > 60:
                    title = title[:57] + "..."
                if not title:
                    title = f"Topic Section at {seg.get('timestamp')}"
                topics.append({
                    "title": title,
                    "timestamp": seg.get("timestamp", "00:00"),
                    "seconds": sec,
                })
                last_sec = sec

        return topics

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
                parts = line_str.split("-->")
                start_ts = parts[0].strip().split(".")[0]
                if start_ts.startswith("00:"):
                    start_ts = start_ts[3:]
                current_time = f"[{start_ts}]"
            elif line_str.isdigit():
                continue
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
