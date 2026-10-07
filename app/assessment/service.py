import json
import os
from typing import Any, Dict, List, Optional
from uuid import UUID
import httpx
from sqlalchemy import delete, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.assessment.models import Assessment, AssessmentAttempt, AssessmentQuestion
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
from app.courses.models import Course, CourseSubject
from app.enrollment.models import Enrollment
from app.identity.models import User
from app.platform.config import settings


class AssessmentNotFoundError(ValueError):
    pass


class AssessmentAccessError(ValueError):
    pass


async def _call_groq_assessment_llm(messages: List[Dict[str, str]], json_mode: bool = True) -> Optional[str]:
    api_key = settings.groq_api_key or os.getenv("GROQ_API_KEY", "")
    if not api_key:
        return None

    candidate_models = [
        settings.groq_model,
        "llama-3.3-70b-versatile",
        "llama-3.1-8b-instant",
        "llama3-70b-8192",
    ]
    candidate_models = [m for m in candidate_models if m]

    url = "https://api.groq.com/openai/v1/chat/completions"
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
    }

    for model_name in candidate_models:
        payload: Dict[str, Any] = {
            "model": model_name,
            "messages": messages,
            "temperature": 0.2,
            "max_tokens": 2000,
        }
        if json_mode:
            payload["response_format"] = {"type": "json_object"}

        try:
            async with httpx.AsyncClient(timeout=25.0) as client:
                res = await client.post(url, headers=headers, json=payload)
                if res.status_code == 200:
                    data = res.json()
                    return data["choices"][0]["message"]["content"]
        except Exception as err:
            print(f"[Groq Assessment Call Exception with {model_name}]: {err}")

    return None


