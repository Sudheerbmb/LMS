import json
import os
from typing import Any, Dict, List, Optional
from uuid import UUID
import httpx
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.assignments.models import Assignment, AssignmentSubmission
from app.assignments.schemas import (
    AIAssignmentGenerateRequest,
    AIAssignmentGenerateResponse,
    AssignmentCreate,
    GradeRequest,
    SubmissionCreate,
)
from app.courses.models import Course, CourseSubject
from app.enrollment.models import Enrollment
from app.identity.models import User
from app.platform.config import settings


class AssignmentNotFoundError(ValueError):
    pass


class AssignmentAccessError(ValueError):
    pass


class SubmissionAlreadyExistsError(ValueError):
    pass


async def generate_ai_assignment_groq(req: AIAssignmentGenerateRequest) -> AIAssignmentGenerateResponse:
    """Dynamically synthesizes a rigorous technical assignment using Groq LPU."""
    grade = req.grade.strip() or "Full Stack Web Development"
    subject = req.subject.strip() or "Software Engineering"
    topic = req.topic.strip() or "System Architecture & Implementation"

    api_key = settings.groq_api_key or os.getenv("GROQ_API_KEY", "")
    if api_key:
        candidate_models = [
            settings.groq_model,
            "llama-3.3-70b-versatile",
            "llama-3.1-8b-instant",
            "llama3-70b-8192",
        ]
        candidate_models = [m for m in candidate_models if m]

        prompt = (
            f"You are a Senior Technical Instructor and Lead Software Architect for **{grade} • {subject}**.\n"
            f"Create a hands-on, production-grade programming / engineering assignment on the topic **\"{topic}\"**.\n"
            f"Return STRICT JSON with keys:\n"
            f"{{\n"
            f"  \"title\": \"Title of assignment\",\n"
            f"  \"description\": \"Comprehensive problem statement, architectural goals, and real-world scenario (2-3 paragraphs)\",\n"
            f"  \"instructions\": \"Step-by-step implementation milestones, constraints, and submission criteria\",\n"
            f"  \"starter_code\": \"Clean, well-commented starter boilerplate code in Python or TypeScript\",\n"
            f"  \"max_score\": 100\n"
            f"}}"
        )

        messages = [
            {"role": "system", "content": "You are an elite software engineering faculty architect. Output valid JSON only."},
            {"role": "user", "content": prompt}
        ]

        url = "https://api.groq.com/openai/v1/chat/completions"
        headers = {"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"}

        for model_name in candidate_models:
            try:
                async with httpx.AsyncClient(timeout=25.0) as client:
                    res = await client.post(
                        url,
                        headers=headers,
                        json={"model": model_name, "messages": messages, "temperature": 0.25, "response_format": {"type": "json_object"}}
                    )
                    if res.status_code == 200:
                        data = res.json()
                        content = data["choices"][0]["message"]["content"]
                        p = json.loads(content)
                        return AIAssignmentGenerateResponse(
                            title=p.get("title", f"Hands-on Lab: {topic}"),
                            description=p.get("description", f"Production challenge on {topic}."),
                            instructions=p.get("instructions", "1. Implement core functions.\n2. Verify edge cases.\n3. Submit code."),
                            starter_code=p.get("starter_code", f"# Starter code for {topic}\n"),
                            max_score=int(p.get("max_score", 100))
                        )
            except Exception as err:
                print(f"[Groq Assignment Exception with {model_name}]: {err}")

    # Dynamic fallback tailored to topic
    return AIAssignmentGenerateResponse(
        title=f"Lab: {topic} Architecture & Implementation",
        description=f"Design and implement a robust, high-performance module for {topic} in {subject}. Ensure strict typing, exception boundary handling, and test coverage.",
        instructions=f"1. Implement the architecture in the provided starter boilerplate.\n2. Handle edge cases and concurrency safeguards for {topic}.\n3. Submit solution source code or git repository link.",
        starter_code=f"# {topic} Implementation Starter\nfrom typing import Any, Dict\nimport asyncio\n\nasync def solve_{topic.lower().replace(' ', '_')}():\n    # TODO: Implement production solution\n    pass\n",
        max_score=100
    )


