import re
from typing import Any, Dict, List, Literal, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, EmailStr
from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.courses.models import Course, CourseSubject, CourseVersion
from app.enrollment.models import Enrollment
from app.identity.models import User
from app.identity.permissions import require_permission
from app.identity.security import hash_password
from app.platform.database import get_session


router = APIRouter(prefix="/api/v1/admin", tags=["admin"])


class ApprovalUpdate(BaseModel):
    role: Literal["student", "teacher", "admin"]


class StatusUpdate(BaseModel):
    status: Literal["active", "suspended", "rejected", "pending"]


class RoleUpdate(BaseModel):
    role: Literal["admin", "teacher", "student"]


class AdminUserCreate(BaseModel):
    email: EmailStr
    display_name: str
    password: str
    role: Literal["admin", "teacher", "student"] = "student"
    phone_number: Optional[str] = None
    status: Literal["active", "pending", "suspended"] = "active"
    course_ids: List[UUID] = []


class AdminUserUpdate(BaseModel):
    display_name: Optional[str] = None
    email: Optional[EmailStr] = None
    phone_number: Optional[str] = None
    password: Optional[str] = None
    role: Optional[Literal["admin", "teacher", "student"]] = None
    status: Optional[Literal["active", "pending", "suspended", "rejected"]] = None
    course_ids: Optional[List[UUID]] = None


class AdminSubjectCreate(BaseModel):
    code: str
    name: str
    description: Optional[str] = None
    teacher_id: Optional[UUID] = None
    color: str = "#3b82f6"


class AdminCourseCreate(BaseModel):
    title: str
    slug: Optional[str] = None
    description: Optional[str] = None
    level: str = "beginner"
    price: float = 0.0
    subjects: List[AdminSubjectCreate] = []


# ── User Management (Students, Teachers, Admins) ──────────────────────────────

@router.get("/users")
async def list_users(
    _admin: User = Depends(require_permission("admin:users")),
    session: AsyncSession = Depends(get_session),
) -> list[dict]:
    users = (await session.scalars(select(User).order_by(User.created_at.desc()))).all()
    
    # Load all enrollments to populate enrolled_courses for students
    enrollments = (await session.scalars(select(Enrollment))).all()
    courses = (await session.scalars(select(Course).options(selectinload(Course.versions)))).all()
    course_map = {}
    for c in courses:
        title = c.versions[0].title if c.versions else c.slug
        course_map[c.id] = {"id": str(c.id), "title": title, "slug": c.slug}

    user_enrollment_map: dict[UUID, list[dict]] = {}
    for e in enrollments:
        if e.user_id not in user_enrollment_map:
            user_enrollment_map[e.user_id] = []
        if e.course_id in course_map:
            user_enrollment_map[e.user_id].append(course_map[e.course_id])

    # Load all subjects to populate assigned_subjects for teachers
    subjects = (await session.scalars(select(CourseSubject))).all()
    teacher_subject_map: dict[UUID, list[dict]] = {}
    for s in subjects:
        if s.teacher_id:
            if s.teacher_id not in teacher_subject_map:
                teacher_subject_map[s.teacher_id] = []
            c_info = course_map.get(s.course_id, {})
            teacher_subject_map[s.teacher_id].append({
                "id": str(s.id),
                "code": s.code,
                "name": s.name,
                "course_title": c_info.get("title", ""),
            })

    return [
        {
            "id": str(user.id),
            "email": user.email,
            "phone_number": user.phone_number,
            "display_name": user.display_name,
            "role": user.role,
            "status": user.status,
            "created_at": user.created_at.isoformat(),
            "enrolled_courses": user_enrollment_map.get(user.id, []),
            "assigned_subjects": teacher_subject_map.get(user.id, []),
        }
        for user in users
    ]


