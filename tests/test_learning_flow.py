from uuid import uuid4

from fastapi.testclient import TestClient

from app.main import app
from tests.helpers import approve_email


def test_enrollment_and_progress_flow() -> None:
    email = f"learner-{uuid4()}@example.com"
    with TestClient(app) as client:
        # Admin login
        admin_token = client.post(
            "/api/v1/identity/login",
            json={"email": "admin@example.com", "password": "ChangeMe123!"},
        ).json()["access_token"]
        admin_headers = {"Authorization": f"Bearer {admin_token}"}

        # Create course via admin
        course = client.post(
            "/api/v1/admin/courses",
            headers=admin_headers,
            json={
                "title": f"Learning Course {uuid4().hex[:6]}",
                "description": "Learning course description",
                "subjects": [],
            },
        ).json()

        # Create resource under course
        resource = client.post(
            f"/api/v1/courses/{course['id']}/resources",
            headers=admin_headers,
            json={"resource_type": "video", "title": "Lesson 1"},
        )
        assert resource.status_code == 201

        # Register and approve student
        reg_res = client.post(
            "/api/v1/identity/register",
            json={
                "email": email,
                "display_name": "Learner",
                "password": "a-strong-password",
            },
        ).json()
        student_id = reg_res["id"]
        client.post(
            f"/api/v1/admin/users/{student_id}/status",
            headers=admin_headers,
            json={"status": "active"},
        )
        student_token = client.post(
            "/api/v1/identity/login",
            json={"email": email, "password": "a-strong-password"},
        ).json()["access_token"]
        student_headers = {"Authorization": f"Bearer {student_token}"}

        # Admin assigns course to student
        student_profile = client.get("/api/v1/identity/me", headers=student_headers).json()
        client.post(
            f"/api/v1/admin/enrollments?user_id={student_profile['id']}&course_id={course['id']}",
            headers=admin_headers,
        )

        progress = client.post(
            f"/api/v1/learning/resources/{resource.json()['id']}/progress",
            headers=student_headers,
            json={"completed": True, "position_seconds": 120},
        )

    assert progress.status_code == 200
    assert progress.json()["completed"] is True
