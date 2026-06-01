from fastapi.testclient import TestClient

from app.main import create_app


def test_account_deletion_page() -> None:
    client = TestClient(create_app())

    response = client.get("/account-deletion")

    assert response.status_code == 200
    assert "text/html" in response.headers["content-type"]
    assert "계정 및 데이터 삭제 안내" in response.text
    assert "삭제 요청" in response.text
    assert "yueric55@gmail.com" in response.text
