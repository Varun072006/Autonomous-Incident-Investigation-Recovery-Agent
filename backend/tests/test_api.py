"""Smoke tests for all FastAPI endpoints using TestClient."""
import pytest
from fastapi.testclient import TestClient
from app.main import app
from app import seed

client = TestClient(app)


@pytest.fixture(scope="module", autouse=True)
def setup_db():
    seed.run()


def test_health_endpoint():
    res = client.get("/api/health")
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "ok"
    assert data["db_initialized"] is True


def test_incident_endpoint():
    res = client.get("/api/incident")
    assert res.status_code == 200
    data = res.json()
    assert data["severity"] == "CRITICAL"
    assert data["blast_radius"] >= 1


def test_graph_endpoint():
    res = client.get("/api/graph")
    assert res.status_code == 200
    data = res.json()
    assert "nodes" in data
    assert "edges" in data
    assert len(data["nodes"]) >= 8


def test_timeline_endpoint():
    res = client.get("/api/timeline")
    assert res.status_code == 200
    data = res.json()
    assert len(data) > 0
    assert "type" in data[0]
    assert "ts" in data[0]


def test_metrics_endpoint():
    res = client.get("/api/metrics?service=checkout-api&metric=p95_latency_ms")
    assert res.status_code == 200
    data = res.json()
    assert len(data) > 0


def test_investigation_api_lifecycle():
    # 1. Create
    create_res = client.post("/api/investigation")
    assert create_res.status_code == 200
    inv_id = create_res.json()["id"]

    # 2. Step 0 (Intake)
    step0_res = client.post(f"/api/investigation/{inv_id}/step")
    assert step0_res.status_code == 200
    assert step0_res.json()["kind"] == "INTAKE"

    # 3. Get state
    get_res = client.get(f"/api/investigation/{inv_id}")
    assert get_res.status_code == 200
    assert len(get_res.json()["hypotheses"]) >= 3

    # 4. Step 1 (Tool Call)
    step1_res = client.post(f"/api/investigation/{inv_id}/step")
    assert step1_res.status_code == 200

    # 5. Evidence
    ev_res = client.get(f"/api/investigation/{inv_id}/evidence")
    assert ev_res.status_code == 200

    # 6. Inject
    inj_res = client.post(
        f"/api/investigation/{inv_id}/inject",
        json={"type": "alert", "payload": {"text": "Spike in 503 errors"}, "actor": "tester"}
    )
    assert inj_res.status_code == 200

    # 7. Proof
    proof_res = client.get(f"/api/investigation/{inv_id}/proof")
    assert proof_res.status_code == 200
    assert "integrity_manifest" in proof_res.json()


def test_actions_and_admin_outage_endpoints():
    # Reset and seed for clean action check
    seed.run()
    c_res = client.post("/api/investigation")
    inv_id = c_res.json()["id"]
    client.post(f"/api/investigation/{inv_id}/step")

    act_res = client.get(f"/api/actions?investigation={inv_id}")
    assert act_res.status_code == 200
    actions = act_res.json()
    assert len(actions) >= 4

    # Outage toggle
    out_res = client.post("/api/admin/outage", json={"tool": "get_alerts", "enabled": True})
    assert out_res.status_code == 200
    assert "get_alerts" in out_res.json()["active_outages"]

    # Restore outage
    client.post("/api/admin/outage", json={"tool": "get_alerts", "enabled": False})


def test_audit_verify_endpoint():
    res = client.get("/api/audit/verify")
    assert res.status_code == 200
    assert res.json()["verified"] is True

