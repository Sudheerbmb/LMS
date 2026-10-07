from typing import List
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.assessment.schemas import (
    AIAssessmentGenerateRequest,
    AIAssessmentGenerateResponse,
    AssessmentCreate,
    AssessmentRead,
    AttemptCreate,
    AttemptRead,
    QuestionCreate,
    QuestionRead,
)
from app.assessment.service import (
    AssessmentAccessError,
    AssessmentNotFoundError,
    create_assessment,
    delete_assessment,
    generate_ai_questions_groq,
    get_all_assessments,
    get_assessment_submissions,
    get_course_assessments,
    get_student_submissions,
    submit_attempt,
)
from app.identity.models import User
from app.identity.permissions import require_permission
from app.platform.database import get_session


router = APIRouter(prefix="/api/v1/assessment", tags=["assessment"])


@router.get("", response_model=List[AssessmentRead])
@router.get("/all", response_model=List[AssessmentRead])
async def list_all_assessments(
    current_user: User = Depends(require_permission("course:read")),
    session: AsyncSession = Depends(get_session),
) -> List[AssessmentRead]:
    return await get_all_assessments(session, current_user)


@router.get("/courses/{course_id}", response_model=List[AssessmentRead])
async def list_by_course(
    course_id: UUID,
    current_user: User = Depends(require_permission("course:read")),
    session: AsyncSession = Depends(get_session),
) -> List[AssessmentRead]:
    return await get_course_assessments(session, course_id)


@router.post("/courses/{course_id}", response_model=AssessmentRead, status_code=status.HTTP_201_CREATED)
async def create(
    course_id: UUID,
    data: AssessmentCreate,
    current_user: User = Depends(require_permission("assessment:manage")),
    session: AsyncSession = Depends(get_session),
) -> AssessmentRead:
    try:
        return await create_assessment(session, course_id, data, current_user)
    except AssessmentAccessError as error:
        raise HTTPException(status_code=403, detail=str(error)) from error
    except AssessmentNotFoundError as error:
        raise HTTPException(status_code=404, detail=str(error)) from error


@router.delete("/{assessment_id}")
async def delete_item(
    assessment_id: UUID,
    current_user: User = Depends(require_permission("assessment:manage")),
    session: AsyncSession = Depends(get_session),
):
    try:
        return await delete_assessment(session, assessment_id, current_user)
    except AssessmentNotFoundError as error:
        raise HTTPException(status_code=404, detail=str(error)) from error
    except AssessmentAccessError as error:
        raise HTTPException(status_code=403, detail=str(error)) from error


@router.post("/generate-ai", response_model=AIAssessmentGenerateResponse)
async def generate_questions_with_ai(
    req: AIAssessmentGenerateRequest,
    current_user: User = Depends(require_permission("course:read")),
) -> AIAssessmentGenerateResponse:
    return await generate_ai_questions_groq(req)


@router.post("/{assessment_id}/attempts", response_model=AttemptRead)
async def attempt(
    assessment_id: UUID,
    data: AttemptCreate,
    current_user: User = Depends(require_permission("assessment:attempt")),
    session: AsyncSession = Depends(get_session),
) -> AttemptRead:
    try:
        return await submit_attempt(session, assessment_id, data, current_user)
    except AssessmentNotFoundError as error:
        raise HTTPException(status_code=404, detail=str(error)) from error
    except AssessmentAccessError as error:
        raise HTTPException(status_code=403, detail=str(error)) from error


@router.get("/{assessment_id}/submissions", response_model=List[AttemptRead])
async def list_assessment_submissions(
    assessment_id: UUID,
    current_user: User = Depends(require_permission("assessment:manage")),
    session: AsyncSession = Depends(get_session),
) -> List[AttemptRead]:
    return await get_assessment_submissions(session, assessment_id)


@router.get("/my-submissions", response_model=List[AttemptRead])
async def list_my_submissions(
    current_user: User = Depends(require_permission("course:read")),
    session: AsyncSession = Depends(get_session),
) -> List[AttemptRead]:
    return await get_student_submissions(session, current_user)

