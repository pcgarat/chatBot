"""Auth multi-usuario: registro, login, aislamiento de historial."""

from app.auth import hash_password, verify_password
from app.models import Conversation
from app.models_user import User
from app.auth import create_session, SESSION_COOKIE


def test_password_hash_roundtrip():
    h = hash_password("secreto123")
    assert verify_password("secreto123", h)
    assert not verify_password("otra", h)


def test_register_login_me(client):
    r = client.post(
        "/api/auth/register",
        json={"username": "alice", "password": "clave123"},
    )
    assert r.status_code == 201
    assert r.json()["username"] == "alice"
    assert "chatbot_session" in r.cookies

    me = client.get("/api/auth/me")
    assert me.status_code == 200
    assert me.json()["username"] == "alice"

    client.post("/api/auth/logout")
    assert client.get("/api/auth/me").status_code == 401

    bad = client.post("/api/auth/login", json={"username": "alice", "password": "mala"})
    assert bad.status_code == 401

    ok = client.post("/api/auth/login", json={"username": "alice", "password": "clave123"})
    assert ok.status_code == 200
    assert client.get("/api/auth/me").json()["username"] == "alice"


def test_conversations_isolated_per_user(client, db_session):
    # client ya viene autenticado como admin
    r = client.post("/api/conversations", json={"title": "Solo admin"})
    assert r.status_code in (200, 201)
    admin_conv = r.json()["id"]

    reg = client.post(
        "/api/auth/register",
        json={"username": "bob", "password": "clave123"},
    )
    assert reg.status_code == 201
    # cookie de bob sustituye a admin
    listed = client.get("/api/conversations")
    assert listed.status_code == 200
    ids = [c["id"] for c in listed.json()]
    assert admin_conv not in ids

    r2 = client.post("/api/conversations", json={"title": "De bob"})
    assert r2.status_code in (200, 201)
    bob_conv = r2.json()["id"]
    assert client.get(f"/api/conversations/{bob_conv}").status_code == 200
    assert client.get(f"/api/conversations/{admin_conv}").status_code == 404


def test_preferences_roundtrip(client):
    put = client.put(
        "/api/auth/preferences",
        json={"preferences": {"theme": "dark", "fontScale": 1.2}},
    )
    assert put.status_code == 200
    assert put.json()["preferences"]["theme"] == "dark"
    got = client.get("/api/auth/preferences")
    assert got.json()["preferences"]["fontScale"] == 1.2


def test_change_password(client, db_session):
    from app.models_user import UserSession

    reg = client.post(
        "/api/auth/register",
        json={"username": "carol", "password": "antigua1"},
    )
    assert reg.status_code == 201
    user_id = reg.json()["id"]

    user = db_session.query(User).filter(User.id == user_id).first()
    other = create_session(db_session, user)
    other_token = other.id

    bad = client.post(
        "/api/auth/change-password",
        json={"current_password": "mala", "new_password": "nueva123"},
    )
    assert bad.status_code == 400

    short = client.post(
        "/api/auth/change-password",
        json={"current_password": "antigua1", "new_password": "abc"},
    )
    assert short.status_code == 422

    same = client.post(
        "/api/auth/change-password",
        json={"current_password": "antigua1", "new_password": "antigua1"},
    )
    assert same.status_code == 400

    ok = client.post(
        "/api/auth/change-password",
        json={"current_password": "antigua1", "new_password": "nueva123"},
    )
    assert ok.status_code == 204

    assert client.get("/api/auth/me").status_code == 200
    db_session.expire_all()
    assert db_session.query(UserSession).filter(UserSession.id == other_token).first() is None

    client.post("/api/auth/logout")
    assert (
        client.post(
            "/api/auth/login",
            json={"username": "carol", "password": "antigua1"},
        ).status_code
        == 401
    )
    assert (
        client.post(
            "/api/auth/login",
            json={"username": "carol", "password": "nueva123"},
        ).status_code
        == 200
    )

    db_session.expire_all()
    row = db_session.query(User).filter(User.id == user_id).first()
    assert verify_password("nueva123", row.password_hash)


def test_unauthenticated_conversations_rejected(db_session, db_engine):
    from fastapi.testclient import TestClient
    from sqlalchemy.orm import sessionmaker
    from app.main import app
    from app.db import get_db
    from app import db as app_db
    from app.migrate_multi_user import bootstrap_multi_user

    TestSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=db_engine)

    def override_get_db():
        yield db_session

    bootstrap_multi_user(db_session)
    prev = app_db.SessionLocal
    app_db.SessionLocal = TestSessionLocal
    app.dependency_overrides[get_db] = override_get_db
    try:
        with TestClient(app) as c:
            assert c.get("/api/conversations").status_code == 401
    finally:
        app.dependency_overrides.clear()
        app_db.SessionLocal = prev
