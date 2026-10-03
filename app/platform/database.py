from collections.abc import AsyncIterator

from sqlalchemy import Connection, func, inspect, select, text
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.platform.config import settings
from app.platform.models import Base


# â”€â”€ Engine & session factory â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

_engine_kwargs: dict = {"pool_pre_ping": True}

if "sqlite" not in settings.database_url:
    _engine_kwargs.update(
        pool_size=settings.database_pool_size,
        max_overflow=settings.database_max_overflow,
    )

if settings.database_echo:
    _engine_kwargs["echo"] = True

engine = create_async_engine(settings.database_url, **_engine_kwargs)
SessionFactory = async_sessionmaker(engine, expire_on_commit=False)


async def get_session() -> AsyncIterator[AsyncSession]:
    async with SessionFactory() as session:
        yield session


# â”€â”€ Schema initialisation (development only) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

async def init_database() -> None:
    """Create all tables and bootstrap the admin account (dev mode only)."""
    # Import every model module so SQLAlchemy registers them before create_all
    import app.ai.models  # noqa: F401
    import app.assessment.models  # noqa: F401
    import app.assignments.models  # noqa: F401
    import app.certification.models  # noqa: F401
    import app.classroom.models  # noqa: F401
    import app.coding.models  # noqa: F401
    import app.communication.models  # noqa: F401
    import app.courses.models  # noqa: F401
    import app.content.models  # noqa: F401
    import app.enrollment.models  # noqa: F401
    import app.identity.models  # noqa: F401
    import app.learning.models  # noqa: F401
    import app.notifications.models  # noqa: F401
    import app.tenancy.models  # noqa: F401
    import app.timetable.models  # noqa: F401

    async with engine.begin() as connection:
        await connection.run_sync(Base.metadata.create_all)
        await connection.run_sync(_patch_missing_columns)

    await _bootstrap_defaults()


