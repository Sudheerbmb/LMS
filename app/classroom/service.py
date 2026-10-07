import json
import logging
import re
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional
from uuid import UUID

from sqlalchemy import and_, delete, func, or_, select
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
    Retrieves current and upcoming scheduled classes for this teacher.
    Strictly filters out ended classes (where ends_at <= now).
    Enforces teacher subject assignment ownership.
    """
    from datetime import datetime, time
    import zoneinfo
    from app.courses.models import Course, CourseSubject
    from app.timetable.models import TimetableSlot

    # LMS timezone (Asia/Kolkata / UTC+05:30)
    try:
        tz = zoneinfo.ZoneInfo(teacher_user.timezone or "Asia/Kolkata")
    except Exception:
        tz = zoneinfo.ZoneInfo("Asia/Kolkata")

    now = datetime.now(tz)
    current_weekday = now.strftime("%A")
    today_date = now.date()

    # Query master timetable slots
    query = (
        select(TimetableSlot)
        .options(
            selectinload(TimetableSlot.course).selectinload(Course.versions),
            selectinload(TimetableSlot.course).selectinload(Course.subjects),
            selectinload(TimetableSlot.teacher),
        )
    )

    is_admin = teacher_user.role == "admin"
    if not is_admin:
        # Enforce teacher ownership: must be assigned to the slot
        query = query.where(TimetableSlot.teacher_id == teacher_user.id)

    slots = (await session.scalars(query)).all()

    result = []
    seen = set()

    for s in slots:
        # Only return classes scheduled for today
        if (s.day_of_week or "").strip().lower() != current_weekday.lower():
            continue

        # Parse start and end times
        try:
            sh, sm = map(int, s.start_time.strip().split(":"))
            eh, em = map(int, s.end_time.strip().split(":"))
            start_dt = datetime.combine(today_date, time(sh, sm), tzinfo=tz)
            end_dt = datetime.combine(today_date, time(eh, em), tzinfo=tz)
        except Exception:
            continue

        # Check ended status: if now >= end_dt, it has ENDED -> DO NOT SHOW!
        if now >= end_dt:
            continue

        # Determine status: LIVE NOW or UPCOMING
        if start_dt <= now < end_dt:
            status_label = "LIVE NOW"
        else:
            status_label = "UPCOMING"

        # Course Title
        c_title = None
        if s.course:
            if s.course.versions and len(s.course.versions) > 0:
                c_title = s.course.versions[0].title
            else:
                c_title = s.course.slug.replace("-", " ").title()

        # Subject ID from course
        subject_id = None
        if s.course and s.course.subjects:
            match_sub = next(
                (cs for cs in s.course.subjects if cs.code == s.subject_code or cs.name == s.subject_name),
                None
            )
            if match_sub:
                subject_id = match_sub.id

        sub_name = s.subject_name or c_title or "Technical Class"
        sub_code = s.subject_code or "CLS"

        dedup_key = (str(s.id), sub_code, s.start_time)
        if dedup_key in seen:
            continue
        seen.add(dedup_key)

        result.append({
            "slot_id": str(s.id),
            "course_id": str(s.course_id) if s.course_id else None,
            "course_title": c_title or "Technical Course",
            "subject_id": str(subject_id) if subject_id else None,
            "subject_code": sub_code,
            "subject_name": sub_name,
            "subject_color": s.subject_color or "#FF7A00",
            "teacher_id": str(s.teacher_id) if s.teacher_id else str(teacher_user.id),
            "teacher_name": s.teacher.display_name if s.teacher else teacher_user.display_name,
            "day_of_week": s.day_of_week,
            "start_time": s.start_time,
            "end_time": s.end_time,
            "room_or_venue": s.room_or_venue or "Main Classroom",
            "meeting_url": s.meeting_url,
            "status": status_label,
            "starts_at": start_dt.isoformat(),
            "ends_at": end_dt.isoformat(),
            "grade_number": 1,
            "grade_name": c_title or "Course Track",
            "section_name": "",
            "period_number": s.period_number or 1,
        })

    # Sort: LIVE NOW first, then chronologically by start_time
    result.sort(key=lambda x: (0 if x["status"] == "LIVE NOW" else 1, x["start_time"]))
    return result


async def schedule_school_live_class(
    session: AsyncSession,
    data: LiveClassCreate,
    teacher: User,
    organization_id: Optional[UUID] = None,
) -> LiveClass:
    """
    Creates an LMS live classroom session and automatically provisions a matching Zoom meeting.
    Preserves course_id, subject_id, teacher_id, and timetable_slot_id.
    """
    active_statuses = ["scheduled", "live", "in_progress"]
    overlap = await session.scalar(
        select(LiveClass).where(
            LiveClass.teacher_id == teacher.id,
            LiveClass.status.in_(active_statuses),
            LiveClass.starts_at < data.ends_at,
            LiveClass.ends_at > data.starts_at,
        )
    )
    if overlap:
        # If this is an existing session or re-launch for the same scheduled slot:
        if data.status == "live" or (data.timetable_slot_id and overlap.timetable_slot_id == data.timetable_slot_id):
            overlap.status = "live"
            overlap.starts_at = data.starts_at
            overlap.ends_at = data.ends_at
            if data.title:
                overlap.title = data.title
            if data.timetable_slot_id:
                overlap.timetable_slot_id = data.timetable_slot_id
            if data.course_id:
                overlap.course_id = data.course_id
            if data.subject_id:
                overlap.subject_id = data.subject_id
            if data.room_number:
                overlap.room_number = data.room_number
            await session.commit()
            await session.refresh(overlap)
            return overlap

        raise ScheduleConflictError("Teacher has a scheduling conflict during this time period")

    duration_mins = max(15, int((data.ends_at - data.starts_at).total_seconds() / 60))
    topic = data.title or f"{data.subject_name or 'Live Class'}"

    zoom_meeting_id = None
    zoom_meeting_uuid = None
    zoom_join_url = None
    zoom_start_url = None
    zoom_password = None
    zoom_status = "scheduled"

    # Automatically create Zoom meeting if configured
    if data.auto_create_zoom and zoom_service.is_configured():
        try:
            zoom_resp = await zoom_service.create_meeting_for_class(
                topic=topic,
                start_time_dt=data.starts_at,
                duration_minutes=duration_mins,
                agenda=f"Acharya LMS: {data.subject_name or 'Technical Session'}",
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
            logger.error("Zoom meeting creation encountered an error: %s. Continuing with direct room.", exc)

    fallback_meeting_url = zoom_join_url or data.meeting_url or f"/classroom/call?room=room_{data.subject_code or 'CLASS'}_{int(datetime.now().timestamp())}"

    live_class = LiveClass(
        organization_id=organization_id,
        course_id=data.course_id,
        subject_id=data.subject_id,
        timetable_slot_id=data.timetable_slot_id,
        teacher_id=teacher.id,
        title=data.title,
        starts_at=data.starts_at,
        ends_at=data.ends_at,
        meeting_url=fallback_meeting_url,
        status=data.status or "scheduled",
        grade_number=data.grade_number,
        section_name="",  # NO BATCH
        subject_code=data.subject_code,
        subject_name=data.subject_name,
        period_number=data.period_number,
        room_number=data.room_number or "Main Classroom",
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
    - Students ONLY receive classes for their enrolled courses/subjects (with join URLs only).
    - Teachers receive classes for their assigned subjects & sessions they lead (with start URLs).
    - Admins receive full institute metadata across all tracks.
    """
    from app.courses.models import Course, CourseSubject
    from app.enrollment.models import Enrollment

    query = select(LiveClass).order_by(LiveClass.starts_at.desc())

    if user.role == "student":
        # Students: Strictly filter to enrolled courses, subjects, and assigned batch
        enrollments = (
            await session.scalars(
                select(Enrollment).where(
                    Enrollment.user_id == user.id,
                    Enrollment.status == "active",
                )
            )
        ).all()
        if not enrollments:
            query = query.where(LiveClass.course_id.is_(None)).where(LiveClass.status != "cancelled")
        else:
            enrolled_course_ids = [e.course_id for e in enrollments]
            all_sections = (
                await session.scalars(
                    select(SchoolSection).options(selectinload(SchoolSection.grade))
                )
            ).all()

            courses = (
                await session.scalars(
                    select(Course)
                    .options(
                        selectinload(Course.versions),
                        selectinload(Course.subjects),
                    )
                    .where(Course.id.in_(enrolled_course_ids))
                )
            ).all()
            course_map = {c.id: c for c in courses}

            enrolled_section_names = set()
            enrolled_grade_numbers = set()
            enrolled_subject_codes = set()

            for e in enrollments:
                c = course_map.get(e.course_id)
                if not c:
                    continue
                c_title = (c.versions[0].title if c.versions else c.slug).lower()
                for s in (c.subjects or []):
                    if s.code:
                        enrolled_subject_codes.add(s.code)

                for sec in all_sections:
                    if sec.grade and (c_title in sec.grade.name.lower() or c.slug.lower() in sec.grade.name.lower()):
                        enrolled_grade_numbers.add(sec.grade.grade_number)
                        if not e.section_id or e.section_id == sec.id:
                            enrolled_section_names.add(sec.name)

            conditions = [LiveClass.course_id.is_(None)]
            if enrolled_course_ids:
                if enrolled_section_names:
                    conditions.append(
                        and_(
                            LiveClass.course_id.in_(enrolled_course_ids),
                            or_(
                                LiveClass.section_name.in_(list(enrolled_section_names)),
                                LiveClass.section_name.is_(None),
                            )
                        )
                    )
                else:
                    conditions.append(LiveClass.course_id.in_(enrolled_course_ids))

            if enrolled_grade_numbers:
                if enrolled_section_names:
                    conditions.append(
                        and_(
                            LiveClass.grade_number.in_(list(enrolled_grade_numbers)),
                            or_(
                                LiveClass.section_name.in_(list(enrolled_section_names)),
                                LiveClass.section_name.is_(None),
                            )
                        )
                    )
                else:
                    conditions.append(LiveClass.grade_number.in_(list(enrolled_grade_numbers)))

            query = query.where(or_(*conditions)).where(LiveClass.status != "cancelled")

    elif user.role == "teacher":
        # Find all subject codes assigned to this teacher
        assigned_subs = (
            await session.scalars(
                select(CourseSubject).where(CourseSubject.teacher_id == user.id)
            )
        ).all()
        assigned_codes = [s.code for s in assigned_subs if s.code]

        # Also check TeacherProfile skills
        t_prof = await session.scalar(
            select(TeacherProfile)
            .options(selectinload(TeacherProfile.skills).selectinload(TeacherSubjectSkill.subject))
            .where(TeacherProfile.user_id == user.id)
        )
        if t_prof and t_prof.skills:
            for sk in t_prof.skills:
                if sk.subject and sk.subject.code:
                    assigned_codes.append(sk.subject.code)

        assigned_codes = list(set(assigned_codes))

        if assigned_codes:
            query = query.where(
                or_(
                    LiveClass.teacher_id == user.id,
                    LiveClass.subject_code.in_(assigned_codes),
                )
            )
        else:
            query = query.where(LiveClass.teacher_id == user.id)

    if grade_number is not None:
        query = query.where(LiveClass.grade_number == grade_number)

    if status_filter:
        query = query.where(LiveClass.status == status_filter)

    classes = (await session.scalars(query)).all()

    teacher_ids = [c.teacher_id for c in classes if c.teacher_id]
    teachers = (await session.scalars(select(User).where(User.id.in_(teacher_ids)))).all() if teacher_ids else []
    t_map = {t.id: t.display_name for t in teachers}

    utc_now = datetime.now(timezone.utc)
    updated_status = False

    result = []
    for c in classes:
        # Auto-transition ended classes
        if c.ends_at and c.ends_at < utc_now and c.status in ("scheduled", "live", "in_progress"):
            c.status = "ended"
            updated_status = True

        is_host = (user.role == "admin" or c.teacher_id == user.id)
        rec_url = c.recording_url
        if not rec_url:
            db_rec = await session.scalar(
                select(ClassRecording).where(ClassRecording.class_id == c.id).order_by(ClassRecording.created_at.desc())
            )
            if db_rec and (db_rec.play_url or db_rec.download_url):
                rec_url = db_rec.play_url or db_rec.download_url
                c.recording_url = rec_url

        result.append({
            "id": c.id,
            "course_id": c.course_id,
            "subject_id": c.subject_id,
            "timetable_slot_id": c.timetable_slot_id,
            "title": c.title,
            "teacher_id": c.teacher_id,
            "teacher_name": t_map.get(c.teacher_id, "Teacher"),
            "starts_at": c.starts_at,
            "ends_at": c.ends_at,
            "meeting_url": c.zoom_join_url or c.meeting_url,
            "recording_url": rec_url,
            "status": c.status,
            "grade_number": c.grade_number,
            "section_name": c.section_name or "",
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

    if updated_status:
        try:
            await session.commit()
        except Exception:
            pass

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
    recs = list((await session.scalars(
        select(ClassRecording)
        .where(ClassRecording.class_id == class_id)
        .order_by(ClassRecording.recording_start.desc())
    )).all())

    if not recs:
        live_class = await session.get(LiveClass, class_id)
        if live_class and live_class.zoom_meeting_id and zoom_service.is_configured():
            try:
                recordings_data, transcript_text = await zoom_service.get_recordings_and_transcript(live_class.zoom_meeting_id)
                if recordings_data and recordings_data.recording_files:
                    for rf in recordings_data.recording_files:
                        existing = await session.scalar(select(ClassRecording).where(ClassRecording.zoom_recording_id == rf.id))
                        if not existing:
                            rec_item = ClassRecording(
                                class_id=class_id,
                                zoom_meeting_id=str(recordings_data.id),
                                zoom_recording_id=rf.id,
                                recording_type=rf.recording_type,
                                file_type=rf.file_type,
                                file_size_bytes=rf.file_size,
                                play_url=rf.play_url,
                                download_url=rf.download_url,
                                status=rf.status,
                                recording_start=rf.recording_start,
                                recording_end=rf.recording_end,
                            )
                            session.add(rec_item)
                            recs.append(rec_item)
                        if not live_class.recording_url and (rf.play_url or rf.download_url):
                            live_class.recording_url = rf.play_url or rf.download_url

                    if transcript_text and not live_class.transcript_text:
                        live_class.transcript_text = transcript_text
                        existing_ts = await session.scalar(select(ClassTranscript).where(ClassTranscript.class_id == class_id))
                        if not existing_ts:
                            session.add(ClassTranscript(
                                class_id=class_id,
                                zoom_meeting_id=live_class.zoom_meeting_id,
                                raw_text=transcript_text,
                                status="available",
                            ))
                    await session.commit()
            except Exception as e:
                logger.warning("On-demand Zoom recording sync for class %s: %s", class_id, e)

    return recs


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
            download_token = (
                body.get("payload", {}).get("download_token")
                or body.get("download_token")
                or payload_obj.get("download_token")
            )
            if not download_token:
                try:
                    from app.integrations.zoom.service import zoom_service
                    if zoom_service.is_configured():
                        download_token = await zoom_service.client.auth.get_access_token()
                except Exception:
                    pass

            for rf in recording_files:
                rec_id = str(rf.get("id") or "")
                rec_type = rf.get("recording_type", "shared_screen_with_speaker_view")
                file_type = rf.get("file_type", "MP4")
                play_url = rf.get("play_url")
                download_url = rf.get("download_url")

                if live_class and rec_id:
                    existing_rec = await session.scalar(select(ClassRecording).where(ClassRecording.zoom_recording_id == rec_id))
                    target_rec = existing_rec
                    if not existing_rec:
                        target_rec = ClassRecording(
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
                        )
                        session.add(target_rec)

                    if not live_class.recording_url and play_url:
                        live_class.recording_url = play_url

                    # Forward video to Vimeo pipeline if configured
                    if file_type == "MP4" and (rec_type in ("shared_screen_with_speaker_view", "speaker_view", "shared_screen", "active_speaker") or not live_class.recording_url or "vimeo" not in (live_class.recording_url or "")):
                        try:
                            vimeo_uri = await upload_zoom_recording({**rf, "download_token": download_token, "file_name": f"{live_class.title or 'Lecture'} - {meeting_id}"})
                            if vimeo_uri:
                                if str(vimeo_uri).startswith("http"):
                                    vimeo_embed_url = str(vimeo_uri)
                                else:
                                    v_id = str(vimeo_uri).split('/')[-1]
                                    vimeo_embed_url = f"https://player.vimeo.com/video/{v_id}"
                                live_class.recording_url = vimeo_embed_url
                                if target_rec:
                                    target_rec.vimeo_url = vimeo_embed_url
                                    target_rec.play_url = vimeo_embed_url
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