async def generate_ai_questions_groq(req: AIAssessmentGenerateRequest) -> AIAssessmentGenerateResponse:
    """Dynamically synthesizes production-grade examination question items using Groq LPU."""
    grade = req.grade.strip() or "Full Stack Web Development"
    subject = req.subject.strip() or "Software Engineering"
    topic = req.topic.strip() or "System Architecture & Implementation"
    count = max(1, min(req.question_count, 10))

    doc_context = ""
    if req.document_text and req.document_text.strip():
        doc_context = f"\nREFERENCE SYLLABUS / SOURCE DOCUMENT:\n\"\"\"\n{req.document_text.strip()[:3000]}\n\"\"\"\n"

    prompt = (
        f"You are a Senior Principal Curriculum Architect and Technical Examiner.\n"
        f"Generate an ultra-rigorous, dynamic {count}-question technical benchmark examination for **{grade} • {subject}** on the specific topic: **\"{topic}\"**.\n"
        f"{doc_context}\n"
        f"STRICT REQUIREMENTS:\n"
        f"1. Generate {count} concrete, technically rich questions directly relevant to {topic}.\n"
        f"2. Include realistic code snippets, architectural trade-offs, bug diagnoses, or performance metrics.\n"
        f"3. For multiple choice questions, provide 4 plausible options where distractors represent subtle real-world mistakes.\n"
        f"4. 'correct_answer' must be the 0-indexed integer position (0, 1, 2, or 3) or correct string.\n"
        f"5. Cognitive levels should be balanced across FOUNDATION, APPLICATION, REASONING, TRANSFER.\n"
        f"6. Return STRICT JSON matching this schema exactly:\n"
        f"{{\n"
        f"  \"topic\": \"{topic}\",\n"
        f"  \"questions\": [\n"
        f"    {{\n"
        f"      \"id\": \"q1\",\n"
        f"      \"question_text\": \"Question text here with code block if applicable\",\n"
        f"      \"question_type\": \"multiple_choice\",\n"
        f"      \"options\": [\"Option A\", \"Option B\", \"Option C\", \"Option D\"],\n"
        f"      \"correct_answer\": 0,\n"
        f"      \"points\": 10,\n"
        f"      \"cognitive_level\": \"APPLICATION\",\n"
        f"      \"concept_name\": \"{topic}\",\n"
        f"      \"explanation\": \"Detailed technical rationale.\"\n"
        f"    }}\n"
        f"  ]\n"
        f"}}"
    )

    messages = [
        {"role": "system", "content": "You are an elite academic exam synthesizer. You output strictly valid JSON matching the schema."},
        {"role": "user", "content": prompt}
    ]

    raw_json = await _call_groq_assessment_llm(messages, json_mode=True)
    if raw_json:
        try:
            parsed = json.loads(raw_json)
            raw_qs = parsed.get("questions", [])
            questions_out = []
            for idx, q in enumerate(raw_qs):
                questions_out.append({
                    "id": q.get("id") or f"q_{idx + 1}",
                    "question_text": q.get("question_text", f"Question on {topic}"),
                    "question_type": q.get("question_type", "multiple_choice"),
                    "options": q.get("options") or ["Option A", "Option B", "Option C", "Option D"],
                    "correct_answer": str(q.get("correct_answer", 0)),
                    "points": int(q.get("points", 10)),
                    "cognitive_level": q.get("cognitive_level", "APPLICATION"),
                    "concept_name": q.get("concept_name", topic),
                    "explanation": q.get("explanation", "Technical derivation."),
                })
            if questions_out:
                return AIAssessmentGenerateResponse(topic=topic, questions=questions_out)
        except Exception as err:
            print(f"[Groq Assessment Parse Error]: {err}")

    # Pure dynamic fallback tailored to request
    return AIAssessmentGenerateResponse(
        topic=topic,
        questions=[
            {
                "id": "q1",
                "question_text": f"In {subject} ({topic}), what is the primary architectural best practice to optimize throughput and guarantee state consistency under high load?",
                "question_type": "multiple_choice",
                "options": [
                    f"Implement asynchronous non-blocking event loops with structured concurrency for {topic}",
                    "Perform synchronous blocking operations inside database commit hooks",
                    "Disable connection pooling and spawn unbounded threads",
                    "Hardcode static state caches without eviction policies"
                ],
                "correct_answer": "0",
                "points": 10,
                "cognitive_level": "APPLICATION",
                "concept_name": topic,
                "explanation": f"Asynchronous non-blocking architecture with structured concurrency isolates failure domains and ensures optimal resource utilization for {topic}."
            },
            {
                "id": "q2",
                "question_text": f"Analyze the key diagnostic criteria when debugging unexpected latency spikes or memory leaks in {topic}.",
                "question_type": "descriptive",
                "options": [],
                "correct_answer": "",
                "points": 10,
                "cognitive_level": "REASONING",
                "concept_name": topic,
                "explanation": f"Profile heap allocation snapshots, trace coroutine event loop delays, and monitor unclosed database transactions."
            }
        ]
    )


