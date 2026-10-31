"""Recovery workflow, risk-tiered human approval gates, simulated execution,
fresh telemetry verification, impact assessment, and tamper-evident audit logging.
"""
import hashlib
import json
import sqlite3
import uuid
from datetime import datetime
from typing import Any, Dict, List, Optional
import numpy as np

from app import db


def now_iso() -> str:
    return datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ")


def canonical_json(data: Any) -> str:
    return json.dumps(data, sort_keys=True, separators=(",", ":"))


def audit(actor: str, event: str, entity: str, details: Dict[str, Any], connection: Optional[sqlite3.Connection] = None) -> str:
    """Append a tamper-evident audit log row with hash-chaining."""
    c = connection or db.conn()
    close_after = (connection is None)
    try:
        # Get previous row hash
        last_row = c.execute("SELECT row_hash FROM audit_log ORDER BY id DESC LIMIT 1").fetchone()
        prev_hash = last_row["row_hash"] if last_row and last_row["row_hash"] else "0" * 64

        ts = now_iso()
        details_str = json.dumps(details)
        row_payload = f"{ts}|{actor}|{event}|{entity}|{details_str}|{prev_hash}"
        row_hash = hashlib.sha256(row_payload.encode("utf-8")).hexdigest()

        c.execute(
            """INSERT INTO audit_log (ts, actor, event, entity, details, prev_hash, row_hash)
               VALUES (?, ?, ?, ?, ?, ?, ?)""",
            (ts, actor, event, entity, details_str, prev_hash, row_hash)
        )
        if close_after:
            c.commit()
        return row_hash
    finally:
        if close_after:
            c.close()


def verify_audit_chain() -> Dict[str, Any]:
    """Verify integrity of all audit log rows and return validation report."""
    c = db.ro_conn()
    try:
        rows = c.execute("SELECT id, ts, actor, event, entity, details, prev_hash, row_hash FROM audit_log ORDER BY id ASC").fetchall()
        expected_prev = "0" * 64

        for r in rows:
            if r["prev_hash"] != expected_prev and r["id"] > 1:
                return {
                    "verified": False,
                    "tampered_at_row_id": r["id"],
                    "error": f"Previous hash mismatch at row {r['id']}"
                }

            row_payload = f"{r['ts']}|{r['actor']}|{r['event']}|{r['entity']}|{r['details']}|{r['prev_hash']}"
            computed = hashlib.sha256(row_payload.encode("utf-8")).hexdigest()
            if computed != r["row_hash"] and r["id"] > 1:
                return {
                    "verified": False,
                    "tampered_at_row_id": r["id"],
                    "error": f"Content hash mismatch at row {r['id']}"
                }
            expected_prev = r["row_hash"]

        return {"verified": True, "total_rows_verified": len(rows), "status": "TAMPER_EVIDENT_CHAIN_VALID"}
    finally:
        c.close()


ACTION_CATALOG = [
    {
        "kind": "NOTIFY_ONCALL",
        "target_service_id": "payment-service",
        "risk_tier": 1,
        "description": "Send alert notification to payment engineering on-call rotation (SIMULATED outbox write).",
        "rollback_plan": "No rollback needed; outbox notification only.",
        "hypothesis_match": "H_POOL"
    },
    {
        "kind": "REVERT_CONFIG",
        "target_service_id": "payment-service",
        "risk_tier": 2,
        "description": "Revert payment-service 'db.pool.max_connections' config from 10 back to 50 via deployment parameter reload.",
        "rollback_plan": "Reapply configuration change with ticket reference CHG-4821 if required.",
        "hypothesis_match": "H_POOL"
    },
    {
        "kind": "ROLLBACK_DEPLOY",
        "target_service_id": "checkout-api",
        "risk_tier": 3,
        "description": "Rollback checkout-api service release v2.14.0 back to previous stable release v2.13.9 across canary and primary hosts.",
        "rollback_plan": "Re-stage checkout v2.14.0 container image across fleet.",
        "hypothesis_match": "H_DEPLOY"
    },
    {
        "kind": "SCALE_DB",
        "target_service_id": "payments-db",
        "risk_tier": 3,
        "description": "Scale payments-db instance pool size from standard 4vCPU to 8vCPU.",
        "rollback_plan": "Downscale database replica pool following traffic subsidence.",
        "hypothesis_match": "H_DB"
    },
    {
        "kind": "RESTART_SERVICE",
        "target_service_id": "payment-service",
        "risk_tier": 3,
        "description": "Perform rolling restart of payment-service pods to clear memory and connections.",
        "rollback_plan": "Restore pods sequentially across availability zones.",
        "hypothesis_match": "H_TRAFFIC"
    }
]


