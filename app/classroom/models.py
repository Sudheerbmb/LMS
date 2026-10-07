import uuid
from datetime import datetime
from typing import TYPE_CHECKING, Optional

from sqlalchemy import (
    JSON,
    Boolean,
    DateTime,
    Float,
    ForeignKey,
    Integer,
    String,
    Text,
    UniqueConstraint,
    Uuid,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.platform.models import Base, TimestampMixin, UUIDMixin

if TYPE_CHECKING:
    from app.identity.models import User
    from app.courses.models import Course


class LiveClass(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "live_classes"

    organization_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid(as_uuid=True), ForeignKey("organizations.id", ondelete="CASCADE"), nullable=True, index=True
    )
    course_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid(as_uuid=True), ForeignKey("courses.id", ondelete="CASCADE"), nullable=True, index=True
    )
    subject_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid(as_uuid=True), ForeignKey("course_subjects.id", ondelete="SET NULL"), nullable=True, index=True
    )
    timetable_slot_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid(as_uuid=True), ForeignKey("timetable_slots.id", ondelete="SET NULL"), nullable=True, index=True
    )
    teacher_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    starts_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, index=True)
    ends_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    meeting_url: Mapped[str | None] = mapped_column(String(1000))
    recording_url: Mapped[str | None] = mapped_column(String(1000), nullable=True)
    status: Mapped[str] = mapped_column(String(32), default="scheduled", nullable=False)

    grade_number: Mapped[int | None] = mapped_column(Integer, nullable=True)
    section_name: Mapped[str | None] = mapped_column(String(16), nullable=True)
    subject_code: Mapped[str | None] = mapped_column(String(16), nullable=True)
    subject_name: Mapped[str | None] = mapped_column(String(128), nullable=True)
    period_number: Mapped[int | None] = mapped_column(Integer, nullable=True)
    room_number: Mapped[str | None] = mapped_column(String(64), nullable=True)
    transcript_text: Mapped[str | None] = mapped_column(Text, nullable=True)
    summary_json: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    transcript_segments: Mapped[list | None] = mapped_column(JSON, nullable=True)

    # ── Zoom Integration Fields ───────────────────────────────────────────────
    zoom_meeting_id: Mapped[str | None] = mapped_column(String(64), index=True, nullable=True)
    zoom_meeting_uuid: Mapped[str | None] = mapped_column(String(128), index=True, nullable=True)
    zoom_host_user_id: Mapped[str | None] = mapped_column(String(128), nullable=True)
    zoom_join_url: Mapped[str | None] = mapped_column(String(1000), nullable=True)
    zoom_start_url: Mapped[str | None] = mapped_column(Text, nullable=True)  # Teacher host launch token
    zoom_password: Mapped[str | None] = mapped_column(String(64), nullable=True)
    zoom_status: Mapped[str | None] = mapped_column(String(32), default="scheduled", nullable=True)
    zoom_last_synced_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    zoom_settings_json: Mapped[dict | None] = mapped_column(JSON, nullable=True)

    # Relationships
    attendances: Mapped[list["ClassAttendance"]] = relationship(
        "ClassAttendance", back_populates="live_class", cascade="all, delete-orphan"
    )
    participant_logs: Mapped[list["ClassParticipantLog"]] = relationship(
        "ClassParticipantLog", back_populates="live_class", cascade="all, delete-orphan"
    )
    recordings: Mapped[list["ClassRecording"]] = relationship(
        "ClassRecording", back_populates="live_class", cascade="all, delete-orphan"
    )
    transcript: Mapped[Optional["ClassTranscript"]] = relationship(
        "ClassTranscript", back_populates="live_class", uselist=False, cascade="all, delete-orphan"
    )


class ClassAttendance(UUIDMixin, TimestampMixin, Base):
    """Aggregated attendance summary per student per live class session."""
    __tablename__ = "class_attendances"

    class_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True), ForeignKey("live_classes.id", ondelete="CASCADE"), nullable=False, index=True
    )
    user_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True
    )
    student_email: Mapped[str] = mapped_column(String(320), nullable=False, index=True)
    student_name: Mapped[str] = mapped_column(String(160), nullable=False)
    status: Mapped[str] = mapped_column(String(32), default="present", nullable=False)  # present, late, partial, absent, excused
    total_duration_minutes: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    first_joined_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    last_left_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    join_count: Mapped[int] = mapped_column(Integer, default=1, nullable=False)
    source: Mapped[str] = mapped_column(String(32), default="zoom_webhook", nullable=False)  # zoom_webhook, zoom_reconciled, manual

    live_class: Mapped["LiveClass"] = relationship("LiveClass", back_populates="attendances")

    __table_args__ = (
        UniqueConstraint("class_id", "student_email", name="uq_class_student_attendance"),
    )


