"""Árbol de mensajes de una conversación: camino activo e intentos (ramas)."""

from __future__ import annotations

from typing import Any, Sequence


def path_from_messages(messages: Sequence[Any], leaf_id: str | None) -> list[Any]:
    """Devuelve el camino raíz → leaf (inclusive). Lista vacía si no hay leaf o no existe."""
    if not leaf_id:
        return []
    by_id = {m.id: m for m in messages if getattr(m, "id", None)}
    path: list[Any] = []
    current = by_id.get(leaf_id)
    seen: set[str] = set()
    while current is not None and current.id not in seen:
        path.append(current)
        seen.add(current.id)
        parent_id = getattr(current, "parent_id", None)
        current = by_id.get(parent_id) if parent_id else None
    path.reverse()
    return path


def children_grouped(messages: Sequence[Any]) -> dict[str | None, list[Any]]:
    """Agrupa mensajes por parent_id conservando el orden de `messages`."""
    groups: dict[str | None, list[Any]] = {}
    for msg in messages:
        groups.setdefault(getattr(msg, "parent_id", None), []).append(msg)
    return groups


def latest_leaf_in_subtree(messages: Sequence[Any], root_id: str | None) -> Any | None:
    """Hoja más reciente (por orden de `messages`) del subárbol que empieza en root_id."""
    if not root_id:
        return None
    by_id = {m.id: m for m in messages if getattr(m, "id", None)}
    root = by_id.get(root_id)
    if root is None:
        return None
    groups = children_grouped(messages)
    order = {m.id: i for i, m in enumerate(messages) if getattr(m, "id", None)}
    stack = [root]
    nodes: list[Any] = []
    while stack:
        node = stack.pop()
        nodes.append(node)
        kids = list(groups.get(node.id, []))
        stack.extend(reversed(kids))
    leaves = [n for n in nodes if not groups.get(n.id)]
    if not leaves:
        return root
    leaves.sort(key=lambda n: order.get(n.id, 0))
    return leaves[-1]


def linear_parent_ids(message_ids: Sequence[str]) -> list[tuple[str, str | None]]:
    """Encadena ids en orden: el primero es raíz, cada siguiente apunta al anterior."""
    out: list[tuple[str, str | None]] = []
    prev: str | None = None
    for mid in message_ids:
        out.append((mid, prev))
        prev = mid
    return out
