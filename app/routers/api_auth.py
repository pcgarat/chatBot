"""API de autenticación y preferencias de usuario."""

from __future__ import annotations

import json
import re
from typing import Annotated

from fastapi import APIRouter, Cookie, Depends, HTTPException, Response
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.auth import (
    SESSION_COOKIE,
    CurrentUser,
    clear_session_cookie,
    create_session,
    get_or_create_preferences,
    hash_password,
    revoke_other_sessions,
    revoke_session,
    set_session_cookie,
    verify_password,
)
from app.db import get_db
from app.models_user import User

router = APIRouter(prefix="/api/auth", tags=["auth"])

_USERNAME_RE = re.compile(r"^[a-zA-Z0-9_.-]{3,64}$")


class RegisterIn(BaseModel):
    username: str = Field(min_length=3, max_length=64)
    password: str = Field(min_length=6, max_length=128)
    email: str | None = Field(default=None, max_length=255)


class LoginIn(BaseModel):
    username: str
    password: str


class UserOut(BaseModel):
    id: str
    username: str
    email: str | None = None
    is_admin: bool = False


class PreferencesIn(BaseModel):
    preferences: dict = Field(default_factory=dict)


class PreferencesOut(BaseModel):
    preferences: dict


class ChangePasswordIn(BaseModel):
    current_password: str = Field(min_length=1, max_length=128)
    new_password: str = Field(min_length=6, max_length=128)


def _to_user_out(user: User) -> UserOut:
    return UserOut(
        id=user.id,
        username=user.username,
        email=user.email,
        is_admin=bool(user.is_admin),
    )


@router.post("/register", response_model=UserOut, status_code=201)
def register(body: RegisterIn, response: Response, db: Session = Depends(get_db)):
    username = (body.username or "").strip()
    if not _USERNAME_RE.match(username):
        raise HTTPException(
            status_code=400,
            detail="Usuario inválido (3-64 chars: letras, números, _ . -)",
        )
    if username.lower() == "admin":
        raise HTTPException(status_code=400, detail="Ese nombre de usuario está reservado")
    if db.query(User).filter(User.username == username).first():
        raise HTTPException(status_code=409, detail="Usuario ya existe")
    email = (body.email or "").strip() or None
    if email and db.query(User).filter(User.email == email).first():
        raise HTTPException(status_code=409, detail="Email ya registrado")
    user = User(
        username=username,
        email=email,
        password_hash=hash_password(body.password),
        is_admin=False,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    get_or_create_preferences(db, user.id)
    session = create_session(db, user)
    set_session_cookie(response, session.id)
    return _to_user_out(user)


@router.post("/login", response_model=UserOut)
def login(body: LoginIn, response: Response, db: Session = Depends(get_db)):
    username = (body.username or "").strip()
    user = db.query(User).filter(User.username == username).first()
    if not user or not verify_password(body.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Credenciales incorrectas")
    session = create_session(db, user)
    set_session_cookie(response, session.id)
    return _to_user_out(user)


@router.post("/logout", status_code=204)
def logout(
    response: Response,
    db: Session = Depends(get_db),
    chatbot_session: Annotated[str | None, Cookie(alias=SESSION_COOKIE)] = None,
):
    revoke_session(db, chatbot_session)
    clear_session_cookie(response)
    return None


@router.get("/me", response_model=UserOut)
def me(user: CurrentUser):
    return _to_user_out(user)


@router.post("/change-password", status_code=204)
def change_password(
    body: ChangePasswordIn,
    user: CurrentUser,
    db: Session = Depends(get_db),
    chatbot_session: Annotated[str | None, Cookie(alias=SESSION_COOKIE)] = None,
):
    if not verify_password(body.current_password, user.password_hash):
        raise HTTPException(status_code=400, detail="Contraseña actual incorrecta")
    if body.current_password == body.new_password:
        raise HTTPException(
            status_code=400,
            detail="La nueva contraseña debe ser distinta de la actual",
        )
    user.password_hash = hash_password(body.new_password)
    db.commit()
    revoke_other_sessions(db, user.id, keep_token=chatbot_session)
    return None


@router.get("/preferences", response_model=PreferencesOut)
def get_preferences(user: CurrentUser, db: Session = Depends(get_db)):
    row = get_or_create_preferences(db, user.id)
    try:
        data = json.loads(row.preferences_json or "{}")
    except json.JSONDecodeError:
        data = {}
    if not isinstance(data, dict):
        data = {}
    return PreferencesOut(preferences=data)


@router.put("/preferences", response_model=PreferencesOut)
def put_preferences(body: PreferencesIn, user: CurrentUser, db: Session = Depends(get_db)):
    row = get_or_create_preferences(db, user.id)
    row.preferences_json = json.dumps(body.preferences or {}, ensure_ascii=False)
    db.commit()
    db.refresh(row)
    return PreferencesOut(preferences=body.preferences or {})
