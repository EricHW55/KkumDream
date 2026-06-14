from fastapi.testclient import TestClient

from app.main import create_app


def test_health_check() -> None:
    client = TestClient(create_app())
    response = client.get("/api/v1/health")
    assert response.status_code == 200
    assert response.json()["status"] == "ok"


def test_app_config() -> None:
    client = TestClient(create_app())
    response = client.get("/api/v1/app-config")
    assert response.status_code == 200
    data = response.json()
    assert data["ios"]["latestVersion"]
    assert data["ios"]["minSupportedVersion"]
    assert data["ios"]["storeUrl"]


def test_marketing_landing_page() -> None:
    client = TestClient(create_app())
    response = client.get("/")

    assert response.status_code == 200
    assert "text/html" in response.headers["content-type"]
    assert "오늘 꾼 꿈을, 친구에게 선물해요." in response.text
    assert "Google Play" in response.text
    assert "App Store" in response.text
    assert "/static/marketing/app_icon_dawn_moon.png" in response.text


def test_favicon() -> None:
    client = TestClient(create_app())
    response = client.get("/favicon.ico")

    assert response.status_code == 200
    assert response.headers["content-type"].startswith("image/")


def test_support_page() -> None:
    client = TestClient(create_app())
    response = client.get("/support")

    assert response.status_code == 200
    assert "text/html" in response.headers["content-type"]
    assert "꿈드림 지원" in response.text
    assert "계정 및 데이터 삭제 안내" in response.text
    assert "yueric55@gmail.com" in response.text


def test_moderation_admin_page() -> None:
    client = TestClient(create_app())
    response = client.get("/admin/moderation")

    assert response.status_code == 200
    assert "text/html" in response.headers["content-type"]
    assert "신고 관리" in response.text
    assert "ADMIN_API_TOKEN" in response.text