async def get_all_assessments(session: AsyncSession, user: User) -> List[AssessmentRead]:
    """Retrieves all assessments visible to the current user."""
    stmt = select(Assessment).order_by(Assessment.created_at.desc())
    if user.role == "student":
        enrollments = (
            await session.scalars(select(Enrollment).where(Enrollment.user_id == user.id, Enrollment.status == "active"))
        ).all()
        enrolled_course_ids = [e.course_id for e in enrollments]
        if enrolled_course_ids:
            stmt = select(Assessment).where(Assessment.course_id.in_(enrolled_course_ids)).order_by(Assessment.created_at.desc())
    elif user.role == "teacher":
        subs = (
            await session.scalars(select(CourseSubject).where(CourseSubject.teacher_id == user.id))
        ).all()
        t_course_ids = list({s.course_id for s in subs if s.course_id})
        if t_course_ids:
            stmt = select(Assessment).where(
                (Assessment.teacher_id == user.id) | (Assessment.course_id.in_(t_course_ids))
            ).order_by(Assessment.created_at.desc())

    assessments = list((await session.scalars(stmt)).all())
    results: List[AssessmentRead] = []

    for a in assessments:
        # Load questions
        q_stmt = select(AssessmentQuestion).where(AssessmentQuestion.assessment_id == a.id).order_by(AssessmentQuestion.position.asc())
        questions = list((await session.scalars(q_stmt)).all())

        # Load submissions count
        sub_count = await session.scalar(
            select(func.count(AssessmentAttempt.id)).where(AssessmentAttempt.assessment_id == a.id)
        ) or 0

        q_reads = [
            QuestionRead(
                id=q.id,
                assessment_id=q.assessment_id,
                prompt=q.prompt,
                question_type=q.question_type,
                options=q.options or [],
                correct_answer=q.correct_answer if user.role in ("teacher", "admin") else None,
                points=q.points,
                cognitive_level=q.cognitive_level,
                concept_name=q.concept_name,
                explanation=q.explanation if user.role in ("teacher", "admin") else None,
                position=q.position,
            )
            for q in questions
        ]

        results.append(
            AssessmentRead(
                id=a.id,
                course_id=a.course_id,
                subject_id=a.subject_id,
                title=a.title,
                description=a.description,
                target_grade=a.target_grade,
                subject_name=a.subject_name,
                topic_syllabus=a.topic_syllabus,
                teacher_id=a.teacher_id,
                teacher_name=a.teacher_name,
                schedule_type=a.schedule_type,
                start_time=a.start_time,
                end_time=a.end_time,
                duration_minutes=a.duration_minutes,
                passing_score=a.passing_score,
                total_points=a.total_points,
                requires_proctoring=a.requires_proctoring,
                status=a.status,
                created_at=a.created_at,
                submissions_count=sub_count,
                questions=q_reads,
            )
        )

    return results


async def get_course_assessments(session: AsyncSession, course_id: UUID) -> List[AssessmentRead]:
    assessments = list((await session.scalars(
        select(Assessment).where(Assessment.course_id == course_id).order_by(Assessment.created_at.desc())
    )).all())

    results: List[AssessmentRead] = []
    for a in assessments:
        q_stmt = select(AssessmentQuestion).where(AssessmentQuestion.assessment_id == a.id).order_by(AssessmentQuestion.position.asc())
        questions = list((await session.scalars(q_stmt)).all())
        sub_count = await session.scalar(
            select(func.count(AssessmentAttempt.id)).where(AssessmentAttempt.assessment_id == a.id)
        ) or 0

        q_reads = [
            QuestionRead(
                id=q.id,
                assessment_id=q.assessment_id,
                prompt=q.prompt,
                question_type=q.question_type,
                options=q.options or [],
                correct_answer=q.correct_answer,
                points=q.points,
                cognitive_level=q.cognitive_level,
                concept_name=q.concept_name,
                explanation=q.explanation,
                position=q.position,
            )
            for q in questions
        ]

        results.append(
            AssessmentRead(
                id=a.id,
                course_id=a.course_id,
                subject_id=a.subject_id,
                title=a.title,
                description=a.description,
                target_grade=a.target_grade,
                subject_name=a.subject_name,
                topic_syllabus=a.topic_syllabus,
                teacher_id=a.teacher_id,
                teacher_name=a.teacher_name,
                schedule_type=a.schedule_type,
                start_time=a.start_time,
                end_time=a.end_time,
                duration_minutes=a.duration_minutes,
                passing_score=a.passing_score,
                total_points=a.total_points,
                requires_proctoring=a.requires_proctoring,
                status=a.status,
                created_at=a.created_at,
                submissions_count=sub_count,
                questions=q_reads,
            )
        )
    return results


