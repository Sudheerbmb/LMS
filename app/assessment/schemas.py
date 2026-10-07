from datetime import datetime
from typing import Any, List, Optional
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class QuestionCreate(BaseModel):
    id: Optional[str] = None
    prompt: str = Field(min_length=1)
    question_type: str = Field(default="multiple_choice")
    options: list[str] = Field(default_factory=list)
    correct_answer: str = Field(default="0")
    points: int = Field(default=10, ge=1)
    cognitive_level: str = Field(default="APPLICATION")
    concept_name: Optional[str] = None
    explanation: Optional[str] = None
    position: int = Field(default=0, ge=0)


class QuestionRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    assessment_id: UUID
    prompt: str
    question_type: str
    options: list[str]
    correct_answer: Optional[str] = None
    points: int
    cognitive_level: str
    concept_name: Optional[str] = None
    explanation: Optional[str] = None
    position: int


class AssessmentCreate(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    description: Optional[str] = None
    target_grade: Optional[str] = None
    subject_name: Optional[str] = None
    topic_syllabus: Optional[str] = None
    schedule_type: str = Field(default="ALWAYS_AVAILABLE")
    start_time: Optional[datetime] = None
    end_time: Optional[datetime] = None
    duration_minutes: int = Field(default=45, ge=1)
    passing_score: int = Field(default=70, ge=1, le=100)
    total_points: int = Field(default=50, ge=1)
    requires_proctoring: bool = True
    questions: List[QuestionCreate] = Field(default_factory=list)


class AssessmentRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    course_id: UUID
    subject_id: Optional[UUID] = None
    title: str
    description: Optional[str] = None
    target_grade: Optional[str] = None
    subject_name: Optional[str] = None
    topic_syllabus: Optional[str] = None
    teacher_id: Optional[UUID] = None
    teacher_name: Optional[str] = None
    schedule_type: str
    start_time: Optional[datetime] = None
    end_time: Optional[datetime] = None
    duration_minutes: int
    passing_score: int
    total_points: int
    requires_proctoring: bool
    status: str
    created_at: Optional[datetime] = None
    submissions_count: int = 0
    questions: List[QuestionRead] = Field(default_factory=list)


class AttemptCreate(BaseModel):
    answers: dict[str, Any] = Field(default_factory=dict)
    cheated: bool = False
    cheating_reasons: Optional[List[str]] = None
    violation_count: int = 0


class AttemptRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    assessment_id: UUID
    user_id: UUID
    student_name: Optional[str] = None
    student_grade: Optional[str] = None
    subject_name: Optional[str] = None
    answers: dict[str, Any]
    score: int
    total_points_earned: int
    max_points: int
    passed: bool
    feedback: Optional[str] = None
    cheated: bool
    cheating_reasons: Optional[List[str]] = None
    violation_count: int
    created_at: Optional[datetime] = None


class AIAssessmentGenerateRequest(BaseModel):
    grade: str = "Full Stack Web Development"
    subject: str = "Full Stack Architecture"
    topic: str = "Production REST API & React State Architecture"
    question_count: int = 5
    document_text: Optional[str] = None


class AIAssessmentGenerateResponse(BaseModel):
    topic: str
    questions: List[dict[str, Any]]

