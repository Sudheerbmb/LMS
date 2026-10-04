import json
import logging
import re
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional
from uuid import UUID

from sqlalchemy import delete, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.classroom.models import (
    ClassAttendance,
    ClassParticipantLog,
    ClassRecording,
    ClassTranscript,
    LiveClass,
    ZoomWebhookEvent,
)
from app.classroom.schemas import LiveClassCreate, LiveClassReschedule
from app.identity.models import User
from app.integrations.zoom.schemas import ZoomClassSettings, ZoomParticipant
from app.integrations.zoom.service import zoom_service
from app.timetable.models import (
    SchoolGrade,
    SchoolSection,
    Subject,
    TeacherProfile,
    TeacherSubjectSkill,
    TimetableSlot,
)
from app.vimeo import upload_zoom_recording

logger = logging.getLogger(__name__)


class ClassroomAccessError(ValueError):
    pass


class ScheduleConflictError(ValueError):
    pass


async def get_teacher_timetable_slots_for_scheduling(
    session: AsyncSession, teacher_user: User
) -> List[Dict[str, Any]]:
    """
    Retrieves the allowed timetable periods for this teacher according to the master schedule.
    """
    profile = await session.scalar(
        select(TeacherProfile)
        .options(selectinload(TeacherProfile.skills).selectinload(TeacherSubjectSkill.subject))
        .where(TeacherProfile.user_id == teacher_user.id)
    )
    if not profile:
        profile = await session.scalar(
            select(TeacherProfile)
            .options(selectinload(TeacherProfile.skills).selectinload(TeacherSubjectSkill.subject))
            .join(User, TeacherProfile.user_id == User.id)
            .where(User.email == teacher_user.email)
        )
    if not profile:
        profile = (await session.scalars(select(TeacherProfile).options(selectinload(TeacherProfile.skills).selectinload(TeacherSubjectSkill.subject)))).first()

    if not profile:
        return []

    slots = (
        await session.scalars(
            select(TimetableSlot)
            .options(
                selectinload(TimetableSlot.section).selectinload(SchoolSection.grade),
                selectinload(TimetableSlot.subject),
            )
            .where(TimetableSlot.teacher_id == profile.id)
            .order_by(TimetableSlot.period_number)
        )
    ).all()

    result = []
    seen = set()

    for s in slots:
        if s.section and s.section.grade and s.subject:
            key = (s.section.grade.grade_number, s.section.name, s.subject.code, s.period_number)
            if key not in seen:
                seen.add(key)
                result.append({
                    "grade_number": s.section.grade.grade_number,
                    "grade_name": s.section.grade.name,
                    "section_name": s.section.name,
                    "subject_code": s.subject.code,
                    "subject_name": s.subject.name,
                    "period_number": s.period_number,
                    "day_of_week": s.day_of_week,
                    "start_time": s.start_time,
                    "end_time": s.end_time,
                    "room_or_venue": s.room_or_venue,
                })

    if not result and profile.skills:
        for sk in profile.skills:
            if sk.subject:
                for g_num in [6, 7]:
                    result.append({
                        "grade_number": g_num,
                        "grade_name": f"Class {g_num}",
                        "section_name": "A",
                        "subject_code": sk.subject.code,
                        "subject_name": sk.subject.name,
                        "period_number": 2,
                        "day_of_week": "Monday",
                        "start_time": "09:20",
                        "end_time": "10:10",
                        "room_or_venue": f"Room {g_num}01",
                    })

    return result


