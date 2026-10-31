"""Tests for TRACEOPS 11-Stage Autonomous Investigation & Recovery Lifecycle and Success Metrics."""
import pytest
from app import db, engine, evidence, historical, metrics_eval, recover, report, seed, tools


@pytest.fixture(autouse=True)
def setup_db():
    seed.run()


def test_stage_1_evidence_collection_and_normalization():
    """Verify Stage 1: Multimodal evidence collection from 12 operational sources with normalized representation."""
    inv_id = engine.create()
    engine.step(inv_id)  # Step 0 intake
    engine.step(inv_id)  # Step 1 first tool run collects evidence

    ev_list = evidence.get_investigation_evidence(inv_id)
    assert len(ev_list) > 0

    first_ev = ev_list[0]
    assert "id" in first_ev
    assert "text" in first_ev
    assert "refs" in first_ev
    assert "extracted_by" in first_ev

    # Test multimodal normalizer
    norm = evidence.normalize_evidence_item(
        source_system="prometheus",
        source_type="metric_anomaly",
        service_name="payment-service",
        timestamp="2026-10-30T13:35:00Z",
        raw_source_ref={"table": "metrics", "ids": [10, 11]},
        normalized_evidence="Connection pool saturation reached 100% (10/10 active connections)",
        trace_id="trc-0061"
    )
    assert norm["evidence_id"].startswith("EV_METR_")
    assert norm["service_name"] == "payment-service"
    assert norm["trace_id"] == "trc-0061"
    assert norm["raw_source_ref"]["table"] == "metrics"


def test_stage_2_timeline_reconstruction():
    """Verify Stage 2: Chronological timeline distinguishing trigger events from cascading consequences."""
    timeline = evidence.build_unified_timeline()
    assert len(timeline) > 0

    # Ensure chronological order
    timestamps = [e["ts"] for e in timeline]
    assert timestamps == sorted(timestamps)

    # Verify trigger event vs consequences labeling
    trigger_events = [e for e in timeline if e.get("is_trigger_event")]
    assert len(trigger_events) > 0
    assert trigger_events[0]["type"] in ("CONFIG_CHANGE", "DEPLOYMENT")
    assert trigger_events[0]["cascade_depth"] == 0

    consequences = [e for e in timeline if e.get("is_consequence")]
    assert len(consequences) > 0
    assert any(c["type"] in ("ANOMALY_ONSET", "ALERT") for c in consequences)


def test_stage_3_multiple_hypothesis_generation():
    """Verify Stage 3: Multiple competing root-cause hypotheses evaluated with Bayesian heuristic shares."""
    inv_id = engine.create()
    res = engine.step(inv_id)

    state = engine.get(inv_id)
    hyps = state["hypotheses"]
    assert len(hyps) == 5

    keys = [h["key"] for h in hyps]
    assert "H_POOL" in keys
    assert "H_DEPLOY" in keys
    assert "H_DB" in keys
    assert "H_TRAFFIC" in keys
    assert "H_EXTERNAL" in keys

    # Verify relative evidence shares sum to 1.0 (heuristic, not probability)
    total_share = sum(h["share"] for h in hyps)
    assert pytest.approx(total_share, abs=0.01) == 1.0


def test_stage_4_autonomous_read_only_investigation():
    """Verify Stage 4: Autonomous read-only diagnostic tools select next action via information gain."""
    inv_id = engine.create()
    engine.step(inv_id)  # Step 0 intake

    step1 = engine.step(inv_id)  # Diagnostic step 1
    assert step1["n"] == 1
    assert step1["tool"] is not None
    assert "candidates" in step1
    assert len(step1["candidates"]) > 1

    # Verify no recovery mutations occur during autonomous investigation
    c = db.ro_conn()
    try:
        mutating_actions = c.execute("SELECT count(*) as cnt FROM actions WHERE investigation_id = ?", (inv_id,)).fetchone()["cnt"]
        # Actions are recommended only upon conclusion or when requested, never executed autonomously
        executed = c.execute("SELECT count(*) as cnt FROM actions WHERE status = 'EXECUTED_SIM'").fetchone()["cnt"]
        assert executed == 0
    finally:
        c.close()


