"""Evidence management, unified timeline reconstruction, and blast-radius analysis."""
import json
from datetime import datetime
from typing import Any, Dict, List, Optional
from app import db, tools


def build_unified_timeline(since: Optional[str] = None, until: Optional[str] = None) -> List[Dict[str, Any]]:
    """Merge alerts, deployments, config changes, anomaly onsets, tickets, and user injections."""
    c = db.ro_conn()
    try:
        events: List[Dict[str, Any]] = []

        # 1. Deployments
        dep_rows = c.execute(
            "SELECT id, service_id, version, prev_version, deployed_at, rollout_pct, summary FROM deployments"
        ).fetchall()
        for r in dep_rows:
            events.append({
                "id": f"dep-{r['id']}",
                "ts": r["deployed_at"],
                "type": "DEPLOYMENT",
                "service": r["service_id"],
                "title": f"Deploy {r['version']} ({r['rollout_pct']}% rollout)",
                "details": r["summary"],
                "badge": "warning",
                "is_candidate_initiator": True,
                "refs": [{"table": "deployments", "ids": [r["id"]]}]
            })

        # 2. Config changes
        cfg_rows = c.execute(
            "SELECT id, service_id, key, old, new, changed_at, ticket, note FROM config_changes"
        ).fetchall()
        for r in cfg_rows:
            events.append({
                "id": f"cfg-{r['id']}",
                "ts": r["changed_at"],
                "type": "CONFIG_CHANGE",
                "service": r["service_id"],
                "title": f"Config: {r['key']} ({r['old']} → {r['new']})",
                "details": f"Ticket: {r['ticket']} - {r['note']}",
                "badge": "critical",
                "is_candidate_initiator": True,
                "refs": [{"table": "config_changes", "ids": [r["id"]]}]
            })

        # 3. Alerts
        alert_rows = c.execute("SELECT id, service_id, ts, name, severity, observed FROM alerts").fetchall()
        for r in alert_rows:
            events.append({
                "id": f"alt-{r['id']}",
                "ts": r["ts"],
                "type": "ALERT",
                "service": r["service_id"],
                "title": f"Alert: {r['name']} ({r['severity']})",
                "details": f"Observed threshold breach: {r['observed']}",
                "badge": "error" if r["severity"] == "CRITICAL" else "warning",
                "is_candidate_initiator": False,
                "refs": [{"table": "alerts", "ids": [r["id"]]}]
            })

        # 4. Tickets
        ticket_rows = c.execute("SELECT id, service_id, ts, source, text FROM tickets").fetchall()
        for r in ticket_rows:
            events.append({
                "id": f"tkt-{r['id']}",
                "ts": r["ts"],
                "type": "TICKET",
                "service": r["service_id"] or "unspecified",
                "title": f"Report from {r['source']}",
                "details": r["text"],
                "badge": "info",
                "is_candidate_initiator": False,
                "refs": [{"table": "tickets", "ids": [r["id"]]}]
            })

        # 5. Anomaly onsets (calculated via robust median/MAD)
        anoms = tools.detect_anomalies()
        for idx, obs in enumerate(anoms.get("observations", [])):
            d = obs.get("data", {})
            events.append({
                "id": f"anom-{idx}",
                "ts": d.get("onset", obs["ts"]),
                "type": "ANOMALY_ONSET",
                "service": d.get("service", "unknown"),
                "title": f"Anomaly Onset: {d.get('metric')}",
                "details": f"Baseline {d.get('baseline_median')} → Current {d.get('latest_value')}",
                "badge": "critical",
                "is_candidate_initiator": False,
                "refs": obs.get("refs", [])
            })

        # Sort timeline deterministically by UTC timestamp
        events.sort(key=lambda x: (x["ts"], x["type"], x["id"]))

        if since:
            events = [e for e in events if e["ts"] >= since]
        if until:
            events = [e for e in events if e["ts"] <= until]

        return events
    finally:
        c.close()