def _patch_missing_columns(connection: Connection) -> None:
    """Apply schema patches and missing column additions for both SQLite and PostgreSQL."""
    is_postgres = "postgresql" in connection.dialect.name.lower()
    uuid_type = "UUID" if is_postgres else "CHAR(32)"
    json_type = "JSONB" if is_postgres else "JSON"
    dt_type = "TIMESTAMP WITH TIME ZONE" if is_postgres else "DATETIME"
    bool_false = "false" if is_postgres else "0"
    bool_true = "true" if is_postgres else "1"

    inspector = inspect(connection)
    tables = set(inspector.get_table_names())

    def _add_column(table: str, col_name: str, col_def: str, existing_cols: set[str]) -> None:
        if col_name not in existing_cols:
            try:
                connection.execute(text(f"ALTER TABLE {table} ADD COLUMN {col_name} {col_def}"))
            except Exception as e:
                # Some engines / states might error if column already exists or table is locked
                print(f"[Schema Patch] Failed to add {col_name} to {table}: {e}")

    # 1. Users Table
    if "users" in tables:
        cols = {c["name"] for c in inspector.get_columns("users")}
        _add_column("users", "role", "VARCHAR(32) DEFAULT 'student' NOT NULL", cols)
        _add_column("users", "phone_number", "VARCHAR(32)", cols)
        _add_column("users", "avatar_url", "VARCHAR(500)", cols)
        _add_column("users", "bio", "TEXT", cols)
        _add_column("users", "timezone", "VARCHAR(64) DEFAULT 'UTC'", cols)
        _add_column("users", "locale", "VARCHAR(16) DEFAULT 'en'", cols)
        _add_column("users", "headline", "VARCHAR(200)", cols)
        _add_column("users", "website_url", "VARCHAR(500)", cols)
        _add_column("users", "linkedin_url", "VARCHAR(500)", cols)
        _add_column("users", "github_url", "VARCHAR(500)", cols)
        _add_column("users", "email_verified", f"BOOLEAN DEFAULT {bool_false}", cols)
        _add_column("users", "email_verify_token", "VARCHAR(255)", cols)
        _add_column("users", "email_verify_expires", dt_type, cols)
        _add_column("users", "password_reset_token", "VARCHAR(255)", cols)
        _add_column("users", "password_reset_expires", dt_type, cols)
        _add_column("users", "last_login_at", dt_type, cols)
        _add_column("users", "login_count", "INTEGER DEFAULT 0", cols)
        _add_column("users", "failed_login_count", "INTEGER DEFAULT 0", cols)
        _add_column("users", "locked_until", dt_type, cols)
        _add_column("users", "notify_email", f"BOOLEAN DEFAULT {bool_true}", cols)
        _add_column("users", "notify_inapp", f"BOOLEAN DEFAULT {bool_true}", cols)

    # 2. Courses Table
    if "courses" in tables:
        cols = {c["name"] for c in inspector.get_columns("courses")}
        _add_column("courses", "category", "VARCHAR(100)", cols)
        _add_column("courses", "tags", json_type, cols)
        _add_column("courses", "thumbnail_url", "VARCHAR(500)", cols)
        _add_column("courses", "level", "VARCHAR(32) DEFAULT 'beginner'", cols)
        _add_column("courses", "language", "VARCHAR(16) DEFAULT 'en'", cols)
        _add_column("courses", "estimated_hours", "REAL", cols)
        _add_column("courses", "max_students", "INTEGER", cols)
        _add_column("courses", "price", "REAL DEFAULT 0.0", cols)
        _add_column("courses", "is_free", f"BOOLEAN DEFAULT {bool_true}", cols)
        _add_column("courses", "rating_avg", "REAL DEFAULT 0.0", cols)
        _add_column("courses", "rating_count", "INTEGER DEFAULT 0", cols)
        _add_column("courses", "enrolled_count", "INTEGER DEFAULT 0", cols)

    # 3. Live Classes Table
    if "live_classes" in tables:
        cols = {c["name"] for c in inspector.get_columns("live_classes")}
        _add_column("live_classes", "organization_id", uuid_type, cols)
        _add_column("live_classes", "course_id", uuid_type, cols)
        _add_column("live_classes", "grade_number", "INTEGER", cols)
        _add_column("live_classes", "section_name", "VARCHAR(16)", cols)
        _add_column("live_classes", "subject_code", "VARCHAR(16)", cols)
        _add_column("live_classes", "subject_name", "VARCHAR(128)", cols)
        _add_column("live_classes", "period_number", "INTEGER", cols)
        _add_column("live_classes", "room_number", "VARCHAR(64)", cols)
        _add_column("live_classes", "recording_url", "VARCHAR(1000)", cols)
        _add_column("live_classes", "transcript_text", "TEXT", cols)
        _add_column("live_classes", "summary_json", json_type, cols)
        _add_column("live_classes", "transcript_segments", json_type, cols)
        # Zoom Integration Columns
        _add_column("live_classes", "zoom_meeting_id", "VARCHAR(64)", cols)
        _add_column("live_classes", "zoom_meeting_uuid", "VARCHAR(128)", cols)
        _add_column("live_classes", "zoom_host_user_id", "VARCHAR(128)", cols)
        _add_column("live_classes", "zoom_join_url", "VARCHAR(1000)", cols)
        _add_column("live_classes", "zoom_start_url", "TEXT", cols)
        _add_column("live_classes", "zoom_password", "VARCHAR(64)", cols)
        _add_column("live_classes", "zoom_status", "VARCHAR(32) DEFAULT 'scheduled'", cols)
        _add_column("live_classes", "zoom_last_synced_at", dt_type, cols)
        _add_column("live_classes", "zoom_settings_json", json_type, cols)


