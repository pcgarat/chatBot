"""Concatenación de instrucciones de sistema (reglas de chat y del planificador)."""


def concat_instruction_texts(*parts: str) -> str:
    """Une textos no vacíos con un espacio (mismo criterio que las reglas del chat)."""
    return " ".join(p.strip() for p in parts if (p or "").strip())
