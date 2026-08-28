"""Tests de parseo infotext y ReplayLastGeneration."""

from pathlib import Path
from unittest.mock import MagicMock

import pytest

from app.services.image_illustration.infotext import (
    build_api_body,
    detect_mode,
    parse_infotext,
    parse_pnginfo_parameters,
)
from app.services.image_illustration.last_payload import (
    FileSystemLastPayloadSource,
    LastPayloadError,
    find_latest_output_image,
    list_style_init_images,
)
from app.services.image_illustration.models import ForgeMode
from tests.fixtures_forge_infotext import (
    SAMPLE_INFOTEXT_TXT2IMG,
    SAMPLE_PARAMS_TXT_IMG2IMG,
    SAMPLE_PNGINFO_PARAMETERS_IMG2IMG,
)


def test_parse_infotext_img2img_recovers_core_fields():
    fields = parse_infotext(SAMPLE_PARAMS_TXT_IMG2IMG)
    assert fields["steps"] == 8
    assert fields["sampler_name"] == "Euler"
    assert fields["scheduler"] == "Beta"
    assert fields["cfg_scale"] == 1.0
    assert fields["seed"] == 3815280852
    assert fields["width"] == 1024
    assert fields["height"] == 1024
    assert fields["sd_model_checkpoint"] == "flux2Klein9bFp8_fp8"
    assert fields["denoising_strength"] == 1.0
    assert fields["modules"][0].startswith("Huihui-Qwen3")
    assert "prompt" in fields


def test_parse_infotext_txt2img_negative_prompt():
    fields = parse_infotext(SAMPLE_INFOTEXT_TXT2IMG)
    assert fields["negative_prompt"] == "blurry, low quality"
    assert fields["steps"] == 20
    assert "denoising_strength" not in fields


def test_detect_mode_from_path_and_denoising():
    assert detect_mode("/data/output/img2img-images/x.png", {}) == ForgeMode.IMG2IMG
    assert detect_mode("/data/output/txt2img-images/x.png", {}) == ForgeMode.TXT2IMG
    assert detect_mode(None, {"denoising_strength": 0.6}) == ForgeMode.IMG2IMG
    assert detect_mode(None, {}) == ForgeMode.TXT2IMG


def test_build_api_body_does_not_invent_defaults():
    fields = {"steps": 8, "sampler_name": "Euler"}
    body, override, recovered, notes = build_api_body(fields, ForgeMode.TXT2IMG)
    assert body == {"steps": 8, "sampler_name": "Euler"}
    assert override == {}
    assert "cfg_scale" not in body
    assert "prompt ausente" in notes[0]


def test_parse_pnginfo_parameters_merges_size():
    fields = parse_pnginfo_parameters(
        SAMPLE_PNGINFO_PARAMETERS_IMG2IMG,
        SAMPLE_PARAMS_TXT_IMG2IMG,
    )
    assert fields["width"] == 1024
    assert fields["height"] == 1024
    assert fields["sd_model_checkpoint"] == "flux2Klein9bFp8_fp8"


def test_find_latest_output_image(tmp_path: Path):
    out = tmp_path / "output" / "txt2img-images" / "2026-08-04"
    out.mkdir(parents=True)
    older = out / "a.png"
    newer = out / "b.png"
    older.write_bytes(b"old")
    newer.write_bytes(b"new")
    import os
    os.utime(older, (1_000_000, 1_000_000))
    os.utime(newer, (2_000_000, 2_000_000))
    assert find_latest_output_image(tmp_path) == newer


def test_find_latest_output_image_missing(tmp_path: Path):
    with pytest.raises(LastPayloadError):
        find_latest_output_image(tmp_path)


def test_list_style_init_priority(tmp_path: Path):
    init = tmp_path / "init"
    init.mkdir()
    (init / "ref.jpg").write_bytes(b"jpg")
    assert len(list_style_init_images(init)) == 1
    assert list_style_init_images(tmp_path / "missing") == []
    assert list_style_init_images("") == []


def test_filesystem_last_payload_img2img_uses_style_init(tmp_path: Path):
    out = tmp_path / "output" / "img2img-images" / "d"
    out.mkdir(parents=True)
    latest = out / "last.jpeg"
    latest.write_bytes(b"\xff\xd8\xfflast")
    init = tmp_path / "init"
    init.mkdir()
    ref = init / "ref.png"
    ref.write_bytes(b"\x89PNGref")
    (tmp_path / "params.txt").write_text(SAMPLE_PARAMS_TXT_IMG2IMG, encoding="utf-8")

    mock_http = MagicMock()
    png_resp = MagicMock()
    png_resp.status_code = 200
    png_resp.json.return_value = {
        "info": SAMPLE_PARAMS_TXT_IMG2IMG,
        "parameters": SAMPLE_PNGINFO_PARAMETERS_IMG2IMG,
    }
    opt_resp = MagicMock()
    opt_resp.status_code = 200
    opt_resp.json.return_value = {"sd_model_checkpoint": "ignored-if-present"}
    mock_http.post.return_value = png_resp
    mock_http.get.return_value = opt_resp

    src = FileSystemLastPayloadSource(
        data_path=str(tmp_path),
        style_init_dir=str(init),
        http_client=mock_http,
    )
    payload = src.load()
    assert payload.mode == ForgeMode.IMG2IMG
    assert payload.body["steps"] == 8
    assert payload.body["prompt"]
    assert "init_images" in payload.body
    assert "init_images:style_init_dir" in payload.recovered_fields
    scene_body = payload.body_with_prompt("nueva escena")
    assert scene_body["prompt"] == "nueva escena"
    assert scene_body["steps"] == 8


def test_filesystem_last_payload_falls_back_to_last_output(tmp_path: Path):
    out = tmp_path / "output" / "img2img-images" / "d"
    out.mkdir(parents=True)
    latest = out / "last.jpeg"
    latest.write_bytes(b"\xff\xd8\xfflast")
    (tmp_path / "params.txt").write_text(SAMPLE_PARAMS_TXT_IMG2IMG, encoding="utf-8")

    mock_http = MagicMock()
    png_resp = MagicMock()
    png_resp.status_code = 200
    png_resp.json.return_value = {"info": SAMPLE_PARAMS_TXT_IMG2IMG, "parameters": {}}
    opt_resp = MagicMock()
    opt_resp.status_code = 200
    opt_resp.json.return_value = {}
    mock_http.post.return_value = png_resp
    mock_http.get.return_value = opt_resp

    src = FileSystemLastPayloadSource(
        data_path=str(tmp_path),
        style_init_dir="",
        http_client=mock_http,
    )
    payload = src.load()
    assert "init_images:last_output" in payload.recovered_fields


def test_load_panel_params_reads_steps_size_seed_without_options(tmp_path: Path):
    out = tmp_path / "output" / "txt2img-images"
    out.mkdir(parents=True)
    (out / "last.png").write_bytes(b"\x89PNGx")
    (tmp_path / "params.txt").write_text(SAMPLE_INFOTEXT_TXT2IMG, encoding="utf-8")

    mock_http = MagicMock()
    png_resp = MagicMock()
    png_resp.status_code = 500
    mock_http.post.return_value = png_resp

    src = FileSystemLastPayloadSource(
        data_path=str(tmp_path),
        http_client=mock_http,
    )
    params = src.load_panel_params()
    assert params["steps"] == 20
    assert params["width"] == 832
    assert params["height"] == 1216
    assert params["seed"] == 12345
    assert params["mode"] == "txt2img"
    mock_http.post.assert_not_called()
    mock_http.get.assert_not_called()
