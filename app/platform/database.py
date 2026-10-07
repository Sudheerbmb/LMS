from collections.abc import AsyncIterator
from typing import Any

from sqlalchemy import Connection, delete, func, inspect, select, text
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
async_session_factory = SessionFactory


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

    def _exec_safe(sql: str) -> None:
        try:
            with connection.begin_nested():
                connection.execute(text(sql))
        except Exception as e:
            print(f"[Schema Patch] Safe execute notice for '{sql.strip()[:60]}...': {e}")

    def _add_column(table: str, col_name: str, col_def: str, existing_cols: set[str]) -> None:
        if col_name not in existing_cols:
            try:
                with connection.begin_nested():
                    connection.execute(text(f"ALTER TABLE {table} ADD COLUMN {col_name} {col_def}"))
                existing_cols.add(col_name)
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
            _exec_safe("ALTER TABLE courses ALTER COLUMN organization_id DROP NOT NULL")
            _exec_safe("ALTER TABLE school_grades ALTER COLUMN name TYPE VARCHAR(160)")
            _exec_safe("ALTER TABLE school_sections ALTER COLUMN name TYPE VARCHAR(32)")
            _exec_safe("ALTER TABLE school_subjects ALTER COLUMN name TYPE VARCHAR(128)")

    # 3. Course Subjects Table
    if "course_subjects" in tables:
        cols = {c["name"] for c in inspector.get_columns("course_subjects")}
        _add_column("course_subjects", "course_id", uuid_type, cols)
        _add_column("course_subjects", "teacher_id", uuid_type, cols)
        _add_column("course_subjects", "code", "VARCHAR(32)", cols)
        _add_column("course_subjects", "name", "VARCHAR(128)", cols)
        _add_column("course_subjects", "description", "TEXT", cols)
        _add_column("course_subjects", "order_index", "INTEGER DEFAULT 1", cols)
        _add_column("course_subjects", "color", "VARCHAR(32) DEFAULT '#3b82f6'", cols)
        if is_postgres:
            _exec_safe("""
                UPDATE course_subjects 
                SET teacher_id = tp.user_id 
                FROM teacher_profiles tp 
                WHERE course_subjects.teacher_id = tp.id
            """)
            _exec_safe("ALTER TABLE course_subjects DROP CONSTRAINT IF EXISTS course_subjects_teacher_id_fkey")
            _exec_safe("ALTER TABLE course_subjects ADD CONSTRAINT course_subjects_teacher_id_fkey FOREIGN KEY (teacher_id) REFERENCES users(id) ON DELETE SET NULL")

    # 4. Live Classes Table
    if "live_classes" in tables:
        cols = {c["name"] for c in inspector.get_columns("live_classes")}
        _add_column("live_classes", "organization_id", uuid_type, cols)
        _add_column("live_classes", "course_id", uuid_type, cols)
        _add_column("live_classes", "subject_id", uuid_type, cols)
        _add_column("live_classes", "timetable_slot_id", uuid_type, cols)
        _add_column("live_classes", "teacher_id", uuid_type, cols)
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
        if is_postgres:
            _exec_safe("ALTER TABLE live_classes DROP CONSTRAINT IF EXISTS live_classes_subject_id_fkey")
            _exec_safe("ALTER TABLE live_classes DROP CONSTRAINT IF EXISTS live_classes_teacher_id_fkey")
            _exec_safe("""
                UPDATE live_classes 
                SET teacher_id = tp.user_id 
                FROM teacher_profiles tp 
                WHERE live_classes.teacher_id = tp.id
            """)
            _exec_safe("ALTER TABLE live_classes ADD CONSTRAINT live_classes_teacher_id_fkey FOREIGN KEY (teacher_id) REFERENCES users(id) ON DELETE CASCADE")

    # 5. Class Recordings Table
    if "class_recordings" in tables:
        cols = {c["name"] for c in inspector.get_columns("class_recordings")}
        _add_column("class_recordings", "course_id", uuid_type, cols)
        _add_column("class_recordings", "subject_id", uuid_type, cols)
        _add_column("class_recordings", "vimeo_url", "VARCHAR(1000)", cols)
        _add_column("class_recordings", "play_url", "VARCHAR(1000)", cols)
        _add_column("class_recordings", "download_url", "VARCHAR(1000)", cols)
        _add_column("class_recordings", "duration_seconds", "INTEGER", cols)
        _add_column("class_recordings", "status", "VARCHAR(32) DEFAULT 'available'", cols)
        _add_column("class_recordings", "vimeo_video_id", "VARCHAR(64)", cols)
        _add_column("class_recordings", "error_message", "TEXT", cols)

    # 6. Learning Resources Table
    if "learning_resources" in tables:
        cols = {c["name"] for c in inspector.get_columns("learning_resources")}
        _add_column("learning_resources", "course_id", uuid_type, cols)
        _add_column("learning_resources", "subject_id", uuid_type, cols)
        _add_column("learning_resources", "course_version_id", uuid_type, cols)
        _add_column("learning_resources", "section_id", uuid_type, cols)
        _add_column("learning_resources", "resource_type", "VARCHAR(32) DEFAULT 'document'", cols)
        _add_column("learning_resources", "title", "VARCHAR(200)", cols)
        _add_column("learning_resources", "description", "TEXT", cols)
        _add_column("learning_resources", "position", "INTEGER DEFAULT 0", cols)
        _add_column("learning_resources", "external_url", "VARCHAR(1000)", cols)
        _add_column("learning_resources", "file_url", "VARCHAR(1000)", cols)
        _add_column("learning_resources", "file_size_bytes", "INTEGER", cols)
        _add_column("learning_resources", "mime_type", "VARCHAR(100)", cols)
        _add_column("learning_resources", "duration_seconds", "INTEGER", cols)
        _add_column("learning_resources", "is_preview", f"BOOLEAN DEFAULT {bool_false}", cols)
        _add_column("learning_resources", "is_required", f"BOOLEAN DEFAULT {bool_true}", cols)
        _add_column("learning_resources", "downloadable", f"BOOLEAN DEFAULT {bool_false}", cols)
        _add_column("learning_resources", "content_body", "TEXT", cols)
        _add_column("learning_resources", "metadata", json_type, cols)

    # 7. Enrollments Table
    if "enrollments" in tables:
        cols = {c["name"] for c in inspector.get_columns("enrollments")}
        _add_column("enrollments", "section_id", uuid_type, cols)

    # 8. Timetable Slots Table
    if "timetable_slots" in tables:
        cols = {c["name"] for c in inspector.get_columns("timetable_slots")}
        _add_column("timetable_slots", "course_id", uuid_type, cols)
        _add_column("timetable_slots", "teacher_id", uuid_type, cols)
        _add_column("timetable_slots", "subject_id", uuid_type, cols)
        _add_column("timetable_slots", "section_id", uuid_type, cols)
        _add_column("timetable_slots", "subject_name", "VARCHAR(200)", cols)
        _add_column("timetable_slots", "subject_code", "VARCHAR(64)", cols)
        _add_column("timetable_slots", "subject_color", "VARCHAR(32) DEFAULT '#3b82f6'", cols)
        _add_column("timetable_slots", "meeting_url", "VARCHAR(500)", cols)
        if is_postgres:
            _exec_safe("ALTER TABLE timetable_slots ALTER COLUMN section_id DROP NOT NULL")
            # Drop legacy constraints
            _exec_safe("ALTER TABLE timetable_slots DROP CONSTRAINT IF EXISTS timetable_slots_teacher_id_fkey")
            _exec_safe("ALTER TABLE timetable_slots DROP CONSTRAINT IF EXISTS timetable_slots_subject_id_fkey")
            _exec_safe("ALTER TABLE timetable_slots DROP CONSTRAINT IF EXISTS timetable_slots_section_id_fkey")
            # If teacher_id stored teacher_profiles.id, migrate to users.id
            _exec_safe("""
                UPDATE timetable_slots 
                SET teacher_id = tp.user_id 
                FROM teacher_profiles tp 
                WHERE timetable_slots.teacher_id = tp.id
            """)
            # Nullify any orphaned teacher_ids before adding new FK
            _exec_safe("""
                UPDATE timetable_slots 
                SET teacher_id = NULL 
                WHERE teacher_id IS NOT NULL AND teacher_id NOT IN (SELECT id FROM users)
            """)
            # Add proper FK constraint referencing users(id)
            _exec_safe("ALTER TABLE timetable_slots ADD CONSTRAINT timetable_slots_teacher_id_fkey FOREIGN KEY (teacher_id) REFERENCES users(id) ON DELETE SET NULL")

    # 9. Assessments Table
    if "assessments" in tables:
        cols = {c["name"] for c in inspector.get_columns("assessments")}
        _add_column("assessments", "description", "TEXT", cols)
        _add_column("assessments", "subject_id", uuid_type, cols)
        _add_column("assessments", "subject_name", "VARCHAR(200)", cols)
        _add_column("assessments", "target_grade", "VARCHAR(200)", cols)
        _add_column("assessments", "topic_syllabus", "VARCHAR(500)", cols)
        _add_column("assessments", "teacher_id", uuid_type, cols)
        _add_column("assessments", "teacher_name", "VARCHAR(200)", cols)
        _add_column("assessments", "schedule_type", "VARCHAR(32) DEFAULT 'ALWAYS_AVAILABLE'", cols)
        _add_column("assessments", "start_time", dt_type, cols)
        _add_column("assessments", "end_time", dt_type, cols)
        _add_column("assessments", "duration_minutes", "INTEGER DEFAULT 45", cols)
        _add_column("assessments", "total_points", "INTEGER DEFAULT 50", cols)
        _add_column("assessments", "requires_proctoring", f"BOOLEAN DEFAULT {bool_true}", cols)

    if "assessment_questions" in tables:
        cols = {c["name"] for c in inspector.get_columns("assessment_questions")}
        _add_column("assessment_questions", "points", "INTEGER DEFAULT 10", cols)
        _add_column("assessment_questions", "cognitive_level", "VARCHAR(64) DEFAULT 'APPLICATION'", cols)
        _add_column("assessment_questions", "concept_name", "VARCHAR(200)", cols)
        _add_column("assessment_questions", "explanation", "TEXT", cols)

    if "assessment_attempts" in tables:
        cols = {c["name"] for c in inspector.get_columns("assessment_attempts")}
        _add_column("assessment_attempts", "student_name", "VARCHAR(200)", cols)
        _add_column("assessment_attempts", "student_grade", "VARCHAR(200)", cols)
        _add_column("assessment_attempts", "subject_name", "VARCHAR(200)", cols)
        _add_column("assessment_attempts", "total_points_earned", "INTEGER DEFAULT 0", cols)
        _add_column("assessment_attempts", "max_points", "INTEGER DEFAULT 0", cols)
        _add_column("assessment_attempts", "feedback", "TEXT", cols)
        _add_column("assessment_attempts", "cheated", f"BOOLEAN DEFAULT {bool_false}", cols)
        _add_column("assessment_attempts", "cheating_reasons", json_type, cols)
        _add_column("assessment_attempts", "violation_count", "INTEGER DEFAULT 0", cols)

    # 10. Assignments Table
    if "assignments" in tables:
        cols = {c["name"] for c in inspector.get_columns("assignments")}
        _add_column("assignments", "description", "TEXT", cols)
        _add_column("assignments", "subject_id", uuid_type, cols)
        _add_column("assignments", "subject_name", "VARCHAR(200)", cols)
        _add_column("assignments", "starter_code", "TEXT", cols)
        _add_column("assignments", "due_date", dt_type, cols)

    if "assignment_submissions" in tables:
        cols = {c["name"] for c in inspector.get_columns("assignment_submissions")}
        _add_column("assignment_submissions", "student_name", "VARCHAR(200)", cols)
        _add_column("assignment_submissions", "file_url", "VARCHAR(1000)", cols)