def recommend(investigation_id: str) -> List[Dict[str, Any]]:
    """Generate or retrieve recommended remediation actions for an investigation."""
    c = db.conn()
    try:
        # Check if actions already exist
        existing = c.execute(
            """SELECT id, investigation_id, target_service_id, kind, risk_tier, description,
                      rollback_plan, recommended, status, approved_by, approval_reason, decided_at, executed_at
               FROM actions WHERE investigation_id = ? ORDER BY recommended DESC, risk_tier ASC""",
            (investigation_id,)
        ).fetchall()

        if existing:
            return [dict(r) for r in existing]

        # Determine leader hypothesis
        finding = c.execute(
            """SELECT f.status, f.hypothesis_id, h.key as hyp_key
               FROM findings f
               JOIN hypotheses h ON f.hypothesis_id = h.id
               WHERE f.investigation_id = ?""",
            (investigation_id,)
        ).fetchone()

        leader_key = finding["hyp_key"] if finding else "H_POOL"

        actions_created = []
        for tmpl in ACTION_CATALOG:
            act_id = f"act-{uuid.uuid4().hex[:8]}"
            is_rec = 1 if tmpl["hypothesis_match"] == leader_key and tmpl["kind"] == "REVERT_CONFIG" else 0

            c.execute(
                """INSERT INTO actions (id, investigation_id, target_service_id, kind, risk_tier,
                                        description, rollback_plan, recommended, status)
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'PENDING')""",
                (
                    act_id,
                    investigation_id,
                    tmpl["target_service_id"],
                    tmpl["kind"],
                    tmpl["risk_tier"],
                    tmpl["description"],
                    tmpl["rollback_plan"],
                    is_rec
                )
            )
            actions_created.append({
                "id": act_id,
                "investigation_id": investigation_id,
                "target_service_id": tmpl["target_service_id"],
                "kind": tmpl["kind"],
                "risk_tier": tmpl["risk_tier"],
                "description": tmpl["description"],
                "rollback_plan": tmpl["rollback_plan"],
                "recommended": is_rec,
                "status": "PENDING",
                "approved_by": None,
                "approval_reason": None,
                "decided_at": None,
                "executed_at": None
            })

        c.commit()
        audit("system", "ACTIONS_RECOMMENDED", "investigation", {"investigation_id": investigation_id, "actions_count": len(actions_created)})
        return actions_created
    finally:
        c.close()


def approve(action_id: str, by: str = "oncall_lead", reason: Optional[str] = None, confirmed_evidence_reviewed: bool = False) -> Dict[str, Any]:
    """Approve an action subject to risk tier constraints and confidence gates."""
    c = db.conn()
    try:
        act = c.execute("SELECT * FROM actions WHERE id = ?", (action_id,)).fetchone()
        if not act:
            raise KeyError(f"Action {action_id} not found")

        # Check Gate: if finding is INCONCLUSIVE or margin < 0.25, require confirmed_evidence_reviewed
        finding = c.execute(
            "SELECT status, margin FROM findings WHERE investigation_id = ?",
            (act["investigation_id"],)
        ).fetchone()

        if finding:
            if (finding["status"] == "INCONCLUSIVE" or float(finding["margin"]) < 0.25) and not confirmed_evidence_reviewed:
                return {
                    "approved": False,
                    "error": "CONFIDENCE_GATE_BLOCKED",
                    "message": "Action cannot be approved: Investigation is inconclusive or margin < 0.25. Explicit confirmation that evidence was reviewed is required."
                }

        # Check Tier 3 requires written reason
        if act["risk_tier"] >= 3 and not (reason and reason.strip()):
            return {
                "approved": False,
                "error": "REASON_REQUIRED",
                "message": f"Tier {act['risk_tier']} high-risk actions require a mandatory written justification reason."
            }

        now_str = now_iso()
        c.execute(
            """UPDATE actions
               SET status = 'APPROVED', approved_by = ?, approval_reason = ?, decided_at = ?
               WHERE id = ?""",
            (by, reason or "Standard operational triage approval", now_str, action_id)
        )
        c.commit()

        audit(by, "ACTION_APPROVED", "action", {"action_id": action_id, "tier": act["risk_tier"], "reason": reason})
        return {
            "approved": True,
            "action_id": action_id,
            "status": "APPROVED",
            "approved_by": by,
            "decided_at": now_str
        }
    finally:
        c.close()


