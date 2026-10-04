import re
from typing import Any, Dict, List, Literal, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, EmailStr
from sqlalchemy import func, or_, select, update
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.courses.models import Course, CourseSubject, CourseVersion
from app.enrollment.models import Enrollment
from app.identity.auth import get_current_user
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
    subject_ids: List[UUID] = []


class AdminUserUpdate(BaseModel):
    display_name: Optional[str] = None
    email: Optional[EmailStr] = None
    phone_number: Optional[str] = None
    password: Optional[str] = None
    role: Optional[Literal["admin", "teacher", "student"]] = None
    status: Optional[Literal["active", "pending", "suspended", "rejected"]] = None
    course_ids: Optional[List[UUID]] = None
    subject_ids: Optional[List[UUID]] = None


class AdminUserStatusUpdate(BaseModel):
    status: Literal["active", "pending", "suspended", "rejected"]


class AdminUserRoleUpdate(BaseModel):
    role: Literal["admin", "teacher", "student"]


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

    # If subject_ids were provided (e.g. for assigned faculty / teacher):
    if data.subject_ids:
        for s_id in data.subject_ids:
            subj = await session.get(CourseSubject, s_id)
            if subj:
                subj.teacher_id = user.id

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

    # Sync assigned subjects if subject_ids was provided (for faculty)
    if data.subject_ids is not None:
        existing_subjects = (await session.scalars(select(CourseSubject).where(CourseSubject.teacher_id == user_id))).all()
        for s in existing_subjects:
            s.teacher_id = None
        for s_id in data.subject_ids:
            subj = await session.get(CourseSubject, s_id)
            if subj:
                subj.teacher_id = user.id

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


@router.post("/users/{user_id}/status")
@router.put("/users/{user_id}/status")
async def update_user_status(
    user_id: UUID,
    data: AdminUserStatusUpdate,
    _admin: User = Depends(require_permission("admin:users")),
    session: AsyncSession = Depends(get_session),
) -> dict:
    user = await session.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if user.id == _admin.id:
        raise HTTPException(status_code=400, detail="You cannot modify status of your own account")
    user.status = data.status
    await session.commit()
    await session.refresh(user)
    return {
        "id": str(user.id),
        "email": user.email,
        "status": user.status,
    }