async def create_assignment(session: AsyncSession, course_id: UUID, data: AssignmentCreate, user: User) -> Assignment:
    course = await session.scalar(select(Course).where(Course.id == course_id))
    if not course:
        # Fallback to first course if ID is slug
        course = await session.scalar(select(Course))
        if not course:
            raise AssignmentNotFoundError("Course not found")
    if user.role not in ("admin", "teacher"):
        raise AssignmentAccessError("User cannot manage assignments for this course")

    assignment = Assignment(
        course_id=course.id,
        subject_id=data.subject_id,
        subject_name=data.subject_name,
        title=data.title,
        description=data.description,
        instructions=data.instructions,
        starter_code=data.starter_code,
        max_score=data.max_score,
        due_date=data.due_date,
        status="published",
    )
    session.add(assignment)
    await session.commit()
    await session.refresh(assignment)
    return assignment


async def submit_assignment(session: AsyncSession, assignment_id: UUID, data: SubmissionCreate, user: User) -> AssignmentSubmission:
    assignment = await session.scalar(select(Assignment).where(Assignment.id == assignment_id))
    if not assignment:
        raise AssignmentNotFoundError("Assignment not found")
    existing = await session.scalar(
        select(AssignmentSubmission).where(
            AssignmentSubmission.assignment_id == assignment_id,
            AssignmentSubmission.user_id == user.id,
        )
    )
    if existing:
        # Update existing submission
        existing.content = data.content
        existing.file_url = data.file_url
        existing.status = "submitted"
        await session.commit()
        await session.refresh(existing)
        return existing

    submission = AssignmentSubmission(
        assignment_id=assignment_id,
        user_id=user.id,
        student_name=user.display_name or "Student Scholar",
        content=data.content,
        file_url=data.file_url,
        status="submitted",
    )
    session.add(submission)
    await session.commit()
    await session.refresh(submission)
    return submission


async def grade_submission(session: AsyncSession, submission_id: UUID, data: GradeRequest, user: User) -> AssignmentSubmission:
    submission = await session.scalar(select(AssignmentSubmission).where(AssignmentSubmission.id == submission_id))
    if not submission:
        raise AssignmentNotFoundError("Submission not found")
    assignment = await session.scalar(select(Assignment).where(Assignment.id == submission.assignment_id))
    if not assignment:
        raise AssignmentNotFoundError("Assignment not found")
    if user.role not in ("admin", "teacher"):
        raise AssignmentAccessError("User cannot grade this assignment")
    if data.score > assignment.max_score:
        raise AssignmentAccessError("Score exceeds assignment maximum")
    submission.score = data.score
    submission.feedback = data.feedback
    submission.status = "graded"
    await session.commit()
    await session.refresh(submission)
    return submission


async def get_course_assignments(session: AsyncSession, course_id: UUID) -> list[Assignment]:
    stmt = select(Assignment).where(Assignment.course_id == course_id).order_by(Assignment.created_at.desc())
    result = await session.scalars(stmt)
    return list(result.all())


async def get_all_assignments(session: AsyncSession, user: User) -> list[Assignment]:
    if user.role == "student":
        enrollments = (
            await session.scalars(
                select(Enrollment).where(
                    Enrollment.user_id == user.id,
                    Enrollment.status == "active",
                )
            )
        ).all()
        enrolled_ids = [e.course_id for e in enrollments]
        if not enrolled_ids:
            stmt = select(Assignment).order_by(Assignment.created_at.desc())
        else:
            stmt = select(Assignment).where(Assignment.course_id.in_(enrolled_ids)).order_by(Assignment.created_at.desc())
    elif user.role == "teacher":
        subs = (
            await session.scalars(
                select(CourseSubject).where(CourseSubject.teacher_id == user.id)
            )
        ).all()
        t_course_ids = list({s.course_id for s in subs if s.course_id})
        if t_course_ids:
            stmt = select(Assignment).where(Assignment.course_id.in_(t_course_ids)).order_by(Assignment.created_at.desc())
        else:
            stmt = select(Assignment).order_by(Assignment.created_at.desc())
    else:
        stmt = select(Assignment).order_by(Assignment.created_at.desc())

    result = await session.scalars(stmt)
    return list(result.all())


async def get_assignment_submissions(session: AsyncSession, assignment_id: UUID) -> list[AssignmentSubmission]:
    stmt = select(AssignmentSubmission).where(AssignmentSubmission.assignment_id == assignment_id).order_by(AssignmentSubmission.created_at.desc())
    result = await session.scalars(stmt)
    return list(result.all())


async def get_student_submissions(session: AsyncSession, user: User) -> list[AssignmentSubmission]:
    stmt = select(AssignmentSubmission).where(AssignmentSubmission.user_id == user.id).order_by(AssignmentSubmission.created_at.desc())
    result = await session.scalars(stmt)
    return list(result.all())


