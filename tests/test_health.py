import hashlib
import hmac
import pytest

from fastapi.testclient import TestClient

from app.main import app
from app.platform.config import settings


client = TestClient(app)


def test_root_and_health_endpoints() -> None:
    assert client.get("/").json()["status"] == "ok"
    assert client.get("/health").json() == {"status": "healthy"}
    assert client.get("/ready").json()["status"] == "ready"


def test_zoom_endpoint_url_validation(monkeypatch: pytest.MonkeyPatch) -> None:
    test_secret = "test-secret-token-123"
    monkeypatch.setenv("ZOOM_SECRET_TOKEN", test_secret)
    monkeypatch.setattr(settings, "zoom_secret_token", test_secret)
    from app.integrations.zoom.webhooks import zoom_webhook_verifier
    monkeypatch.setattr(zoom_webhook_verifier, "secret_token", test_secret)

    plain_token = "test-plain-token"
    response = client.post(
        "/api/zoom/webhook",
        json={
            "event": "endpoint.url_validation",
            "payload": {"plainToken": plain_token},
        },
    )

    expected = hmac.new(
        test_secret.encode("utf-8"),
        plain_token.encode("utf-8"),
        hashlib.sha256,
    ).hexdigest()

    assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
    assert response.json() == {
        "plainToken": plain_token,
        "encryptedToken": expected,
    }