@router.post("/users/{user_id}/role")
@router.put("/users/{user_id}/role")
async def update_user_role(
    user_id: UUID,
    data: AdminUserRoleUpdate,
    _admin: User = Depends(require_permission("admin:users")),
    session: AsyncSession = Depends(get_session),
) -> dict:
    user = await session.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if user.id == _admin.id:
        raise HTTPException(status_code=400, detail="You cannot modify role of your own account")
    user.role = data.role
    await session.commit()
    await session.refresh(user)
    return {
        "id": str(user.id),
        "email": user.email,
        "role": user.role,
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
        raise HTTPException(status_code=400, detail="You cannot delete your own account")
    await session.delete(user)
    await session.commit()
    return {"id": str(user_id), "deleted": True}


# ── Courses & Subjects Management (Training Institute Hierarchy) ───────────────

TECH_COURSES_DATA = [
    {
        "title": "Python with Generative AI (GenAI)",
        "slug": "python-genai",
        "description": "Master Python 3.12, LangChain, OpenAI & Gemini SDKs, RAG vector search, and autonomous multi-agent systems.",
        "level": "intermediate",
        "subjects": [
            {"code": "PY-101", "name": "Python Core & Advanced OOP", "color": "#3b82f6", "desc": "AsyncIO, data structures, decorators, and production Python design patterns."},
            {"code": "GEN-201", "name": "Prompt Engineering, LLMs & LangChain", "color": "#8b5cf6", "desc": "Prompt chaining, tool calling, memory, and LCEL expression graphs."},
            {"code": "RAG-301", "name": "RAG Architectures & Vector Databases", "color": "#10b981", "desc": "Chunking, embeddings, ChromaDB, Pinecone, and cross-encoder re-ranking."},
            {"code": "AI-401", "name": "Autonomous AI Agents & FastAPI Deployment", "color": "#f59e0b", "desc": "LangGraph multi-agent workflows, FastAPI REST APIs, and Docker deployment."}
        ]
    },
    {
        "title": "Salesforce Administration & Development",
        "slug": "salesforce-developer",
        "description": "Comprehensive Salesforce certification curriculum covering Admin essentials, Apex OOP, SOQL, and Lightning Web Components (LWC).",
        "level": "intermediate",
        "subjects": [
            {"code": "SF-ADM", "name": "Salesforce Administrator & Security", "color": "#0284c7", "desc": "Objects, fields, profiles, OWD sharing rules, and Flow Builder automation."},
            {"code": "SF-APEX", "name": "Apex Programming, Triggers & SOQL", "color": "#0ea5e9", "desc": "Apex triggers, handler patterns, governor limits, and unit test suites."},
            {"code": "SF-LWC", "name": "Lightning Web Components (LWC) & UI", "color": "#06b6d4", "desc": "JavaScript ES6, wire adapters, LDS, events, and Lightning Design System."},
            {"code": "SF-INT", "name": "Salesforce REST API & Enterprise Integrations", "color": "#6366f1", "desc": "Connected Apps, OAuth 2.0, outbound webhooks, and REST/SOAP services."}
        ]
    },
    {
        "title": "ServiceNow Administration & Development (CSA / CAD)",
        "slug": "servicenow-csa-cad",
        "description": "Official ServiceNow CSA & CAD aligned training covering ITSM workflows, GlideRecord scripting, Script Includes, and Service Portal.",
        "level": "intermediate",
        "subjects": [
            {"code": "SN-CSA", "name": "ServiceNow Certified System Administrator Core", "color": "#10b981", "desc": "User management, CMDB, tables, UI policies, dictionary overrides, and SLAs."},
            {"code": "SN-ITSM", "name": "IT Service Management (ITSM Processes)", "color": "#059669", "desc": "Incident routing, problem root-cause, change advisory boards, and knowledge management."},
            {"code": "SN-SCRIPT", "name": "GlideRecord, Business Rules & Script Includes", "color": "#14b8a6", "desc": "Server-side and client-side JavaScript, GlideAjax, and event queues."},
            {"code": "SN-PORTAL", "name": "Service Portal & Flow Designer Automation", "color": "#0d9488", "desc": "Custom widgets, AngularJS client controllers, Flow Designer actions, and REST spokes."}
        ]
    },
    {
        "title": "Full Stack Web Engineering (React & FastAPI)",
        "slug": "full-stack-web",
        "description": "Build end-to-end full stack web platforms using modern HTML5, Tailwind CSS, React 19, FastAPI REST backends, and PostgreSQL.",
        "level": "beginner",
        "subjects": [
            {"code": "WEB-101", "name": "HTML5, Semantic UI & Tailwind CSS Layouts", "color": "#f59e0b", "desc": "Semantic HTML, Flexbox, Grid systems, responsive design, and Tailwind utility styling."},
            {"code": "JS-201", "name": "Modern JavaScript ES6+ & React 19 Ecosystem", "color": "#3b82f6", "desc": "State management, React hooks, component hierarchy, React Router, Vite, and API integration."},
            {"code": "BE-301", "name": "FastAPI, PostgreSQL ORM & Authentication", "color": "#8b5cf6", "desc": "REST architecture, SQLAlchemy 2.0 ORM, migrations, JWT auth, and role-based access control."}
        ]
    },
    {
        "title": "Cloud Computing & DevOps Engineering (AWS & Kubernetes)",
        "slug": "cloud-devops-aws",
        "description": "Hands-on DevOps engineering covering Linux administration, Docker containerization, Kubernetes cluster management, CI/CD, and AWS.",
        "level": "advanced",
        "subjects": [
            {"code": "DO-101", "name": "Linux Administration, Shell Scripting & Networking", "color": "#eab308", "desc": "Bash scripting, user permissions, systemd services, SSH, firewalls, and network inspection."},
            {"code": "DO-201", "name": "Docker Containerization & Kubernetes Orchestration", "color": "#0284c7", "desc": "Dockerfiles, compose, multi-stage builds, pods, deployments, services, ingress, and Helm charts."},
            {"code": "DO-301", "name": "AWS Cloud Architecture & CI/CD with GitHub Actions", "color": "#ea580c", "desc": "EC2, S3, RDS, IAM roles, GitHub Actions pipelines, and Terraform Infrastructure as Code."}
        ]
    }
]


async def seed_tech_courses_internal(session: AsyncSession) -> list[Course]:
    """Helper to ensure all professional tech courses & subjects exist."""
    from app.tenancy.models import Organization
    default_org = await session.scalar(select(Organization).limit(1))
    if not default_org:
        default_org = Organization(name="Omni Training Institute", slug="omni-institute")
        session.add(default_org)
        await session.flush()
    org_id = default_org.id

    teachers = (await session.scalars(select(User).where(User.role == "teacher"))).all()
    teacher_idx = 0
    created = []

    for c_data in TECH_COURSES_DATA:
        existing = await session.scalar(select(Course).where(Course.slug == c_data["slug"]))
        if not existing:
            c = Course(
                organization_id=org_id,
                slug=c_data["slug"],
                status="published",
                level=c_data["level"],
                price=0.0,
                is_free=True,
            )
            session.add(c)
            await session.flush()

            v = CourseVersion(
                course_id=c.id,
                version_number=1,
                title=c_data["title"],
                description=c_data["description"]
            )
            session.add(v)

            for idx, s_info in enumerate(c_data["subjects"], start=1):
                t_id = teachers[teacher_idx % len(teachers)].id if teachers else None
                teacher_idx += 1
                session.add(CourseSubject(
                    course_id=c.id,
                    teacher_id=t_id,
                    code=s_info["code"],
                    name=s_info["name"],
                    description=s_info["desc"],
                    color=s_info["color"],
                    order_index=idx
                ))
            created.append(c)

    # Enroll all students in the primary tech courses if they have none
    all_students = (await session.scalars(select(User).where(User.role == "student"))).all()
    all_courses = (await session.scalars(select(Course))).all()
    for stu in all_students:
        for c in all_courses:
            existing_enroll = await session.scalar(
                select(Enrollment).where(Enrollment.user_id == stu.id, Enrollment.course_id == c.id)
            )
            if not existing_enroll:
                session.add(Enrollment(user_id=stu.id, course_id=c.id, status="active"))

    await session.commit()
    return created


@router.get("/courses")
async def list_admin_courses(
    _user: User = Depends(get_current_user),
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

    # If no courses exist, auto-seed standard tech tracks
    if not courses:
        await seed_tech_courses_internal(session)
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


@router.post("/seed-tech-courses")
async def seed_tech_courses_endpoint(
    _admin: User = Depends(require_permission("admin:users")),
    session: AsyncSession = Depends(get_session),
) -> dict:
    created = await seed_tech_courses_internal(session)
    return {"status": "success", "courses_seeded": len(created), "message": "Tech training courses and subject tracks seeded successfully"}


@router.post("/courses", status_code=status.HTTP_201_CREATED)
async def create_admin_course(
    data: AdminCourseCreate,
    _admin: User = Depends(require_permission("admin:users")),
    session: AsyncSession = Depends(get_session),
) -> dict:
    slug = data.slug or re.sub(r"[^a-z0-9]+", "-", data.title.lower()).strip("-")
    existing = await session.scalar(select(Course).where(Course.slug == slug))
    if existing:
        import uuid as _uuid_lib
        slug = f"{slug}-{_uuid_lib.uuid4().hex[:6]}"
    from app.tenancy.models import Organization
    default_org = await session.scalar(select(Organization).limit(1))
    if not default_org:
        default_org = Organization(name="Omni Training Institute", slug="omni-institute", status="active", is_public=True)
        session.add(default_org)
        await session.flush()
    org_id = default_org.id

    course = Course(
        organization_id=org_id,
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

    # Automatically sync Course & Subjects into Timetable and regenerate schedule
    try:
        from app.timetable.service import sync_courses_to_timetable_curriculum, generate_school_timetable
        await sync_courses_to_timetable_curriculum(session)
        await generate_school_timetable(session)
    except Exception as e:
        print(f"[Admin Course Sync Warning]: {e}")

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

    try:
        from app.timetable.service import sync_courses_to_timetable_curriculum, generate_school_timetable
        await sync_courses_to_timetable_curriculum(session)
        await generate_school_timetable(session)
    except Exception as e:
        print(f"[Admin Subject Add Sync Warning]: {e}")

    return {
        "id": str(subject.id),
        "course_id": str(course_id),
        "code": subject.code,
        "name": subject.name,
        "teacher_id": str(subject.teacher_id) if subject.teacher_id else None,
    }


@router.put("/courses/{course_id}/subjects/{subject_id}")
async def update_course_subject(
    course_id: UUID,
    subject_id: UUID,
    data: AdminSubjectCreate,
    _admin: User = Depends(require_permission("admin:users")),
    session: AsyncSession = Depends(get_session),
) -> dict:
    subject = await session.get(CourseSubject, subject_id)
    if not subject or subject.course_id != course_id:
        raise HTTPException(status_code=404, detail="Subject not found")

    subject.code = data.code.strip().upper()
    subject.name = data.name.strip()
    subject.description = data.description
    subject.teacher_id = data.teacher_id
    if data.color:
        subject.color = data.color

    await session.commit()
    await session.refresh(subject)

    try:
        from app.timetable.service import sync_courses_to_timetable_curriculum, generate_school_timetable
        await sync_courses_to_timetable_curriculum(session)
        await generate_school_timetable(session)
    except Exception as e:
        print(f"[Admin Subject Update Sync Warning]: {e}")

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

    try:
        from app.timetable.service import sync_courses_to_timetable_curriculum, generate_school_timetable
        await sync_courses_to_timetable_curriculum(session)
        await generate_school_timetable(session)
    except Exception as e:
        print(f"[Admin Subject Delete Sync Warning]: {e}")

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