async def _bootstrap_defaults() -> None:
    """Bootstrap all default demo accounts, school hierarchy, teachers, students, and timetable schedule."""
    from app.identity.models import User
    from app.identity.security import hash_password
    from app.tenancy.models import Organization
    from app.timetable.models import TimetableSlot
    from app.timetable.service import generate_school_timetable, seed_school_defaults

    student_seeds = [
        {"email": "student@example.com", "name": "Alex Rivera", "role": "student"},
        {"email": "student.class1@school.edu", "name": "Aarav Patel (Class 1-A)", "role": "student"},
        {"email": "student.class2@school.edu", "name": "Diya Sharma (Class 2-A)", "role": "student"},
        {"email": "student.class3@school.edu", "name": "Ishaan Verma (Class 3-A)", "role": "student"},
        {"email": "student.class4@school.edu", "name": "Ananya Iyer (Class 4-A)", "role": "student"},
        {"email": "student.class5@school.edu", "name": "Rohan Gupta (Class 5-A)", "role": "student"},
        {"email": "student.class6@school.edu", "name": "Sanya Reddy (Class 6-A)", "role": "student"},
        {"email": "student.class7@school.edu", "name": "Kabir Mehta (Class 7-A)", "role": "student"},
        {"email": "student.class8@school.edu", "name": "Pooja Nair (Class 8-A)", "role": "student"},
        {"email": "student.class9@school.edu", "name": "Arjun Rao (Class 9-A)", "role": "student"},
        {"email": "student.class10@school.edu", "name": "Meera Joshi (Class 10-A)", "role": "student"},
    ]

    admins = [
        ("admin@example.com", "System Admin", "ChangeMe123!"),
        ("admin@lms-platform.com", "Platform Administrator", "OrbitAdmin!2026X7"),
    ]
    if settings.bootstrap_admin_email and settings.bootstrap_admin_password:
        admins.append((settings.bootstrap_admin_email.lower(), settings.bootstrap_admin_name, settings.bootstrap_admin_password))

    async with SessionFactory() as session:
        # 1. Ensure Admins
        try:
            for email, name, pwd in admins:
                u = await session.scalar(select(User).where(User.email == email.lower()))
                if not u:
                    session.add(User(
                        email=email.lower(),
                        display_name=name,
                        password_hash=hash_password(pwd),
                        role="admin",
                        status="active",
                        email_verified=True,
                    ))
                else:
                    u.password_hash = hash_password(pwd)
                    u.role = "admin"
                    u.status = "active"
                    u.email_verified = True
            await session.commit()
        except Exception as err:
            await session.rollback()
            print(f"[Bootstrap] ensure admins: {err}")

        # 2. Ensure default Organization
        try:
            org = await session.scalar(select(Organization).where(Organization.slug == "acharya-academy"))
            if not org:
                session.add(Organization(
                    name="Acharya Global Academy",
                    slug="acharya-academy",
                    website="https://school.edu",
                    status="active",
                    is_public=True,
                ))
            await session.commit()
        except Exception as err:
            await session.rollback()
            print(f"[Bootstrap] ensure organization: {err}")

        # 3. Seed school structure, grades, sections, subjects, rules, and teachers
        try:
            await seed_school_defaults(session)
            await session.commit()
        except Exception as err:
            await session.rollback()
            print(f"[Bootstrap] seed_school_defaults: {err}")

        # 4. Ensure Students
        try:
            for s_data in student_seeds:
                stu = await session.scalar(select(User).where(User.email == s_data["email"].lower()))
                if not stu:
                    session.add(User(
                        email=s_data["email"].lower(),
                        display_name=s_data["name"],
                        password_hash=hash_password("Student123!"),
                        role="student",
                        status="active",
                        email_verified=True,
                    ))
                else:
                    stu.password_hash = hash_password("Student123!")
                    stu.role = "student"
                    stu.status = "active"
                    stu.email_verified = True
            await session.commit()
        except Exception as err:
            await session.rollback()
            print(f"[Bootstrap] ensure students: {err}")

        # 5. Ensure Generic teacher account & active status
        try:
            gen_t = await session.scalar(select(User).where(User.email == "teacher@example.com"))
            if not gen_t:
                session.add(User(
                    email="teacher@example.com",
                    display_name="Dr. Sarah Connor",
                    password_hash=hash_password("Teacher123!"),
                    role="teacher",
                    status="active",
                    email_verified=True,
                ))
            else:
                gen_t.password_hash = hash_password("Teacher123!")
                gen_t.role = "teacher"
                gen_t.status = "active"

            teachers = (await session.scalars(select(User).where(User.role == "teacher"))).all()
            for t in teachers:
                t.password_hash = hash_password("Teacher123!")
                t.status = "active"
                t.email_verified = True
            await session.commit()
        except Exception as err:
            await session.rollback()
            print(f"[Bootstrap] ensure teachers: {err}")

        # 6. Seed Training Institute Technical Courses & Subjects
        try:
            from app.admin import seed_tech_courses_internal
            await seed_tech_courses_internal(session)
            await session.commit()
        except Exception as err:
            await session.rollback()
            print(f"[Bootstrap] seed tech courses error: {err}")

        # 7. Generate Master Timetable if empty
        try:
            slot_count = await session.scalar(select(func.count(TimetableSlot.id)))
            if not slot_count or slot_count == 0:
                await generate_school_timetable(session)
                await session.commit()
        except Exception as err:
            await session.rollback()
            print(f"[Bootstrap] generate_school_timetable: {err}")