async def create_assessment(session: AsyncSession, course_id: UUID, data: AssessmentCreate, user: User) -> AssessmentRead:
    course = await session.scalar(select(Course).where(Course.id == course_id))
    if not course:
        # Fallback to first course if ID is slug or placeholder
        course = await session.scalar(select(Course))
        if not course:
            raise AssessmentNotFoundError("Course not found")

    if user.role not in ("admin", "teacher"):
        raise AssessmentAccessError("Only faculty or administrators can schedule assessments")

    assessment = Assessment(
        course_id=course.id,
        title=data.title,
        description=data.description,
        target_grade=data.target_grade or course.slug or "Master Program",
        subject_name=data.subject_name,
        topic_syllabus=data.topic_syllabus,
        teacher_id=user.id,
        teacher_name=user.display_name or "Faculty Member",
        schedule_type=data.schedule_type,
        start_time=data.start_time,
        end_time=data.end_time,
        duration_minutes=data.duration_minutes,
        passing_score=data.passing_score,
        total_points=data.total_points,
        requires_proctoring=data.requires_proctoring,
        status="PUBLISHED",
    )
    session.add(assessment)
    await session.flush()

    q_reads: List[QuestionRead] = []
    for idx, q in enumerate(data.questions):
        question = AssessmentQuestion(
            assessment_id=assessment.id,
            prompt=q.prompt,
            question_type=q.question_type,
            options=q.options or [],
            correct_answer=str(q.correct_answer or "0"),
            points=q.points,
            cognitive_level=q.cognitive_level,
            concept_name=q.concept_name or data.topic_syllabus,
            explanation=q.explanation,
            position=q.position or idx + 1,
        )
        session.add(question)
        await session.flush()
        q_reads.append(
            QuestionRead(
                id=question.id,
                assessment_id=question.assessment_id,
                prompt=question.prompt,
                question_type=question.question_type,
                options=question.options or [],
                correct_answer=question.correct_answer,
                points=question.points,
                cognitive_level=question.cognitive_level,
                concept_name=question.concept_name,
                explanation=question.explanation,
                position=question.position,
            )
        )

    await session.commit()
    await session.refresh(assessment)

    return AssessmentRead(
        id=assessment.id,
        course_id=assessment.course_id,
        subject_id=assessment.subject_id,
        title=assessment.title,
        description=assessment.description,
        target_grade=assessment.target_grade,
        subject_name=assessment.subject_name,
        topic_syllabus=assessment.topic_syllabus,
        teacher_id=assessment.teacher_id,
        teacher_name=assessment.teacher_name,
        schedule_type=assessment.schedule_type,
        start_time=assessment.start_time,
        end_time=assessment.end_time,
        duration_minutes=assessment.duration_minutes,
        passing_score=assessment.passing_score,
        total_points=assessment.total_points,
        requires_proctoring=assessment.requires_proctoring,
        status=assessment.status,
        created_at=assessment.created_at,
        submissions_count=0,
        questions=q_reads,
    )


async def delete_assessment(session: AsyncSession, assessment_id: UUID, user: User) -> dict:
    assessment = await session.scalar(select(Assessment).where(Assessment.id == assessment_id))
    if not assessment:
        raise AssessmentNotFoundError("Assessment not found")
    if user.role not in ("admin", "teacher"):
        raise AssessmentAccessError("Unauthorized to delete assessment")

    await session.execute(delete(AssessmentQuestion).where(AssessmentQuestion.assessment_id == assessment_id))
    await session.execute(delete(AssessmentAttempt).where(AssessmentAttempt.assessment_id == assessment_id))
    await session.delete(assessment)
    await session.commit()
    return {"status": "success", "message": "Assessment deleted successfully"}


