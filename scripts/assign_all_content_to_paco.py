#!/usr/bin/env python3
"""Crea el usuario 'paco' y le asigna todo el contenido existente (salvo reglas builtin)."""

from __future__ import annotations

import secrets
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from app.auth import ensure_admin_user, get_or_create_preferences, hash_password
from app.db import SessionLocal, init_db
from app import models  # noqa: F401
from app import models_user  # noqa: F401
from app.models import Conversation, PlannerRulePresetRecord, Rule, WorkspaceProfileRecord
from app.models_user import User
from app.services.rules.seed import (
    FLUX_PROMPT_GUIDE_RULE_ID,
    KREA2_POV_GUIDE_RULE_ID,
    seed_builtin_rules,
)

USERNAME = "paco"
EMAIL = "f.garat@sumauto.com"
BUILTIN = {FLUX_PROMPT_GUIDE_RULE_ID, KREA2_POV_GUIDE_RULE_ID}


def main() -> None:
    password = secrets.token_urlsafe(10)
    init_db()
    db = SessionLocal()
    try:
        ensure_admin_user(db)
        seed_builtin_rules(db)

        user = db.query(User).filter(User.username == USERNAME).first()
        created = user is None
        if user is None:
            user = User(
                username=USERNAME,
                email=EMAIL,
                password_hash=hash_password(password),
                is_admin=False,
            )
            db.add(user)
            db.commit()
            db.refresh(user)
        else:
            user.password_hash = hash_password(password)
            if not user.email:
                user.email = EMAIL
            db.commit()
            db.refresh(user)

        get_or_create_preferences(db, user.id)
        uid = user.id

        n_conv = db.query(Conversation).update(
            {Conversation.user_id: uid}, synchronize_session=False
        )
        n_rules = (
            db.query(Rule)
            .filter(~Rule.id.in_(BUILTIN))
            .update({Rule.user_id: uid}, synchronize_session=False)
        )
        n_prof = db.query(WorkspaceProfileRecord).update(
            {WorkspaceProfileRecord.user_id: uid}, synchronize_session=False
        )
        n_pres = db.query(PlannerRulePresetRecord).update(
            {PlannerRulePresetRecord.user_id: uid}, synchronize_session=False
        )
        db.commit()

        print("created=" + ("yes" if created else "updated"))
        print(f"username={USERNAME}")
        print(f"email={EMAIL}")
        print(f"password={password}")
        print(f"user_id={uid}")
        print(f"conversations_reassigned={n_conv}")
        print(f"rules_reassigned={n_rules}")
        print(f"profiles_reassigned={n_prof}")
        print(f"presets_reassigned={n_pres}")
        print(
            "conversations_owned="
            + str(db.query(Conversation).filter(Conversation.user_id == uid).count())
        )
        print("rules_owned=" + str(db.query(Rule).filter(Rule.user_id == uid).count()))
        print(
            "rules_builtin="
            + str(db.query(Rule).filter(Rule.user_id.is_(None)).count())
        )
    finally:
        db.close()


if __name__ == "__main__":
    main()
