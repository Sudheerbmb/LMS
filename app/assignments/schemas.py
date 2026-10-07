from datetime import datetime
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class AssignmentCreate(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    description: Optional[str] = None
    instructions: Optional[str] = None
    subject_name: Optional[str] = None
    subject_id: Optional[UUID] = None
    starter_code: Optional[str] = None
    max_score: int = Field(default=100, ge=1, le=1000)
    due_date: Optional[datetime] = None


class AssignmentRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    course_id: UUID
    subject_id: Optional[UUID] = None
    subject_name: Optional[str] = None
    title: str
    description: Optional[str] = None
    instructions: Optional[str] = None
    starter_code: Optional[str] = None
    max_score: int
    due_date: Optional[datetime] = None
    status: str
    created_at: Optional[datetime] = None


class SubmissionCreate(BaseModel):
    content: str = Field(min_length=1)
    file_url: Optional[str] = None


class SubmissionRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    assignment_id: UUID
    user_id: UUID
    student_name: Optional[str] = None
    content: str
    file_url: Optional[str] = None
    status: str
    score: Optional[int] = None
    feedback: Optional[str] = None
    created_at: Optional[datetime] = None


class GradeRequest(BaseModel):
    score: int = Field(ge=0)
    feedback: Optional[str] = None


class AIAssignmentGenerateRequest(BaseModel):
    grade: str = "Full Stack Web Development"
    subject: str = "Full Stack Architecture"
    topic: str = "Production REST API & React State Architecture"


class AIAssignmentGenerateResponse(BaseModel):
    title: str
    description: str
    instructions: str
    starter_code: str
    max_score: int

