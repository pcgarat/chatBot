"""Auth: hashing de contraseñas, sesiones y dependencias FastAPI."""

from __future__ import annotations

import hashlib
import hmac
import secrets
from datetime import datetime, timedelta
from typing import Annotated

from fastapi import Cookie, Depends, HTTPException, Response, status
from sqlalchemy.orm import Session

from app.config import settings
from app.db import get_db
from app.models_user import User, UserPreferences, UserSession

SESSION_COOKIE = "chatbot_session"
SESSION_DAYS = 30
_PBKDF2_ITERATIONS = 260_000


def hash_password(password: str) -> str:
    salt = secrets.token_hex(16)
    digest = hashlib.pbkdf2_hmac(
        "sha256",
        password.encode("utf-8"),
        salt.encode("utf-8"),
        _PBKDF2_ITERATIONS,
    ).hex()
    return f"pbkdf2_sha256${_PBKDF2_ITERATIONS}${salt}${digest}"


def verify_password(password: str, password_hash: str) -> bool:
    try:
        algo, iters_s, salt, digest = password_hash.split("$", 3)
    except ValueError:
        return False
    if algo != "pbkdf2_sha256":
        return False
    try:
        iters = int(iters_s)
    except ValueError:
        return False
    candidate = hashlib.pbkdf2_hmac(
        "sha256",
        password.encode("utf-8"),
        salt.encode("utf-8"),
        iters,
    ).hex()
    return hmac.compare_digest(candidate, digest)


def create_session(db: Session, user: User) -> UserSession:
    token = secrets.token_urlsafe(32)
    session = UserSession(
        id=token,
        user_id=user.id,
        expires_at=datetime.utcnow() + timedelta(days=SESSION_DAYS),
    )
    db.add(session)
    db.commit()
    db.refresh(session)
    return session


def set_session_cookie(response: Response, token: str) -> None:
    response.set_cookie(
        key=SESSION_COOKIE,
        value=token,
        httponly=True,
        samesite="lax",
        max_age=SESSION_DAYS * 24 * 3600,
        path="/",
    )


def clear_session_cookie(response: Response) -> None:
    response.delete_cookie(key=SESSION_COOKIE, path="/")


def get_session_user(db: Session, token: str | None) -> User | None:
    if not token:
        return None
    row = db.query(UserSession).filter(UserSession.id == token).first()
    if not row:
        return None
    if row.expires_at < datetime.utcnow():
        db.delete(row)
        db.commit()
        return None
    return db.query(User).filter(User.id == row.user_id).first()


def revoke_session(db: Session, token: str | None) -> None:
    if not token:
        return
    row = db.query(UserSession).filter(UserSession.id == token).first()
    if row:
        db.delete(row)
        db.commit()


def revoke_other_sessions(db: Session, user_id: str, keep_token: str | None) -> None:
    """Invalida el resto de sesiones del usuario (p. ej. tras cambiar contraseña)."""
    q = db.query(UserSession).filter(UserSession.user_id == user_id)
    if keep_token:
        q = q.filter(UserSession.id != keep_token)
    q.delete(synchronize_session=False)
    db.commit()


def get_or_create_preferences(db: Session, user_id: str) -> UserPreferences:
    prefs = db.query(UserPreferences).filter(UserPreferences.user_id == user_id).first()
    if prefs:
        return prefs
    prefs = UserPreferences(user_id=user_id, preferences_json="{}")
    db.add(prefs)
    db.commit()
    db.refresh(prefs)
    return prefs


def get_current_user(
    db: Session = Depends(get_db),
    chatbot_session: Annotated[str | None, Cookie(alias=SESSION_COOKIE)] = None,
) -> User:
    user = get_session_user(db, chatbot_session)
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="No autenticado")
    return user


def get_current_user_optional(
    db: Session = Depends(get_db),
    chatbot_session: Annotated[str | None, Cookie(alias=SESSION_COOKIE)] = None,
) -> User | None:
    return get_session_user(db, chatbot_session)


def require_admin(user: User = Depends(get_current_user)) -> User:
    if not user.is_admin:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Se requiere administrador")
    return user


CurrentUser = Annotated[User, Depends(get_current_user)]
OptionalUser = Annotated[User | None, Depends(get_current_user_optional)]
AdminUser = Annotated[User, Depends(require_admin)]


def ensure_admin_user(db: Session) -> User:
    """Crea o actualiza el usuario admin desde ADMIN_PASSWORD."""
    password = (settings.admin_password or "admin").strip() or "admin"
    admin = db.query(User).filter(User.username == "admin").first()
    if admin is None:
        admin = User(
            username="admin",
            email=None,
            password_hash=hash_password(password),
            is_admin=True,
        )
        db.add(admin)
        db.commit()
        db.refresh(admin)
        get_or_create_preferences(db, admin.id)
        return admin
    if not admin.is_admin:
        admin.is_admin = True
        db.commit()
    get_or_create_preferences(db, admin.id)
    return admin
