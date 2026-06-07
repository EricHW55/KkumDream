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