@router.post("/users", status_code=status.HTTP_201_CREATED)
async def create_user(
    data: AdminUserCreate,
    _admin: User = Depends(require_permission("admin:users")),
    session: AsyncSession = Depends(get_session),
) -> dict:
    normalized_email = str(data.email).strip().lower()
    existing = await session.scalar(select(User).where(User.email == normalized_email))
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="A user with this email address already exists",
        )

    phone = data.phone_number.strip() if data.phone_number and data.phone_number.strip() else None
    if phone:
        existing_phone = await session.scalar(select(User).where(User.phone_number == phone))
        if existing_phone:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="A user with this phone number already exists",
            )

    user = User(
        email=normalized_email,
        phone_number=phone,
        display_name=data.display_name.strip(),
        password_hash=hash_password(data.password),
        role=data.role,
        status=data.status,
        email_verified=True,
    )
    session.add(user)
    await session.flush()

    # If course_ids were provided (e.g. for enrolled student):
    if data.course_ids:
        for c_id in data.course_ids:
            session.add(Enrollment(user_id=user.id, course_id=c_id, status="active"))

    await session.commit()
    await session.refresh(user)

    return {
        "id": str(user.id),
        "email": user.email,
        "phone_number": user.phone_number,
        "display_name": user.display_name,
        "role": user.role,
        "status": user.status,
        "created_at": user.created_at.isoformat(),
    }


@router.put("/users/{user_id}")
async def update_user(
    user_id: UUID,
    data: AdminUserUpdate,
    _admin: User = Depends(require_permission("admin:users")),
    session: AsyncSession = Depends(get_session),
) -> dict:
    user = await session.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    if data.display_name is not None:
        user.display_name = data.display_name.strip()
    if data.phone_number is not None:
        user.phone_number = data.phone_number.strip() if data.phone_number.strip() else None
    if data.role is not None:
        user.role = data.role
    if data.status is not None:
        user.status = data.status
    if data.password and data.password.strip():
        user.password_hash = hash_password(data.password.strip())

    # Sync enrollments if course_ids was provided
    if data.course_ids is not None:
        existing_enrollments = (await session.scalars(select(Enrollment).where(Enrollment.user_id == user_id))).all()
        for e in existing_enrollments:
            await session.delete(e)
        for c_id in data.course_ids:
            session.add(Enrollment(user_id=user.id, course_id=c_id, status="active"))

    await session.commit()
    await session.refresh(user)

    return {
        "id": str(user.id),
        "email": user.email,
        "phone_number": user.phone_number,
        "display_name": user.display_name,
        "role": user.role,
        "status": user.status,
    }


@router.delete("/users/{user_id}")
async def delete_user(
    user_id: UUID,
    _admin: User = Depends(require_permission("admin:users")),
    session: AsyncSession = Depends(get_session),
) -> dict:
    user = await session.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if user.id == _admin.id:
        raise HTTPException(status_code=400, detail="You cannot delete your own admin account")
    await session.delete(user)
    await session.commit()
    return {"id": str(user_id), "deleted": True}


# ── Courses & Subjects Management (Training Institute Hierarchy) ───────────────

@router.get("/courses")
async def list_admin_courses(
    _admin: User = Depends(require_permission("admin:users")),
    session: AsyncSession = Depends(get_session),
) -> list[dict]:
    courses = (
        await session.scalars(
            select(Course)
            .options(
                selectinload(Course.versions),
                selectinload(Course.subjects),
            )
            .order_by(Course.created_at.desc())
        )
    ).all()

    # Load teacher names for subject mapping
    teachers = (await session.scalars(select(User).where(User.role == "teacher"))).all()
    teacher_map = {t.id: t.display_name for t in teachers}

    # Count enrollments per course
    enrollment_counts = (
        await session.execute(
            select(Enrollment.course_id, func.count(Enrollment.id)).group_by(Enrollment.course_id)
        )
    ).all()
    count_map = {row[0]: row[1] for row in enrollment_counts}

    result = []
    for c in courses:
        title = c.versions[0].title if c.versions else c.slug
        desc = c.versions[0].description if c.versions else ""
        result.append({
            "id": str(c.id),
            "title": title,
            "slug": c.slug,
            "description": desc,
            "level": c.level,
            "price": c.price,
            "is_free": c.is_free,
            "status": c.status,
            "enrolled_count": count_map.get(c.id, 0),
            "subjects": [
                {
                    "id": str(s.id),
                    "code": s.code,
                    "name": s.name,
                    "description": s.description,
                    "color": s.color,
                    "teacher_id": str(s.teacher_id) if s.teacher_id else None,
                    "teacher_name": teacher_map.get(s.teacher_id, "Unassigned"),
                }
                for s in c.subjects
            ],
        })

    return result