async def purge_legacy_school_data(session: AsyncSession) -> None:
    """Safely cleans up any old school dummy accounts, Class 1-10 grades, and obsolete feedback."""
    statements = [
        # 1. Delete legacy teacher feedback
        """
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
        """,
        # 2. Delete legacy timetable slots for Class 1-10
        """
        DELETE FROM timetable_slots 
        WHERE section_id IN (
            SELECT s.id FROM school_sections s 
            JOIN school_grades g ON s.grade_id = g.id 
            WHERE g.name LIKE 'Class %'
        )
        """,
        # 3. Delete legacy school sections & grades
        """
        DELETE FROM school_sections 
        WHERE grade_id IN (
            SELECT id FROM school_grades WHERE name LIKE 'Class %'
        )
        """,
        """
        DELETE FROM grade_curricula 
        WHERE grade_id IN (
            SELECT id FROM school_grades WHERE name LIKE 'Class %'
        )
        """,
        """
        DELETE FROM school_grades WHERE name LIKE 'Class %'
        """,
        # 4. Delete obsolete school subjects
        """
        DELETE FROM school_subjects 
        WHERE code IN ('MATH-01', 'ENG-01', 'SCI-01', 'SOC-01', 'HIN-01', 'SAN-01', 'PE-01', 'ART-01')
           OR name IN ('Mathematics', 'English', 'Science', 'Social Studies', 'Hindi', 'Sanskrit', 'Physical Education', 'Art & Craft')
        """,
        # 5. Remove student enrollments, attendances, teacher skills for school users
        """
        DELETE FROM enrollments 
        WHERE user_id IN (
            SELECT id FROM users 
            WHERE email LIKE '%@school.edu' 
               OR display_name LIKE '%Class %'
               OR display_name LIKE '%Class-%'
        )
        """,
        # 5. Delete legacy teacher profiles for non-faculty
        """
        DELETE FROM teacher_profiles 
        WHERE user_id IN (
            SELECT id FROM users 
            WHERE email LIKE '%@school.edu' 
               OR (role = 'teacher' AND email NOT IN (
                    'sarah.connor@institute.edu',
                    'alan.turing@institute.edu',
                    'sarah.fullstack@institute.edu',
                    'alan.genai@institute.edu',
                    'marc.b@institute.edu',
                    'fred.l@institute.edu',
                    'dan.a@institute.edu',
                    'linus.t@institute.edu',
                    'teacher@example.com'
               ))
        )
        """,
        # 6. Delete all users with email @school.edu or display_name with Class
        """
        DELETE FROM users 
        WHERE email LIKE '%@school.edu' 
           OR display_name LIKE '%Class %'
           OR display_name LIKE '%(Class%'
        """
    ]

    for stmt in statements:
        try:
            await session.execute(text(stmt))
            await session.commit()
        except Exception as e:
            await session.rollback()
            print(f"[Purge Legacy School Data] step note: {e}")