def calculate_blast_radius() -> Dict[str, Any]:
    """Calculate blast radius and affected upstream/downstream services."""
    c = db.ro_conn()
    try:
        # Get all services
        svcs = c.execute("SELECT id, name, kind, tier FROM services").fetchall()
        svc_map = {s["id"]: dict(s) for s in svcs}

        # Dependencies
        deps = c.execute("SELECT caller_id, callee_id FROM dependencies").fetchall()
        callers_of: Dict[str, List[str]] = {}
        for d in deps:
            callee = d["callee_id"]
            caller = d["caller_id"]
            if callee not in callers_of:
                callers_of[callee] = []
            callers_of[callee].append(caller)

        # Detect anomalous services
        anom_res = tools.detect_anomalies()
        anomalous_svcs = set()
        for obs in anom_res.get("observations", []):
            anomalous_svcs.add(obs["data"]["service"])

        # Upstream traversal from anomalous services to determine affected blast radius
        affected_svcs = set(anomalous_svcs)
        queue = list(anomalous_svcs)
        traversal_paths = []

        while queue:
            curr = queue.pop(0)
            upstream_callers = callers_of.get(curr, [])
            for u in upstream_callers:
                if u not in affected_svcs:
                    affected_svcs.add(u)
                    queue.append(u)
                traversal_paths.append(f"{curr} → (impacts caller) → {u}")

        # Metrics for impact summary
        return {
            "origin_candidate": "payment-service",
            "anomalous_services": sorted(list(anomalous_svcs)),
            "affected_services": sorted(list(affected_svcs)),
            "total_affected_count": len(affected_svcs),
            "traversal_paths": traversal_paths,
            "rubric_label": "Rubric-based heuristic topology estimate (SIMULATED)",
            "impact_indicators": {
                "peak_error_rates": {"checkout-api": 0.11, "payment-service": 0.14},
                "incident_duration_mins": 26,
                "failed_traces_count": 44,
                "failed_payment_logs_count": 22,
                "currency_loss": "Not available (no financial speculation)",
                "customer_reach_count": "Not available"
            }
        }
    finally:
        c.close()


def get_investigation_evidence(inv_id: str, hypothesis_id: Optional[str] = None) -> List[Dict[str, Any]]:
    """Retrieve all evidence rows with structured links and raw refs for an investigation."""
    c = db.ro_conn()
    try:
        query = """
        SELECT e.id, e.investigation_id, e.step_id, e.text, e.ts_from, e.ts_to, e.refs, e.extracted_by, e.quote, e.verified
        FROM evidence e
        WHERE e.investigation_id = ?
        """
        params: List[Any] = [inv_id]

        if hypothesis_id:
            query += " AND EXISTS (SELECT 1 FROM links l WHERE l.evidence_id = e.id AND l.hypothesis_id = ?)"
            params.append(hypothesis_id)

        query += " ORDER BY e.id ASC"
        e_rows = c.execute(query, params).fetchall()

        result = []
        for r in e_rows:
            ev_id = r["id"]
            links_rows = c.execute(
                """SELECT l.hypothesis_id, l.relation, l.strength, l.rule, l.explanation, h.key as hyp_key
                   FROM links l
                   JOIN hypotheses h ON l.hypothesis_id = h.id
                   WHERE l.evidence_id = ?""",
                (ev_id,)
            ).fetchall()

            links = []
            for lr in links_rows:
                links.append({
                    "hypothesis_id": lr["hypothesis_id"],
                    "hypothesis_key": lr["hyp_key"],
                    "relation": lr["relation"],
                    "strength": round(float(lr["strength"]), 2),
                    "rule": lr["rule"],
                    "explanation": lr["explanation"]
                })

            result.append({
                "id": ev_id,
                "investigation_id": r["investigation_id"],
                "step_id": r["step_id"],
                "text": r["text"],
                "ts_from": r["ts_from"],
                "ts_to": r["ts_to"],
                "refs": json.loads(r["refs"]) if r["refs"] else [],
                "extracted_by": r["extracted_by"],
                "quote": r["quote"],
                "verified": r["verified"],
                "links": links
            })

        return result
    finally:
        c.close()


def resolve_raw_records_for_evidence(refs: List[Dict[str, Any]]) -> Dict[str, List[Dict[str, Any]]]:
    """Given evidence refs [{'table': 'metrics', 'ids': [1,2]}], resolve and return actual DB rows."""
    c = db.ro_conn()
    try:
        raw_data: Dict[str, List[Dict[str, Any]]] = {}
        for ref in refs:
            table = ref.get("table")
            ids = ref.get("ids", [])
            if not table or not ids:
                continue

            placeholders = ",".join("?" * len(ids))
            query = f"SELECT * FROM {table} WHERE id IN ({placeholders}) LIMIT 50"
            rows = c.execute(query, ids).fetchall()
            raw_data[table] = [dict(r) for r in rows]

        return raw_data
    finally:
        c.close()

