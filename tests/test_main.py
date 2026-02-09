"""Tests del punto de entrada y raíz."""
def test_index_returns_200(client):
    r = client.get("/")
    assert r.status_code == 200


def test_index_returns_html_when_static_exists(client):
    r = client.get("/")
    assert r.status_code == 200
    # Si la app sirve index.html, el content-type es text/html
    ct = r.headers.get("content-type", "")
    if "text/html" in ct:
        assert b"Chat" in r.content or b"chat" in r.content or b"<!DOCTYPE" in r.content
