"""Tests del cliente HTTP Forge."""

import base64
from unittest.mock import MagicMock

import pytest

from app.services.image_illustration.forge_client import ForgeClientError, ForgeHttpClient
from app.services.image_illustration.models import ForgeMode


def test_forge_client_txt2img_decodes_image():
    raw = b"fake-png-bytes"
    mock_http = MagicMock()
    resp = MagicMock()
    resp.status_code = 200
    resp.json.return_value = {"images": [base64.b64encode(raw).decode()]}
    mock_http.post.return_value = resp

    client = ForgeHttpClient(base_url="http://forge.test", http_client=mock_http)
    out = client.generate(ForgeMode.TXT2IMG, {"prompt": "x", "steps": 8})
    assert out == raw
    mock_http.post.assert_called_once()
    args, kwargs = mock_http.post.call_args
    assert args[0].endswith("/sdapi/v1/txt2img")


def test_forge_client_img2img_endpoint():
    mock_http = MagicMock()
    resp = MagicMock()
    resp.status_code = 200
    resp.json.return_value = {"images": [base64.b64encode(b"img").decode()]}
    mock_http.post.return_value = resp
    client = ForgeHttpClient(http_client=mock_http)
    client.generate(ForgeMode.IMG2IMG, {"prompt": "y", "init_images": ["data:,"]})
    assert mock_http.post.call_args[0][0].endswith("/sdapi/v1/img2img")


def test_forge_client_http_error():
    mock_http = MagicMock()
    resp = MagicMock()
    resp.status_code = 500
    resp.text = "boom"
    resp.reason_phrase = "Error"
    mock_http.post.return_value = resp
    client = ForgeHttpClient(http_client=mock_http)
    with pytest.raises(ForgeClientError) as ei:
        client.generate(ForgeMode.TXT2IMG, {"prompt": "z"})
    assert ei.value.status_code == 500


def test_forge_client_missing_images():
    mock_http = MagicMock()
    resp = MagicMock()
    resp.status_code = 200
    resp.json.return_value = {"images": []}
    mock_http.post.return_value = resp
    client = ForgeHttpClient(http_client=mock_http)
    with pytest.raises(ForgeClientError, match="images"):
        client.generate(ForgeMode.TXT2IMG, {"prompt": "z"})
