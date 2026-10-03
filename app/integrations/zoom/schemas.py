"""
Pydantic Schemas for Zoom Integration
"""
from datetime import datetime
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field


class ZoomClassSettings(BaseModel):
    host_video: bool = True
    participant_video: bool = True
    join_before_host: bool = False
    mute_upon_entry: bool = True
    watermark: bool = False
    use_pmi: bool = False
    approval_type: int = 2  # 2 = Automatically approve
    audio: str = "both"  # both, telephony, voip
    auto_recording: str = "cloud"  # local, cloud, none
    enforce_login: bool = False
    waiting_room: bool = True
    registrants_email_notification: bool = False


class ZoomMeetingCreateRequest(BaseModel):
    topic: str
    type: int = 2  # 2 = Scheduled meeting, 8 = Recurring with fixed time
    start_time: str  # ISO 8601 UTC format: YYYY-MM-DDTHH:MM:SSZ
    duration: int  # minutes
    timezone: str = "UTC"
    password: Optional[str] = None
    agenda: Optional[str] = None
    settings: Optional[ZoomClassSettings] = Field(default_factory=ZoomClassSettings)


class ZoomMeetingUpdateRequest(BaseModel):
    topic: Optional[str] = None
    start_time: Optional[str] = None
    duration: Optional[int] = None
    timezone: Optional[str] = None
    password: Optional[str] = None
    agenda: Optional[str] = None
    settings: Optional[ZoomClassSettings] = None


class ZoomMeetingResponse(BaseModel):
    id: int
    uuid: str
    host_id: Optional[str] = "me"
    host_email: Optional[str] = None
    topic: str
    type: int = 2
    status: Optional[str] = None
    start_time: str
    duration: int
    timezone: str = "UTC"
    agenda: Optional[str] = None
    created_at: Optional[str] = None
    start_url: Optional[str] = None
    join_url: str
    password: Optional[str] = None
    h323_password: Optional[str] = None
    pstn_password: Optional[str] = None
    encrypted_password: Optional[str] = None
    settings: Optional[Dict[str, Any]] = None


class ZoomParticipant(BaseModel):
    id: Optional[str] = None
    user_id: Optional[str] = None
    name: str
    user_email: Optional[str] = None
    join_time: datetime
    leave_time: Optional[datetime] = None
    duration: int = 0  # seconds
    attentiveness_score: Optional[str] = None
    failover: Optional[bool] = None
    status: Optional[str] = None
    customer_key: Optional[str] = None


class ZoomRecordingFile(BaseModel):
    id: str
    meeting_id: str
    recording_start: datetime
    recording_end: datetime
    file_type: str  # MP4, M4A, TIMELINE, TRANSCRIPT, CHAT, CC, CSV
    file_extension: Optional[str] = None
    file_size: Optional[int] = None
    play_url: Optional[str] = None
    download_url: Optional[str] = None
    status: str
    recording_type: str  # shared_screen_with_speaker_view, audio_only, audio_transcript, etc.


class ZoomMeetingRecordings(BaseModel):
    uuid: str
    id: int
    account_id: str
    host_id: str
    topic: str
    start_time: datetime
    duration: int
    total_size: int
    recording_count: int
    recording_files: List[ZoomRecordingFile] = []
    download_access_token: Optional[str] = None