async def schedule_school_live_class(
    session: AsyncSession,
    data: LiveClassCreate,
    teacher: User,
    organization_id: Optional[UUID] = None,
) -> LiveClass:
    """
    Creates an LMS live classroom session and automatically provisions a matching Zoom meeting.
    """
    # Check for teacher scheduling conflicts
    overlap = await session.scalar(
        select(LiveClass).where(
            LiveClass.teacher_id == teacher.id,
            LiveClass.status != "cancelled",
            LiveClass.starts_at < data.ends_at,
            LiveClass.ends_at > data.starts_at,
        )
    )
    if overlap:
        raise ScheduleConflictError("Teacher has a scheduling conflict during this time period")

    duration_mins = max(15, int((data.ends_at - data.starts_at).total_seconds() / 60))
    topic = data.title or f"{data.subject_name or 'Live Class'} - Class {data.grade_number or ''}{data.section_name or ''}"

    zoom_meeting_id = None
    zoom_meeting_uuid = None
    zoom_join_url = None
    zoom_start_url = None
    zoom_password = None
    zoom_status = "scheduled"

    # 1. Automatically create Zoom meeting if configured
    if data.auto_create_zoom and zoom_service.is_configured():
        try:
            zoom_resp = await zoom_service.create_meeting_for_class(
                topic=topic,
                start_time_dt=data.starts_at,
                duration_minutes=duration_mins,
                agenda=f"Acharya LMS Class {data.grade_number or ''}-{data.section_name or ''} {data.subject_name or ''}",
                settings=ZoomClassSettings(
                    auto_recording="cloud",
                    waiting_room=True,
                    mute_upon_entry=True,
                    host_video=True,
                    participant_video=True,
                ),
            )
            if zoom_resp:
                zoom_meeting_id = str(zoom_resp.id)
                zoom_meeting_uuid = zoom_resp.uuid
                zoom_join_url = zoom_resp.join_url
                zoom_start_url = zoom_resp.start_url
                zoom_password = zoom_resp.password
                zoom_status = "scheduled"
                logger.info("Created Zoom meeting %s for LiveClass: %s", zoom_meeting_id, topic)
        except Exception as exc:
            logger.error("Zoom meeting creation encountered an error: %s. Continuing with LMS direct room.", exc)

    fallback_meeting_url = zoom_join_url or data.meeting_url or f"/classroom/call?room=room_{data.grade_number or 9}_{data.subject_code or 'CLASS'}_{int(datetime.now().timestamp())}"

    live_class = LiveClass(
        organization_id=organization_id,
        course_id=data.course_id,
        teacher_id=teacher.id,
        title=data.title,
        starts_at=data.starts_at,
        ends_at=data.ends_at,
        meeting_url=fallback_meeting_url,
        status=data.status or "scheduled",
        grade_number=data.grade_number,
        section_name=data.section_name or "A",
        subject_code=data.subject_code,
        subject_name=data.subject_name,
        period_number=data.period_number,
        room_number=data.room_number or (f"Room {data.grade_number}01" if data.grade_number else "Virtual Room"),
        zoom_meeting_id=zoom_meeting_id,
        zoom_meeting_uuid=zoom_meeting_uuid,
        zoom_join_url=zoom_join_url,
        zoom_start_url=zoom_start_url,
        zoom_password=zoom_password,
        zoom_status=zoom_status,
        zoom_last_synced_at=datetime.utcnow() if zoom_meeting_id else None,
    )
    session.add(live_class)
    await session.commit()
    await session.refresh(live_class)
    return live_class


async def reschedule_school_live_class(
    session: AsyncSession,
    class_id: UUID,
    data: LiveClassReschedule,
    user: User,
) -> LiveClass:
    """
    Reschedules an LMS class and synchronizes the updated time with the Zoom meeting.
    """
    live_class = await session.get(LiveClass, class_id)
    if not live_class:
        raise ClassroomAccessError("Live class not found")

    if user.role != "admin" and live_class.teacher_id != user.id:
        raise ClassroomAccessError("Unauthorized to reschedule this class")

    duration_mins = max(15, int((data.ends_at - data.starts_at).total_seconds() / 60))
    live_class.starts_at = data.starts_at
    live_class.ends_at = data.ends_at
    live_class.status = "scheduled"

    if live_class.zoom_meeting_id and zoom_service.is_configured():
        await zoom_service.update_meeting_for_class(
            meeting_id=live_class.zoom_meeting_id,
            start_time_dt=data.starts_at,
            duration_minutes=duration_mins,
            topic=live_class.title,
        )
        live_class.zoom_last_synced_at = datetime.utcnow()

    await session.commit()
    await session.refresh(live_class)
    return live_class


