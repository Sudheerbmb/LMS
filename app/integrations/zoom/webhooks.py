"""
Zoom Webhook Signature Verification and URL Validation Handler
Implements standard Zoom HMAC-SHA256 webhook validation protocol.
"""
import hashlib
import hmac
import logging
import os
from typing import Any, Dict, Optional, Tuple

from app.integrations.zoom.exceptions import ZoomWebhookValidationError
from app.platform.config import settings

logger = logging.getLogger(__name__)


class ZoomWebhookVerifier:
    def __init__(self, secret_token: Optional[str] = None):
        self.secret_token = secret_token or settings.zoom_secret_token or os.getenv("ZOOM_SECRET_TOKEN")

    def handle_url_validation(self, body: Dict[str, Any]) -> Dict[str, str]:
        """
        Responds to Zoom's endpoint.url_validation webhook challenge.
        """
        secret = os.environ.get("ZOOM_SECRET_TOKEN") or self.secret_token or getattr(settings, "zoom_secret_token", None)
        if not secret:
            raise ZoomWebhookValidationError("ZOOM_SECRET_TOKEN is not configured for webhook validation")

        payload = body.get("payload", {})
        plain_token = payload.get("plainToken")
        if not plain_token:
            raise ZoomWebhookValidationError("Missing plainToken in Zoom endpoint.url_validation payload")

        encrypted_token = hmac.new(
            secret.encode("utf-8"),
            plain_token.encode("utf-8"),
            hashlib.sha256,
        ).hexdigest()

        return {
            "plainToken": plain_token,
            "encryptedToken": encrypted_token,
        }

    def verify_signature(
        self,
        raw_body_bytes: bytes,
        timestamp_header: Optional[str],
        signature_header: Optional[str],
    ) -> bool:
        """
        Verifies that an incoming webhook request originated from Zoom using HMAC-SHA256 signature.
        Format: v0={hex_digest of (v0:{timestamp}:{raw_body})}
        """
        secret = os.environ.get("ZOOM_SECRET_TOKEN") or self.secret_token or getattr(settings, "zoom_secret_token", None)
        if not secret:
            logger.warning("ZOOM_SECRET_TOKEN not set; skipping webhook signature verification.")
            return True

        if not timestamp_header or not signature_header:
            logger.warning("Missing Zoom webhook verification headers (x-zm-request-timestamp or x-zm-signature)")
            return False

        message = f"v0:{timestamp_header}:{raw_body_bytes.decode('utf-8')}"
        expected_hash = hmac.new(
            secret.encode("utf-8"),
            message.encode("utf-8"),
            hashlib.sha256,
        ).hexdigest()
        expected_signature = f"v0={expected_hash}"

        is_valid = hmac.compare_digest(expected_signature, signature_header)
        if not is_valid:
            logger.warning("Zoom webhook signature mismatch! (Header: %s, Computed: %s)", signature_header, expected_signature)
        return is_valid


# Global Webhook Verifier instance
zoom_webhook_verifier = ZoomWebhookVerifier()