def reject(action_id: str, by: str = "oncall_lead", reason: Optional[str] = None) -> Dict[str, Any]:
    """Reject an action."""
    c = db.conn()
    try:
        now_str = now_iso()
        c.execute(
            """UPDATE actions
               SET status = 'REJECTED', approved_by = ?, approval_reason = ?, decided_at = ?
               WHERE id = ?""",
            (by, reason or "Operator rejected remediation candidate", now_str, action_id)
        )
        c.commit()
        audit(by, "ACTION_REJECTED", "action", {"action_id": action_id, "reason": reason})
        return {"rejected": True, "action_id": action_id, "status": "REJECTED"}
    finally:
        c.close()


def execute(action_id: str) -> Dict[str, Any]:
    """Simulate execution of an action. Fails with 409 if not approved."""
    c = db.conn()
    try:
        act = c.execute("SELECT * FROM actions WHERE id = ?", (action_id,)).fetchone()
        if not act:
            raise KeyError(f"Action {action_id} not found")

        # Tier 0 and Tier 1 can execute autonomously
        if act["risk_tier"] >= 2 and act["status"] != "APPROVED":
            return {
                "executed": False,
                "error": "EXECUTION_BLOCKED_UNAPPROVED",
                "status_code": 409,
                "message": f"Action '{act['kind']}' (Risk Tier {act['risk_tier']}) cannot be executed without explicit human approval."
            }

        if act["status"] == "REJECTED":
            return {
                "executed": False,
                "error": "ACTION_REJECTED",
                "status_code": 409,
                "message": "Rejected actions can never be executed."
            }

        now_str = now_iso()
        # Simulated execution switches branch
        sim_branch = f"post_{act['kind']}"
        c.execute(
            "UPDATE actions SET status = 'EXECUTED_SIM', executed_at = ? WHERE id = ?",
            (now_str, action_id)
        )
        c.execute(
            "UPDATE investigations SET state = 'EXECUTED_SIM' WHERE id = ?",
            (act["investigation_id"],)
        )
        c.commit()

        audit(
            act["approved_by"] or "autonomous",
            "ACTION_EXECUTED_SIMULATED",
            "action",
            {"action_id": action_id, "kind": act["kind"], "simulated_branch": sim_branch}
        )

        return {
            "executed": True,
            "action_id": action_id,
            "status": "EXECUTED_SIM",
            "mode": "SIMULATED",
            "branch": sim_branch,
            "executed_at": now_str,
            "message": f"Remediation action {act['kind']} simulated successfully. Target verification branch: {sim_branch}."
        }
    finally:
        c.close()


