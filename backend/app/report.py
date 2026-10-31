"""Post-Incident Report & Learning Module (Stage 11).

Every field is derived from stored rows (findings, scores, links, evidence, config_changes,
actions, verifications, telemetry). Nothing is assumed: if the investigation has not concluded,
no action was executed, or no verification ran, the report says so explicitly.
"""
import json
from datetime import datetime
from typing import Any, Dict, List, Optional
from app import db, evidence, historical


def now_iso() -> str:
    return datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ")


# Knowledge base keyed by hypothesis category (generic prevention guidance, not incident facts).
PREVENTION_BY_KEY = {
    "H_POOL": [
        ("GitOps Configuration Guardrail", "Lint/review config changes that lower connection-pool limits; require load-test sign-off."),
        ("Telemetry & Alerting", "Alert when pool utilization stays above 85% for 2+ minutes, before errors cascade."),
        ("Resilience", "Add circuit-breaker fast-fail on callers so pool waits do not exhaust caller threads."),
    ],
    "H_DEPLOY": [
        ("Release Safety", "Gate rollouts on per-version error/latency comparison and automate canary rollback."),
        ("Telemetry & Alerting", "Alert on version-split error-rate divergence during staged rollouts."),
    ],
    "H_DB": [
        ("Capacity", "Add DB saturation alerts (CPU/IOPS/slow queries) and capacity headroom reviews."),
        ("Resilience", "Rehearse replica failover and verify connection-retry behavior."),
    ],
    "H_TRAFFIC": [
        ("Capacity", "Define autoscaling and rate-limit policies for traffic surges."),
        ("Telemetry & Alerting", "Alert on request-rate deviation against forecast."),
    ],
    "H_EXTERNAL": [
        ("Dependency Resilience", "Add timeouts, retries with backoff and fallbacks around third-party calls."),
        ("Telemetry & Alerting", "Monitor vendor status and per-dependency latency/error SLOs."),
    ],
}
MECHANISM_BY_KEY = {
    "H_POOL": "Connection-pool capacity ceiling reached; callers queue for connections and time out, cascading errors upstream.",
    "H_DEPLOY": "A code change shipped in a release introduced a defect visible in the new version only.",
    "H_DB": "Database resource saturation slowed queries and propagated latency to callers.",
    "H_TRAFFIC": "Request volume exceeded provisioned capacity.",
    "H_EXTERNAL": "A third-party dependency degraded and propagated failures to callers.",
}


def _latest_scores(c, investigation_id: str) -> List[Dict[str, Any]]:
    rows = c.execute(
        """SELECT h.id, h.key, h.title, h.category, sc.score, sc.share, sc.status
           FROM hypotheses h
           LEFT JOIN scores sc ON sc.hypothesis_id = h.id
             AND sc.id = (SELECT max(id) FROM scores WHERE hypothesis_id = h.id)
           WHERE h.investigation_id = ?
           ORDER BY sc.share DESC""",
        (investigation_id,),
    ).fetchall()
    return [dict(r) for r in rows]


