"""Endpoint del flujo prompt generator (txt2img)."""

from typing import Any, Literal, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.db import get_db
from app.routers.api_conversations import _message_in_chat
from app.schemas import MessageInChat
from app.services.prompt_generator.turn import run_turn

router = APIRouter(prefix="/api", tags=["prompt-generator"])


class PromptGeneratorTurnIn(BaseModel):
    message: Optional[str] = None
    force: bool = False


class PromptGeneratorTurnOut(BaseModel):
    assistant_text: str
    phase: Literal["interview", "prompt"]
    prompt: Optional[str] = None
    brief: dict[str, Any]
    user_message: Optional[MessageInChat] = None
    assistant_message: MessageInChat


@router.post(
    "/conversations/{conversation_id}/prompt-generator/turn",
    response_model=PromptGeneratorTurnOut,
)
def prompt_generator_turn(
    conversation_id: str,
    body: PromptGeneratorTurnIn,
    db: Session = Depends(get_db),
):
    try:
        result = run_turn(
            db,
            conversation_id,
            message=body.message,
            force=body.force,
        )
    except LookupError:
        raise HTTPException(status_code=404, detail="Conversación no encontrada")
    except PermissionError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    except ValueError as exc:
        raise HTTPException(status_code=502, detail=f"Respuesta inválida del modelo: {exc}")

    return PromptGeneratorTurnOut(
        assistant_text=result.assistant_text,
        phase=result.phase,  # type: ignore[arg-type]
        prompt=result.prompt,
        brief=result.brief,
        user_message=_message_in_chat(result.user_message) if result.user_message else None,
        assistant_message=_message_in_chat(result.assistant_message),
    )
