"""API del árbol unificado de respuestas (roots + children)."""

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.db import get_db
from app.schemas import MessageTreeListResponse, MessageTreeNode
from app.services import message_tree as mt

router = APIRouter(prefix="/api", tags=["message-tree"])


def _to_schema(node: mt.MessageTreeNodeData) -> MessageTreeNode:
    return MessageTreeNode(
        id=node.id,
        conversation_id=node.conversation_id,
        conversation_title=node.conversation_title,
        content_preview=node.content_preview,
        created_at=node.created_at,
        parent_message_id=node.parent_message_id,
        is_fork_edge=node.is_fork_edge,
        has_children=node.has_children,
        sibling_index=node.sibling_index,
        sibling_count=node.sibling_count,
        active_leaf_message_id=None,
    )


@router.get("/message-tree/roots", response_model=MessageTreeListResponse)
def list_message_tree_roots(
    limit: int = Query(default=mt.ROOT_LIMIT_DEFAULT, ge=1, le=mt.ROOT_LIMIT_MAX),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db),
):
    page = mt.list_root_nodes(db, limit=limit, offset=offset)
    return MessageTreeListResponse(
        items=[_to_schema(n) for n in page.nodes],
        total=page.total,
        limit=page.limit,
        offset=page.offset,
    )


@router.get("/message-tree/{message_id}/children", response_model=list[MessageTreeNode])
def list_message_tree_children(message_id: str, db: Session = Depends(get_db)):
    if mt.get_message_any_active(db, message_id) is None:
        raise HTTPException(status_code=404, detail="Mensaje no encontrado")
    return [_to_schema(n) for n in mt.list_child_nodes(db, message_id)]