async def submit_attempt(session: AsyncSession, assessment_id: UUID, data: AttemptCreate, user: User) -> AttemptRead:
    assessment = await session.scalar(select(Assessment).where(Assessment.id == assessment_id))
    if not assessment:
        raise AssessmentNotFoundError("Assessment not found")

    questions = list((await session.scalars(
        select(AssessmentQuestion).where(AssessmentQuestion.assessment_id == assessment_id)
    )).all())

    total_possible_points = sum(q.points for q in questions) or assessment.total_points or 100
    earned_points = 0

    is_cheated = data.cheated or data.violation_count >= 3

    if not is_cheated:
        for q in questions:
            user_ans = data.answers.get(str(q.id)) or data.answers.get(str(q.position))
            if user_ans is not None:
                if str(user_ans).strip().lower() == str(q.correct_answer).strip().lower():
                    earned_points += q.points
                elif q.question_type == "descriptive" and len(str(user_ans).strip()) > 10:
                    earned_points += q.points

    score_pct = round((earned_points / total_possible_points) * 100) if total_possible_points > 0 else 0
    if is_cheated:
        earned_points = 0
        score_pct = 0

    passed = score_pct >= assessment.passing_score and not is_cheated

    feedback = "Exceptional conceptual mastery demonstrated." if passed else "Review core theorems and retake benchmark."
    if is_cheated:
        feedback = "Assessment flagged for academic integrity violations."

    attempt = AssessmentAttempt(
        assessment_id=assessment_id,
        user_id=user.id,
        student_name=user.display_name or "Student Scholar",
        student_grade=assessment.target_grade,
        subject_name=assessment.subject_name,
        answers=data.answers,
        score=score_pct,
        total_points_earned=earned_points,
        max_points=total_possible_points,
        passed=passed,
        feedback=feedback,
        cheated=is_cheated,
        cheating_reasons=data.cheating_reasons,
        violation_count=data.violation_count,
    )
    session.add(attempt)
    await session.commit()
    await session.refresh(attempt)

    return AttemptRead(
        id=attempt.id,
        assessment_id=attempt.assessment_id,
        user_id=attempt.user_id,
        student_name=attempt.student_name,
        student_grade=attempt.student_grade,
        subject_name=attempt.subject_name,
        answers=attempt.answers,
        score=attempt.score,
        total_points_earned=attempt.total_points_earned,
        max_points=attempt.max_points,
        passed=attempt.passed,
        feedback=attempt.feedback,
        cheated=attempt.cheated,
        cheating_reasons=attempt.cheating_reasons,
        violation_count=attempt.violation_count,
        created_at=attempt.created_at,
    )


async def get_assessment_submissions(session: AsyncSession, assessment_id: UUID) -> List[AttemptRead]:
    attempts = list((await session.scalars(
        select(AssessmentAttempt).where(AssessmentAttempt.assessment_id == assessment_id).order_by(AssessmentAttempt.created_at.desc())
    )).all())
    return [
        AttemptRead(
            id=a.id,
            assessment_id=a.assessment_id,
            user_id=a.user_id,
            student_name=a.student_name,
            student_grade=a.student_grade,
            subject_name=a.subject_name,
            answers=a.answers or {},
            score=a.score,
            total_points_earned=a.total_points_earned,
            max_points=a.max_points,
            passed=a.passed,
            feedback=a.feedback,
            cheated=a.cheated,
            cheating_reasons=a.cheating_reasons,
            violation_count=a.violation_count,
            created_at=a.created_at,
        )
        for a in attempts
    ]


async def get_student_submissions(session: AsyncSession, user: User) -> List[AttemptRead]:
    attempts = list((await session.scalars(
        select(AssessmentAttempt).where(AssessmentAttempt.user_id == user.id).order_by(AssessmentAttempt.created_at.desc())
    )).all())
    return [
        AttemptRead(
            id=a.id,
            assessment_id=a.assessment_id,
            user_id=a.user_id,
            student_name=a.student_name,
            student_grade=a.student_grade,
            subject_name=a.subject_name,
            answers=a.answers or {},
            score=a.score,
            total_points_earned=a.total_points_earned,
            max_points=a.max_points,
            passed=a.passed,
            feedback=a.feedback,
            cheated=a.cheated,
            cheating_reasons=a.cheating_reasons,
            violation_count=a.violation_count,
            created_at=a.created_at,
        )
        for a in attempts
    ]

