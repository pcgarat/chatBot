"""Tests del CRUD de reglas (biblioteca)."""
from app.crud import create_rule
from app.crud import delete_rule
from app.crud import get_rule
from app.crud import list_rules
from app.crud import update_rule


def test_create_rule(db_session):
    """POST /api/rules crea una regla y devuelve id, title, content."""
    r = create_rule(db_session, title="Mi regla", content="Contenido aquí.")
    assert r.id
    assert r.title == "Mi regla"
    assert r.content == "Contenido aquí."


def test_list_rules_empty(client):
    """GET /api/rules sin reglas devuelve lista vacía."""
    r = client.get("/api/rules")
    assert r.status_code == 200
    assert r.json() == []


def test_list_rules_after_create(client, db_session):
    """GET /api/rules devuelve las reglas creadas."""
    create_rule(db_session, title="A", content="Contenido A")
    create_rule(db_session, title="B", content="Contenido B")
    r = client.get("/api/rules")
    assert r.status_code == 200
    data = r.json()
    assert len(data) >= 2
    titles = [x["title"] for x in data]
    assert "A" in titles and "B" in titles


def test_get_rule(client, db_session):
    """GET /api/rules/{id} devuelve la regla."""
    rule = create_rule(db_session, title="T", content="C")
    r = client.get(f"/api/rules/{rule.id}")
    assert r.status_code == 200
    assert r.json()["id"] == rule.id
    assert r.json()["title"] == "T"
    assert r.json()["content"] == "C"


def test_get_rule_404(client):
    """GET /api/rules/{id} con id inexistente devuelve 404."""
    r = client.get("/api/rules/00000000-0000-0000-0000-000000000000")
    assert r.status_code == 404


def test_post_rule(client):
    """POST /api/rules crea regla y devuelve 201."""
    r = client.post("/api/rules", json={"title": "Nueva", "content": "Texto"})
    assert r.status_code == 201
    data = r.json()
    assert data["title"] == "Nueva"
    assert data["content"] == "Texto"
    assert data["id"]


def test_put_rule(client, db_session):
    """PUT /api/rules/{id} actualiza la regla."""
    rule = create_rule(db_session, title="Antes", content="Antes")
    r = client.put(f"/api/rules/{rule.id}", json={"title": "Después", "content": "Después"})
    assert r.status_code == 200
    assert r.json()["title"] == "Después"
    assert r.json()["content"] == "Después"
    r2 = client.get(f"/api/rules/{rule.id}")
    assert r2.json()["title"] == "Después"


def test_put_rule_partial(client, db_session):
    """PUT /api/rules/{id} con solo title actualiza solo title."""
    rule = create_rule(db_session, title="T", content="C")
    r = client.put(f"/api/rules/{rule.id}", json={"title": "Nuevo título"})
    assert r.status_code == 200
    assert r.json()["title"] == "Nuevo título"
    assert r.json()["content"] == "C"


def test_delete_rule(client, db_session):
    """DELETE /api/rules/{id} elimina la regla y devuelve 204."""
    rule = create_rule(db_session, title="X", content="Y")
    r = client.delete(f"/api/rules/{rule.id}")
    assert r.status_code == 204
    r2 = client.get(f"/api/rules/{rule.id}")
    assert r2.status_code == 404


def test_delete_rule_404(client):
    """DELETE /api/rules/{id} con id inexistente devuelve 404."""
    r = client.delete("/api/rules/00000000-0000-0000-0000-000000000000")
    assert r.status_code == 404
