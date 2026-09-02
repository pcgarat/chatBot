"""Tests del cliente HTTP Forge."""

import base64
from unittest.mock import MagicMock

import pytest

from app.services.image_illustration.forge_client import (
    ForgeClientError,
    ForgeHttpClient,
    sanitize_forge_body_for_log,
)
from app.services.image_illustration.models import ForgeMode


def test_sanitize_forge_body_redacts_init_images_and_keeps_params():
    body = {
        "prompt": "a lighthouse",
        "negative_prompt": "blur",
        "steps": 20,
        "sampler_name": "Euler a",
        "seed": 42,
        "cfg_scale": 7,
        "width": 768,
        "height": 768,
        "override_settings": {"sd_model_checkpoint": "flux.safetensors"},
        "init_images": ["AAAA" * 100],
        "mask": "BBBB" * 50,
    }
    out = sanitize_forge_body_for_log(body)
    assert out["prompt"] == "a lighthouse"
    assert out["steps"] == 20
    assert out["sampler_name"] == "Euler a"
    assert out["seed"] == 42
    assert out["override_settings"]["sd_model_checkpoint"] == "flux.safetensors"
    assert isinstance(out["init_images"][0], str)
    assert "omitted" in out["init_images"][0]
    assert "omitted" in out["mask"]
    # original intact
    assert body["init_images"][0].startswith("AAAA")


def test_forge_client_logs_request_to_stderr_when_verbose(monkeypatch, capsys):
    monkeypatch.setattr(
        "app.services.image_illustration.forge_client.settings.verbose",
        True,
    )
    raw = b"fake-png-bytes"
    mock_http = MagicMock()
    resp = MagicMock()
    resp.status_code = 200
    resp.json.return_value = {"images": [base64.b64encode(raw).decode()]}
    mock_http.post.return_value = resp

    client = ForgeHttpClient(base_url="http://forge.test", http_client=mock_http)
    client.generate(
        ForgeMode.TXT2IMG,
        {
            "prompt": "storm lighthouse",
            "steps": 8,
            "sampler_name": "DPM++ 2M",
            "seed": 123,
            "override_settings": {"sd_model_checkpoint": "model.safetensors"},
        },
    )
    err = capsys.readouterr().err
    assert "Forge Neo" in err
    assert "txt2img" in err
    assert "storm lighthouse" in err
    assert "DPM++ 2M" in err
    assert "123" in err
    assert "model.safetensors" in err


def test_forge_client_skips_log_when_not_verbose(monkeypatch, capsys):
    monkeypatch.setattr(
        "app.services.image_illustration.forge_client.settings.verbose",
        False,
    )
    mock_http = MagicMock()
    resp = MagicMock()
    resp.status_code = 200
    resp.json.return_value = {"images": [base64.b64encode(b"x").decode()]}
    mock_http.post.return_value = resp
    ForgeHttpClient(http_client=mock_http).generate(
        ForgeMode.TXT2IMG, {"prompt": "quiet", "steps": 1}
    )
    assert "Forge Neo" not in capsys.readouterr().err


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


def test_forge_client_reactor_swap_decodes_image():
    raw = b"swapped-face-bytes"
    mock_http = MagicMock()
    resp = MagicMock()
    resp.status_code = 200
    resp.json.return_value = {"image": base64.b64encode(raw).decode()}
    mock_http.post.return_value = resp

    params = {
        "source_faces_index": [0],
        "face_index": [0],
        "upscaler": "None",
        "scale": 1,
        "upscale_visibility": 1,
        "face_restorer": "CodeFormer",
        "restorer_visibility": 1,
        "restore_first": 1,
        "model": "inswapper_128.onnx",
        "gender_source": 0,
        "gender_target": 0,
        "save_to_file": 0,
        "result_file_path": "",
        "device": "CUDA",
        "mask_face": 1,
        "select_source": 0,
        "upscale_force": 0,
        "codeformer_weight": 0.5,
    }
    client = ForgeHttpClient(base_url="http://forge.test", http_client=mock_http)
    out = client.reactor_swap(
        source_image=b"source",
        target_image=b"target",
        params=params,
    )
    assert out == raw
    args, kwargs = mock_http.post.call_args
    assert args[0] == "http://forge.test/reactor/image"
    payload = kwargs["json"]
    assert payload["model"] == "inswapper_128.onnx"
    assert payload["source_image"].startswith("data:image/png;base64,")
    assert payload["target_image"].startswith("data:image/png;base64,")


def test_forge_client_reactor_swap_http_error():
    mock_http = MagicMock()
    resp = MagicMock()
    resp.status_code = 404
    resp.text = "not found"
    resp.reason_phrase = "Not Found"
    mock_http.post.return_value = resp
    client = ForgeHttpClient(http_client=mock_http)
    with pytest.raises(ForgeClientError) as ei:
        client.reactor_swap(source_image=b"a", target_image=b"b", params={"model": "x"})
    assert ei.value.status_code == 404
