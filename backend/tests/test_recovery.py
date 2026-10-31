"""Tests for risk tiers, approval gates, simulated execution, verification, and reopening."""
import pytest
from app import engine, recover, seed


@pytest.fixture(scope="module", autouse=True)
def setup_completed_investigation():
    seed.run()
    inv = engine.run_full_investigation()
    return inv["id"]


def test_action_catalog_tiers(setup_completed_investigation):
    inv_id = setup_completed_investigation
    actions = recover.recommend(inv_id)
    assert len(actions) >= 4
    tier_map = {a["kind"]: a["risk_tier"] for a in actions}
    assert tier_map["NOTIFY_ONCALL"] == 1
    assert tier_map["REVERT_CONFIG"] == 2
    assert tier_map["ROLLBACK_DEPLOY"] == 3


def test_tier2_execution_without_approval_returns_409(setup_completed_investigation):
    inv_id = setup_completed_investigation
    actions = recover.recommend(inv_id)
    revert_act = next(a for a in actions if a["kind"] == "REVERT_CONFIG")

    res = recover.execute(revert_act["id"])
    assert res["executed"] is False
    assert res["status_code"] == 409


def test_tier3_approval_without_reason_rejected(setup_completed_investigation):
    inv_id = setup_completed_investigation
    actions = recover.recommend(inv_id)
    rollback_act = next(a for a in actions if a["kind"] == "ROLLBACK_DEPLOY")

    res = recover.approve(rollback_act["id"], by="lead", reason="")
    assert res["approved"] is False
    assert res["error"] == "REASON_REQUIRED"


def test_verified_flow_for_revert_config(setup_completed_investigation):
    inv_id = setup_completed_investigation
    actions = recover.recommend(inv_id)
    revert_act = next(a for a in actions if a["kind"] == "REVERT_CONFIG")

    # Approve
    app_res = recover.approve(revert_act["id"], by="sre_lead", reason="Reverting pool downscale")
    assert app_res["approved"] is True

    # Execute
    exec_res = recover.execute(revert_act["id"])
    assert exec_res["executed"] is True
    assert exec_res["mode"] == "SIMULATED"

    # Verify
    ver_res = recover.verify(revert_act["id"])
    assert ver_res["verdict"] == "VERIFIED"
    assert ver_res["checks"]["checkout_p95_under_570ms"]["passed"] is True
    assert ver_res["checks"]["error_rates_under_1pct"]["passed"] is True
    assert ver_res["checks"]["pool_active_under_80pct_max"]["passed"] is True


def test_wrong_action_returns_not_recovered_and_reopens(setup_completed_investigation):
    inv_id = setup_completed_investigation
    actions = recover.recommend(inv_id)
    rollback_act = next(a for a in actions if a["kind"] == "ROLLBACK_DEPLOY")

    # Approve with required reason
    recover.approve(rollback_act["id"], by="sre_lead", reason="Attempt canary rollback")
    exec_res = recover.execute(rollback_act["id"])
    assert exec_res["executed"] is True

    ver_res = recover.verify(rollback_act["id"])
    assert ver_res["verdict"] == "NOT_RECOVERED"

    # Reopen
    reopen_res = engine.reopen(inv_id, rollback_act["id"])
    assert reopen_res["reopened"] is True
    cur_state = engine.get(inv_id)
    assert cur_state["state"] == "INVESTIGATING"


def test_audit_log_hash_chain():
    report = recover.verify_audit_chain()
    assert report["verified"] is True
    assert report["status"] == "TAMPER_EVIDENT_CHAIN_VALID"