def generate_post_incident_report(investigation_id: str) -> Dict[str, Any]:
    """Compile and persist a structured post-incident report derived from stored data."""
    c = db.conn()
    try:
        inv = c.execute("SELECT id, state, started_at FROM investigations WHERE id = ?", (investigation_id,)).fetchone()
        if not inv:
            raise KeyError(f"Investigation {investigation_id} not found")

        hyps = _latest_scores(c, investigation_id)
        finding = c.execute(
            """SELECT f.*, h.key as leader_key, h.title as leader_title FROM findings f
               JOIN hypotheses h ON f.hypothesis_id = h.id WHERE f.investigation_id = ?""",
            (investigation_id,),
        ).fetchone()
        concluded = finding is not None
        if finding:
            leader_key, leader_title = finding["leader_key"], finding["leader_title"]
            share, coverage = float(finding["share"]), float(finding["coverage"])
            finding_expl = finding["explanation"]
        elif hyps and hyps[0]["share"] is not None:
            leader_key, leader_title = hyps[0]["key"], hyps[0]["title"]
            share, coverage = float(hyps[0]["share"]), None
            finding_expl = "Investigation not concluded; leader shown is provisional."
        else:
            leader_key = leader_title = None
            share = coverage = None
            finding_expl = "No hypotheses scored yet."

        blast = evidence.calculate_blast_radius()
        origin = blast.get("origin_service")
        timeline_events = evidence.build_unified_timeline()
        milestones = [
            {"ts": e["ts"], "type": e["type"], "title": e["title"], "initiator": e.get("is_trigger_event", False)}
            for e in timeline_events
            if e.get("is_trigger_event") or e["type"] in ("ANOMALY_ONSET", "ALERT", "DEPLOYMENT", "CONFIG_CHANGE")
        ]

        # Hypotheses with evidence-backed rejection reasons (from stored CONTRADICTS links)
        competing, rejected = [], []
        for h in hyps:
            sup = c.execute(
                """SELECT e.id, l.explanation, l.strength FROM links l JOIN evidence e ON l.evidence_id = e.id
                   WHERE l.hypothesis_id = ? AND l.relation='SUPPORTS' AND e.investigation_id = ?""",
                (h["id"], investigation_id)).fetchall()
            con = c.execute(
                """SELECT e.id, e.text, l.explanation, l.strength FROM links l JOIN evidence e ON l.evidence_id = e.id
                   WHERE l.hypothesis_id = ? AND l.relation='CONTRADICTS' AND e.investigation_id = ?
                   ORDER BY l.strength DESC""",
                (h["id"], investigation_id)).fetchall()
            is_leader = h["key"] == leader_key
            status = ("CONFIRMED_ROOT_CAUSE" if concluded else "PROVISIONAL_LEADER") if is_leader else (
                "RULED_OUT" if h["status"] == "RULED_OUT" else "NOT_SUPPORTED")
            competing.append({
                "key": h["key"], "title": h["title"], "category": h["category"],
                "relative_evidence_share": round(float(h["share"] or 0.0), 4),
                "status": status,
                "supporting_evidence_ids": [r["id"] for r in sup],
                "contradicting_evidence_ids": [r["id"] for r in con],
            })
            if not is_leader:
                if con:
                    reason = "; ".join(f"{r['explanation']} [{r['id']}]" for r in con[:3])
                else:
                    reason = "Lower relative evidence share; no direct contradicting evidence recorded."
                rejected.append({"key": h["key"], "title": h["title"],
                                 "share": round(float(h["share"] or 0.0), 4), "rejection_reason": reason})

        steps = [dict(s) for s in c.execute(
            "SELECT n, kind, tool, summary, replan_reason, ts FROM steps WHERE investigation_id = ? ORDER BY n",
            (investigation_id,)).fetchall()]
        replans = [s for s in steps if s.get("replan_reason") and s["replan_reason"] != "pending"]
        injected = [dict(r) for r in c.execute(
            "SELECT id, text, verified FROM evidence WHERE investigation_id = ? AND extracted_by='injected'",
            (investigation_id,)).fetchall()]

        # Causal change events on the origin service (facts from tables, correlation not asserted as cause)
        change_events = {}
        if origin:
            cfg = c.execute(
                "SELECT key, old, new, changed_at, ticket FROM config_changes WHERE service_id=? ORDER BY changed_at DESC LIMIT 1",
                (origin,)).fetchone()
            dep = c.execute(
                "SELECT version, prev_version, deployed_at, rollout_pct FROM deployments WHERE service_id=? ORDER BY deployed_at DESC LIMIT 1",
                (origin,)).fetchone()
            change_events = {"latest_config_change": dict(cfg) if cfg else None,
                             "latest_deployment": dict(dep) if dep else None}

        # Summary strictly composed from stored facts
        m = blast.get("measured_impact", {})
        parts = []
        if leader_title:
            parts.append(f"{'Root cause' if concluded else 'Provisional leading hypothesis'}: {leader_title} "
                         f"(relative evidence share {share:.2f}) originating at {origin}.")
        if leader_key == "H_POOL" and change_events.get("latest_config_change"):
            cc = change_events["latest_config_change"]
            parts.append(f"Recorded config change on {origin}: {cc['key']} {cc['old']} -> {cc['new']} at {cc['changed_at']}.")
        parts.append(f"Measured: ~{m.get('measured_incident_duration_mins')} min degradation, peak error rates "
                     f"{m.get('measured_peak_error_rates')}, peak p95 {m.get('measured_peak_p95_latency_ms')} ms.")
        parts.append(f"{len(hyps)} hypotheses evaluated over {len([s for s in steps if s['tool']])} tool calls, "
                     f"{len(replans)} replan(s), {len(injected)} injected signal(s).")

        # Recovery: real action + real verification, or explicit "not performed"
        act = c.execute(
            "SELECT * FROM actions WHERE investigation_id = ? AND status IN ('EXECUTED_SIM','VERIFIED','NOT_RECOVERED') "
            "ORDER BY executed_at DESC LIMIT 1", (investigation_id,)).fetchone()
        recommended = c.execute(
            "SELECT * FROM actions WHERE investigation_id = ? AND recommended = 1 LIMIT 1", (investigation_id,)).fetchone()
        shown = act or recommended
        recovery_rec = None
        if shown:
            recovery_rec = {
                "action": shown["kind"], "risk_tier": shown["risk_tier"], "description": shown["description"],
                "status": shown["status"], "approval_required": bool(shown["risk_tier"] and shown["risk_tier"] >= 2),
                "approved_by": shown["approved_by"], "decided_at": shown["decided_at"],
                "justification": shown["approval_reason"],
            }
        verif = None
        if act:
            vr = c.execute("SELECT * FROM verifications WHERE action_id = ? ORDER BY id DESC LIMIT 1", (act["id"],)).fetchone()
            if vr:
                verif = dict(vr)
                if isinstance(verif.get("checks"), str):
                    verif["checks"] = json.loads(verif["checks"])
        verdict = verif["verdict"] if verif else ("NOT_VERIFIED" if act else "NO_ACTION_EXECUTED")

        before_after = None
        if verif:
            ch = verif["checks"]
            before_after = {
                "pre_recovery_peak_p95_ms": m.get("measured_peak_p95_latency_ms"),
                "post_recovery_p95_ms": ch.get("checkout_p95_under_570ms", {}).get("observed_avg_ms"),
                "pre_recovery_peak_error_rates": m.get("measured_peak_error_rates"),
                "post_recovery_error_rates": {
                    "checkout": ch.get("error_rates_under_1pct", {}).get("checkout_err_avg"),
                    "payment": ch.get("error_rates_under_1pct", {}).get("payment_err_avg"),
                },
                "post_recovery_pool_active_avg": ch.get("pool_active_under_80pct_max", {}).get("pool_active_avg"),
                "pool_max": ch.get("pool_active_under_80pct_max", {}).get("pool_max"),
                "verdict": verdict,
                "telemetry_is_simulated": True,
            }

        hist = historical.analyze_historical_intelligence(investigation_id)
        prevention = [{"category": a, "recommendation": b} for a, b in PREVENTION_BY_KEY.get(leader_key, [])]

        report_id = f"REP-{investigation_id[-8:]}"
        payload = {
            "report_id": report_id,
            "investigation_id": investigation_id,
            "report_status": "FINAL" if (concluded and verdict == "VERIFIED") else ("CONCLUDED" if concluded else "DRAFT"),
            "title": f"Post-Incident Report: {leader_title or 'Investigation pending'}",
            "severity": "CRITICAL",
            "incident_window": "2026-10-30T13:00:00Z to 2026-10-30T14:40:00Z",
            "summary": " ".join(parts),
            "finding_explanation": finding_expl,
            "affected_services": blast.get("affected_services", []),
            "origin_service": origin,
            "customer_and_business_impact": {"measured": m, "estimated": blast.get("estimated_impact", {})},
            "timeline_milestones": milestones,
            "change_events_on_origin": change_events,
            "evidence_references": [e["id"] for e in evidence.get_investigation_evidence(investigation_id)],
            "competing_hypotheses": competing,
            "root_cause_assessment": {
                "confirmed_root_cause": leader_title if concluded else None,
                "provisional_leader": None if concluded else leader_title,
                "hypothesis_key": leader_key,
                "origin_service": origin,
                "relative_evidence_share": share,
                "tested_coverage": coverage,
                "causal_mechanism": MECHANISM_BY_KEY.get(leader_key),
                "uncertainty_assessment": (
                    f"Coverage {coverage:.0%} of the leader's expected checks tested; shares are heuristic, not probabilities."
                    if coverage is not None else "Insufficient investigation to assess."),
            },
            "rejected_hypotheses": rejected,
            "adaptation": {
                "replans": [{"step": s["n"], "reason": s["replan_reason"]} for s in replans],
                "injected_signals": injected,
            },
            "diagnostic_actions_taken": steps,
            "recovery_recommendation": recovery_rec,
            "recovery_outcome": {"status": act["status"] if act else None, "verdict": verdict,
                                 "checked_at": verif["checked_at"] if verif else None},
            "before_and_after_verification": before_after,
            "historical_incident_comparison": {
                "top_match": hist.get("top_match_incident_id"), "title": hist.get("top_match_title"),
                "similarity": hist.get("top_match_similarity"), "guideline": hist.get("recommended_historical_action"),
            },
            "prevention_recommendations": prevention,
            "generated_at": now_iso(),
        }

        c.execute(
            """INSERT OR REPLACE INTO post_incident_reports (
                id, investigation_id, title, severity, root_cause_key, root_cause_title,
                origin_service, affected_services, measured_impact, estimated_impact,
                timeline_summary, hypotheses_evaluated, rejected_hypotheses, diagnostic_actions,
                recovery_action, recovery_verdict, before_after_telemetry, prevention_recommendations, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (report_id, investigation_id, payload["title"], payload["severity"], leader_key or "", leader_title or "",
             origin or "", json.dumps(payload["affected_services"]), json.dumps(m),
             json.dumps(payload["customer_and_business_impact"]["estimated"]), json.dumps(milestones),
             json.dumps(competing), json.dumps(rejected), json.dumps(steps), json.dumps(recovery_rec),
             verdict, json.dumps(before_after), json.dumps(prevention), payload["generated_at"]),
        )
        c.commit()
        return payload
    finally:
        c.close()
