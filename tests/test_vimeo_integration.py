import pytest
from unittest.mock import AsyncMock, patch, MagicMock
from app.vimeo import get_vimeo_access_token, upload_zoom_recording


@pytest.mark.asyncio
async def test_vimeo_access_token_retrieval(monkeypatch):
    monkeypatch.setenv("VIMEO_ACCESS_TOKEN", "test_vimeo_token_12345")
    token = get_vimeo_access_token()
    assert token == "test_vimeo_token_12345"


@pytest.mark.asyncio
async def test_vimeo_upload_skipped_when_no_token(monkeypatch):
    monkeypatch.delenv("VIMEO_ACCESS_TOKEN", raising=False)
    with patch("app.vimeo.settings") as mock_settings:
        mock_settings.vimeo_access_token = None
        res = await upload_zoom_recording({"download_url": "https://zoom.us/rec/play/123"})
        assert res is None


@pytest.mark.asyncio
async def test_vimeo_upload_zoom_recording_success(monkeypatch):
    monkeypatch.setenv("VIMEO_ACCESS_TOKEN", "test_token_xyz")

    sample_recording = {
        "download_url": "https://api.zoom.us/recording/download/video.mp4",
        "download_token": "zoom_dl_token",
        "file_name": "Test Lecture Recording",
    }

    mock_client = AsyncMock()

    # Stream download mock
    mock_stream_resp = MagicMock()
    mock_stream_resp.raise_for_status = MagicMock()

    async def mock_aiter_bytes(chunk_size=65536):
        yield b"\x00\x00\x00 ftypmp42\x00\x00\x00\x00mp42isom" + (b"\x00" * 2000)

    mock_stream_resp.aiter_bytes = mock_aiter_bytes

    # Context manager for client.stream
    mock_stream_cm = AsyncMock()
    mock_stream_cm.__aenter__.return_value = mock_stream_resp
    mock_stream_cm.__aexit__.return_value = None
    mock_client.stream = MagicMock(return_value=mock_stream_cm)

    # Post mock (Vimeo create video)
    mock_post_resp = MagicMock()
    mock_post_resp.raise_for_status = MagicMock()
    mock_post_resp.json.return_value = {
        "uri": "/videos/987654321",
        "upload": {"upload_link": "https://upload.vimeo.com/tus/987654321"}
    }
    mock_client.post.return_value = mock_post_resp

    # Patch mock (Vimeo chunked patch)
    mock_patch_resp = MagicMock()
    mock_patch_resp.raise_for_status = MagicMock()
    mock_client.patch.return_value = mock_patch_resp

    with patch("httpx.AsyncClient") as mock_client_cls:
        mock_client_cls.return_value.__aenter__.return_value = mock_client
        mock_client_cls.return_value.__aexit__.return_value = None

        uri = await upload_zoom_recording(sample_recording)
        assert uri == "/videos/987654321"
        assert mock_client.post.called
        assert mock_client.patch.called
