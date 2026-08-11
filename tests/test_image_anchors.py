"""Tests de anclas de inserción."""

from app.services.image_illustration.anchors import (
    insert_scene_markers,
    marker_for,
    replace_marker_with,
    strip_illustration_artifacts,
)
from app.services.image_illustration.models import SceneSpec


def test_insert_after_anchor_excerpt():
    text = "Había una vez un castillo.\n\nLuego salió el dragón."
    scenes = [
        SceneSpec(id="s1", prompt="castle", anchor_excerpt="un castillo."),
    ]
    out = insert_scene_markers(text, scenes)
    assert "un castillo.\n⟦img:s1⟧\n" in out
    assert "Luego salió el dragón." in out


def test_insert_by_paragraph_index_skips_image_only_blocks():
    """
    Con imágenes en bloques propios, paragraph_index de cobertura (huecos)
    no debe resolverse con split('\\n\\n') crudo (pegaría la ancla al <img>).
    """
    text = (
        "Párrafo uno del relato.\n\n"
        '<img src="/api/illustrated-images/a.png" class="chat-illustration" />\n\n'
        "Párrafo dos todavía libre.\n\n"
        "Párrafo tres también libre."
    )
    scenes = [
        SceneSpec(id="s10", prompt="two", paragraph_index=1, anchor_excerpt=""),
        SceneSpec(id="s11", prompt="three", paragraph_index=2, anchor_excerpt=""),
    ]
    out = insert_scene_markers(text, scenes)
    img_at = out.index('<img src="/api/illustrated-images/a.png"')
    s10 = out.index(marker_for("s10"))
    s11 = out.index(marker_for("s11"))
    dos = out.index("Párrafo dos todavía libre.")
    tres = out.index("Párrafo tres también libre.")
    assert dos < s10 < tres < s11
    assert not (img_at < s10 < dos), "s10 no debe quedar pegada al <img> existente"


def test_insert_prefers_paragraph_index_over_ambiguous_excerpt():
    """Si el excerpt aparece antes (junto a imgs), manda el paragraph_index del hueco."""
    text = (
        "Vio la casa al fondo.\n"
        '<img src="/api/illustrated-images/old.png" class="chat-illustration" />\n\n'
        "Más tarde volvió a la casa.\n\n"
        "Cierre del relato."
    )
    scenes = [
        SceneSpec(
            id="s20",
            prompt="return home",
            paragraph_index=1,
            anchor_excerpt="la casa",  # también en el párrafo 0 ilustrado
        ),
    ]
    out = insert_scene_markers(text, scenes)
    img_at = out.index("<img")
    mark = out.index(marker_for("s20"))
    second = out.index("Más tarde volvió a la casa.")
    assert second < mark
    assert mark > img_at
    # No insertar entre el primer "la casa" y su imagen
    first_casa = out.index("Vio la casa al fondo.")
    assert not (first_casa < mark < img_at)


def test_insert_at_end_when_no_anchor():
    text = "Solo texto."
    scenes = [SceneSpec(id="s3", prompt="x", anchor_excerpt="", paragraph_index=99)]
    out = insert_scene_markers(text, scenes)
    assert out.endswith(f"\n{marker_for('s3')}\n") or marker_for("s3") in out


def test_replace_marker():
    text = f"a {marker_for('s1')} b"
    assert replace_marker_with(text, "s1", "<img>") == "a <img> b"


def test_strip_illustration_artifacts_removes_img_error_and_marker():
    text = (
        "Había un faro.\n"
        '<img src="/api/illustrated-images/x.png" class="chat-illustration" />\n'
        '<span class="chat-illustration-error" data-scene="s1">[Imagen fallida: x]</span>\n'
        f"{marker_for('s2')}\n"
        "El mar seguía."
    )
    out = strip_illustration_artifacts(text)
    assert "faro" in out
    assert "El mar seguía." in out
    assert "chat-illustration" not in out
    assert "⟦img:" not in out
    assert "[Imagen fallida" not in out


def test_strip_illustration_artifacts_noop_on_plain_text():
    assert strip_illustration_artifacts("Solo relato.") == "Solo relato."


def test_strip_transient_keeps_images_removes_placeholders():
    from app.services.image_illustration.anchors import strip_transient_illustration_artifacts

    text = (
        "A\n"
        '<img src="/api/illustrated-images/x.png" class="chat-illustration" />\n'
        '<span class="chat-illustration-placeholder" data-scene="s1">Generando…</span>\n'
        "⟦img:s2⟧\n"
        "B"
    )
    out = strip_transient_illustration_artifacts(text)
    assert "x.png" in out
    assert "placeholder" not in out
    assert "⟦img:" not in out


def test_allocate_unique_scene_ids_skips_used():
    from app.services.image_illustration.anchors import allocate_unique_scene_ids

    assert allocate_unique_scene_ids({"s1", "s2"}, 2) == ["s3", "s4"]

