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
        if "sqlite" in settings.database_url:
            await connection.run_sync(_patch_sqlite_columns)

    await _bootstrap_defaults()


def _patch_sqlite_columns(connection: Connection) -> None:
    """Apply schema patches that Alembic would handle in production."""
    inspector = inspect(connection)
    tables = inspector.get_table_names()

    if "users" in tables:
        columns = {c["name"] for c in inspector.get_columns("users")}
        if "role" not in columns:
            connection.execute(text("ALTER TABLE users ADD COLUMN role VARCHAR(32) DEFAULT 'student' NOT NULL"))
        if "phone_number" not in columns:
            connection.execute(text("ALTER TABLE users ADD COLUMN phone_number VARCHAR(32)"))
        if "avatar_url" not in columns:
            connection.execute(text("ALTER TABLE users ADD COLUMN avatar_url VARCHAR(500)"))
        if "bio" not in columns:
            connection.execute(text("ALTER TABLE users ADD COLUMN bio TEXT"))
        if "timezone" not in columns:
            connection.execute(text("ALTER TABLE users ADD COLUMN timezone VARCHAR(64) DEFAULT 'UTC'"))
        if "locale" not in columns:
            connection.execute(text("ALTER TABLE users ADD COLUMN locale VARCHAR(16) DEFAULT 'en'"))
        if "email_verified" not in columns:
            connection.execute(text("ALTER TABLE users ADD COLUMN email_verified BOOLEAN DEFAULT 0"))
        if "last_login_at" not in columns:
            connection.execute(text("ALTER TABLE users ADD COLUMN last_login_at DATETIME"))
        if "login_count" not in columns:
            connection.execute(text("ALTER TABLE users ADD COLUMN login_count INTEGER DEFAULT 0"))
        if "failed_login_count" not in columns:
            connection.execute(text("ALTER TABLE users ADD COLUMN failed_login_count INTEGER DEFAULT 0"))
        if "locked_until" not in columns:
            connection.execute(text("ALTER TABLE users ADD COLUMN locked_until DATETIME"))

    if "courses" in tables:
        columns = {c["name"] for c in inspector.get_columns("courses")}
        if "category" not in columns:
            connection.execute(text("ALTER TABLE courses ADD COLUMN category VARCHAR(100)"))
        if "tags" not in columns:
            connection.execute(text("ALTER TABLE courses ADD COLUMN tags JSON"))
        if "thumbnail_url" not in columns:
            connection.execute(text("ALTER TABLE courses ADD COLUMN thumbnail_url VARCHAR(500)"))
        if "level" not in columns:
            connection.execute(text("ALTER TABLE courses ADD COLUMN level VARCHAR(32) DEFAULT 'beginner'"))
        if "language" not in columns:
            connection.execute(text("ALTER TABLE courses ADD COLUMN language VARCHAR(16) DEFAULT 'en'"))
        if "estimated_hours" not in columns:
            connection.execute(text("ALTER TABLE courses ADD COLUMN estimated_hours REAL"))
        if "max_students" not in columns:
            connection.execute(text("ALTER TABLE courses ADD COLUMN max_students INTEGER"))
        if "price" not in columns:
            connection.execute(text("ALTER TABLE courses ADD COLUMN price REAL DEFAULT 0.0"))
        if "is_free" not in columns:
            connection.execute(text("ALTER TABLE courses ADD COLUMN is_free BOOLEAN DEFAULT 1"))
        if "rating_avg" not in columns:
            connection.execute(text("ALTER TABLE courses ADD COLUMN rating_avg REAL DEFAULT 0.0"))
        if "rating_count" not in columns:
            connection.execute(text("ALTER TABLE courses ADD COLUMN rating_count INTEGER DEFAULT 0"))
        if "enrolled_count" not in columns:
            connection.execute(text("ALTER TABLE courses ADD COLUMN enrolled_count INTEGER DEFAULT 0"))


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

        # 2. Ensure default Organization
        org = await session.scalar(select(Organization).where(Organization.slug == "acharya-academy"))
        if not org:
            session.add(Organization(
                name="Acharya Global Academy",
                slug="acharya-academy",
                website="https://school.edu",
                status="active",
                is_public=True,
            ))
            await session.flush()

        # 3. Seed school structure, grades, sections, subjects, rules, and teachers
        try:
            await seed_school_defaults(session)
        except Exception as err:
            print(f"[Bootstrap] seed_school_defaults: {err}")

        # 4. Ensure Students
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

        # 5. Ensure Generic teacher account
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

        # 6. Ensure all teachers have password Teacher123!
        teachers = (await session.scalars(select(User).where(User.role == "teacher"))).all()
        for t in teachers:
            t.password_hash = hash_password("Teacher123!")
            t.status = "active"
            t.email_verified = True

        await session.commit()

        # 7. Generate Master Timetable if empty
        try:
            slot_count = await session.scalar(select(func.count(TimetableSlot.id)))
            if not slot_count or slot_count == 0:
                await generate_school_timetable(session)
        except Exception as err:
            print(f"[Bootstrap] generate_school_timetable: {err}")

