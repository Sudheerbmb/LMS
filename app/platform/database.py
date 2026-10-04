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
        if is_postgres:
            try:
                connection.execute(text("ALTER TABLE courses ALTER COLUMN organization_id DROP NOT NULL"))
                connection.execute(text("ALTER TABLE school_grades ALTER COLUMN name TYPE VARCHAR(160)"))
                connection.execute(text("ALTER TABLE school_sections ALTER COLUMN name TYPE VARCHAR(32)"))
                connection.execute(text("ALTER TABLE school_subjects ALTER COLUMN name TYPE VARCHAR(128)"))
            except Exception as e:
                print(f"[Schema Patch] Column adjustments note: {e}")

    # 3. Live Classes Table
    if "live_classes" in tables:
        cols = {c["name"] for c in inspector.get_columns("live_classes")}
        _add_column("live_classes", "organization_id", uuid_type, cols)
        _add_column("live_classes", "course_id", uuid_type, cols)
        _add_column("live_classes", "grade_number", "INTEGER", cols)
        _add_column("live_classes", "section_name", "VARCHAR(32)", cols)
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


async def purge_legacy_school_data(session: AsyncSession) -> None:
    """Safely cleans up any old school dummy accounts, Class 1-10 grades, and obsolete feedback."""
    try:
        # 1. Delete legacy teacher feedback
        await session.execute(
            text("""
                DELETE FROM teacher_feedback 
                WHERE section_id IN (
                    SELECT s.id FROM school_sections s 
                    JOIN school_grades g ON s.grade_id = g.id 
                    WHERE g.name LIKE 'Class %'
                ) 
                OR comments LIKE '%trigonometry%' 
                OR comments LIKE '%homework%' 
                OR comments LIKE '%physics%'
                OR comments LIKE '%math%'
            """)
        )
        
        # 2. Delete legacy timetable slots for Class 1-10
        await session.execute(
            text("""
                DELETE FROM timetable_slots 
                WHERE section_id IN (
                    SELECT s.id FROM school_sections s 
                    JOIN school_grades g ON s.grade_id = g.id 
                    WHERE g.name LIKE 'Class %'
                )
            """)
        )

        # 3. Delete legacy school sections & grades
        await session.execute(
            text("""
                DELETE FROM school_sections 
                WHERE grade_id IN (
                    SELECT id FROM school_grades WHERE name LIKE 'Class %'
                )
            """)
        )
        await session.execute(
            text("""
                DELETE FROM grade_curricula 
                WHERE grade_id IN (
                    SELECT id FROM school_grades WHERE name LIKE 'Class %'
                )
            """)
        )
        await session.execute(
            text("""
                DELETE FROM school_grades WHERE name LIKE 'Class %'
            """)
        )

        # 4. Delete obsolete school subjects
        await session.execute(
            text("""
                DELETE FROM school_subjects 
                WHERE code IN ('MATH-01', 'ENG-01', 'SCI-01', 'SOC-01', 'HIN-01', 'SAN-01', 'PE-01', 'ART-01')
                   OR name IN ('Mathematics', 'English', 'Science', 'Social Studies', 'Hindi', 'Sanskrit', 'Physical Education', 'Art & Craft')
            """)
        )

        # 5. Remove student enrollments, attendances, teacher skills for school users
        await session.execute(
            text("""
                DELETE FROM enrollments 
                WHERE user_id IN (
                    SELECT id FROM users 
                    WHERE email LIKE '%@school.edu' 
                       OR display_name LIKE '%Class %'
                       OR display_name LIKE '%Class-%'
                )
            """)
        )
        await session.execute(
            text("""
                DELETE FROM class_attendance 
                WHERE student_email LIKE '%@school.edu'
            """)
        )
        await session.execute(
            text("""
                DELETE FROM teacher_subject_skills 
                WHERE teacher_id IN (
                    SELECT tp.id FROM teacher_profiles tp
                    JOIN users u ON tp.user_id = u.id
                    WHERE u.email LIKE '%@school.edu'
                       OR u.display_name LIKE '%Class %'
                )
            """)
        )
        await session.execute(
            text("""
                DELETE FROM teacher_profiles 
                WHERE user_id IN (
                    SELECT id FROM users 
                    WHERE email LIKE '%@school.edu'
                       OR (role = 'teacher' AND email NOT IN (
                            'sarah.connor@institute.edu',
                            'alan.turing@institute.edu',
                            'marc.b@institute.edu',
                            'fred.l@institute.edu',
                            'dan.a@institute.edu',
                            'linus.t@institute.edu',
                            'teacher@example.com'
                       ))
                )
            """)
        )

        # 6. Delete all users with email @school.edu or display_name with Class
        await session.execute(
            text("""
                DELETE FROM users 
                WHERE email LIKE '%@school.edu' 
                   OR display_name LIKE '%Class %'
                   OR display_name LIKE '%(Class%'
            """)
        )

        await session.commit()
    except Exception as e:
        await session.rollback()
        print(f"[Purge Legacy School Data] notice: {e}")


