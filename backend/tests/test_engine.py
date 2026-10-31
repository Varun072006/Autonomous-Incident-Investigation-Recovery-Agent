"""Tests for investigation engine: priors, planning, scoring, stop rules, replan, and absence of scenario literals."""
import inspect
import pytest
import numpy as np
from app import engine, seed


@pytest.fixture(scope="module", autouse=True)
def setup_seed():
    seed.run()


def test_intake_creates_at_least_three_hypotheses():
    inv_id = engine.create()
    res = engine.step(inv_id)
    assert res["kind"] == "INTAKE"
    state = engine.get(inv_id)
    assert len(state["hypotheses"]) >= 3


def test_prior_shares_sum_to_one_and_max_under_limit():
    inv_id = engine.create()
    engine.step(inv_id)
    state = engine.get(inv_id)
    shares = [h["share"] for h in state["hypotheses"]]
    assert abs(sum(shares) - 1.0) < 1e-4
    for h in state["hypotheses"]:
        assert h["share"] <= 0.45, f"Hypothesis {h['key']} exceeds prior share 0.45: {h['share']}"


def test_replan_and_conclude_flow():
    inv_id = engine.create()
    engine.step(inv_id)  # Step 0: Intake

    steps_recorded = []
    replanned = False
    for i in range(1, 10):
        s = engine.step(inv_id)
        steps_recorded.append(s)
        if s.get("replan") and s["replan"]["triggered"]:
            replanned = True
        if s["kind"] == "CONCLUDE":
            break

    state = engine.get(inv_id)
    assert replanned, "A replan should have occurred during investigation"
    assert state["state"] == "CONCLUDED"
    assert state["finding"] is not None
    assert state["finding"]["share"] >= 0.60
    assert state["finding"]["margin"] >= 0.25


def test_engine_determinism():
    seed.run()
    inv1 = engine.run_full_investigation()
    seed.run()
    inv2 = engine.run_full_investigation()
    assert inv1["finding"]["leader_key"] == inv2["finding"]["leader_key"]
    assert abs(inv1["finding"]["share"] - inv2["finding"]["share"]) < 1e-4


def test_no_scenario_literals_in_engine_file():
    with open(inspect.getfile(engine), "r", encoding="utf-8") as f:
        src = f.read()

    forbidden = ["CHG-4821", "INC-0198", "payment-service", "checkout-api"]
    for lit in forbidden:
        assert lit not in src, f"Forbidden scenario literal '{lit}' found in engine.py!"



def _conclude(inv_id):
    for _ in range(14):
        if engine.step(inv_id).get("state_after") in ("CONCLUDED", "INCONCLUSIVE"):
            break


def test_inject_rescores_reopens_and_verifies():
    """Surprise evidence must be linked to hypotheses, change scores, reopen and queue a verification tool."""
    inv_id = engine.create()
    _conclude(inv_id)
    res = engine.inject(inv_id, "log", {"text": "payments-db failover event: replica promoted, disk IOPS saturated"}, "jury")
    assert res["links"] and res["links"][0]["hypothesis_key"] == "H_DB"
    assert res["queued_followup_tool"] == "get_db_metrics"
    st = engine.get(inv_id)
    assert st["state"] == "INVESTIGATING" and st["finding"] is None
    h_db = next(h for h in st["hypotheses"] if h["key"] == "H_DB")
    assert h_db["supporting"] >= 1
    nxt = engine.step(inv_id)
    assert nxt["tool"] == "get_db_metrics"  # re-verifies the claim against fresh telemetry
    assert nxt["replan"]["reason"] == "Verification of injected evidence"


def test_inject_unmatched_text_does_not_change_scores():
    inv_id = engine.create()
    _conclude(inv_id)
    res = engine.inject(inv_id, "note", {"text": "lunch order arrived"}, "jury")
    assert res["links"] == [] and res["leader_before"] == res["leader_after"]
