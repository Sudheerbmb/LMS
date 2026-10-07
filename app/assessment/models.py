from datetime import datetime
import uuid
from typing import Any

from sqlalchemy import DateTime, ForeignKey, Integer, JSON, String, Text, Uuid
from sqlalchemy.orm import Mapped, mapped_column

from app.platform.models import Base, TimestampMixin, UUIDMixin


class Assessment(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "assessments"

    course_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True), ForeignKey("courses.id", ondelete="CASCADE"), nullable=False, index=True
    )
    subject_id: Mapped[uuid.UUID | None] = mapped_column(Uuid(as_uuid=True), nullable=True, index=True)
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    target_grade: Mapped[str | None] = mapped_column(String(200), nullable=True)
    subject_name: Mapped[str | None] = mapped_column(String(200), nullable=True)
    topic_syllabus: Mapped[str | None] = mapped_column(String(500), nullable=True)
    teacher_id: Mapped[uuid.UUID | None] = mapped_column(Uuid(as_uuid=True), nullable=True, index=True)
    teacher_name: Mapped[str | None] = mapped_column(String(200), nullable=True)
    schedule_type: Mapped[str] = mapped_column(String(32), default="ALWAYS_AVAILABLE", nullable=False)
    start_time: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    end_time: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    duration_minutes: Mapped[int] = mapped_column(Integer, default=45, nullable=False)
    passing_score: Mapped[int] = mapped_column(Integer, default=70, nullable=False)
    total_points: Mapped[int] = mapped_column(Integer, default=50, nullable=False)
    requires_proctoring: Mapped[bool] = mapped_column(default=True, nullable=False)
    status: Mapped[str] = mapped_column(String(32), default="PUBLISHED", nullable=False)


class AssessmentQuestion(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "assessment_questions"

    assessment_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True), ForeignKey("assessments.id", ondelete="CASCADE"), nullable=False, index=True
    )
    prompt: Mapped[str] = mapped_column(Text, nullable=False)
    question_type: Mapped[str] = mapped_column(String(32), default="multiple_choice", nullable=False)
    options: Mapped[list[Any]] = mapped_column(JSON, default=list, nullable=False)
    correct_answer: Mapped[str] = mapped_column(String(500), default="0", nullable=False)
    points: Mapped[int] = mapped_column(Integer, default=10, nullable=False)
    cognitive_level: Mapped[str] = mapped_column(String(64), default="APPLICATION", nullable=False)
    concept_name: Mapped[str | None] = mapped_column(String(200), nullable=True)
    explanation: Mapped[str | None] = mapped_column(Text, nullable=True)
    position: Mapped[int] = mapped_column(Integer, default=0, nullable=False)


class AssessmentAttempt(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "assessment_attempts"

    assessment_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True), ForeignKey("assessments.id", ondelete="CASCADE"), nullable=False, index=True
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    student_name: Mapped[str | None] = mapped_column(String(200), nullable=True)
    student_grade: Mapped[str | None] = mapped_column(String(200), nullable=True)
    subject_name: Mapped[str | None] = mapped_column(String(200), nullable=True)
    answers: Mapped[dict[str, Any]] = mapped_column(JSON, default=dict, nullable=False)
    score: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    total_points_earned: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    max_points: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    passed: Mapped[bool] = mapped_column(default=False, nullable=False)
    feedback: Mapped[str | None] = mapped_column(Text, nullable=True)
    cheated: Mapped[bool] = mapped_column(default=False, nullable=False)
    cheating_reasons: Mapped[list[Any] | None] = mapped_column(JSON, nullable=True)
    violation_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