async def cancel_school_live_class(
    session: AsyncSession,
    class_id: UUID,
    user: User,
) -> LiveClass:
    """
    Cancels an LMS class and deletes/cancels the corresponding Zoom meeting.
    """
    live_class = await session.get(LiveClass, class_id)
    if not live_class:
        raise ClassroomAccessError("Live class not found")

    if user.role != "admin" and live_class.teacher_id != user.id:
        raise ClassroomAccessError("Unauthorized to cancel this class")

    live_class.status = "cancelled"
    live_class.zoom_status = "cancelled"

    if live_class.zoom_meeting_id and zoom_service.is_configured():
        await zoom_service.cancel_meeting_for_class(live_class.zoom_meeting_id)

    await session.commit()
    await session.refresh(live_class)
    return live_class


async def delete_school_live_class(
    session: AsyncSession,
    class_id: UUID,
    user: User,
) -> bool:
    """
    Deletes a live class session and cancels the associated Zoom meeting.
    """
    live_class = await session.get(LiveClass, class_id)
    if not live_class:
        raise ClassroomAccessError("Live class not found")

    if user.role != "admin" and live_class.teacher_id != user.id:
        raise ClassroomAccessError("Unauthorized to delete this class")

    if live_class.zoom_meeting_id and zoom_service.is_configured():
        try:
            await zoom_service.cancel_meeting_for_class(live_class.zoom_meeting_id)
        except Exception as e:
            logger.warning(f"Failed to cancel zoom meeting {live_class.zoom_meeting_id}: {e}")

    await session.delete(live_class)
    await session.commit()
    return True


async def flush_all_school_live_classes(
    session: AsyncSession,
    user: User,
) -> int:
    """
    Deletes all live class sessions for clean retesting (Admin and Faculty).
    """
    if user.role not in ("admin", "teacher"):
        raise ClassroomAccessError("Only administrators and faculty can flush live classes")

    classes = list((await session.scalars(select(LiveClass))).all())
    count = len(classes)
    for c in classes:
        if c.zoom_meeting_id and zoom_service.is_configured():
            try:
                await zoom_service.cancel_meeting_for_class(c.zoom_meeting_id)
            except Exception:
                pass
        await session.delete(c)

    await session.commit()
    return count


async def get_school_live_classes(
    session: AsyncSession,
    user: User,
    grade_number: Optional[int] = None,
    status_filter: Optional[str] = None,
) -> List[Dict[str, Any]]:
    """
    Fetches live classes strictly filtered by role and student enrollment:
    - Students ONLY receive join URLs (never start_url or host credentials).
    - Teachers receive start URLs for classes they lead.
    - Admins receive full metadata.
    """
    query = select(LiveClass).order_by(LiveClass.starts_at.desc())

    target_grade = grade_number
    if user.role == "student" and not target_grade:
        m = re.search(r"class\s*(\d+)", user.display_name or "", re.IGNORECASE) or re.search(r"class(\d+)", user.email or "", re.IGNORECASE)
        if m:
            target_grade = int(m.group(1))
        else:
            target_grade = 10

    if user.role == "student":
        if grade_number is not None:
            query = query.where(LiveClass.grade_number == grade_number)
        else:
            query = query.where(LiveClass.grade_number == target_grade)
    elif user.role == "teacher":
        if grade_number is not None:
            query = query.where(LiveClass.grade_number == grade_number)
        else:
            query = query.where(
                or_(
                    LiveClass.teacher_id == user.id,
                    LiveClass.grade_number.isnot(None),
                )
            )

    if status_filter:
        query = query.where(LiveClass.status == status_filter)

    classes = (await session.scalars(query)).all()

    teacher_ids = [c.teacher_id for c in classes]
    teachers = (await session.scalars(select(User).where(User.id.in_(teacher_ids)))).all() if teacher_ids else []
    t_map = {t.id: t.display_name for t in teachers}

    result = []
    for c in classes:
        is_host = (user.role == "admin" or c.teacher_id == user.id)
        result.append({
            "id": c.id,
            "title": c.title,
            "teacher_id": c.teacher_id,
            "teacher_name": t_map.get(c.teacher_id, "Teacher"),
            "starts_at": c.starts_at,
            "ends_at": c.ends_at,
            "meeting_url": c.zoom_join_url or c.meeting_url,
            "recording_url": c.recording_url,
            "status": c.status,
            "grade_number": c.grade_number,
            "section_name": c.section_name,
            "subject_code": c.subject_code,
            "subject_name": c.subject_name,
            "period_number": c.period_number,
            "room_number": c.room_number,
            "zoom_meeting_id": c.zoom_meeting_id,
            "zoom_meeting_uuid": c.zoom_meeting_uuid,
            "zoom_join_url": c.zoom_join_url,
            "zoom_start_url": c.zoom_start_url if is_host else None,
            "zoom_password": c.zoom_password,
            "zoom_status": c.zoom_status or c.status,
            "zoom_last_synced_at": c.zoom_last_synced_at,
        })

    return result


