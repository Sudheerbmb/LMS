import urllib.parse
import uuid
from datetime import datetime
from typing import AsyncGenerator

from sqlalchemy import DateTime, MetaData, Uuid
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column

from lens.config import settings

# Naming convention for clean constraints
convention = {
    "ix": "ix_%(column_0_label)s",
    "uq": "uq_%(table_name)s_%(column_0_name)s",
    "ck": "ck_%(table_name)s_%(constraint_name)s",
    "fk": "fk_%(table_name)s_%(column_0_name)s_%(referred_table_name)s",
    "pk": "pk_%(table_name)s",
}
metadata = MetaData(naming_convention=convention)


class LensBase(DeclarativeBase):
    metadata = metadata


class LensUUIDMixin:
    id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True), primary_key=True, default=uuid.uuid4
    )


class LensTimestampMixin:
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=datetime.utcnow, nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=datetime.utcnow,
        onupdate=datetime.utcnow,
        nullable=False,
    )


def get_engine_url(url: str) -> str:
    if not isinstance(url, str) or not url.strip():
        return url
    url = url.strip()
    if url.startswith("postgres://"):
        url = url.replace("postgres://", "postgresql+asyncpg://", 1)
    elif url.startswith("postgresql://") and not url.startswith("postgresql+"):
        url = url.replace("postgresql://", "postgresql+asyncpg://", 1)

    if "postgresql+asyncpg://" in url:
        parsed = urllib.parse.urlsplit(url)
        if parsed.query:
            query_pairs = urllib.parse.parse_qsl(parsed.query)
            allowed_asyncpg_params = {
                "ssl", "timeout", "command_timeout", "statement_cache_size",
                "max_cached_statement_lifetime", "max_cacheable_statement_size",
                "server_settings"
            }
            cleaned_pairs = []
            for k, val in query_pairs:
                if k == "sslmode":
                    cleaned_pairs.append(("ssl", "require" if val != "disable" else "disable"))
                elif k in allowed_asyncpg_params:
                    cleaned_pairs.append((k, val))
            new_query = urllib.parse.urlencode(cleaned_pairs)
            url = urllib.parse.urlunsplit((parsed.scheme, parsed.netloc, parsed.path, new_query, parsed.fragment))

    return url


engine = create_async_engine(
    get_engine_url(settings.database_url),
    echo=False,
    pool_pre_ping=True,
    pool_size=10,
    max_overflow=20,
)

async_session_factory = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,
)


async def get_lens_session() -> AsyncGenerator[AsyncSession, None]:
    async with async_session_factory() as session:
        yield session


async def init_lens_database():
    async with engine.begin() as conn:
        await conn.run_sync(LensBase.metadata.create_all)