async def _bootstrap_defaults() -> None:
    """Bootstrap all default demo accounts, tech tracks, faculty, students, and timetable schedule."""
    from app.identity.models import User
    from app.identity.security import hash_password
    from app.tenancy.models import Organization
    from app.timetable.models import TimetableSlot
    from app.timetable.service import generate_school_timetable, seed_school_defaults

    student_seeds = [
        {"email": "student@example.com", "name": "Alex Rivera", "role": "student"},
        {"email": "priya.s@student.edu", "name": "Priya Sharma", "role": "student"},
        {"email": "rahul.k@student.edu", "name": "Rahul Kumar", "role": "student"},
        {"email": "ananya.r@student.edu", "name": "Ananya Roy", "role": "student"},
        {"email": "vikram.m@student.edu", "name": "Vikram Malhotra", "role": "student"},
        {"email": "sneha.p@student.edu", "name": "Sneha Patel", "role": "student"},
    ]

    teacher_seeds = [
        {"email": "teacher@example.com", "name": "Dr. Sarah Connor", "role": "teacher"},
        {"email": "sarah.connor@institute.edu", "name": "Dr. Sarah Connor", "role": "teacher"},
        {"email": "alan.turing@institute.edu", "name": "Prof. Alan Turing", "role": "teacher"},
        {"email": "marc.b@institute.edu", "name": "Marc Benioff", "role": "teacher"},
        {"email": "fred.l@institute.edu", "name": "Fred Luddy", "role": "teacher"},
        {"email": "dan.a@institute.edu", "name": "Dan Abramov", "role": "teacher"},
        {"email": "linus.t@institute.edu", "name": "Linus Torvalds", "role": "teacher"},
    ]

    admins = [
        ("admin@example.com", "System Admin", "ChangeMe123!"),
        ("admin@lms-platform.com", "Platform Administrator", "OrbitAdmin!2026X7"),
    ]
    if settings.bootstrap_admin_email and settings.bootstrap_admin_password:
        admins.append((settings.bootstrap_admin_email.lower(), settings.bootstrap_admin_name, settings.bootstrap_admin_password))

    async with SessionFactory() as session:
        # 0. Clean up legacy school dummy accounts & outdated users
        await purge_legacy_school_data(session)

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
            org = await session.scalar(select(Organization).where(Organization.slug == "omni-institute"))
            if not org:
                session.add(Organization(
                    name="Omni Technical Training Institute",
                    slug="omni-institute",
                    website="https://institute.edu",
                    status="active",
                    is_public=True,
                ))
            await session.commit()
        except Exception as err:
            await session.rollback()
            print(f"[Bootstrap] ensure organization: {err}")

        # 3. Ensure Technical Faculty
        try:
            for t_data in teacher_seeds:
                t = await session.scalar(select(User).where(User.email == t_data["email"].lower()))
                if not t:
                    session.add(User(
                        email=t_data["email"].lower(),
                        display_name=t_data["name"],
                        password_hash=hash_password("Teacher123!"),
                        role="teacher",
                        status="active",
                        email_verified=True,
                    ))
                else:
                    t.display_name = t_data["name"]
                    t.password_hash = hash_password("Teacher123!")
                    t.role = "teacher"
                    t.status = "active"
                    t.email_verified = True
            await session.commit()
        except Exception as err:
            await session.rollback()
            print(f"[Bootstrap] ensure teachers: {err}")

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
                    stu.display_name = s_data["name"]
                    stu.password_hash = hash_password("Student123!")
                    stu.role = "student"
                    stu.status = "active"
                    stu.email_verified = True
            await session.commit()
        except Exception as err:
            await session.rollback()
            print(f"[Bootstrap] ensure students: {err}")

        # 5. Seed Training Institute Technical Courses & Subjects
        try:
            from app.admin import seed_tech_courses_internal
            await seed_tech_courses_internal(session)
            await session.commit()
        except Exception as err:
            await session.rollback()
            print(f"[Bootstrap] seed tech courses error: {err}")

        # 6. Synchronize Timetable Engine & Generate Schedule
        try:
            await seed_school_defaults(session)
            await session.commit()
            await generate_school_timetable(session)
            await session.commit()
        except Exception as err:
            await session.rollback()
            print(f"[Bootstrap] timetable sync error: {err}")
        except Exception as err:
            await session.rollback()
            print(f"[Bootstrap] generate_school_timetable: {err}")

