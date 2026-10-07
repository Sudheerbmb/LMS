from datetime import datetime, timezone
from uuid import UUID

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile, status
from sqlalchemy import and_, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.classroom.models import ClassRecording, LiveClass
from app.content.models import LearningResource
from app.courses.models import Course, CourseSubject, CourseVersion
from app.courses.schemas import (
    CategoryCreate,
    CategoryRead,
    ClassScheduleRead,
    CourseCreate,
    CourseDetailRead,
    CourseRead,
    CourseUpdate,
    RecordingRead,
    ReviewCreate,
    ReviewRead,
    StudentCourseDetailRead,
    StudentCourseRead,
    SubjectClassesResponse,
    SubjectDetailRead,
    SubjectResourceCreate,
    SubjectResourceRead,
    SubjectTeacherInfo,
)
from app.courses.service import (
    archive_course,
    create_category,
    create_course,
    create_review,
    get_course,
    list_categories,
    list_courses,
    list_reviews,
    publish_course,
    update_course,
    upload_thumbnail,
)
from app.enrollment.models import Enrollment
from app.identity.auth import get_current_user
from app.identity.models import User
from app.identity.permissions import require_permission
from app.platform.database import get_session
from app.platform.errors import LMSError
from app.platform.storage import upload_file
from app.timetable.models import TimetableSlot

router = APIRouter(prefix="/api/v1/courses", tags=["courses"])


def _err(exc: LMSError) -> HTTPException:
    return HTTPException(status_code=exc.status_code, detail=exc.message)


# ── Categories ────────────────────────────────────────────────────────────────

@router.get("/categories", response_model=list[CategoryRead])
async def get_categories(session: AsyncSession = Depends(get_session)) -> list[CategoryRead]:
    cats = await list_categories(session)
    return [CategoryRead.model_validate(c) for c in cats]


@router.post("/categories", response_model=CategoryRead, status_code=status.HTTP_201_CREATED)
async def create_cat(
    data: CategoryCreate,
    _: User = Depends(require_permission("course:manage")),
    session: AsyncSession = Depends(get_session),
) -> CategoryRead:
    try:
        cat = await create_category(session, data)
        return CategoryRead.model_validate(cat)
    except LMSError as exc:
        raise _err(exc) from exc


# ── Courses ───────────────────────────────────────────────────────────────────

@router.post("", response_model=CourseRead, status_code=status.HTTP_201_CREATED)
async def create(
    data: CourseCreate,
    current_user: User = Depends(require_permission("course:manage")),
    session: AsyncSession = Depends(get_session),
) -> CourseRead:
    try:
        course = await create_course(session, data, current_user)
        return CourseRead.model_validate(course)
    except LMSError as exc:
        raise _err(exc) from exc


@router.get("", response_model=dict)
async def list_all(
    org_id: UUID | None = Query(default=None),
    status_filter: str | None = Query(default=None, alias="status"),
    level: str | None = Query(default=None),
    category_id: UUID | None = Query(default=None),
    search: str | None = Query(default=None),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    session: AsyncSession = Depends(get_session),
    _: User = Depends(get_current_user),
) -> dict:
    try:
        courses, total = await list_courses(
            session, org_id=org_id, status=status_filter, level=level,
            category_id=category_id, search=search, page=page, page_size=page_size,
        )
        pages = max(1, (total + page_size - 1) // page_size)
        items = []
        for c in courses:
            d = CourseRead.model_validate(c).model_dump()
            d["title"] = c.versions[0].title if c.versions else c.slug.replace("-", " ").title()
            items.append(d)
        return {
            "items": items,
            "total": total,
            "page": page,
            "page_size": page_size,
            "pages": pages,
        }
    except LMSError as exc:
        raise _err(exc) from exc


# ── LMS True Product Model: Course -> Subject -> Classes / Recordings / Resources ──

async def _verify_course_enrollment(session: AsyncSession, user: User, course_id: UUID) -> None:
    if user.role == "student":
        enrolled = await session.scalar(
            select(Enrollment.id).where(
                Enrollment.user_id == user.id,
                Enrollment.course_id == course_id,
                Enrollment.status == "active",
            )
        )
        if not enrolled:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="You are not enrolled in this course")