async def _bootstrap_defaults() -> None:
    """Ensure essential System Admin account, sample Faculty, and sample Student accounts exist."""
    from app.identity.models import User
    from app.identity.security import hash_password
    from app.tenancy.models import Organization
    from app.timetable.models import TeacherProfile

    admins = [
        ("admin@example.com", "System Admin", "ChangeMe123!"),
        ("admin@lms-platform.com", "Platform Administrator", "OrbitAdmin!2026X7"),
    ]
    if settings.bootstrap_admin_email and settings.bootstrap_admin_password:
        admins.append((settings.bootstrap_admin_email.lower(), settings.bootstrap_admin_name, settings.bootstrap_admin_password))

    faculty_members = [
        ("sarah.fullstack@institute.edu", "Dr. Sarah Connor", "ChangeMe123!", "Full Stack Web Development & Distributed Systems Faculty", "EMP-FS-101"),
        ("alan.genai@institute.edu", "Dr. Alan Turing", "ChangeMe123!", "Generative AI & Deep Learning Faculty", "EMP-AI-102"),
    ]

    students = [
        ("alex.student@institute.edu", "Alex Mercer", "ChangeMe123!", "Full Stack Engineering Scholar"),
        ("priya.student@institute.edu", "Priya Sharma", "ChangeMe123!", "Generative AI & Machine Learning Scholar"),
    ]

    async with SessionFactory() as session:
        # 1. Clean up legacy school dummy accounts & outdated users
        await purge_legacy_school_data(session)

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

        # 3. Ensure Admins
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

        # 4. Ensure Faculty (Full Stack & Gen AI)
        try:
            for email, name, pwd, headline, emp_id in faculty_members:
                u = await session.scalar(select(User).where(User.email == email.lower()))
                if not u:
                    u = User(
                        email=email.lower(),
                        display_name=name,
                        headline=headline,
                        password_hash=hash_password(pwd),
                        role="teacher",
                        status="active",
                        email_verified=True,
                    )
                    session.add(u)
                    await session.flush()
                else:
                    u.password_hash = hash_password(pwd)
                    u.role = "teacher"
                    u.status = "active"
                    u.headline = headline
                    u.email_verified = True
                    await session.flush()

                tp = await session.scalar(select(TeacherProfile).where(TeacherProfile.user_id == u.id))
                if not tp:
                    session.add(TeacherProfile(
                        user_id=u.id,
                        employee_id=emp_id,
                        qualification="Ph.D / M.Tech in Computer Science",
                        max_daily_periods=6,
                        rating_avg=5.0,
                    ))
            await session.commit()
        except Exception as err:
            await session.rollback()
            print(f"[Bootstrap] ensure faculty: {err}")

        # 5. Ensure Students
        try:
            for email, name, pwd, headline in students:
                u = await session.scalar(select(User).where(User.email == email.lower()))
                if not u:
                    session.add(User(
                        email=email.lower(),
                        display_name=name,
                        headline=headline,
                        password_hash=hash_password(pwd),
                        role="student",
                        status="active",
                        email_verified=True,
                    ))
                else:
                    u.password_hash = hash_password(pwd)
                    u.role = "student"
                    u.status = "active"
                    u.headline = headline
                    u.email_verified = True
            await session.commit()
        except Exception as err:
            await session.rollback()
            print(f"[Bootstrap] ensure students: {err}")

        # 6. Ensure Core Courses, Subjects & Enrollments
        try:
            from app.courses.models import Course, CourseVersion, CourseSubject
            from app.enrollment.models import Enrollment

            org = await session.scalar(select(Organization).where(Organization.slug == "omni-institute"))
            sarah = await session.scalar(select(User).where(User.email == "sarah.fullstack@institute.edu"))
            alan = await session.scalar(select(User).where(User.email == "alan.genai@institute.edu"))
            alex = await session.scalar(select(User).where(User.email == "alex.student@institute.edu"))
            priya = await session.scalar(select(User).where(User.email == "priya.student@institute.edu"))

            if org and sarah and alan:
                # 1. Full Stack Course
                c_fs = await session.scalar(select(Course).where(Course.slug == "full-stack-web-development"))
                if not c_fs:
                    c_fs = Course(
                        organization_id=org.id,
                        slug="full-stack-web-development",
                        status="published",
                        level="intermediate",
                        is_featured=True,
                    )
                    session.add(c_fs)
                    await session.flush()
                    v_fs = CourseVersion(
                        course_id=c_fs.id,
                        version_number=1,
                        title="Full Stack Web Development & Distributed Systems",
                        description="Comprehensive masterclass on React, FastAPI, microservices, and Vimeo video pipelines.",
                    )
                    session.add(v_fs)
                    subj_fs = CourseSubject(
                        course_id=c_fs.id,
                        teacher_id=sarah.id,
                        code="FS-101",
                        name="Full Stack Architecture & Cloud Services",
                        color="#3b82f6",
                    )
                    session.add(subj_fs)
                    await session.flush()

                if alex and c_fs:
                    enr_alex = await session.scalar(select(Enrollment).where(Enrollment.user_id == alex.id, Enrollment.course_id == c_fs.id))
                    if not enr_alex:
                        session.add(Enrollment(user_id=alex.id, course_id=c_fs.id, status="active"))

                # 2. Gen AI Course
                c_ai = await session.scalar(select(Course).where(Course.slug == "generative-ai-and-llms"))
                if not c_ai:
                    c_ai = Course(
                        organization_id=org.id,
                        slug="generative-ai-and-llms",
                        status="published",
                        level="advanced",
                        is_featured=True,
                    )
                    session.add(c_ai)
                    await session.flush()
                    v_ai = CourseVersion(
                        course_id=c_ai.id,
                        version_number=1,
                        title="Generative AI, LLMs & Autonomous Agents",
                        description="Deep dive into transformers, RAG architectures, prompt engineering, and autonomous agents.",
                    )
                    session.add(v_ai)
                    subj_ai = CourseSubject(
                        course_id=c_ai.id,
                        teacher_id=alan.id,
                        code="AI-201",
                        name="Generative AI & LLM Systems",
                        color="#8b5cf6",
                    )
                    session.add(subj_ai)
                    await session.flush()

                if priya and c_ai:
                    enr_priya = await session.scalar(select(Enrollment).where(Enrollment.user_id == priya.id, Enrollment.course_id == c_ai.id))
                    if not enr_priya:
                        session.add(Enrollment(user_id=priya.id, course_id=c_ai.id, status="active"))

                # 3. Ensure Realistic Assignments
                from app.assignments.models import Assignment
                if c_fs:
                    asg_fs = await session.scalar(select(Assignment).where(Assignment.course_id == c_fs.id))
                    if not asg_fs:
                        session.add(Assignment(
                            course_id=c_fs.id,
                            subject_name="Full Stack Architecture & Cloud Services",
                            title="Lab 1: Production REST API & React State Machine Architecture",
                            description="Design an asynchronous FastAPI backend service integrated with a React TypeScript client, JWT authentication, and resilient state synchronization.",
                            instructions="1. Implement async SQLAlchemy session management.\n2. Construct React query caching hooks.\n3. Submit GitHub repo URL or source code derivation.",
                            starter_code="# FastAPI + React Architecture Boilerplate\nimport asyncio\nfrom fastapi import FastAPI, Depends\n\napp = FastAPI(title='Enterprise Omni-Service')\n\n@app.get('/api/v1/health')\nasync def health_check():\n    return {'status': 'healthy', 'uptime_ms': 1250}\n",
                            max_score=100,
                            status="published",
                        ))

                if c_ai:
                    asg_ai = await session.scalar(select(Assignment).where(Assignment.course_id == c_ai.id))
                    if not asg_ai:
                        session.add(Assignment(
                            course_id=c_ai.id,
                            subject_name="Generative AI & LLM Systems",
                            title="Lab 1: Enterprise Multi-Agent RAG Pipeline with LangGraph & Groq LPU",
                            description="Construct a hierarchical multi-agent retrieval system featuring semantic chunking, HNSW vector search, and sub-100ms Groq LPU inference.",
                            instructions="1. Setup LangGraph state graph with supervisory routing.\n2. Implement dense retrieval reranking.\n3. Verify token throughput telemetry.",
                            starter_code="# Multi-Agent LangGraph Pipeline\nfrom typing import TypedDict, Annotated, Sequence\nimport operator\n\nclass AgentState(TypedDict):\n    messages: Annotated[Sequence[dict], operator.add]\n    current_agent: str\n    confidence_score: float\n",
                            max_score=100,
                            status="published",
                        ))

                # 4. Ensure Realistic Assessments
                from app.assessment.models import Assessment, AssessmentQuestion
                if c_fs and sarah:
                    asmt_fs = await session.scalar(select(Assessment).where(Assessment.course_id == c_fs.id))
                    if not asmt_fs:
                        asmt_fs = Assessment(
                            course_id=c_fs.id,
                            title="Full Stack Web & Cloud Architecture Certification Benchmark",
                            description="Comprehensive examination assessing async Python, FastAPI middleware, React state lifecycle, and PostgreSQL query optimization.",
                            target_grade="Full Stack Web Development",
                            subject_name="FS-101: Full Stack Architecture & Cloud Services",
                            topic_syllabus="FastAPI AsyncIO, React Hooks Memoization & SQL Indexing",
                            teacher_id=sarah.id,
                            teacher_name="Dr. Sarah Connor",
                            schedule_type="ALWAYS_AVAILABLE",
                            duration_minutes=45,
                            passing_score=70,
                            total_points=30,
                            requires_proctoring=True,
                            status="PUBLISHED",
                        )
                        session.add(asmt_fs)
                        await session.flush()
                        session.add_all([
                            AssessmentQuestion(
                                assessment_id=asmt_fs.id,
                                prompt="In Python AsyncIO and FastAPI, what is the key advantage of 'asyncio.TaskGroup' over 'asyncio.gather'?",
                                question_type="multiple_choice",
                                options=[
                                    "TaskGroup guarantees structured concurrency by cancelling sibling tasks if any task raises an exception",
                                    "TaskGroup spawns separate operating system processes for CPU parallelism",
                                    "TaskGroup disables the GIL during network I/O",
                                    "TaskGroup forces synchronous blocking execution"
                                ],
                                correct_answer="0",
                                points=10,
                                cognitive_level="APPLICATION",
                                concept_name="AsyncIO Structured Concurrency",
                                explanation="TaskGroup provides structured concurrency in Python 3.11+, propagating failures cleanly and avoiding orphaned tasks.",
                                position=1,
                            ),
                            AssessmentQuestion(
                                assessment_id=asmt_fs.id,
                                prompt="When optimizing PostgreSQL for high-volume tenant lookups, which index structure provides O(log N) equality and range queries?",
                                question_type="multiple_choice",
                                options=["B-Tree Index", "GIN Inverted Index", "BRIN Block Range Index", "Hash Index"],
                                correct_answer="0",
                                points=10,
                                cognitive_level="REASONING",
                                concept_name="Database Indexing",
                                explanation="B-Tree indexes are the default and most efficient general-purpose structure for equality and range queries in PostgreSQL.",
                                position=2,
                            ),
                            AssessmentQuestion(
                                assessment_id=asmt_fs.id,
                                prompt="Describe the architectural difference between React Server Components (RSC) and standard Client Components regarding bundle size.",
                                question_type="descriptive",
                                options=[],
                                correct_answer="",
                                points=10,
                                cognitive_level="TRANSFER",
                                concept_name="React Architecture",
                                explanation="RSC execute strictly on the server and their dependencies are never shipped in the client JavaScript bundle, significantly decreasing client load time.",
                                position=3,
                            ),
                        ])

                if c_ai and alan:
                    asmt_ai = await session.scalar(select(Assessment).where(Assessment.course_id == c_ai.id))
                    if not asmt_ai:
                        asmt_ai = Assessment(
                            course_id=c_ai.id,
                            title="Generative AI, LLMs & Multi-Agent Systems Benchmark",
                            description="Rigorous evaluation on transformer attention mechanisms, vector databases (HNSW), LangChain LCEL, and Groq LPU inference architectures.",
                            target_grade="Generative AI & LLMs",
                            subject_name="AI-201: Generative AI & LLM Systems",
                            topic_syllabus="LangChain LCEL, RAG Vector Search & Agentic Graphs",
                            teacher_id=alan.id,
                            teacher_name="Dr. Alan Turing",
                            schedule_type="ALWAYS_AVAILABLE",
                            duration_minutes=45,
                            passing_score=70,
                            total_points=30,
                            requires_proctoring=True,
                            status="PUBLISHED",
                        )
                        session.add(asmt_ai)
                        await session.flush()
                        session.add_all([
                            AssessmentQuestion(
                                assessment_id=asmt_ai.id,
                                prompt="In Retrieval-Augmented Generation (RAG), why does HNSW (Hierarchical Navigable Small World) outperform naive cosine scanning for 1M+ embeddings?",
                                question_type="multiple_choice",
                                options=[
                                    "HNSW constructs multi-layer proximity graphs providing sub-linear logarithmic O(log N) ANN search time",
                                    "HNSW compresses all embeddings into 8-bit integers without vectors",
                                    "HNSW eliminates the need for query embedding generation",
                                    "HNSW runs strictly on GPU tensor cores only"
                                ],
                                correct_answer="0",
                                points=10,
                                cognitive_level="REASONING",
                                concept_name="Vector Search Algorithms",
                                explanation="HNSW creates hierarchical skip-list graphs where search navigates coarse to fine layers, achieving rapid O(log N) retrieval.",
                                position=1,
                            ),
                            AssessmentQuestion(
                                assessment_id=asmt_ai.id,
                                prompt="In LangChain 0.3 LCEL, which component passes incoming inputs unmodified into a parallel dictionary branch?",
                                question_type="multiple_choice",
                                options=["RunnablePassthrough()", "RunnableParallel()", "RunnableLambda()", "RunnableBranch()"],
                                correct_answer="0",
                                points=10,
                                cognitive_level="APPLICATION",
                                concept_name="LangChain LCEL",
                                explanation="RunnablePassthrough allows an input value to flow unmodified into subsequent runnables.",
                                position=2,
                            ),
                            AssessmentQuestion(
                                assessment_id=asmt_ai.id,
                                prompt="How does FlashAttention optimize self-attention memory bandwidth on modern GPUs?",
                                question_type="descriptive",
                                options=[],
                                correct_answer="",
                                points=10,
                                cognitive_level="TRANSFER",
                                concept_name="Transformer Architecture",
                                explanation="FlashAttention tiles inputs and computes softmax on-chip in SRAM without materializing the full N x N attention matrix to slow GPU High Bandwidth Memory (HBM).",
                                position=3,
                            ),
                        ])

            await session.commit()
        except Exception as err:
            await session.rollback()
            print(f"[Bootstrap] ensure courses & enrollments: {err}")