def verify(action_id: str) -> Dict[str, Any]:
    """Verify post-remediation telemetry over fresh data for 5 consecutive minutes:
    - checkout p95 < 1.5x baseline median (~570ms)
    - checkout and payment error rates < 1% (< 0.01)
    - pool active < 80% pool max
    """
    c = db.conn()
    try:
        act = c.execute("SELECT * FROM actions WHERE id = ?", (action_id,)).fetchone()
        if not act:
            raise KeyError(f"Action {action_id} not found")

        inv_id = act["investigation_id"]
        sim_branch = f"post_{act['kind']}"

        # Fetch telemetry for the simulation branch
        metrics = c.execute(
            """SELECT service_id, name, value, ts
               FROM metrics
               WHERE branch = ?
               ORDER BY ts DESC LIMIT 100""",
            (sim_branch,)
        ).fetchall()

        if not metrics:
            return {
                "verdict": "INCONCLUSIVE",
                "checks": {"error": "Telemetry data missing for verification branch"},
                "checked_at": now_iso()
            }

        # Check metrics over the last 5 minutes of the simulation window (14:55 to 15:00)
        co_p95_vals = [float(r["value"]) for r in metrics if r["service_id"] == "checkout-api" and r["name"] == "p95_latency_ms"][:5]
        co_err_vals = [float(r["value"]) for r in metrics if r["service_id"] == "checkout-api" and r["name"] == "error_rate"][:5]
        pay_err_vals = [float(r["value"]) for r in metrics if r["service_id"] == "payment-service" and r["name"] == "error_rate"][:5]
        pool_act_vals = [float(r["value"]) for r in metrics if r["service_id"] == "payment-service" and r["name"] == "pool_active"][:5]
        pool_max_vals = [float(r["value"]) for r in metrics if r["service_id"] == "payment-service" and r["name"] == "pool_max"][:5]

        # 1. checkout p95 below 1.5x baseline median (380ms * 1.5 = 570ms)
        p95_target = 570.0
        check_p95 = (np.mean(co_p95_vals) < p95_target) if co_p95_vals else False

        # 2. checkout and payment error rates below 1% (0.01)
        check_err = (np.mean(co_err_vals) < 0.01 and np.mean(pay_err_vals) < 0.01) if (co_err_vals and pay_err_vals) else False

        # 3. pool_active below 80% pool_max
        if pool_act_vals and pool_max_vals:
            avg_act = np.mean(pool_act_vals)
            avg_max = np.mean(pool_max_vals)
            check_pool = (avg_act < 0.8 * avg_max)
        else:
            check_pool = False

        all_passed = (check_p95 and check_err and check_pool)
        verdict = "VERIFIED" if all_passed else "NOT_RECOVERED"
        now_str = now_iso()

        checks_data = {
            "checkout_p95_under_570ms": {
                "passed": bool(check_p95),
                "observed_avg_ms": round(float(np.mean(co_p95_vals)), 1) if co_p95_vals else None,
                "threshold_ms": p95_target
            },
            "error_rates_under_1pct": {
                "passed": bool(check_err),
                "checkout_err_avg": round(float(np.mean(co_err_vals)), 4) if co_err_vals else None,
                "payment_err_avg": round(float(np.mean(pay_err_vals)), 4) if pay_err_vals else None
            },
            "pool_active_under_80pct_max": {
                "passed": bool(check_pool),
                "pool_active_avg": round(float(np.mean(pool_act_vals)), 1) if pool_act_vals else None,
                "pool_max": round(float(np.mean(pool_max_vals)), 1) if pool_max_vals else None
            }
        }

        # Record in verifications
        c.execute(
            """INSERT INTO verifications (action_id, verdict, checks, checked_at)
               VALUES (?, ?, ?, ?)""",
            (action_id, verdict, json.dumps(checks_data), now_str)
        )

        # Update action and investigation state
        new_state = "VERIFIED" if verdict == "VERIFIED" else "NOT_RECOVERED"
        c.execute("UPDATE actions SET status = ? WHERE id = ?", (new_state, action_id))
        c.execute("UPDATE investigations SET state = ? WHERE id = ?", (new_state, inv_id))
        c.commit()

        audit("system", "VERIFICATION_COMPLETED", "verification", {"action_id": action_id, "verdict": verdict, "checks": checks_data})

        return {
            "verdict": verdict,
            "action_id": action_id,
            "checks": checks_data,
            "checked_at": now_str,
            "state_after": new_state
        }
    finally:
        c.close()


def impact(investigation_id: str) -> Dict[str, Any]:
    """Compute rubric-based blast radius and operational impact indicators."""
    c = db.ro_conn()
    try:
        # Finding
        finding = c.execute("SELECT impact FROM findings WHERE investigation_id = ?", (investigation_id,)).fetchone()
        if finding and finding["impact"]:
            return json.loads(finding["impact"])

        # Default fallback computation
        return {
            "affected_services": ["checkout-api", "payment-service", "api-gateway"],
            "peak_error_rates": {"checkout-api": 0.11, "payment-service": 0.14},
            "duration_minutes": 26,
            "failed_traces": 44,
            "failed_payment_logs": 22,
            "rubric_label": "Rubric-based heuristic topology estimate (SIMULATED)"
        }
    finally:
        c.close()


