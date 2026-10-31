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

