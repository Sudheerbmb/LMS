from datetime import datetime
from typing import Any, Dict, List, Optional
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class LiveClassCreate(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    starts_at: datetime
    ends_at: datetime
    meeting_url: Optional[str] = None
    recording_url: Optional[str] = None
    course_id: Optional[UUID] = None
    grade_number: Optional[int] = None
    section_name: Optional[str] = "A"
    subject_code: Optional[str] = None
    subject_name: Optional[str] = None
    period_number: Optional[int] = None
    room_number: Optional[str] = None
    status: Optional[str] = "scheduled"
    auto_create_zoom: bool = True


class LiveClassReschedule(BaseModel):
    starts_at: datetime
    ends_at: datetime
    reason: Optional[str] = None


class LiveClassRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    course_id: Optional[UUID] = None
    teacher_id: UUID
    teacher_name: Optional[str] = None
    title: str
    starts_at: datetime
    ends_at: datetime
    meeting_url: Optional[str] = None
    recording_url: Optional[str] = None
    status: str
    grade_number: Optional[int] = None
    section_name: Optional[str] = None
    subject_code: Optional[str] = None
    subject_name: Optional[str] = None
    period_number: Optional[int] = None
    room_number: Optional[str] = None

    # Zoom integration metadata
    zoom_meeting_id: Optional[str] = None
    zoom_meeting_uuid: Optional[str] = None
    zoom_join_url: Optional[str] = None
    zoom_start_url: Optional[str] = None  # Populated only for assigned teacher or admin
    zoom_password: Optional[str] = None
    zoom_status: Optional[str] = None
    zoom_last_synced_at: Optional[datetime] = None


class TeacherTimetableSlotRead(BaseModel):
    grade_number: int
    grade_name: str
    section_name: str
    subject_code: str
    subject_name: str
    period_number: int
    day_of_week: str
    start_time: str
    end_time: str
    room_or_venue: str


class EndClassSessionRequest(BaseModel):
    live_transcript: Optional[str] = None
    duration_seconds: Optional[int] = None


class ClassAttendanceRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    class_id: UUID
    user_id: Optional[UUID] = None
    student_email: str
    student_name: str
    status: str  # present, late, partial, absent, excused
    total_duration_minutes: float
    first_joined_at: Optional[datetime] = None
    last_left_at: Optional[datetime] = None
    join_count: int
    source: str


class ClassParticipantLogRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    class_id: UUID
    user_id: Optional[UUID] = None
    zoom_participant_id: Optional[str] = None
    user_name: str
    user_email: Optional[str] = None
    join_time: datetime
    leave_time: Optional[datetime] = None
    duration_seconds: int
    device_info: Optional[str] = None
    created_at: datetime


class ClassRecordingRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    class_id: UUID
    zoom_meeting_id: str
    zoom_recording_id: str
    recording_type: str
    file_type: str
    file_size_bytes: Optional[int] = None
    play_url: Optional[str] = None
    download_url: Optional[str] = None
    vimeo_url: Optional[str] = None
    duration_seconds: Optional[int] = None
    status: str
    recording_start: Optional[datetime] = None
    recording_end: Optional[datetime] = None


class ClassTranscriptRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    class_id: UUID
    zoom_meeting_id: Optional[str] = None
    vtt_content: Optional[str] = None
    raw_text: Optional[str] = None
    segments_json: Optional[List[Dict[str, Any]]] = None
    language: str
    status: str
    summary_json: Optional[Dict[str, Any]] = None


class ZoomSyncSummary(BaseModel):
    class_id: UUID
    zoom_meeting_id: Optional[str] = None
    status: str
    participants_synced: int = 0
    attendance_records_created: int = 0
    recordings_found: int = 0
    transcript_available: bool = False
    details: Optional[str] = None