async def get_live_class_by_id(session: AsyncSession, class_id: UUID) -> Optional[LiveClass]:
    return await session.get(LiveClass, class_id)


async def update_live_class_status(
    session: AsyncSession, class_id: UUID, new_status: str
) -> Optional[LiveClass]:
    """Updates status between scheduled, live, and ended."""
    live_class = await session.scalar(select(LiveClass).where(LiveClass.id == class_id))
    if live_class:
        live_class.status = new_status
        if new_status in ("live", "in_progress"):
            live_class.zoom_status = "in_progress"
        elif new_status == "ended":
            live_class.zoom_status = "ended"
        await session.commit()
        await session.refresh(live_class)
    return live_class


async def attach_class_recording(
    session: AsyncSession, class_id: UUID, recording_url: str
) -> Optional[LiveClass]:
    live_class = await session.scalar(select(LiveClass).where(LiveClass.id == class_id))
    if live_class:
        live_class.recording_url = recording_url
        await session.commit()
        await session.refresh(live_class)
    return live_class


# ── Attendance Calculation & Reconciliation ────────────────────────────────────

async def reconcile_meeting_attendance(
    session: AsyncSession,
    class_id: UUID,
) -> Dict[str, Any]:
    """
    Queries Zoom past meeting participants and computes student attendance records.
    """
    live_class = await session.get(LiveClass, class_id)
    if not live_class or not live_class.zoom_meeting_id:
        return {"status": "skipped", "reason": "No associated Zoom meeting ID"}

    meeting_identifier = live_class.zoom_meeting_uuid or live_class.zoom_meeting_id
    participants: List[ZoomParticipant] = await zoom_service.get_past_participants(meeting_identifier)

    scheduled_duration_mins = max(15.0, (live_class.ends_at - live_class.starts_at).total_seconds() / 60.0)

    # 1. Group participants by lowercase email or sanitized name
    participant_aggregates: Dict[str, Dict[str, Any]] = {}
    for p in participants:
        key = (p.user_email.strip().lower() if p.user_email else p.name.strip().lower())
        if not key:
            continue

        dur_mins = p.duration / 60.0
        if key not in participant_aggregates:
            participant_aggregates[key] = {
                "name": p.name,
                "email": p.user_email or "",
                "total_duration_mins": dur_mins,
                "first_joined_at": p.join_time,
                "last_left_at": p.leave_time or p.join_time,
                "join_count": 1,
                "zoom_participant_id": p.id or p.user_id,
            }
        else:
            participant_aggregates[key]["total_duration_mins"] += dur_mins
            participant_aggregates[key]["join_count"] += 1
            if p.join_time < participant_aggregates[key]["first_joined_at"]:
                participant_aggregates[key]["first_joined_at"] = p.join_time
            if p.leave_time and p.leave_time > participant_aggregates[key]["last_left_at"]:
                participant_aggregates[key]["last_left_at"] = p.leave_time

        # Save raw telemetry log
        log_entry = ClassParticipantLog(
            class_id=class_id,
            zoom_participant_id=p.id or p.user_id,
            user_name=p.name,
            user_email=p.user_email,
            join_time=p.join_time,
            leave_time=p.leave_time,
            duration_seconds=p.duration,
        )
        session.add(log_entry)

    # 2. Match participants to registered users in DB
    all_users = (await session.scalars(select(User))).all()
    user_email_map = {u.email.lower(): u for u in all_users if u.email}
    user_name_map = {u.display_name.lower(): u for u in all_users if u.display_name}

    attendances_created = 0

    for key, agg in participant_aggregates.items():
        matched_user: Optional[User] = None
        if agg["email"] and agg["email"].lower() in user_email_map:
            matched_user = user_email_map[agg["email"].lower()]
        elif agg["name"].lower() in user_name_map:
            matched_user = user_name_map[agg["name"].lower()]

        # Ignore the teacher/instructor from student attendance calculation
        if matched_user and matched_user.id == live_class.teacher_id:
            continue

        student_email = agg["email"] or (matched_user.email if matched_user else f"{re.sub(r'[^a-zA-Z0-9]', '.', agg['name']).lower()}@student.edu")
        student_name = matched_user.display_name if matched_user else agg["name"]

        duration = round(agg["total_duration_mins"], 1)

        # Configurable attendance thresholds
        if duration >= 0.75 * scheduled_duration_mins:
            att_status = "present"
        elif duration >= 0.30 * scheduled_duration_mins:
            att_status = "partial"
        elif duration > 0:
            att_status = "late"
        else:
            att_status = "absent"

        existing_att = await session.scalar(
            select(ClassAttendance).where(
                ClassAttendance.class_id == class_id,
                ClassAttendance.student_email == student_email.lower(),
            )
        )

        if not existing_att:
            session.add(ClassAttendance(
                class_id=class_id,
                user_id=matched_user.id if matched_user else None,
                student_email=student_email.lower(),
                student_name=student_name,
                status=att_status,
                total_duration_minutes=duration,
                first_joined_at=agg["first_joined_at"],
                last_left_at=agg["last_left_at"],
                join_count=agg["join_count"],
                source="zoom_reconciled",
            ))
            attendances_created += 1
        else:
            existing_att.total_duration_minutes = duration
            existing_att.status = att_status
            existing_att.first_joined_at = agg["first_joined_at"]
            existing_att.last_left_at = agg["last_left_at"]
            existing_att.join_count = agg["join_count"]
            existing_att.source = "zoom_reconciled"

    await session.commit()
    return {
        "status": "success",
        "class_id": str(class_id),
        "total_participants": len(participants),
        "attendance_records": len(participant_aggregates),
    }