def test_stage_5_root_cause_assessment():
    """Verify Stage 5: Concluded root cause identifies origin, explains mechanism, and rejects alternatives."""
    inv_id = engine.create()
    for _ in range(12):
        engine.step(inv_id)

    state = engine.get(inv_id)
    assert state["state"] == "CONCLUDED"

    finding = state["finding"]
    assert finding is not None
    assert finding["leader_key"] == "H_POOL"
    assert finding["share"] > 0.60
    assert finding["coverage"] >= 0.70
    assert len(finding["evidence_ids"]) > 0


def test_stage_6_historical_incident_intelligence():
    """Verify Stage 6: Compares current signals against past incidents and evaluates remediation applicability."""
    hist = historical.analyze_historical_intelligence()
    assert hist["total_historical_searched"] >= 4
    assert hist["top_match_incident_id"] == "INC-0198"
    assert hist["top_match_similarity"] > 0.50

    top = hist["matched_incidents"][0]
    assert top["incident_id"] == "INC-0198"
    assert top["remediation_applicability"] is True
    assert "INC-0198" in top["applicability_rationale"]
    assert top["previous_recovery_action"] is not None

    # Counter-example: verify alternative past incident is rejected by current evidence
    inc_mem = next(m for m in hist["matched_incidents"] if m["incident_id"] == "INC-0254")
    assert inc_mem["remediation_applicability"] is False
    assert inc_mem["current_evidence_support"] == "CONTRADICTED_BY_EVIDENCE"


def test_stage_7_blast_radius_and_business_impact():
    """Verify Stage 7: Explicitly separates measured operational impact from estimated business impact."""
    blast = evidence.calculate_blast_radius()
    assert "payment-service" in blast["affected_services"]
    assert "checkout-api" in blast["affected_services"]

    measured = blast["measured_impact"]
    assert "directly_affected_services" in measured
    assert "downstream_affected_services" in measured
    assert measured["measured_failed_transactions"] > 0
    assert measured["measured_failed_transactions"] <= measured["measured_sampled_transactions"]
    assert measured["measured_incident_duration_mins"] > 0

    estimated = blast["estimated_impact"]
    assert "estimated_sla_breach_mins" in estimated
    assert "estimated_error_budget_consumed_pct" in estimated


def test_stage_8_and_9_recovery_planning_and_approval_gate():
    """Verify Stages 8 & 9: Risk-classified actions with human approval gate enforcement (HTTP 409)."""
    inv_id = engine.create()
    for _ in range(12):
        engine.step(inv_id)

    actions = recover.recommend(inv_id)
    assert len(actions) >= 4

    tier2_act = next(a for a in actions if a["kind"] == "REVERT_CONFIG")
    assert tier2_act["risk_tier"] == 2
    assert tier2_act["approval_required"] is True
    assert tier2_act["expected_outcome"] != ""

    # Unapproved execution MUST be blocked with status code 409
    blocked_res = recover.execute(tier2_act["id"])
    assert blocked_res["executed"] is False
    assert blocked_res["status_code"] == 409
    assert "without explicit human approval" in blocked_res["message"]

    # Explicit approval
    app_res = recover.approve(tier2_act["id"], by="oncall_lead", reason="Verified connection pool exhaustion")
    assert app_res["approved"] is True

    # Now execution succeeds
    exec_res = recover.execute(tier2_act["id"])
    assert exec_res["executed"] is True
    assert exec_res["mode"] == "SIMULATED"


