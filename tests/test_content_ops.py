"""Tests de operaciones sobre content ilustrado."""

from app.services.image_illustration.content_ops import (
    drop_missing_illustration_files,
    extract_illustrated_filenames,
    remove_all_photos,
    remove_orphan_anchors,
)
from app.services.image_illustration.storage import delete_illustrated_image, save_illustrated_image


def test_extract_illustrated_filenames():
    text = (
        'A <img src="/api/illustrated-images/aaa_s1.png" class="chat-illustration" /> '
        '<img class="chat-illustration" src="/api/illustrated-images/bbb_s2.png" /> '
        'B'
    )
    assert extract_illustrated_filenames(text) == ["aaa_s1.png", "bbb_s2.png"]


def test_remove_all_photos_keeps_text_and_orphans():
    text = (
        "Había un faro.\n\n"
        '<img src="/api/illustrated-images/x.png" class="chat-illustration" />\n\n'
        "⟦img:s2⟧\n"
        '<span class="chat-illustration-error" data-scene="s1">[Imagen fallida: e]</span>\n'
        "El mar."
    )
    out, names = remove_all_photos(text)
    assert names == ["x.png"]
    assert "<img" not in out
    assert "⟦img:s2⟧" in out
    assert "chat-illustration-error" in out
    assert "Había un faro." in out
    assert "El mar." in out


def test_remove_orphan_anchors_keeps_photos():
    text = (
        "A\n"
        '<img src="/api/illustrated-images/ok.png" class="chat-illustration" />\n'
        '<span class="chat-illustration-placeholder" data-scene="s1">Generando…</span>\n'
        '<span class="chat-illustration-error" data-scene="s2">[Imagen fallida]</span>\n'
        "⟦img:s3⟧\n"
        "B"
    )
    out = remove_orphan_anchors(text, image_exists=lambda name: name == "ok.png")
    assert "ok.png" in out
    assert "placeholder" not in out
    assert "chat-illustration-error" not in out
    assert "⟦img:" not in out
    assert "A" in out and "B" in out


def test_drop_missing_illustration_files_keeps_placeholders():
    text = (
        "A\n"
        '<img src="/api/illustrated-images/gone.jpg" class="chat-illustration" />\n'
        '<span class="chat-illustration-placeholder" data-scene="s1" data-prompt="storm">'
        "pending</span>\n"
        "B"
    )
    out = drop_missing_illustration_files(text, image_exists=lambda name: False)
    assert "gone.jpg" not in out
    assert "data-scene=\"s1\"" in out
    assert "A" in out and "B" in out


def test_remove_orphan_anchors_drops_missing_photos():
    text = (
        "A\n"
        '<img src="/api/illustrated-images/gone.jpg" class="chat-illustration" />\n'
        '<img src="/api/illustrated-images/ok.png" class="chat-illustration" />\n'
        "B"
    )
    out = remove_orphan_anchors(text, image_exists=lambda name: name == "ok.png")
    assert "gone.jpg" not in out
    assert "ok.png" in out
    assert "A" in out and "B" in out


def test_extract_pending_illustration_scenes_order_and_prompts():
    from app.services.image_illustration.content_ops import extract_pending_illustration_scenes

    text = (
        "Inicio\n"
        '<img src="/api/illustrated-images/ok.png" class="chat-illustration" />\n'
        '<span class="chat-illustration-placeholder" data-scene="s1" data-prompt="faro en tormenta">'
        "Generando imagen…\n\nfaro en tormenta</span>\n"
        '<span class="chat-illustration-error" data-scene="s2" data-prompt="barco">'
        "[Imagen fallida: timeout]</span>\n"
        "⟦img:s3⟧\n"
        '<span class="chat-illustration-placeholder" data-scene="s4">'
        "Generando imagen…\n\nolive tree</span>\n"
        "Fin"
    )
    pending = extract_pending_illustration_scenes(text)
    assert [p.id for p in pending] == ["s1", "s2", "s3", "s4"]
    assert pending[0].prompt == "faro en tormenta"
    assert pending[1].prompt == "barco"
    assert pending[2].prompt == ""
    assert pending[3].prompt == "olive tree"


def test_extract_pending_skips_duplicate_scene_ids():
    from app.services.image_illustration.content_ops import extract_pending_illustration_scenes

    text = (
        '<span class="chat-illustration-error" data-scene="s1" data-prompt="a">err</span>\n'
        "⟦img:s1⟧"
    )
    pending = extract_pending_illustration_scenes(text)
    assert len(pending) == 1
    assert pending[0].id == "s1"
    assert pending[0].prompt == "a"


def test_delete_illustrated_image_removes_file(tmp_path, monkeypatch):
    monkeypatch.setattr(
        "app.services.image_illustration.storage.DEFAULT_DIR",
        tmp_path / "illustrated",
    )
    name = save_illustrated_image("s1", b"\x89PNG\r\n\x1a\n")
    assert name.endswith(".png")
    assert (tmp_path / "illustrated" / name).is_file()
    assert delete_illustrated_image(name) is True
    assert not (tmp_path / "illustrated" / name).is_file()
    assert delete_illustrated_image(name) is False
    assert delete_illustrated_image("../etc/passwd") is False


def test_save_illustrated_image_uses_jpg_extension_for_jpeg_bytes(tmp_path, monkeypatch):
    monkeypatch.setattr(
        "app.services.image_illustration.storage.DEFAULT_DIR",
        tmp_path / "illustrated",
    )
    jpeg = b"\xff\xd8\xff\xe0\x00\x10JFIF" + b"\x00" * 16
    name = save_illustrated_image("s3", jpeg)
    assert name.endswith(".jpg")
    assert (tmp_path / "illustrated" / name).read_bytes().startswith(b"\xff\xd8\xff")
