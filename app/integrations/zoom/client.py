"""
Zoom REST API Client with automatic token injection, rate limit handling, and retries.
"""
import asyncio
import logging
from typing import Any, Dict, Optional

import httpx

from app.integrations.zoom.auth import ZoomOAuthManager, zoom_oauth_manager
from app.integrations.zoom.exceptions import (
    ZoomApiError,
    ZoomAuthError,
    ZoomNotFoundError,
    ZoomRateLimitError,
)

logger = logging.getLogger(__name__)

ZOOM_BASE_URL = "https://api.zoom.us/v2"


class ZoomClient:
    def __init__(self, auth_manager: Optional[ZoomOAuthManager] = None):
        self.auth = auth_manager or zoom_oauth_manager
        self.base_url = ZOOM_BASE_URL

    async def _request(
        self,
        method: str,
        path: str,
        params: Optional[Dict[str, Any]] = None,
        json_data: Optional[Dict[str, Any]] = None,
        max_retries: int = 2,
    ) -> Any:
        url = f"{self.base_url}{path}" if path.startswith("/") else f"{self.base_url}/{path}"
        token = await self.auth.get_access_token()

        for attempt in range(max_retries + 1):
            headers = {
                "Authorization": f"Bearer {token}",
                "Content-Type": "application/json",
                "User-Agent": "Acharya-LMS/2.0",
            }
            try:
                async with httpx.AsyncClient(timeout=25.0) as client:
                    resp = await client.request(
                        method=method,
                        url=url,
                        headers=headers,
                        params=params,
                        json=json_data,
                    )

                    # Handle 401 (Expired/Revoked Token) -> refresh and retry
                    if resp.status_code == 401 and attempt < max_retries:
                        logger.warning("Received 401 from Zoom API, refreshing token and retrying...")
                        token = await self.auth.get_access_token(force_refresh=True)
                        continue

                    # Handle 429 (Rate limit)
                    if resp.status_code == 429:
                        retry_after = int(resp.headers.get("Retry-After", "5"))
                        logger.warning("Zoom API rate limited (429). Retrying after %d seconds...", retry_after)
                        if attempt < max_retries:
                            await asyncio.sleep(retry_after)
                            continue
                        raise ZoomRateLimitError(
                            "Zoom API rate limit exceeded",
                            status_code=429,
                            details={"retry_after": retry_after, "url": url},
                        )

                    # Handle 404 (Not Found)
                    if resp.status_code == 404:
                        raise ZoomNotFoundError(
                            f"Zoom resource not found at {path}",
                            status_code=404,
                            details={"response": resp.text},
                        )

                    # Handle other non-2xx status codes
                    if resp.status_code >= 400:
                        err_text = resp.text
                        logger.error("Zoom API Error %d on %s %s: %s", resp.status_code, method, path, err_text)
                        raise ZoomApiError(
                            f"Zoom API request failed: {resp.status_code}",
                            status_code=resp.status_code,
                            details={"url": url, "method": method, "response": err_text},
                        )

                    if resp.status_code == 204:  # No content (e.g. DELETE/UPDATE)
                        return None

                    return resp.json()

            except (httpx.RequestError, httpx.TimeoutException) as exc:
                if attempt < max_retries:
                    backoff = 1.5 * (attempt + 1)
                    logger.warning("Network error on Zoom API request (%s). Retrying in %.1fs...", exc, backoff)
                    await asyncio.sleep(backoff)
                    continue
                raise ZoomApiError(f"Zoom API network failure: {str(exc)}", details={"url": url}) from exc

    async def get(self, path: str, params: Optional[Dict[str, Any]] = None) -> Any:
        return await self._request("GET", path, params=params)

    async def post(self, path: str, json_data: Optional[Dict[str, Any]] = None, params: Optional[Dict[str, Any]] = None) -> Any:
        return await self._request("POST", path, params=params, json_data=json_data)

    async def patch(self, path: str, json_data: Optional[Dict[str, Any]] = None, params: Optional[Dict[str, Any]] = None) -> Any:
        return await self._request("PATCH", path, params=params, json_data=json_data)

    async def put(self, path: str, json_data: Optional[Dict[str, Any]] = None, params: Optional[Dict[str, Any]] = None) -> Any:
        return await self._request("PUT", path, params=params, json_data=json_data)

    async def delete(self, path: str, params: Optional[Dict[str, Any]] = None) -> Any:
        return await self._request("DELETE", path, params=params)


# Global Zoom Client instance
zoom_client = ZoomClient()