async def flush_all_operational_data(session: AsyncSession) -> dict[str, Any]:
    """Completely flushes all demo/test/seed operational data across the entire database:
    - timetable slots -> 0
    - live classes -> 0
    - recordings -> 0
    - resources -> 0
    - enrollments -> 0
    - courses & subjects -> 0
    - legacy school records -> 0
    - non-admin test users -> 0
    Preserves ONLY System Admin accounts.
    """
    from app.classroom.models import LiveClass, ClassRecording, ClassAttendance, ClassParticipantLog, ClassTranscript, ZoomWebhookEvent
    from app.content.models import LearningResource, CourseSection
    from app.courses.models import Course, CourseSubject, CourseVersion, CourseReview, Category
    from app.enrollment.models import Enrollment
    from app.identity.models import User, RefreshToken, OrganizationMembership
    from app.learning.models import ResourceProgress
    from app.notifications.models import Notification
    from app.timetable.models import (
        TimetableSlot, TeacherProfile, TeacherSubjectSkill, TeacherFeedback,
        TeacherClassRestriction, TeacherLeave, TimetableRule, SchoolGrade,
        SchoolSection, Subject, GradeCurriculum, CurriculumCourseOverride
    )

    # 1. Learning progress & drop obsolete LENS tables
    await session.execute(delete(ResourceProgress))
    try:
        from sqlalchemy import text
        await session.execute(text("DROP TABLE IF EXISTS learning_action_feedback, learner_concept_states, learning_evidence, lens_sn1_decision_audits, lens_teacher_escalations, lens_learner_states, lens_sn1_runs, lens_sn1_threads CASCADE"))
    except Exception:
        pass

    # 2. Timetable & Live classes & Recordings & Resources
    await session.execute(delete(ClassAttendance))
    await session.execute(delete(ClassParticipantLog))
    await session.execute(delete(ClassTranscript))
    await session.execute(delete(ZoomWebhookEvent))
    await session.execute(delete(ClassRecording))
    await session.execute(delete(LiveClass))
    await session.execute(delete(TimetableSlot))
    await session.execute(delete(LearningResource))
    await session.execute(delete(CourseSection))

    # 3. Enrollments & Reviews & Notifications
    await session.execute(delete(Enrollment))
    await session.execute(delete(CourseReview))
    await session.execute(delete(Notification))

    # 4. Subjects & Courses
    await session.execute(delete(CourseSubject))
    await session.execute(delete(CourseVersion))
    await session.execute(delete(Course))
    await session.execute(delete(Category))

    # 5. Legacy school structures
    await session.execute(delete(CurriculumCourseOverride))
    await session.execute(delete(GradeCurriculum))
    await session.execute(delete(SchoolSection))
    await session.execute(delete(SchoolGrade))
    await session.execute(delete(Subject))

    # 6. Teacher profiles & auxiliary records
    await session.execute(delete(TeacherSubjectSkill))
    await session.execute(delete(TeacherFeedback))
    await session.execute(delete(TeacherClassRestriction))
    await session.execute(delete(TeacherLeave))
    await session.execute(delete(TeacherProfile))

    # 7. Remove non-admin users and their sessions
    admin_users = (await session.scalars(select(User).where(User.role == "admin"))).all()
    admin_ids = [u.id for u in admin_users]
    if admin_ids:
        await session.execute(delete(OrganizationMembership).where(OrganizationMembership.user_id.not_in(admin_ids)))
        await session.execute(delete(RefreshToken).where(RefreshToken.user_id.not_in(admin_ids)))
        await session.execute(delete(User).where(User.id.not_in(admin_ids)))
    else:
        await session.execute(delete(User).where(User.role != "admin"))

    await session.commit()
    return {"status": "success", "message": "All operational data completely flushed. System ready for dynamic Admin creation."}

