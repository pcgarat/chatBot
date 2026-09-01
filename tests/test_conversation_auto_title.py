"""Título automático derivado del último mensaje visible."""

from app.services.conversation_title import TITLE_SOFT_MAX_LEN, derive_auto_title


def test_derive_primera_frase_sin_signos_conserva_espacios():
    assert derive_auto_title("Hola, mundo. Adiós.") == "Hola mundo"


def test_derive_limpia_interrogacion_y_acentos():
    assert derive_auto_title("¿Qué hora es?") == "Qué hora es"


def test_derive_sin_punto_usa_el_mensaje_entero():
    assert derive_auto_title("solo una línea") == "solo una línea"


def test_derive_primera_linea_si_no_hay_punto():
    assert derive_auto_title("La Ventana de la Culpa\nDesde mi punto de vista") == "La Ventana de la Culpa"


def test_derive_quita_html_e_ilustraciones():
    raw = '<p>Un faro al anochecer.</p><img class="chat-illustration" src="x.png"/>⟦img:s1⟧ Más texto.'
    assert derive_auto_title(raw) == "Un faro al anochecer"


def test_derive_vacio_o_solo_ruido():
    assert derive_auto_title("") == ""
    assert derive_auto_title("   ") == ""
    assert derive_auto_title("!!!") == ""
    assert derive_auto_title(None) == ""


def test_derive_recorta_parrafo_sin_puntos():
    blob = "palabra " * 40
    out = derive_auto_title(blob)
    assert len(out) <= TITLE_SOFT_MAX_LEN
    assert out.startswith("palabra")
    assert not out.endswith(" ")
