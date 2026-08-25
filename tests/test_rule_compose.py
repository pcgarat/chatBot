"""Tests de concatenación de instrucciones extra del planificador."""
from app.services.rules.compose import concat_instruction_texts


def test_concat_instruction_texts_skips_blank():
    assert concat_instruction_texts("  a  ", "", "  ", "b") == "a b"


def test_concat_instruction_texts_empty():
    assert concat_instruction_texts("", None, "   ") == ""
    assert concat_instruction_texts() == ""