@router.post("/courses", status_code=status.HTTP_201_CREATED)
async def create_admin_course(
    data: AdminCourseCreate,
    _admin: User = Depends(require_permission("admin:users")),
    session: AsyncSession = Depends(get_session),
) -> dict:
    slug = data.slug or re.sub(r"[^a-z0-9]+", "-", data.title.lower()).strip("-")
    existing = await session.scalar(select(Course).where(Course.slug == slug))
    if existing:
        slug = f"{slug}-{int(func.random() * 1000)}"

    course = Course(
        slug=slug,
        status="published",
        level=data.level,
        price=data.price,
        is_free=data.price == 0.0,
    )
    session.add(course)
    await session.flush()

    # Create CourseVersion
    version = CourseVersion(
        course_id=course.id,
        version_number=1,
        title=data.title.strip(),
        description=data.description,
    )
    session.add(version)

    # Create Subjects/Modules under this course
    for idx, sub_data in enumerate(data.subjects, start=1):
        session.add(CourseSubject(
            course_id=course.id,
            teacher_id=sub_data.teacher_id,
            code=sub_data.code.strip().upper(),
            name=sub_data.name.strip(),
            description=sub_data.description,
            order_index=idx,
            color=sub_data.color or "#3b82f6",
        ))

    await session.commit()
    await session.refresh(course)

    return {
        "id": str(course.id),
        "title": data.title,
        "slug": course.slug,
        "status": course.status,
    }


@router.post("/courses/{course_id}/subjects", status_code=status.HTTP_201_CREATED)
async def add_course_subject(
    course_id: UUID,
    data: AdminSubjectCreate,
    _admin: User = Depends(require_permission("admin:users")),
    session: AsyncSession = Depends(get_session),
) -> dict:
    course = await session.get(Course, course_id)
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")

    subject = CourseSubject(
        course_id=course_id,
        teacher_id=data.teacher_id,
        code=data.code.strip().upper(),
        name=data.name.strip(),
        description=data.description,
        color=data.color,
    )
    session.add(subject)
    await session.commit()
    await session.refresh(subject)

    return {
        "id": str(subject.id),
        "course_id": str(course_id),
        "code": subject.code,
        "name": subject.name,
        "teacher_id": str(subject.teacher_id) if subject.teacher_id else None,
    }


@router.delete("/courses/{course_id}/subjects/{subject_id}")
async def delete_course_subject(
    course_id: UUID,
    subject_id: UUID,
    _admin: User = Depends(require_permission("admin:users")),
    session: AsyncSession = Depends(get_session),
) -> dict:
    subject = await session.get(CourseSubject, subject_id)
    if not subject or subject.course_id != course_id:
        raise HTTPException(status_code=404, detail="Subject not found")
    await session.delete(subject)
    await session.commit()
    return {"id": str(subject_id), "deleted": True}


# ── Enrollment Management ─────────────────────────────────────────────────────

@router.post("/enrollments")
async def enroll_student(
    user_id: UUID,
    course_id: UUID,
    _admin: User = Depends(require_permission("admin:users")),
    session: AsyncSession = Depends(get_session),
) -> dict:
    existing = await session.scalar(
        select(Enrollment).where(Enrollment.user_id == user_id, Enrollment.course_id == course_id)
    )
    if not existing:
        session.add(Enrollment(user_id=user_id, course_id=course_id, status="active"))
        await session.commit()
    return {"user_id": str(user_id), "course_id": str(course_id), "status": "active"}


@router.delete("/enrollments/{user_id}/{course_id}")
async def unenroll_student(
    user_id: UUID,
    course_id: UUID,
    _admin: User = Depends(require_permission("admin:users")),
    session: AsyncSession = Depends(get_session),
) -> dict:
    existing = await session.scalar(
        select(Enrollment).where(Enrollment.user_id == user_id, Enrollment.course_id == course_id)
    )
    if existing:
        await session.delete(existing)
        await session.commit()
    return {"user_id": str(user_id), "course_id": str(course_id), "status": "un-enrolled"}