def test_stage_10_recovery_verification():
    """Verify Stage 10: Fresh telemetry SLA probe over 5 consecutive minutes verifies recovery."""
    inv_id = engine.create()
    for _ in range(12):
        engine.step(inv_id)

    actions = recover.recommend(inv_id)
    act = next(a for a in actions if a["kind"] == "REVERT_CONFIG")
    recover.approve(act["id"], by="oncall_lead", reason="Approved")
    recover.execute(act["id"])

    verif = recover.verify(act["id"])
    assert verif["verdict"] == "VERIFIED"
    assert verif["checks"]["checkout_p95_under_570ms"]["passed"] is True
    assert verif["checks"]["error_rates_under_1pct"]["passed"] is True


def test_stage_11_post_incident_report_generation():
    """Verify Stage 11: Structured post-incident report compiled and preserved in SQLite."""
    inv_id = engine.create()
    for _ in range(12):
        engine.step(inv_id)

    actions = recover.recommend(inv_id)
    act = next(a for a in actions if a["kind"] == "REVERT_CONFIG")
    recover.approve(act["id"], by="oncall_lead", reason="Approved")
    recover.execute(act["id"])
    recover.verify(act["id"])

    rep = report.generate_post_incident_report(inv_id)
    assert rep["investigation_id"] == inv_id
    assert rep["root_cause_assessment"]["hypothesis_key"] == "H_POOL"
    assert len(rep["competing_hypotheses"]) == 5
    assert len(rep["rejected_hypotheses"]) == 4
    assert len(rep["prevention_recommendations"]) >= 2
    assert rep["recovery_outcome"]["verdict"] == "VERIFIED"
    assert rep["before_and_after_verification"]["post_recovery_p95_ms"] < 570
    assert all("[" in r["rejection_reason"] or "Lower relative" in r["rejection_reason"] for r in rep["rejected_hypotheses"])

    # Verify report is preserved in SQLite
    c = db.ro_conn()
    try:
        row = c.execute("SELECT * FROM post_incident_reports WHERE investigation_id = ?", (inv_id,)).fetchone()
        assert row is not None
        assert row["root_cause_key"] == "H_POOL"
    finally:
        c.close()


def test_section_3_success_metrics_engine():
    """Verify Section 3: Empirical measurement of 16 SRE success metrics from SQLite."""
    inv_id = engine.create()
    for _ in range(12):
        engine.step(inv_id)

    actions = recover.recommend(inv_id)
    act = next(a for a in actions if a["kind"] == "REVERT_CONFIG")
    recover.approve(act["id"], by="oncall_lead", reason="Approved")
    recover.execute(act["id"])
    recover.verify(act["id"])

    metrics = metrics_eval.compute_success_metrics()
    assert "investigation_effectiveness" in metrics
    assert "recovery_effectiveness" in metrics
    assert "evidence_quality" in metrics
    assert "adaptability" in metrics

    inv_eff = metrics["investigation_effectiveness"]
    assert inv_eff["root_cause_accuracy"] == 1.0
    assert inv_eff["evidence_coverage"] > 0.70
    assert inv_eff["mean_time_to_investigate_steps"] >= 5.0
    assert inv_eff["false_conclusion_rate"] == 0.0

    rec_eff = metrics["recovery_effectiveness"]
    assert rec_eff["recovery_success_rate"] == 1.0
    assert rec_eff["recovery_verification_rate"] == 1.0

    ev_qual = metrics["evidence_quality"]
    assert ev_qual["evidence_traceability"] == 1.0
    assert ev_qual["evidence_source_coverage"] == 1.0
    assert ev_qual["contradictory_evidence_identified"] is True


def test_report_does_not_fabricate_when_nothing_happened():
    """A fresh investigation must not claim a root cause, recovery or verification."""
    inv_id = engine.create()
    rep = report.generate_post_incident_report(inv_id)
    assert rep["report_status"] == "DRAFT"
    assert rep["root_cause_assessment"]["confirmed_root_cause"] is None
    assert rep["recovery_outcome"]["verdict"] == "NO_ACTION_EXECUTED"
    assert rep["before_and_after_verification"] is None
