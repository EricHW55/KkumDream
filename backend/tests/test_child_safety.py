from fastapi.testclient import TestClient

from app.main import create_app


def test_child_safety_page() -> None:
    client = TestClient(create_app())

    response = client.get("/child-safety")

    assert response.status_code == 200
    assert "text/html" in response.headers["content-type"]
    assert "Child Safety Standards" in response.text
    assert "child sexual abuse and exploitation" in response.text
    assert "yueric55@gmail.com" in response.text
