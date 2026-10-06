from typing import Optional
from uuid import UUID

from pydantic import BaseModel, ConfigDict


class EnrollmentRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    user_id: UUID
    course_id: UUID
    status: str
    progress_percent: int
    course_title: Optional[str] = None
    course_slug: Optional[str] = None
    section_name: Optional[str] = None