@router.get("/my-courses", response_model=list[StudentCourseRead])
async def get_my_courses(
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> list[StudentCourseRead]:
    """Returns ONLY courses enrolled by the student, or assigned to teacher, or all for admin."""
    if current_user.role == "student":
        enrolled_subq = select(Enrollment.course_id).where(
            Enrollment.user_id == current_user.id,
            Enrollment.status == "active",
        )
        q = (
            select(Course)
            .where(Course.id.in_(enrolled_subq))
            .options(selectinload(Course.versions), selectinload(Course.subjects))
        )
    elif current_user.role == "teacher":
        teacher_course_ids = select(CourseSubject.course_id).where(CourseSubject.teacher_id == current_user.id)
        q = (
            select(Course)
            .where(or_(Course.id.in_(teacher_course_ids), Course.status == "published"))
            .options(selectinload(Course.versions), selectinload(Course.subjects))
        )
    else:
        q = select(Course).options(selectinload(Course.versions), selectinload(Course.subjects))

    courses = (await session.scalars(q)).all()

    result = []
    for c in courses:
        title = c.versions[0].title if c.versions else c.slug.replace("-", " ").title()
        desc = c.versions[0].description if c.versions else None
        subj_count = len(c.subjects) if c.subjects else 0
        result.append(
            StudentCourseRead(
                id=c.id,
                slug=c.slug,
                title=title,
                description=desc,
                subjects_count=subj_count,
                status=c.status,
            )
        )
    return result


async def fetch_authoritative_course_detail(
    session: AsyncSession,
    course_identifier: str,
    current_user: User,
) -> StudentCourseDetailRead:
    """Authoritative course resolution by UUID or slug, with enrollment auth & true subjects."""
    course_uuid = None
    try:
        course_uuid = UUID(course_identifier)
    except (ValueError, AttributeError):
        course_uuid = None

    if course_uuid:
        course = await session.scalar(
            select(Course)
            .where(Course.id == course_uuid)
            .options(selectinload(Course.versions), selectinload(Course.subjects))
        )
    else:
        course = await session.scalar(
            select(Course)
            .where(Course.slug == course_identifier)
            .options(selectinload(Course.versions), selectinload(Course.subjects))
        )

    if not course:
        raise HTTPException(status_code=404, detail="Course not found")

    # Authorize: Students must be enrolled in course.id
    await _verify_course_enrollment(session, current_user, course.id)

    title = course.versions[0].title if course.versions else course.slug.replace("-", " ").title()
    desc = course.versions[0].description if course.versions else None

    # Prefetch teachers for subjects
    teacher_ids = [s.teacher_id for s in course.subjects if s.teacher_id]
    teachers_by_id = {}
    if teacher_ids:
        t_users = (await session.scalars(select(User).where(User.id.in_(teacher_ids)))).all()
        teachers_by_id = {u.id: u for u in t_users}

    subjects_res = []
    for s in course.subjects:
        teacher_info = None
        teachers_list = []
        if s.teacher_id and s.teacher_id in teachers_by_id:
            teacher_user = teachers_by_id[s.teacher_id]
            teacher_info = SubjectTeacherInfo(
                id=teacher_user.id,
                name=teacher_user.display_name,
                display_name=teacher_user.display_name,
                email=teacher_user.email,
            )
            teachers_list = [teacher_info]

        try:
            async with session.begin_nested():
                classes_cnt = await session.scalar(
                    select(func.count(TimetableSlot.id)).where(
                        or_(
                            TimetableSlot.subject_id == s.id,
                            and_(TimetableSlot.course_id == course.id, TimetableSlot.subject_code == s.code),
                        )
                    )
                ) or 0
        except Exception:
            classes_cnt = 0

        try:
            async with session.begin_nested():
                recs_cnt = await session.scalar(
                    select(func.count(ClassRecording.id)).where(
                        or_(
                            ClassRecording.subject_id == s.id,
                            and_(
                                ClassRecording.course_id == course.id,
                                or_(ClassRecording.subject_id == s.id, ClassRecording.subject_id.is_(None))
                            ),
                            ClassRecording.class_id.in_(
                                select(LiveClass.id).where(
                                    or_(
                                        LiveClass.subject_id == s.id,
                                        LiveClass.subject_code == s.code,
                                        LiveClass.course_id == course.id,
                                    )
                                )
                            )
                        )
                    )
                ) or 0
        except Exception:
            recs_cnt = 0

        try:
            async with session.begin_nested():
                res_cnt = await session.scalar(
                    select(func.count(LearningResource.id)).where(
                        LearningResource.subject_id == s.id
                    )
                ) or 0
        except Exception:
            res_cnt = 0

        subjects_res.append(
            SubjectDetailRead(
                id=s.id,
                course_id=s.course_id,
                course_title=title,
                code=s.code,
                name=s.name,
                description=s.description,
                color=s.color or "#FF7A00",
                order_index=s.order_index,
                teacher=teacher_info,
                teachers=teachers_list,
                scheduled_classes_count=classes_cnt,
                recordings_count=recs_cnt,
                resources_count=res_cnt,
            )
        )

    return StudentCourseDetailRead(
        id=course.id,
        slug=course.slug,
        name=title,
        title=title,
        description=desc,
        subjects=subjects_res,
    )


@router.get("/hierarchy/{course_identifier}", response_model=StudentCourseDetailRead)
@router.get("/{course_identifier}/hierarchy", response_model=StudentCourseDetailRead)
async def get_course_hierarchy(
    course_identifier: str,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> StudentCourseDetailRead:
    """Returns course and its first-class subjects with dynamic counts and assigned teachers."""
    return await fetch_authoritative_course_detail(session, course_identifier, current_user)


@router.get("/subjects/{subject_id}", response_model=SubjectDetailRead)
async def get_subject_detail(
    subject_id: UUID,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> SubjectDetailRead:
    subject = await session.get(CourseSubject, subject_id)
    if not subject:
        raise HTTPException(status_code=404, detail="Subject not found")

    await _verify_course_enrollment(session, current_user, subject.course_id)

    course = await session.scalar(
        select(Course).where(Course.id == subject.course_id).options(selectinload(Course.versions))
    )
    course_title = course.versions[0].title if course and course.versions else "Course"

    teacher_info = None
    if subject.teacher_id:
        teacher_user = await session.get(User, subject.teacher_id)
        if teacher_user:
            teacher_info = SubjectTeacherInfo(
                id=teacher_user.id,
                name=teacher_user.display_name,
                display_name=teacher_user.display_name,
                email=teacher_user.email,
            )

    try:
        async with session.begin_nested():
            classes_cnt = await session.scalar(
                select(func.count(TimetableSlot.id)).where(
                    or_(
                        TimetableSlot.subject_id == subject.id,
                        and_(TimetableSlot.course_id == subject.course_id, TimetableSlot.subject_code == subject.code),
                    )
                )
            ) or 0
    except Exception:
        classes_cnt = 0

    try:
        async with session.begin_nested():
            recs_cnt = await session.scalar(
                select(func.count(ClassRecording.id)).where(
                    ClassRecording.subject_id == subject.id
                )
            ) or 0
    except Exception:
        recs_cnt = 0

    try:
        async with session.begin_nested():
            res_cnt = await session.scalar(
                select(func.count(LearningResource.id)).where(
                    LearningResource.subject_id == subject.id
                )
            ) or 0
    except Exception:
        res_cnt = 0

    return SubjectDetailRead(
        id=subject.id,
        course_id=subject.course_id,
        course_title=course_title,
        code=subject.code,
        name=subject.name,
        description=subject.description,
        color=subject.color or "#FF7A00",
        order_index=subject.order_index,
        teacher=teacher_info,
        teachers=[teacher_info] if teacher_info else [],
        scheduled_classes_count=classes_cnt,
        recordings_count=recs_cnt,
        resources_count=res_cnt,
    )


@router.get("/subjects/{subject_id}/classes", response_model=SubjectClassesResponse)
async def get_subject_classes(
    subject_id: UUID,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> SubjectClassesResponse:
    subject = await session.get(CourseSubject, subject_id)
    if not subject:
        raise HTTPException(status_code=404, detail="Subject not found")

    await _verify_course_enrollment(session, current_user, subject.course_id)

    course = await session.scalar(
        select(Course).where(Course.id == subject.course_id).options(selectinload(Course.versions))
    )
    course_title = course.versions[0].title if course and course.versions else "Course"

    teacher_name = None
    if subject.teacher_id:
        teacher_user = await session.get(User, subject.teacher_id)
        if teacher_user:
            teacher_name = teacher_user.display_name

    now = datetime.now(timezone.utc)
    current_day_name = now.strftime("%A")

    # 1. LiveClass check
    live_running = await session.scalar(
        select(LiveClass)
        .where(
            LiveClass.subject_id == subject.id,
            or_(
                LiveClass.status.in_(["live", "in_progress"]),
                and_(LiveClass.starts_at <= now, now < LiveClass.ends_at),
            ),
        )
    )

    live_now_item: ClassScheduleRead | None = None
    if live_running:
        live_now_item = ClassScheduleRead(
            id=live_running.id,
            subject_id=subject.id,
            subject_code=subject.code,
            subject_name=subject.name,
            course_id=subject.course_id,
            course_title=course_title,
            teacher_name=teacher_name,
            title=live_running.title,
            starts_at=live_running.starts_at,
            ends_at=live_running.ends_at,
            start_time=live_running.starts_at.strftime("%H:%M"),
            end_time=live_running.ends_at.strftime("%H:%M"),
            status="live_now",
            meeting_url=live_running.meeting_url,
            zoom_join_url=live_running.zoom_join_url or live_running.meeting_url,
            room_or_venue=live_running.room_number or "Online Live Studio",
        )

    # 2. Timetable slots check
    slots = (
        await session.scalars(
            select(TimetableSlot)
            .where(
                or_(
                    TimetableSlot.subject_id == subject.id,
                    and_(TimetableSlot.course_id == subject.course_id, TimetableSlot.subject_code == subject.code),
                )
            )
            .order_by(TimetableSlot.period_number)
        )
    ).all()

    upcoming_list: list[ClassScheduleRead] = []

    for slot in slots:
        is_today = slot.day_of_week.strip().lower() == current_day_name.lower()
        now_time_str = now.strftime("%H:%M")

        if is_today and slot.start_time <= now_time_str < slot.end_time and not live_now_item:
            live_now_item = ClassScheduleRead(
                id=slot.id,
                subject_id=subject.id,
                subject_code=subject.code,
                subject_name=subject.name,
                course_id=subject.course_id,
                course_title=course_title,
                teacher_name=teacher_name,
                title=f"{subject.name} - Live Lecture",
                day_of_week=slot.day_of_week,
                start_time=slot.start_time,
                end_time=slot.end_time,
                status="live_now",
                meeting_url=slot.meeting_url,
                zoom_join_url=slot.meeting_url,
                room_or_venue=slot.room_or_venue,
            )
        else:
            upcoming_list.append(
                ClassScheduleRead(
                    id=slot.id,
                    subject_id=subject.id,
                    subject_code=subject.code,
                    subject_name=subject.name,
                    course_id=subject.course_id,
                    course_title=course_title,
                    teacher_name=teacher_name,
                    title=f"{subject.name} - Scheduled Lecture",
                    day_of_week=slot.day_of_week,
                    start_time=slot.start_time,
                    end_time=slot.end_time,
                    status="upcoming",
                    meeting_url=slot.meeting_url,
                    zoom_join_url=slot.meeting_url,
                    room_or_venue=slot.room_or_venue,
                )
            )

    return SubjectClassesResponse(live_now=live_now_item, upcoming=upcoming_list)


@router.get("/subjects/{subject_id}/recordings", response_model=list[RecordingRead])
async def get_subject_recordings(
    subject_id: UUID,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> list[RecordingRead]:
    subject = await session.get(CourseSubject, subject_id)
    if not subject:
        raise HTTPException(status_code=404, detail="Subject not found")

    await _verify_course_enrollment(session, current_user, subject.course_id)

    try:
        async with session.begin_nested():
            recs = (
                await session.scalars(
                    select(ClassRecording)
                    .where(
                        or_(
                            ClassRecording.subject_id == subject.id,
                            and_(
                                ClassRecording.course_id == subject.course_id,
                                or_(ClassRecording.subject_id == subject.id, ClassRecording.subject_id.is_(None)),
                            ),
                            ClassRecording.class_id.in_(
                                select(LiveClass.id).where(
                                    or_(
                                        LiveClass.subject_id == subject.id,
                                        LiveClass.subject_code == subject.code,
                                        LiveClass.course_id == subject.course_id,
                                    )
                                )
                            )
                        )
                    )
                    .order_by(ClassRecording.recording_start.desc().nullslast(), ClassRecording.created_at.desc())
                )
            ).all()
    except Exception:
        recs = []

    teacher_name = None
    if subject.teacher_id:
        teacher_user = await session.get(User, subject.teacher_id)
        if teacher_user:
            teacher_name = teacher_user.display_name

    def format_duration(seconds: int | None) -> str:
        if not seconds:
            return "50m"
        hours = seconds // 3600
        mins = (seconds % 3600) // 60
        if hours > 0:
            return f"{hours}h {mins:02d}m"
        return f"{mins}m"

    result = []
    for r in recs:
        result.append(
            RecordingRead(
                id=r.id,
                class_id=r.class_id,
                vimeo_video_id=r.vimeo_video_id,
                title=subject.name,
                recorded_at=r.recording_start or r.created_at,
                duration=format_duration(r.duration_seconds),
                duration_seconds=r.duration_seconds,
                play_url=r.play_url or r.vimeo_url,
                vimeo_url=r.vimeo_url,
                teacher_name=teacher_name,
                status=r.status or "available",
            )
        )
    return result


@router.get("/subjects/{subject_id}/resources", response_model=list[SubjectResourceRead])
async def get_subject_resources(
    subject_id: UUID,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> list[SubjectResourceRead]:
    subject = await session.get(CourseSubject, subject_id)
    if not subject:
        raise HTTPException(status_code=404, detail="Subject not found")

    await _verify_course_enrollment(session, current_user, subject.course_id)

    try:
        async with session.begin_nested():
            resources = (
                await session.scalars(
                    select(LearningResource)
                    .where(LearningResource.subject_id == subject.id)
                    .order_by(LearningResource.position.asc(), LearningResource.created_at.asc())
                )
            ).all()
    except Exception:
        resources = []

    return [SubjectResourceRead.model_validate(r) for r in resources]


@router.post("/subjects/{subject_id}/resources", response_model=SubjectResourceRead, status_code=status.HTTP_201_CREATED)
async def create_subject_resource(
    subject_id: UUID,
    data: SubjectResourceCreate,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> SubjectResourceRead:
    subject = await session.get(CourseSubject, subject_id)
    if not subject:
        raise HTTPException(status_code=404, detail="Subject not found")

    if current_user.role not in ["teacher", "admin", "superadmin"]:
        raise HTTPException(status_code=403, detail="Only teachers and admins can add resources")

    resource = LearningResource(
        course_id=subject.course_id,
        subject_id=subject.id,
        title=data.title,
        description=data.description,
        resource_type=data.resource_type,
        file_url=data.file_url,
        external_url=data.external_url,
        downloadable=data.downloadable,
    )
    session.add(resource)
    await session.commit()
    await session.refresh(resource)
    return SubjectResourceRead.model_validate(resource)


@router.delete("/subjects/{subject_id}/resources/{resource_id}")
async def delete_subject_resource(
    subject_id: UUID,
    resource_id: UUID,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> dict:
    if current_user.role not in ["teacher", "admin", "superadmin"]:
        raise HTTPException(status_code=403, detail="Only teachers and admins can delete resources")
    resource = await session.get(LearningResource, resource_id)
    if not resource or resource.subject_id != subject_id:
        raise HTTPException(status_code=404, detail="Resource not found")
    await session.delete(resource)
    await session.commit()
    return {"id": str(resource_id), "deleted": True}


# ── Generic Course Detail ─────────────────────────────────────────────────────

@router.get("/{course_identifier}", response_model=StudentCourseDetailRead)
async def get_one(
    course_identifier: str,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
) -> StudentCourseDetailRead:
    """Authoritative endpoint returning course metadata and its first-class subjects."""
    return await fetch_authoritative_course_detail(session, course_identifier, current_user)


@router.patch("/{course_id}", response_model=CourseRead)
async def update(
    course_id: UUID,
    data: CourseUpdate,
    current_user: User = Depends(require_permission("course:manage")),
    session: AsyncSession = Depends(get_session),
) -> CourseRead:
    try:
        course = await update_course(session, course_id, data, current_user)
        return CourseRead.model_validate(course)
    except LMSError as exc:
        raise _err(exc) from exc


@router.post("/{course_id}/publish", response_model=CourseRead)
async def publish(
    course_id: UUID,
    current_user: User = Depends(require_permission("course:manage")),
    session: AsyncSession = Depends(get_session),
) -> CourseRead:
    try:
        course = await publish_course(session, course_id, current_user)
        return CourseRead.model_validate(course)
    except LMSError as exc:
        raise _err(exc) from exc


@router.post("/{course_id}/archive", response_model=CourseRead)
async def archive(
    course_id: UUID,
    current_user: User = Depends(require_permission("course:manage")),
    session: AsyncSession = Depends(get_session),
) -> CourseRead:
    try:
        course = await archive_course(session, course_id, current_user)
        return CourseRead.model_validate(course)
    except LMSError as exc:
        raise _err(exc) from exc


@router.post("/{course_id}/thumbnail", response_model=CourseRead)
async def upload_course_thumbnail(
    course_id: UUID,
    file: UploadFile = File(...),
    current_user: User = Depends(require_permission("course:manage")),
    session: AsyncSession = Depends(get_session),
) -> CourseRead:
    if file.content_type not in ("image/jpeg", "image/png", "image/webp"):
        raise HTTPException(status_code=400, detail="Only JPEG, PNG, and WEBP images allowed")
    data_bytes = await file.read()
    url = await upload_file(data_bytes, file.filename or "thumb.jpg", prefix="thumbnails")
    try:
        course = await upload_thumbnail(session, course_id, url, current_user)
        return CourseRead.model_validate(course)
    except LMSError as exc:
        raise _err(exc) from exc


# ── Reviews ───────────────────────────────────────────────────────────────────

@router.post("/{course_id}/reviews", response_model=ReviewRead, status_code=status.HTTP_201_CREATED)
async def add_review(
    course_id: UUID,
    data: ReviewCreate,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> ReviewRead:
    try:
        review = await create_review(session, course_id, data, current_user)
        return ReviewRead.model_validate(review)
    except LMSError as exc:
        raise _err(exc) from exc


@router.get("/{course_id}/reviews", response_model=list[ReviewRead])
async def get_reviews(
    course_id: UUID,
    session: AsyncSession = Depends(get_session),
    _: User = Depends(get_current_user),
) -> list[ReviewRead]:
    reviews = await list_reviews(session, course_id)
    return [ReviewRead.model_validate(r) for r in reviews]