async def get_class_attendances(session: AsyncSession, class_id: UUID) -> List[ClassAttendance]:
    return list((await session.scalars(
        select(ClassAttendance)
        .where(ClassAttendance.class_id == class_id)
        .order_by(ClassAttendance.status, ClassAttendance.student_name)
    )).all())


async def get_class_recordings(session: AsyncSession, class_id: UUID) -> List[ClassRecording]:
    return list((await session.scalars(
        select(ClassRecording)
        .where(ClassRecording.class_id == class_id)
        .order_by(ClassRecording.recording_start.desc())
    )).all())


async def get_class_transcript(session: AsyncSession, class_id: UUID) -> Optional[ClassTranscript]:
    return await session.scalar(select(ClassTranscript).where(ClassTranscript.class_id == class_id))


# ── Webhook Event Processing ───────────────────────────────────────────────────

async def process_zoom_webhook_event(
    session: AsyncSession,
    event_type: str,
    event_id: Optional[str],
    body: Dict[str, Any],
) -> Dict[str, Any]:
    """
    Processes incoming Zoom webhook events asynchronously and idempotently.
    """
    # 1. Deduplication check
    if event_id:
        existing = await session.scalar(select(ZoomWebhookEvent).where(ZoomWebhookEvent.event_id == event_id))
        if existing and existing.status == "processed":
            logger.info("Ignoring duplicate Zoom webhook event: %s", event_id)
            return {"status": "duplicate_ignored"}

    payload_obj = body.get("payload", {}).get("object", {})
    meeting_id = str(payload_obj.get("id") or "")
    meeting_uuid = str(payload_obj.get("uuid") or "")

    audit_entry = ZoomWebhookEvent(
        event_id=event_id,
        event_type=event_type,
        zoom_meeting_id=meeting_id,
        payload_json=body,
        status="received",
    )
    session.add(audit_entry)
    await session.flush()

    try:
        # Locate corresponding LMS LiveClass
        live_class: Optional[LiveClass] = None
        if meeting_id:
            live_class = await session.scalar(
                select(LiveClass).where(
                    or_(
                        LiveClass.zoom_meeting_id == meeting_id,
                        LiveClass.zoom_meeting_uuid == meeting_uuid,
                    )
                )
            )

        if event_type == "meeting.started":
            if live_class:
                live_class.status = "live"
                live_class.zoom_status = "in_progress"
                logger.info("Meeting started event: LiveClass %s is now LIVE", live_class.id)

        elif event_type == "meeting.ended":
            if live_class:
                live_class.status = "ended"
                live_class.zoom_status = "ended"
                logger.info("Meeting ended event: LiveClass %s ended. Triggering attendance reconciliation...", live_class.id)
                try:
                    await reconcile_meeting_attendance(session, live_class.id)
                except Exception as rec_err:
                    logger.warning("Attendance reconciliation error on meeting.ended: %s", rec_err)

        elif event_type == "meeting.participant_joined":
            participant_data = body.get("payload", {}).get("object", {}).get("participant", {})
            if live_class and participant_data:
                join_time_str = participant_data.get("join_time")
                join_time_dt = datetime.fromisoformat(join_time_str.replace("Z", "+00:00")) if join_time_str else datetime.utcnow()
                session.add(ClassParticipantLog(
                    class_id=live_class.id,
                    zoom_participant_id=participant_data.get("participant_user_id") or participant_data.get("id"),
                    user_name=participant_data.get("user_name", "Student"),
                    user_email=participant_data.get("email"),
                    join_time=join_time_dt,
                ))

        elif event_type == "meeting.participant_left":
            participant_data = body.get("payload", {}).get("object", {}).get("participant", {})
            if live_class and participant_data:
                p_email = participant_data.get("email")
                p_name = participant_data.get("user_name", "Student")
                p_duration = participant_data.get("duration", 0)
                leave_time_str = participant_data.get("leave_time")
                leave_time_dt = datetime.fromisoformat(leave_time_str.replace("Z", "+00:00")) if leave_time_str else datetime.utcnow()

                session.add(ClassParticipantLog(
                    class_id=live_class.id,
                    zoom_participant_id=participant_data.get("participant_user_id") or participant_data.get("id"),
                    user_name=p_name,
                    user_email=p_email,
                    join_time=leave_time_dt,
                    leave_time=leave_time_dt,
                    duration_seconds=p_duration,
                ))

        elif event_type in ("recording.completed", "recording.transcript_completed"):
            recording_files = payload_obj.get("recording_files", [])
            download_token = payload_obj.get("download_token")

            for rf in recording_files:
                rec_id = str(rf.get("id") or "")
                rec_type = rf.get("recording_type", "shared_screen_with_speaker_view")
                file_type = rf.get("file_type", "MP4")
                play_url = rf.get("play_url")
                download_url = rf.get("download_url")

                if live_class and rec_id:
                    existing_rec = await session.scalar(select(ClassRecording).where(ClassRecording.zoom_recording_id == rec_id))
                    if not existing_rec:
                        session.add(ClassRecording(
                            class_id=live_class.id,
                            zoom_meeting_id=meeting_id,
                            zoom_recording_id=rec_id,
                            recording_type=rec_type,
                            file_type=file_type,
                            file_size_bytes=rf.get("file_size"),
                            play_url=play_url,
                            download_url=download_url,
                            status="available",
                            recording_start=datetime.fromisoformat(rf["recording_start"].replace("Z", "+00:00")) if rf.get("recording_start") else None,
                            recording_end=datetime.fromisoformat(rf["recording_end"].replace("Z", "+00:00")) if rf.get("recording_end") else None,
                        ))

                    if not live_class.recording_url and play_url:
                        live_class.recording_url = play_url

                    # Forward video to Vimeo pipeline if configured
                    if file_type == "MP4" and rec_type == "shared_screen_with_speaker_view":
                        try:
                            vimeo_uri = await upload_zoom_recording({**rf, "download_token": download_token})
                            if vimeo_uri:
                                live_class.recording_url = f"https://vimeo.com/{vimeo_uri.split('/')[-1]}"
                        except Exception as v_err:
                            logger.warning("Vimeo forward note: %s", v_err)

        audit_entry.status = "processed"
        await session.commit()
        return {"status": "processed", "event_type": event_type}

    except Exception as exc:
        logger.error("Error processing Zoom webhook event %s: %s", event_type, exc)
        audit_entry.status = "failed"
        audit_entry.error_message = str(exc)
        await session.commit()
        return {"status": "error", "detail": str(exc)}
