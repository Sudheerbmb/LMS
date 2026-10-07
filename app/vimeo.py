import logging
import os
from pathlib import Path
from tempfile import NamedTemporaryFile

import httpx

from app.platform.config import settings

logger = logging.getLogger(__name__)

VIMEO_API_URL = "https://api.vimeo.com"


def get_vimeo_access_token() -> str | None:
    return os.getenv("VIMEO_ACCESS_TOKEN") or getattr(settings, "vimeo_access_token", None)


async def upload_zoom_recording(recording: dict) -> str | None:
    token = get_vimeo_access_token()
    if not token:
        logger.warning("VIMEO_ACCESS_TOKEN is not configured; skipping Vimeo upload.")
        return None

    download_url = recording.get("download_url")
    if not download_url:
        raise ValueError("Zoom recording does not contain a download_url")

    download_token = recording.get("download_token")
    if not download_token:
        try:
            from app.integrations.zoom.service import zoom_service
            if zoom_service.is_configured():
                download_token = await zoom_service.client.auth.get_access_token()
        except Exception:
            pass

    zoom_headers = {}
    if download_token:
        zoom_headers["Authorization"] = f"Bearer {download_token}"
        separator = "&" if "?" in download_url else "?"
        download_url = f"{download_url}{separator}access_token={download_token}"

    name = recording.get("file_name") or "Lecture Recording"
    headers = {"Authorization": f"Bearer {token}"}

    async with httpx.AsyncClient(timeout=None, follow_redirects=True) as client:
        # Stream download into disk chunk-by-chunk to prevent OOM
        temp_file = NamedTemporaryFile(prefix="zoom-recording-", suffix=".mp4", delete=False)
        temp_path = Path(temp_file.name)
        try:
            try:
                async with client.stream("GET", download_url, headers=zoom_headers) as stream_resp:
                    stream_resp.raise_for_status()
                    async for chunk in stream_resp.aiter_bytes(chunk_size=65536):
                        temp_file.write(chunk)
            finally:
                temp_file.close()

            file_size = temp_path.stat().st_size
            if file_size < 1024:
                raise ValueError(f"Downloaded video file is too small ({file_size} bytes)")

            # Verify it is not an HTML/JSON error page
            with temp_path.open("rb") as f:
                header_bytes = f.read(512)
                if header_bytes.startswith(b"<!DOCTYPE") or header_bytes.startswith(b"<html") or header_bytes.startswith(b"{\""):
                    raise ValueError(f"Zoom returned an HTML/JSON error page instead of binary MP4 video: {header_bytes[:100].decode('utf-8', errors='replace')}")

            logger.info("Uploading %s (%.2f MB) to Vimeo...", name, file_size / (1024 * 1024))
            
            create_response = await client.post(
                f"{VIMEO_API_URL}/me/videos",
                headers={**headers, "Content-Type": "application/json"},
                json={
                    "name": name,
                    "privacy": {
                        "view": "unlisted",
                        "embed": "public",
                    },
                    "upload": {
                        "approach": "tus",
                        "size": str(file_size),
                    },
                },
            )
            if create_response.status_code >= 400:
                err_text = create_response.text
                raise RuntimeError(f"Vimeo API video creation failed ({create_response.status_code}): {err_text}")
            create_json = create_response.json()
            upload_link = create_json.get("upload", {}).get("upload_link")
            raw_uri = create_json.get("uri") or ""
            link = create_json.get("link") or ""
            player_embed_url = create_json.get("player_embed_url") or ""

            # Extract Vimeo video ID
            video_id = ""
            if raw_uri:
                video_id = raw_uri.replace("/videos/", "").strip("/")
            elif link:
                video_id = link.rstrip("/").split("/")[-1]
            elif player_embed_url:
                video_id = player_embed_url.rstrip("/").split("/")[-1].split("?")[0]

            if not player_embed_url and video_id:
                player_embed_url = f"https://player.vimeo.com/video/{video_id}"

            if not upload_link:
                raise RuntimeError(f"Vimeo did not return an upload link. Response: {create_json}")

            # Stream upload in 5MB TUS chunks to guarantee constant memory footprint
            chunk_size = 5 * 1024 * 1024
            with temp_path.open("rb") as f:
                offset = 0
                while offset < file_size:
                    chunk = f.read(chunk_size)
                    if not chunk:
                        break
                    upload_response = await client.patch(
                        upload_link,
                        headers={
                            "Tus-Resumable": "1.0.0",
                            "Upload-Offset": str(offset),
                            "Content-Type": "application/offset+octet-stream",
                        },
                        content=chunk,
                    )
                    upload_response.raise_for_status()
                    offset += len(chunk)

            logger.info("Successfully uploaded Zoom recording to Vimeo: %s (ID: %s)", player_embed_url, video_id)
            return {
                "vimeo_video_id": video_id,
                "vimeo_url": player_embed_url,
                "player_embed_url": player_embed_url,
                "link": link,
                "uri": raw_uri,
            }
        finally:
            temp_path.unlink(missing_ok=True)