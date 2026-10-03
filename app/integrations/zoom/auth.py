"""
Zoom Server-to-Server OAuth Authenticator with in-memory caching and lock synchronization.
"""
import asyncio
import base64
import logging
import os
import time
from typing import Optional

import httpx

from app.integrations.zoom.exceptions import ZoomAuthError
from app.platform.config import settings

logger = logging.getLogger(__name__)

ZOOM_OAUTH_URL = "https://zoom.us/oauth/token"


class ZoomOAuthManager:
    def __init__(
        self,
        account_id: Optional[str] = None,
        client_id: Optional[str] = None,
        client_secret: Optional[str] = None,
    ):
        self.account_id = account_id or settings.zoom_account_id or os.getenv("ZOOM_ACCOUNT_ID")
        self.client_id = client_id or settings.zoom_client_id or os.getenv("ZOOM_CLIENT_ID")
        self.client_secret = client_secret or settings.zoom_client_secret or os.getenv("ZOOM_CLIENT_SECRET")
        self._cached_token: Optional[str] = None
        self._token_expiry_timestamp: float = 0
        self._lock = asyncio.Lock()

    def is_configured(self) -> bool:
        """Returns True if full S2S OAuth credentials are present."""
        return bool(self.account_id and self.client_id and self.client_secret)

    async def get_access_token(self, force_refresh: bool = False) -> str:
        """
        Retrieves a valid bearer token. Uses memory caching with a 60s safety buffer.
        Thread/task safe using asyncio.Lock.
        """
        if not self.is_configured():
            raise ZoomAuthError(
                "Zoom credentials not configured. Please set ZOOM_ACCOUNT_ID, ZOOM_CLIENT_ID, and ZOOM_CLIENT_SECRET."
            )

        now = time.time()
        # Return cached token if valid for at least another 60 seconds
        if not force_refresh and self._cached_token and (self._token_expiry_timestamp - now > 60):
            return self._cached_token

        async with self._lock:
            # Double check within lock
            now = time.time()
            if not force_refresh and self._cached_token and (self._token_expiry_timestamp - now > 60):
                return self._cached_token

            auth_header_val = base64.b64encode(f"{self.client_id}:{self.client_secret}".encode("utf-8")).decode("utf-8")
            headers = {
                "Authorization": f"Basic {auth_header_val}",
                "Content-Type": "application/x-www-form-urlencoded",
            }
            params = {
                "grant_type": "account_credentials",
                "account_id": self.account_id,
            }

            max_retries = 3
            last_err = None

            for attempt in range(max_retries):
                try:
                    async with httpx.AsyncClient(timeout=15.0) as client:
                        resp = await client.post(ZOOM_OAUTH_URL, headers=headers, params=params)
                        if resp.status_code == 200:
                            data = resp.json()
                            access_token = data.get("access_token")
                            expires_in = data.get("expires_in", 3600)
                            if not access_token:
                                raise ZoomAuthError("Access token missing in Zoom OAuth response", details=data)

                            self._cached_token = access_token
                            self._token_expiry_timestamp = time.time() + expires_in
                            logger.info("Successfully refreshed Zoom S2S OAuth access token (expires in %ds)", expires_in)
                            return self._cached_token

                        error_body = resp.text
                        logger.error("Zoom OAuth error status %d: %s", resp.status_code, error_body)
                        raise ZoomAuthError(
                            f"Zoom OAuth token request failed with status {resp.status_code}",
                            status_code=resp.status_code,
                            details={"response": error_body},
                        )
                except (httpx.RequestError, httpx.TimeoutException) as err:
                    last_err = err
                    wait_time = 1.0 * (2 ** attempt)
                    logger.warning("Zoom OAuth network attempt %d failed: %s. Retrying in %.1fs...", attempt + 1, err, wait_time)
                    await asyncio.sleep(wait_time)

            raise ZoomAuthError(f"Failed to acquire Zoom access token after {max_retries} attempts: {last_err}")


# Global OAuth Manager instance
zoom_oauth_manager = ZoomOAuthManager()
