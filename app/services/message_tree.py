"""Árbol unificado de mensajes assistant: plano por conversación; nest solo en forks."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime

from sqlalchemy.orm import Session

from app.crud import message_content_preview
from app.models import Conversation, Message
from app.services.conversation_tree import latest_leaf_in_subtree


@dataclass(frozen=True)
class MessageTreeNodeData:
    id: str
    conversation_id: str
    conversation_title: str
    content_preview: str
    created_at: datetime
    parent_message_id: str | None
    is_fork_edge: bool
    has_children: bool
    sibling_index: int | None
    sibling_count: int | None


@dataclass(frozen=True)
class MessageTreeRootsPage:
    nodes: list[MessageTreeNodeData]
    total: int
    limit: int
    offset: int


ROOT_LIMIT_DEFAULT = 50
ROOT_LIMIT_MAX = 100


def clamp_root_limit(limit: int | None) -> int:
    if limit is None:
        return ROOT_LIMIT_DEFAULT
    return max(1, min(int(limit), ROOT_LIMIT_MAX))


def clamp_root_offset(offset: int | None) -> int:
    if offset is None:
        return 0
    return max(0, int(offset))


def _active_chat_conv_filter():
    return (
        Conversation.deleted_at.is_(None),
        Conversation.kind != Conversation.KIND_PROMPT_GENERATOR,
    )


def unified_parent_assistant_id(messages_by_id: dict[str, Message], msg: Message) -> str | None:
    """Assistant anterior en el camino SQL (solo para utilidades; el árbol UI no anida intra-hilo)."""
    parent_id = getattr(msg, "parent_id", None)
    seen: set[str] = set()
    while parent_id and parent_id not in seen:
        seen.add(parent_id)
        parent = messages_by_id.get(parent_id)
        if parent is None:
            return None
        if parent.role == "assistant":
            return parent.id
        parent_id = getattr(parent, "parent_id", None)
    return None


def _messages_by_conversation(db: Session, conversation_id: str) -> list[Message]:
    return (
        db.query(Message)
        .filter(Message.conversation_id == conversation_id)
        .order_by(Message.created_at.asc())
        .all()
    )


def _assistants_in(messages: list[Message]) -> list[Message]:
    return [m for m in messages if m.role == "assistant"]


def _node_from_message(
    msg: Message,
    *,
    title: str,
    parent_message_id: str | None,
    is_fork_edge: bool,
    has_children: bool,
    sibling_index: int | None = None,
    sibling_count: int | None = None,
) -> MessageTreeNodeData:
    return MessageTreeNodeData(
        id=msg.id,
        conversation_id=msg.conversation_id,
        conversation_title=title or "",
        content_preview=message_content_preview(msg.content or ""),
        created_at=msg.created_at,
        parent_message_id=parent_message_id,
        is_fork_edge=is_fork_edge,
        has_children=has_children,
        sibling_index=sibling_index,
        sibling_count=sibling_count,
    )


def _forks_anchored_at(db: Session, anchor_message_id: str) -> list[Conversation]:
    return (
        db.query(Conversation)
        .filter(
            Conversation.forked_from_message_id == anchor_message_id,
            *_active_chat_conv_filter(),
        )
        .order_by(Conversation.created_at.asc())
        .all()
    )


def _fork_assistant_pairs(db: Session, anchor_message_id: str) -> list[tuple[Message, str]]:
    """Todos los assistants propios de cada fork anclado; mismo nivel entre sí."""
    out: list[tuple[Message, str]] = []
    for fork in _forks_anchored_at(db, anchor_message_id):
        own = _assistants_in(_messages_by_conversation(db, fork.id))
        if not own:
            continue
        title = fork.title or ""
        for msg in own:
            out.append((msg, title))
    out.sort(key=lambda t: (t[0].created_at or datetime.min, t[0].id))
    return out


def _has_fork_children(db: Session, message_id: str) -> bool:
    for fork in _forks_anchored_at(db, message_id):
        if any(m.role == "assistant" for m in _messages_by_conversation(db, fork.id)):
            return True
    return False


def get_message_any_active(db: Session, message_id: str) -> Message | None:
    """Mensaje cuyo dueño no está en papelera ni es prompt_generator."""
    return (
        db.query(Message)
        .join(Conversation, Conversation.id == Message.conversation_id)
        .filter(Message.id == message_id, *_active_chat_conv_filter())
        .first()
    )


def list_child_nodes(db: Session, message_id: str) -> list[MessageTreeNodeData]:
    """Solo forks: un nivel más. Mensajes de la misma conversación no anidan aquí."""
    msg = get_message_any_active(db, message_id)
    if msg is None:
        return []

    pairs = _fork_assistant_pairs(db, message_id)
    total = len(pairs)
    nodes: list[MessageTreeNodeData] = []
    for idx, (child, child_title) in enumerate(pairs):
        nodes.append(
            _node_from_message(
                child,
                title=child_title,
                parent_message_id=message_id,
                is_fork_edge=True,
                has_children=_has_fork_children(db, child.id),
                sibling_index=idx,
                sibling_count=total,
            )
        )
    return nodes


def list_root_nodes(
    db: Session, limit: int | None = None, offset: int | None = None
) -> MessageTreeRootsPage:
    """Assistants de conversaciones raíz, todos al mismo nivel (sin nest intra-hilo)."""
    capped = clamp_root_limit(limit)
    off = clamp_root_offset(offset)

    root_convs = (
        db.query(Conversation)
        .filter(
            *_active_chat_conv_filter(),
            Conversation.forked_from_conversation_id.is_(None),
        )
        .all()
    )
    roots: list[MessageTreeNodeData] = []
    for conv in root_convs:
        messages = _messages_by_conversation(db, conv.id)
        for msg in _assistants_in(messages):
            roots.append(
                _node_from_message(
                    msg,
                    title=conv.title or "",
                    parent_message_id=None,
                    is_fork_edge=False,
                    has_children=_has_fork_children(db, msg.id),
                    sibling_index=None,
                    sibling_count=None,
                )
            )

    roots.sort(key=lambda n: (n.created_at or datetime.min, n.id), reverse=True)
    total = len(roots)
    return MessageTreeRootsPage(
        nodes=roots[off : off + capped],
        total=total,
        limit=capped,
        offset=off,
    )


def active_leaf_for_node(db: Session, message_id: str) -> str | None:
    """Hoja del subárbol del mensaje en su conversación dueña."""
    msg = get_message_any_active(db, message_id)
    if msg is None:
        return None
    messages = _messages_by_conversation(db, msg.conversation_id)
    leaf = latest_leaf_in_subtree(messages, message_id)
    return leaf.id if leaf else message_id
