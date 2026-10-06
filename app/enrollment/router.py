from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.enrollment.schemas import EnrollmentRead
from app.enrollment.service import AlreadyEnrolledError, CourseNotFoundError, enroll_user
from app.identity.auth import get_current_user
from app.identity.models import User
from app.platform.database import get_session


router = APIRouter(prefix="/api/v1/enrollments", tags=["enrollment"])


@router.get("/me", response_model=list[EnrollmentRead])
async def get_my_enrollments(
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> list[EnrollmentRead]:
    from sqlalchemy import select
    from sqlalchemy.orm import selectinload
    from app.enrollment.models import Enrollment
    from app.courses.models import Course

    enrollments = (
        await session.scalars(
            select(Enrollment).where(Enrollment.user_id == current_user.id)
        )
    ).all()
    if not enrollments:
        return []

    course_ids = [e.course_id for e in enrollments]
    courses = (
        await session.scalars(
            select(Course)
            .options(selectinload(Course.versions))
            .where(Course.id.in_(course_ids))
        )
    ).all()
    course_map = {c.id: c for c in courses}

    result = []
    for e in enrollments:
        c = course_map.get(e.course_id)
        c_title = c.versions[0].title if (c and c.versions) else (c.slug if c else "Technical Course")
        c_slug = c.slug if c else ""
        result.append(
            EnrollmentRead(
                id=e.id,
                user_id=e.user_id,
                course_id=e.course_id,
                status=e.status,
                progress_percent=e.progress_percent,
                course_title=c_title,
                course_slug=c_slug,
                section_name="Batch A",
            )
        )
    return result


@router.post("/{course_id}", response_model=EnrollmentRead, status_code=status.HTTP_201_CREATED)
async def enroll(
    course_id: UUID,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> EnrollmentRead:
    try:
        return await enroll_user(session, course_id, current_user)
    except CourseNotFoundError as error:
        raise HTTPException(status_code=404, detail=str(error)) from error
    except AlreadyEnrolledError as error:
        raise HTTPException(status_code=409, detail=str(error)) from error