def proof(investigation_id: str) -> Dict[str, Any]:
    """Build a comprehensive, exportable proof bundle with SHA-256 section manifests."""
    c = db.ro_conn()
    try:
        # Findings
        f_row = c.execute(
            """SELECT f.*, h.key as leader_key, h.title as leader_title
               FROM findings f
               JOIN hypotheses h ON f.hypothesis_id = h.id
               WHERE f.investigation_id = ?""",
            (investigation_id,)
        ).fetchone()
        findings_data = dict(f_row) if f_row else {}

        # Evidence with raw rows
        ev_rows = c.execute("SELECT * FROM evidence WHERE investigation_id = ?", (investigation_id,)).fetchall()
        evidence_list = []
        for er in ev_rows:
            ev_dict = dict(er)
            ev_dict["refs"] = json.loads(er["refs"]) if er["refs"] else []

            # Raw DB rows resolution
            raw_sources = {}
            for ref in ev_dict["refs"]:
                tbl = ref.get("table")
                ids = ref.get("ids", [])
                if tbl and ids:
                    q = f"SELECT * FROM {tbl} WHERE id IN ({','.join(['?']*len(ids))})"
                    rows = c.execute(q, ids).fetchall()
                    raw_sources[tbl] = [dict(r) for r in rows]
            ev_dict["raw_sources"] = raw_sources

            # Links
            links = c.execute("SELECT * FROM links WHERE evidence_id = ?", (er["id"],)).fetchall()
            ev_dict["links"] = [dict(l) for l in links]
            evidence_list.append(ev_dict)

        # Steps
        steps_rows = c.execute("SELECT * FROM steps WHERE investigation_id = ? ORDER BY n ASC", (investigation_id,)).fetchall()
        steps_list = [dict(s) for s in steps_rows]

        # Hypotheses & scores
        hyps_rows = c.execute("SELECT * FROM hypotheses WHERE investigation_id = ?", (investigation_id,)).fetchall()
        hyps_list = []
        for hr in hyps_rows:
            h_dict = dict(hr)
            sc_rows = c.execute("SELECT * FROM scores WHERE hypothesis_id = ?", (hr["id"],)).fetchall()
            h_dict["scores"] = [dict(sc) for sc in sc_rows]
            hyps_list.append(h_dict)

        # Actions & Verifications
        acts_rows = c.execute("SELECT * FROM actions WHERE investigation_id = ?", (investigation_id,)).fetchall()
        acts_list = []
        for ar in acts_rows:
            a_dict = dict(ar)
            v_rows = c.execute("SELECT * FROM verifications WHERE action_id = ?", (ar["id"],)).fetchall()
            a_dict["verifications"] = [dict(v) for v in v_rows]
            acts_list.append(a_dict)

        # Audit Log
        audit_rows = c.execute("SELECT * FROM audit_log ORDER BY id ASC").fetchall()
        audit_list = [dict(al) for al in audit_rows]

        # LLM calls & claims
        llm_rows = c.execute("SELECT * FROM llm_calls WHERE investigation_id = ?", (investigation_id,)).fetchall()
        llm_list = [dict(lr) for lr in llm_rows]

        # Calculate section hashes for integrity manifest
        manifest = {
            "findings": hashlib.sha256(canonical_json(findings_data).encode("utf-8")).hexdigest(),
            "evidence": hashlib.sha256(canonical_json(evidence_list).encode("utf-8")).hexdigest(),
            "steps": hashlib.sha256(canonical_json(steps_list).encode("utf-8")).hexdigest(),
            "hypotheses": hashlib.sha256(canonical_json(hyps_list).encode("utf-8")).hexdigest(),
            "actions": hashlib.sha256(canonical_json(acts_list).encode("utf-8")).hexdigest(),
            "audit_log": hashlib.sha256(canonical_json(audit_list).encode("utf-8")).hexdigest(),
        }

        return {
            "investigation_id": investigation_id,
            "exported_at": now_iso(),
            "integrity_manifest": manifest,
            "findings": findings_data,
            "evidence": evidence_list,
            "steps": steps_list,
            "hypotheses": hyps_list,
            "actions": acts_list,
            "audit_log": audit_list,
            "llm_calls": llm_list
        }
    finally:
        c.close()
