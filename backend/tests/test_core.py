"""P10 Acceptance Test Checklist:
The single test file that validates all requirements of TRACEOPS build plan.
This is the ONLY file in the repository permitted to know the seeded root cause answer.
"""
import inspect
import json
import pytest
from app import db, engine, evidence, llm, recover, seed, tools


@pytest.fixture(scope="module", autouse=True)
def run_clean_seed():
    seed.run()


def test_p10_full_acceptance_checklist():
    # 1. At least 3 hypotheses at intake
    inv_id = engine.create()
    step0 = engine.step(inv_id)
    assert step0["kind"] == "INTAKE"
    intake_state = engine.get(inv_id)
    assert len(intake_state["hypotheses"]) >= 3, "Intake must create at least 3 hypotheses"

    # Prior shares sum to 1.0 (within float tolerance) and max share <= 0.45
    shares = [h["share"] for h in intake_state["hypotheses"]]
    assert abs(sum(shares) - 1.0) < 1e-3, f"Prior shares must sum to 1.0, got {sum(shares)}"
    assert max(shares) <= 0.45, f"No hypothesis may start above 0.45 share, got {max(shares)}"

    # 2. Autonomous investigation loop
    # Must record at least 5 real tool calls
    steps_list = []
    replanned = False
    for _ in range(12):
        s = engine.step(inv_id)
        steps_list.append(s)
        if s.get("replan") and s["replan"]["triggered"]:
            replanned = True
        if s["kind"] == "CONCLUDE":
            break

    tool_call_steps = [s for s in steps_list if s["kind"] in ("TOOL_CALL", "CONCLUDE") and s.get("tool")]
    assert len(tool_call_steps) >= 5, f"Expected at least 5 real tool calls, got {len(tool_call_steps)}"
    assert replanned is True, "A replan must have occurred during the investigation"

    # 3. Concluded category matches seeded cause (CONNECTION_POOL / H_POOL)
    # THIS TEST FILE IS THE ONLY PLACE THAT KNOWS THE ANSWER
    final_state = engine.get(inv_id)
    assert final_state["state"] == "CONCLUDED", f"Investigation should conclude, got {final_state['state']}"
    finding = final_state["finding"]
    assert finding is not None
    assert finding["leader_key"] == "H_POOL", f"Expected H_POOL as concluded root cause, got {finding['leader_key']}"

    # 4. No scenario literals in engine.py, tools.py or llm.py
    for mod in [engine, tools, llm]:
        src = inspect.getsource(mod)
        assert "CHG-4821" not in src, f"Scenario ticket literal found in {mod.__name__}"
        assert "INC-0198" not in src, f"Scenario incident literal found in {mod.__name__}"
        assert "tax-calculation fallback" not in src, f"Scenario log literal found in {mod.__name__}"

    # 5. Every evidence ID in conclusion resolves to raw database rows
    ev_pack = evidence.get_investigation_evidence(inv_id)
    assert len(ev_pack) > 0
    for ev in ev_pack:
        if ev["refs"]:
            resolved = evidence.resolve_raw_records_for_evidence(ev["refs"])
            assert len(resolved) > 0, f"Evidence {ev['id']} refs failed to resolve to raw rows"

    # 6. Recommendation and Tiered Human Approval
    actions = recover.recommend(inv_id)
    assert len(actions) >= 4
    revert_act = next(a for a in actions if a["kind"] == "REVERT_CONFIG")
    rollback_act = next(a for a in actions if a["kind"] == "ROLLBACK_DEPLOY")

    # Tier 2 execution without approval returns 409
    unapp_res = recover.execute(revert_act["id"])
    assert unapp_res["executed"] is False
    assert unapp_res["status_code"] == 409

    # Tier 3 approval without written reason is rejected
    no_reason_res = recover.approve(rollback_act["id"], by="operator", reason="")
    assert no_reason_res["approved"] is False

    # 7. Approve -> Execute -> Verify gives VERIFIED for REVERT_CONFIG
    recover.approve(revert_act["id"], by="lead_sre", reason="Reverting pool config downscale to restore capacity")
    exec_res = recover.execute(revert_act["id"])
    assert exec_res["executed"] is True
    assert exec_res["mode"] == "SIMULATED"

    ver_res = recover.verify(revert_act["id"])
    assert ver_res["verdict"] == "VERIFIED"
    assert ver_res["checks"]["checkout_p95_under_570ms"]["passed"] is True
    assert ver_res["checks"]["error_rates_under_1pct"]["passed"] is True
    assert ver_res["checks"]["pool_active_under_80pct_max"]["passed"] is True

    # 8. Wrong action (ROLLBACK_DEPLOY) gives NOT_RECOVERED, which reopens investigation
    recover.approve(rollback_act["id"], by="lead_sre", reason="Testing rollback hypothesis")
    recover.execute(rollback_act["id"])
    ver_wrong = recover.verify(rollback_act["id"])
    assert ver_wrong["verdict"] == "NOT_RECOVERED"

    engine.reopen(inv_id, rollback_act["id"])
    reopened_state = engine.get(inv_id)
    assert reopened_state["state"] == "INVESTIGATING"

    # 9. Injecting evidence triggers replan
    inj_res = engine.inject(inv_id, "alert", {"text": "Gateway latency threshold exceeded"})
    assert inj_res["status"] == "INJECTED_AND_REPLANNED"

    # 10. Audit log integrity
    audit_check = recover.verify_audit_chain()
    assert audit_check["verified"] is True

