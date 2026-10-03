"""
Acharya-LMS Enterprise Backend Service
Production Release Sync
"""
import hashlib
import hmac
import json
import os
from contextlib import asynccontextmanager

import httpx
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware

from app.assessment import models as assessment_models  # noqa: F401
from app.assessment.router import router as assessment_router
from app.admin import router as admin_router
from app.ai import models as ai_models  # noqa: F401
from app.ai.router import router as intelligence_router
from app.assignments import models as assignment_models  # noqa: F401
from app.assignments.router import router as assignments_router
from app.identity.router import router as identity_router
from app.notifications import models as notification_models  # noqa: F401
from app.notifications.router import router as notifications_router
from app.identity import models as identity_models  # noqa: F401
from app.courses.router import router as courses_router
from app.courses import models as course_models  # noqa: F401
from app.content.router import router as content_router
from app.dashboard import router as dashboard_router
from app.certification import models as certificate_models  # noqa: F401
from app.certification.router import router as certification_router
from app.classroom import models as classroom_models  # noqa: F401
from app.classroom.router import router as classroom_router
from app.coding import models as coding_models  # noqa: F401
from app.coding.router import router as coding_router
from app.communication import models as communication_models  # noqa: F401
from app.communication.router import router as communication_router
from app.enrollment.router import router as enrollment_router
from app.learning.router import router as learning_router
from app.learning_agent.router import router as lens_router
from app.mcp.router import router as mcp_router
from app.agents.router import router as agents_router
from app.platform.config import settings
from app.platform.database import init_database
from app.platform.errors import database_error_handler, unhandled_exception_handler
from sqlalchemy.exc import SQLAlchemyError
from app.platform.logging import configure_logging
from app.tenancy.router import router as tenancy_router
from app.timetable import models as timetable_models  # noqa: F401
from app.timetable.router import router as timetable_router
from app.vimeo import upload_zoom_recording
from app.tenancy import models as tenancy_models  # noqa: F401

load_dotenv()
configure_logging()


@asynccontextmanager
async def lifespan(_app: FastAPI):
    # create_all is additive and ensures newly introduced modules exist on
    # lightweight Render deployments that do not yet run Alembic migrations.
    await init_database()
    yield

app = FastAPI(
    title=settings.app_name,
    version=settings.app_version,
    lifespan=lifespan,
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=[origin.strip() for origin in settings.cors_origins.split(",") if origin.strip()],
    allow_origin_regex=r"https://.*\.vercel\.app|http://localhost:.*|http://127\.0\.0\.1:.*",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.add_exception_handler(Exception, unhandled_exception_handler)
app.add_exception_handler(SQLAlchemyError, database_error_handler)
app.include_router(identity_router)
app.include_router(notifications_router)
app.include_router(tenancy_router)
app.include_router(courses_router)
app.include_router(content_router)
app.include_router(enrollment_router)
app.include_router(learning_router)
app.include_router(assessment_router)
app.include_router(admin_router)
app.include_router(dashboard_router)
app.include_router(intelligence_router)
app.include_router(assignments_router)
app.include_router(certification_router)
app.include_router(classroom_router)
app.include_router(coding_router)
app.include_router(communication_router)
app.include_router(timetable_router)
app.include_router(lens_router)
app.include_router(mcp_router)
app.include_router(agents_router)

ZOOM_SECRET_TOKEN = settings.zoom_secret_token or os.getenv("ZOOM_SECRET_TOKEN")


@app.get("/")
async def root():
    return {
        "status": "ok",
        "service": "zoom-lms-integration"
    }


@app.get("/health")
async def health():
    return {
        "status": "healthy"
    }


@app.get("/ready")
async def ready():
    return {
        "status": "ready",
        "environment": settings.environment,
    }


@app.post("/api/zoom/webhook")
async def zoom_webhook(request: Request):
    from app.classroom.service import process_zoom_webhook_event
    from app.integrations.zoom.webhooks import zoom_webhook_verifier
    from app.platform.database import SessionFactory

    raw_body = await request.body()
    try:
        body = json.loads(raw_body.decode("utf-8"))
    except Exception:
        raise HTTPException(status_code=400, detail="Malformed JSON")

    event = body.get("event")

    # 1. Zoom endpoint URL validation
    if event == "endpoint.url_validation":
        return zoom_webhook_verifier.handle_url_validation(body)

    # 2. Verify signature
    header_timestamp = x_zm_request_timestamp or request.headers.get("x-zm-request-timestamp")
    header_sig = x_zm_signature or request.headers.get("x-zm-signature")
    if not zoom_webhook_verifier.verify_signature(raw_body, header_timestamp, header_sig):
        raise HTTPException(status_code=401, detail="Invalid Zoom webhook signature")

    # 3. Process event in DB session
    event_id = body.get("event_ts") or body.get("payload", {}).get("object", {}).get("uuid")
    async with SessionFactory() as session:
        result = await process_zoom_webhook_event(session, event, str(event_id) if event_id else None, body)

    return {"status": "received", "result": result}
