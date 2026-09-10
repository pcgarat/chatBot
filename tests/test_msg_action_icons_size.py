"""Iconos de acciones bajo cada mensaje: tamaño compacto."""
from tests.frontend_source import frontend_markup, frontend_source

from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[1]
STYLE = ROOT / "frontend" / "src" / "styles" / "style.css"


def test_msg_action_icons_are_compact_in_css():
    css = STYLE.read_text(encoding="utf-8")
    m = re.search(r"\.msg-action-btn svg\s*\{([^}]+)\}", css)
    assert m, "Falta regla .msg-action-btn svg"
    body = m.group(1)
    assert "width: 11px" in body
    assert "height: 11px" in body


def test_msg_action_svgs_use_compact_intrinsic_size():
    js = frontend_source()
    assert js.count('width="11" height="11"') + js.count('width=\\"11\\" height=\\"11\\"') >= 5