class ClassParticipantLog(UUIDMixin, Base):
    """Raw participant join and leave telemetry events from Zoom."""
    __tablename__ = "class_participant_logs"

    class_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True), ForeignKey("live_classes.id", ondelete="CASCADE"), nullable=False, index=True
    )
    user_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True
    )
    zoom_participant_id: Mapped[str | None] = mapped_column(String(128), nullable=True)
    user_name: Mapped[str] = mapped_column(String(160), nullable=False)
    user_email: Mapped[str | None] = mapped_column(String(320), nullable=True, index=True)
    join_time: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    leave_time: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    duration_seconds: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    device_info: Mapped[str | None] = mapped_column(String(255), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow, nullable=False)

    live_class: Mapped["LiveClass"] = relationship("LiveClass", back_populates="participant_logs")


class ClassRecording(UUIDMixin, TimestampMixin, Base):
    """Cloud recording files associated with a live class session."""
    __tablename__ = "class_recordings"

    class_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True), ForeignKey("live_classes.id", ondelete="CASCADE"), nullable=False, index=True
    )
    zoom_meeting_id: Mapped[str] = mapped_column(String(64), index=True, nullable=False)
    zoom_recording_id: Mapped[str] = mapped_column(String(128), unique=True, index=True, nullable=False)
    recording_type: Mapped[str] = mapped_column(String(64), default="shared_screen_with_speaker_view", nullable=False)
    file_type: Mapped[str] = mapped_column(String(32), default="MP4", nullable=False)
    file_size_bytes: Mapped[int | None] = mapped_column(Integer, nullable=True)
    play_url: Mapped[str | None] = mapped_column(String(1000), nullable=True)
    download_url: Mapped[str | None] = mapped_column(String(1000), nullable=True)
    vimeo_url: Mapped[str | None] = mapped_column(String(1000), nullable=True)
    duration_seconds: Mapped[int | None] = mapped_column(Integer, nullable=True)
    status: Mapped[str] = mapped_column(String(32), default="available", nullable=False)
    recording_start: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    recording_end: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    live_class: Mapped["LiveClass"] = relationship("LiveClass", back_populates="recordings")


class ClassTranscript(UUIDMixin, TimestampMixin, Base):
    """Lecture transcript and AI extracted knowledge."""
    __tablename__ = "class_transcripts"

    class_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True), ForeignKey("live_classes.id", ondelete="CASCADE"), unique=True, nullable=False, index=True
    )
    zoom_meeting_id: Mapped[str | None] = mapped_column(String(64), index=True, nullable=True)
    vtt_content: Mapped[str | None] = mapped_column(Text, nullable=True)
    raw_text: Mapped[str | None] = mapped_column(Text, nullable=True)
    segments_json: Mapped[list | None] = mapped_column(JSON, nullable=True)
    language: Mapped[str] = mapped_column(String(16), default="en", nullable=False)
    status: Mapped[str] = mapped_column(String(32), default="available", nullable=False)  # available, summarized, processing, failed
    summary_json: Mapped[dict | None] = mapped_column(JSON, nullable=True)

    live_class: Mapped["LiveClass"] = relationship("LiveClass", back_populates="transcript")


class ZoomWebhookEvent(UUIDMixin, Base):
    """Idempotency and audit log for Zoom Webhook events."""
    __tablename__ = "zoom_webhook_events"

    event_id: Mapped[str | None] = mapped_column(String(128), index=True, nullable=True)
    event_type: Mapped[str] = mapped_column(String(64), index=True, nullable=False)
    zoom_meeting_id: Mapped[str | None] = mapped_column(String(64), index=True, nullable=True)
    payload_json: Mapped[dict] = mapped_column(JSON, nullable=False)
    status: Mapped[str] = mapped_column(String(32), default="received", nullable=False)  # received, processed, failed
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow, nullable=False)
