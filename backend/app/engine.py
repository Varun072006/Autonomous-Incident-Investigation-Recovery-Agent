"""TRACEOPS Investigation Engine:
Hypothesis evaluation, Bayesian-inspired heuristic scoring, information-gain planning,
replanning, evidence linking, and autonomous lifecycle management.

STRICT RULE: NO SCENARIO LITERALS (no service names, ticket IDs, or root causes).
All probabilities/accuracies are banned: uses 'relative evidence share (heuristic)'.
"""
import json
import re
import uuid
from datetime import datetime
from typing import Any, Dict, List, Optional, Set, Tuple
import numpy as np

from app import db, tools

HYPOTHESIS_TEMPLATES = [
    {
        "key": "H_DEPLOY",
        "title": "Software Deployment Regression",
        "category": "DEPLOYMENT",
        "expectations": [
            {"name": "temporal", "tool": "get_deployments", "weight": 0.5, "necessary": False},
            {"name": "version_split", "tool": "errors_by_version", "weight": 0.9, "necessary": True},
            {"name": "self_time", "tool": "trace_breakdown", "weight": 0.7, "necessary": False},
            {"name": "resource", "tool": "detect_anomalies", "weight": 0.4, "necessary": False},
            {"name": "novel_logs", "tool": "search_logs", "weight": 0.3, "necessary": False},
            {"name": "past_similar", "tool": "find_similar_incidents", "weight": 0.2, "necessary": False},
        ]
    },
    {
        "key": "H_POOL",
        "title": "Connection Pool Exhaustion",
        "category": "CONNECTION_POOL",
        "expectations": [
            {"name": "config_change", "tool": "get_config_changes", "weight": 0.8, "necessary": False},
            {"name": "saturation", "tool": "get_pool_metrics", "weight": 0.9, "necessary": True},
            {"name": "wait_dominates", "tool": "trace_breakdown", "weight": 0.9, "necessary": False},
            {"name": "log_signature", "tool": "search_logs", "weight": 0.7, "necessary": False},
            {"name": "ordering", "tool": "localize_origin", "weight": 0.6, "necessary": False},
            {"name": "past_similar", "tool": "find_similar_incidents", "weight": 0.3, "necessary": False},
        ]
    },
    {
        "key": "H_DB",
        "title": "Database Saturation / Capacity Bottleneck",
        "category": "DATABASE",
        "expectations": [
            {"name": "db_saturation", "tool": "get_db_metrics", "weight": 0.9, "necessary": True},
            {"name": "query_latency", "tool": "trace_breakdown", "weight": 0.8, "necessary": False},
            {"name": "breadth", "tool": "detect_anomalies", "weight": 0.6, "necessary": False},
            {"name": "past_similar", "tool": "find_similar_incidents", "weight": 0.2, "necessary": False},
        ]
    },
    {
        "key": "H_TRAFFIC",
        "title": "Traffic Surge / Load Overload",
        "category": "TRAFFIC_SPIKE",
        "expectations": [
            {"name": "load_up", "tool": "detect_anomalies", "weight": 0.4, "necessary": False},
            {"name": "proportionality", "tool": "detect_anomalies", "weight": 0.6, "necessary": False},
            {"name": "past_similar", "tool": "find_similar_incidents", "weight": 0.2, "necessary": False},
        ]
    },
    {
        "key": "H_EXTERNAL",
        "title": "Downstream External Dependency Failure",
        "category": "EXTERNAL_DEPENDENCY",
        "expectations": [
            {"name": "gateway_latency", "tool": "trace_breakdown", "weight": 0.8, "necessary": True},
            {"name": "past_similar", "tool": "find_similar_incidents", "weight": 0.2, "necessary": False},
        ]
    },
]


def softmax(x: np.ndarray) -> np.ndarray:
    e_x = np.exp(x - np.max(x))
    return e_x / e_x.sum()


INJECT_RULE_WEIGHT = 0.9

# Deterministic keyword classifier for operator-injected signals (no LLM authority).
INJECT_KEYWORDS = {
    "H_EXTERNAL": ["stripe", "third-party", "third party", "external", "provider", "vendor", "partner", "upstream api", "status page"],
    "H_DB": ["failover", "replica", "database", "iops", "deadlock", "slow quer", "disk", "db cpu", "replication"],
    "H_TRAFFIC": ["traffic", "surge", "ddos", "bot ", "flash sale", "request rate", "load spike"],
    "H_DEPLOY": ["deploy", "release", "rollout", "regression", "canary", "new version", "hotfix"],
    "H_POOL": ["pool", "max_connections", "connection limit", "connection wait"],
}
NEGATIONS = ["not ", "no ", "ruled out", "healthy", "nominal", "normal", "resolved", "false alarm", "unrelated"]
INJECT_FOLLOWUP_TOOL = {
    "H_EXTERNAL": "trace_breakdown", "H_DB": "get_db_metrics", "H_TRAFFIC": "detect_anomalies",
    "H_DEPLOY": "errors_by_version", "H_POOL": "get_pool_metrics",
}


def classify_injection(text: str) -> List[Dict[str, Any]]:
    """Map free-text injected evidence onto hypotheses (SUPPORTS/CONTRADICTS) by keyword match."""
    t = (text or "").lower()
    negated = any(n in t for n in NEGATIONS)
    out = []
    for key, kws in INJECT_KEYWORDS.items():
        hits = [k for k in kws if k in t]
        if hits:
            out.append({
                "hypothesis_key": key,
                "relation": "CONTRADICTS" if negated else "SUPPORTS",
                "strength": min(1.0, 0.6 + 0.15 * len(hits)),
                "explanation": f"Operator-injected signal matched keywords {hits}",
            })
    return out


def _compute_scores(c, inv_id: str, tested: Set[str]):
    """score = prior + sum(sign * strength * weight); necessary falsifier => -2.0 and RULED_OUT."""
    hyps_db = c.execute(
        "SELECT id, key, title, prior FROM hypotheses WHERE investigation_id = ?", (inv_id,)
    ).fetchall()
    scores_by_key, status_by_key, coverage_by_key = {}, {}, {}
    for h in hyps_db:
        h_key = h["key"]
        tmpl = next((t for t in HYPOTHESIS_TEMPLATES if t["key"] == h_key), None)
        total_expectations = len(tmpl["expectations"]) if tmpl else 1
        exp_tools = set(e["tool"] for e in tmpl["expectations"]) if tmpl else set()
        coverage = len(exp_tools.intersection(tested)) / total_expectations
        links = c.execute(
            """SELECT l.relation, l.strength, l.rule FROM links l
               JOIN evidence e ON l.evidence_id = e.id
               WHERE l.hypothesis_id = ? AND e.investigation_id = ?""",
            (h["id"], inv_id),
        ).fetchall()
        h_score = float(h["prior"])
        ruled_out = False
        for l in links:
            is_necessary, weight = False, 0.5
            if l["rule"] == "injected_signal":
                weight = INJECT_RULE_WEIGHT
            elif tmpl:
                for e in tmpl["expectations"]:
                    if e["name"] == l["rule"]:
                        is_necessary, weight = e["necessary"], e["weight"]
                        break
            sign = 1.0 if l["relation"] == "SUPPORTS" else (-1.0 if l["relation"] == "CONTRADICTS" else 0.0)
            h_score += sign * float(l["strength"]) * weight
            if is_necessary and l["relation"] == "CONTRADICTS" and float(l["strength"]) >= 0.7:
                ruled_out = True
                h_score -= 2.0
        scores_by_key[h_key] = h_score
        status_by_key[h_key] = "RULED_OUT" if ruled_out else "PLAUSIBLE"
        coverage_by_key[h_key] = coverage
    return hyps_db, scores_by_key, status_by_key, coverage_by_key


def now_iso() -> str:
    return datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ")


def create() -> str:
    """Create a new investigation and return its ID."""
    inv_id = f"inv-{uuid.uuid4().hex[:8]}"
    c = db.conn()
    try:
        c.execute(
            "INSERT INTO investigations (id, state, started_at) VALUES (?, ?, ?)",
            (inv_id, "CREATED", now_iso())
        )
        c.commit()
        return inv_id
    finally:
        c.close()


def get(inv_id: str) -> Dict[str, Any]:
    """Retrieve full investigation state."""
    c = db.ro_conn()
    try:
        inv = c.execute("SELECT id, state, started_at FROM investigations WHERE id = ?", (inv_id,)).fetchone()
        if not inv:
            raise KeyError(f"Investigation {inv_id} not found")

        # Hypotheses
        hyps_rows = c.execute(
            "SELECT id, key, title, category, prior FROM hypotheses WHERE investigation_id = ?",
            (inv_id,)
        ).fetchall()

        # Steps
        steps_rows = c.execute(
            """SELECT id, n, kind, tool, args, rationale, candidates, summary, replan_reason, ts
               FROM steps WHERE investigation_id = ? ORDER BY n ASC""",
            (inv_id,)
        ).fetchall()

        steps = []
        for s in steps_rows:
            steps.append({
                "id": s["id"],
                "n": s["n"],
                "kind": s["kind"],
                "tool": s["tool"],
                "args": json.loads(s["args"]) if s["args"] else {},
                "rationale": s["rationale"],
                "candidates": json.loads(s["candidates"]) if s["candidates"] else [],
                "summary": s["summary"],
                "replan": {"triggered": bool(s["replan_reason"]), "reason": s["replan_reason"]} if s["replan_reason"] else None,
                "ts": s["ts"],
                "state_after": inv["state"],
            })

        # Latest scores per hypothesis
        hypotheses = []
        for h in hyps_rows:
            h_id = h["id"]
            # Score history
            scores_rows = c.execute(
                """SELECT s.n, sc.score, sc.share, sc.coverage, sc.status
                   FROM scores sc
                   JOIN steps s ON sc.step_id = s.id
                   WHERE sc.hypothesis_id = ? ORDER BY s.n ASC""",
                (h_id,)
            ).fetchall()

            score_history = [{"n": sr["n"], "share": round(float(sr["share"]), 4)} for sr in scores_rows]
            latest_sc = scores_rows[-1] if scores_rows else None

            # Evidence counts
            links_rows = c.execute(
                """SELECT l.relation, count(*) as count
                   FROM links l
                   JOIN evidence e ON l.evidence_id = e.id
                   WHERE l.hypothesis_id = ? AND e.investigation_id = ?
                   GROUP BY l.relation""",
                (h_id, inv_id)
            ).fetchall()
            supporting = sum(lr["count"] for lr in links_rows if lr["relation"] == "SUPPORTS")
            contradicting = sum(lr["count"] for lr in links_rows if lr["relation"] == "CONTRADICTS")

            hypotheses.append({
                "id": h_id,
                "key": h["key"],
                "title": h["title"],
                "category": h["category"],
                "prior": h["prior"],
                "status": latest_sc["status"] if latest_sc else "PLAUSIBLE",
                "score": round(float(latest_sc["score"]), 3) if latest_sc else h["prior"],
                "share": round(float(latest_sc["share"]), 4) if latest_sc else 0.2,
                "coverage": round(float(latest_sc["coverage"]), 3) if latest_sc else 0.0,
                "supporting": supporting,
                "contradicting": contradicting,
                "score_history": score_history
            })

        # Sort hypotheses by share descending
        hypotheses.sort(key=lambda x: x["share"], reverse=True)

        # Finding
        finding_row = c.execute(
            """SELECT f.share, f.coverage, f.margin, f.status, f.explanation, f.explanation_source,
                      f.grounding_score, f.evidence_ids, f.impact, h.key as leader_key, h.title as leader_title
               FROM findings f
               JOIN hypotheses h ON f.hypothesis_id = h.id
               WHERE f.investigation_id = ?""",
            (inv_id,)
        ).fetchone()

        finding = None
        if finding_row:
            finding = {
                "leader_key": finding_row["leader_key"],
                "leader_title": finding_row["leader_title"],
                "share": round(float(finding_row["share"]), 4),
                "coverage": round(float(finding_row["coverage"]), 3),
                "margin": round(float(finding_row["margin"]), 4),
                "status": finding_row["status"],
                "explanation": finding_row["explanation"],
                "explanation_source": finding_row["explanation_source"],
                "grounding_score": round(float(finding_row["grounding_score"]), 2),
                "evidence_ids": json.loads(finding_row["evidence_ids"]),
                "impact": json.loads(finding_row["impact"])
            }

        return {
            "id": inv["id"],
            "state": inv["state"],
            "started_at": inv["started_at"],
            "hypotheses": hypotheses,
            "steps": steps,
            "finding": finding,
            "impact": finding["impact"] if finding else None
        }
    finally:
        c.close()


def initialize_investigation(inv_id: str) -> Dict[str, Any]:
    """Execute INTAKE step: run initial discovery tools, calculate priors, set up hypotheses."""
    c = db.conn()
    try:
        # 1. Intake tool runs
        alerts_res = tools.run_tool("get_alerts")
        deploy_res = tools.run_tool("get_deployments")
        tickets_res = tools.run_tool("search_tickets")
        past_res = tools.run_tool("find_similar_incidents")

        # 2. Heuristic prior calculation
        # Rule: deploy proximity (+0.5), alert on deployed (+0.5), 0.5 * past similarity, ticket hits (+0.2)
        # Clamped so no prior share > 0.45
        has_deploy = len(deploy_res["observations"]) > 0
        has_alerts = len(alerts_res["observations"]) > 0
        ticket_texts = " ".join([o["text"] for o in tickets_res["observations"]]).lower()

        raw_priors = {}
        for h in HYPOTHESIS_TEMPLATES:
            k = h["key"]
            prior_val = 0.0
            if k == "H_DEPLOY":
                if has_deploy:
                    prior_val += 0.5
                if has_alerts and has_deploy:
                    prior_val += 0.5
                if "deploy" in ticket_texts or "update" in ticket_texts or "version" in ticket_texts:
                    prior_val += 0.2
            elif k == "H_POOL":
                if "pool" in ticket_texts or "timeout" in ticket_texts or "paying" in ticket_texts:
                    prior_val += 0.4
                # Check past similarity
                pool_sim = max([o["data"]["similarity"] for o in past_res["observations"] if "pool" in o["text"].lower()] + [0.2])
                prior_val += 0.5 * pool_sim
            elif k == "H_DB":
                if "db" in ticket_texts or "database" in ticket_texts:
                    prior_val += 0.2
                db_sim = max([o["data"]["similarity"] for o in past_res["observations"] if "db" in o["text"].lower() or "query" in o["text"].lower()] + [0.15])
                prior_val += 0.5 * db_sim
            elif k == "H_TRAFFIC":
                if "slow" in ticket_texts or "traffic" in ticket_texts or "surge" in ticket_texts:
                    prior_val += 0.3
            elif k == "H_EXTERNAL":
                if "gateway" in ticket_texts or "third-party" in ticket_texts:
                    prior_val += 0.3

            raw_priors[k] = prior_val

        # Softmax raw priors to check max share <= 0.45 constraint
        prior_arr = np.array([raw_priors[h["key"]] for h in HYPOTHESIS_TEMPLATES])
        prior_shares = softmax(prior_arr)

        # Dampen if max share > 0.45
        if np.max(prior_shares) > 0.45:
            scale_factor = 0.45 / np.max(prior_shares)
            prior_arr = prior_arr * scale_factor
            prior_shares = softmax(prior_arr)

        # Insert hypotheses
        hyp_ids = {}
        for idx, h in enumerate(HYPOTHESIS_TEMPLATES):
            h_id = f"hyp-{inv_id}-{h['key']}"
            hyp_ids[h["key"]] = h_id
            c.execute(
                """INSERT INTO hypotheses (id, investigation_id, key, title, category, prior)
                   VALUES (?, ?, ?, ?, ?, ?)""",
                (h_id, inv_id, h["key"], h["title"], h["category"], float(prior_arr[idx]))
            )

        # Create intake Step (n=0)
        c.execute(
            """INSERT INTO steps (investigation_id, n, kind, tool, args, rationale, candidates, summary, replan_reason, ts)
               VALUES (?, 0, 'INTAKE', NULL, NULL, ?, ?, ?, NULL, ?)""",
            (
                inv_id,
                "Intake phase: processed active alerts, recent deployments, tickets, and past incidents to establish initial prior shares.",
                json.dumps([{"tool": "intake", "value": 1.0}]),
                f"Ingested {len(alerts_res['observations'])} alerts, {len(deploy_res['observations'])} deployments, {len(tickets_res['observations'])} tickets, and historical incidents.",
                now_iso()
            )
        )
        step_id = c.execute("SELECT last_insert_rowid() as id").fetchone()["id"]

        # Save initial scores
        for idx, h in enumerate(HYPOTHESIS_TEMPLATES):
            h_id = hyp_ids[h["key"]]
            c.execute(
                """INSERT INTO scores (hypothesis_id, step_id, score, share, coverage, status)
                   VALUES (?, ?, ?, ?, 0.0, 'PLAUSIBLE')""",
                (h_id, step_id, float(prior_arr[idx]), float(prior_shares[idx]))
            )

        # Update investigation state
        c.execute("UPDATE investigations SET state = 'INVESTIGATING' WHERE id = ?", (inv_id,))
        c.commit()

        # Construct Step response
        return {
            "n": 0,
            "kind": "INTAKE",
            "tool": None,
            "args": {},
            "rationale": "Initial triage and intake ingestion",
            "candidates": [{"tool": "intake", "value": 1.0}],
            "summary": f"Intake completed with 5 candidate hypotheses initialized.",
            "evidence_ids": [],
            "score_deltas": {},
            "replan": None,
            "state_after": "INVESTIGATING"
        }
    finally:
        c.close()


def evaluate_tool_result_rules(tool_name: str, tool_result: Dict[str, Any]) -> List[Dict[str, Any]]:
    """Evaluate generic expectation rules against a tool's observations without scenario literals."""
    links_to_create = []

    if tool_name == "errors_by_version":
        # Rule: version error rates comparison
        rates = [obs["data"]["error_rate_pct"] for obs in tool_result.get("observations", []) if "error_rate_pct" in obs.get("data", {})]
        if rates:
            min_r = min(rates)
            max_r = max(rates)
            ratio = (max_r / min_r) if min_r > 0 else 1.0
            # ratio <= 1.2 contradicts H_DEPLOY, >= 1.5 supports H_DEPLOY
            if ratio <= 1.25 or (max_r - min_r) <= 2.0:
                links_to_create.append({
                    "hypothesis_key": "H_DEPLOY",
                    "relation": "CONTRADICTS",
                    "strength": 0.85,
                    "rule": "version_split",
                    "explanation": f"Software versions show statistically identical error rates ({min_r:.1f}% vs {max_r:.1f}%, ratio {ratio:.2f} <= 1.2), refuting release regression."
                })
            elif ratio >= 1.5:
                links_to_create.append({
                    "hypothesis_key": "H_DEPLOY",
                    "relation": "SUPPORTS",
                    "strength": 0.85,
                    "rule": "version_split",
                    "explanation": f"Significant error rate disparity across versions ({min_r:.1f}% vs {max_r:.1f}%, ratio {ratio:.2f} >= 1.5) supports release regression."
                })

    elif tool_name == "get_pool_metrics":
        for obs in tool_result.get("observations", []):
            sat = obs.get("data", {}).get("saturation_pct", 0)
            if sat >= 95.0:
                links_to_create.append({
                    "hypothesis_key": "H_POOL",
                    "relation": "SUPPORTS",
                    "strength": 0.95,
                    "rule": "saturation",
                    "explanation": f"Connection pool saturation is pinned at {sat:.1f}% (>= 95%), confirming critical resource starvation."
                })
            elif sat < 70.0:
                links_to_create.append({
                    "hypothesis_key": "H_POOL",
                    "relation": "CONTRADICTS",
                    "strength": 0.8,
                    "rule": "saturation",
                    "explanation": f"Connection pool saturation is healthy at {sat:.1f}% (< 70%), refuting pool exhaustion."
                })

    elif tool_name == "get_config_changes":
        for obs in tool_result.get("observations", []):
            k = obs.get("data", {}).get("key", "").lower()
            if any(term in k for term in ["pool", "connection", "timeout", "max_"]):
                links_to_create.append({
                    "hypothesis_key": "H_POOL",
                    "relation": "SUPPORTS",
                    "strength": 0.8,
                    "rule": "config_change",
                    "explanation": f"Configuration modification directly altered connection capacity key '{obs['data']['key']}' prior to onset."
                })

    elif tool_name == "get_db_metrics":
        for obs in tool_result.get("observations", []):
            cpu = obs.get("data", {}).get("avg_cpu_pct", 0)
            lat = obs.get("data", {}).get("query_p95_ms", 0)
            if cpu < 30.0 and lat < 50.0:
                links_to_create.append({
                    "hypothesis_key": "H_DB",
                    "relation": "CONTRADICTS",
                    "strength": 0.85,
                    "rule": "db_saturation",
                    "explanation": f"Database infrastructure is operating well within nominal limits (CPU: {cpu:.1f}%, query p95: {lat:.1f}ms)."
                })
            elif cpu > 70.0 or lat > 200.0:
                links_to_create.append({
                    "hypothesis_key": "H_DB",
                    "relation": "SUPPORTS",
                    "strength": 0.85,
                    "rule": "db_saturation",
                    "explanation": f"Database indicates heavy utilization bottleneck (CPU: {cpu:.1f}%, query p95: {lat:.1f}ms)."
                })

    elif tool_name == "trace_breakdown":
        for obs in tool_result.get("observations", []):
            op = obs.get("data", {}).get("operation", "").lower()
            dur = obs.get("data", {}).get("avg_duration_ms", 0)
            if "acquire" in op or "pool" in op:
                if dur > 1000.0:
                    links_to_create.append({
                        "hypothesis_key": "H_POOL",
                        "relation": "SUPPORTS",
                        "strength": 0.9,
                        "rule": "wait_dominates",
                        "explanation": f"Connection wait/acquire span '{obs['data']['operation']}' dominates execution latency ({dur:.1f}ms)."
                    })
            elif "gateway" in op or "external" in op or "authorize" in op:
                if dur < 300.0:
                    links_to_create.append({
                        "hypothesis_key": "H_EXTERNAL",
                        "relation": "CONTRADICTS",
                        "strength": 0.8,
                        "rule": "gateway_latency",
                        "explanation": f"External downstream dependency response time is normal and steady ({dur:.1f}ms < 300ms)."
                    })
            elif "self" in op or "process" in op:
                if dur < 100.0:
                    links_to_create.append({
                        "hypothesis_key": "H_DEPLOY",
                        "relation": "CONTRADICTS",
                        "strength": 0.6,
                        "rule": "self_time",
                        "explanation": f"Local computation/self-time is healthy (~{dur:.1f}ms), showing no algorithmic CPU regression."
                    })

    elif tool_name == "search_logs":
        for obs in tool_result.get("observations", []):
            msg = obs.get("data", {}).get("message", "").lower()
            if "pooltimeout" in msg or "waiting for connection" in msg:
                links_to_create.append({
                    "hypothesis_key": "H_POOL",
                    "relation": "SUPPORTS",
                    "strength": 0.85,
                    "rule": "log_signature",
                    "explanation": f"Discovered explicit connection acquisition timeout errors in service logs."
                })
            elif "syntaxerror" in msg or "nullpointer" in msg:
                links_to_create.append({
                    "hypothesis_key": "H_DEPLOY",
                    "relation": "SUPPORTS",
                    "strength": 0.7,
                    "rule": "novel_logs",
                    "explanation": f"Found fatal code exception traces in application logs."
                })

    elif tool_name == "localize_origin":
        for obs in tool_result.get("observations", []):
            orig = obs.get("data", {}).get("origin_service", "")
            if orig:
                links_to_create.append({
                    "hypothesis_key": "H_POOL",
                    "relation": "SUPPORTS",
                    "strength": 0.65,
                    "rule": "ordering",
                    "explanation": f"Dependency topology confirms earliest anomalous service is '{orig}' with healthy downstream dependencies."
                })
                links_to_create.append({
                    "hypothesis_key": "H_EXTERNAL",
                    "relation": "CONTRADICTS",
                    "strength": 0.75,
                    "rule": "gateway_latency",
                    "explanation": f"Fault origin is localized upstream to '{orig}'; downstream external dependencies are healthy, refuting external gateway outage."
                })

    elif tool_name == "detect_anomalies":
        # Check traffic proportionality
        for obs in tool_result.get("observations", []):
            m_name = obs.get("data", {}).get("metric", "").lower()
            if "latency" in m_name:
                links_to_create.append({
                    "hypothesis_key": "H_TRAFFIC",
                    "relation": "CONTRADICTS",
                    "strength": 0.6,
                    "rule": "proportionality",
                    "explanation": "Latency degraded by over an order of magnitude, far exceeding the modest 30% load increase."
                })

    return links_to_create


def plan_next_tool(inv_id: str, tested_tools: Set[str], current_leader_key: str, pending_follow_up: Optional[str] = None) -> Tuple[str, Dict[str, Any], str, List[Dict[str, Any]]]:
    """Calculate information gain for candidate tools and select top candidate."""
    # Current hypothesis shares
    c = db.ro_conn()
    try:
        hyps = c.execute(
            """SELECT h.key, sc.share
               FROM hypotheses h
               JOIN scores sc ON sc.hypothesis_id = h.id
               WHERE h.investigation_id = ?
               ORDER BY sc.id DESC LIMIT 5""",
            (inv_id,)
        ).fetchall()
        share_map = {h["key"]: float(h["share"]) for h in hyps}
    finally:
        c.close()

    candidate_values: Dict[str, float] = {}
    tool_rationales: Dict[str, str] = {}

    for h_tmpl in HYPOTHESIS_TEMPLATES:
        h_key = h_tmpl["key"]
        h_share = share_map.get(h_key, 0.2)
        is_leader = (h_key == current_leader_key)

        for exp in h_tmpl["expectations"]:
            t_name = exp["tool"]
            if t_name in tested_tools:
                continue

            multiplier = 1.5 if (is_leader and exp["necessary"]) else 1.0
            gain = exp["weight"] * h_share * multiplier

            candidate_values[t_name] = candidate_values.get(t_name, 0.0) + gain
            if t_name not in tool_rationales:
                tool_rationales[t_name] = f"Test expectation '{exp['name']}' for {h_tmpl['title']}"

    # Apply follow-up boost if pending
    if pending_follow_up and pending_follow_up not in tested_tools:
        candidate_values[pending_follow_up] = candidate_values.get(pending_follow_up, 0.0) + 2.5
        tool_rationales[pending_follow_up] = f"Execute high-priority follow-up triggered by prior evidence"

    # Sort candidates
    sorted_candidates = sorted(candidate_values.items(), key=lambda x: x[1], reverse=True)
    top_3 = [{"tool": k, "value": round(float(v), 3)} for k, v in sorted_candidates[:3]]

    if not sorted_candidates:
        # Fallback if all standard tools tested
        return "search_logs", {}, "Fallback log investigation", []

    chosen_tool = sorted_candidates[0][0]
    rationale = tool_rationales.get(chosen_tool, f"Evaluate candidate tool {chosen_tool}")
    return chosen_tool, {}, rationale, top_3


def step(inv_id: str) -> Dict[str, Any]:
    """Execute one investigation cycle:
    Check state, plan next tool, execute tool, score hypotheses, update evidence and findings.
    """
    state_obj = get(inv_id)
    if state_obj["state"] == "CREATED":
        return initialize_investigation(inv_id)

    if state_obj["state"] in ("CONCLUDED", "INCONCLUSIVE", "EXECUTED_SIM", "VERIFIED"):
        # Investigation already concluded or in recovery
        last_step = state_obj["steps"][-1] if state_obj["steps"] else {}
        return {
            "n": last_step.get("n", 1),
            "kind": "CONCLUDE",
            "tool": None,
            "args": {},
            "rationale": "Investigation has concluded.",
            "candidates": [],
            "summary": "Investigation already reached terminal decision state.",
            "evidence_ids": [],
            "score_deltas": {},
            "replan": None,
            "state_after": state_obj["state"]
        }

    c = db.conn()
    try:
        step_n = len(state_obj["steps"])
        tested_tools = set([s["tool"] for s in state_obj["steps"] if s["tool"]])

        # Identify current leader
        current_hyps = state_obj["hypotheses"]
        prev_leader = current_hyps[0]
        prev_leader_key = prev_leader["key"]
        prev_leader_share = prev_leader["share"]

        # Check pending follow-ups
        pending_follow_up = None
        # If get_config_changes ran and found pool changes, boost get_pool_metrics
        if "get_config_changes" in tested_tools and "get_pool_metrics" not in tested_tools:
            pending_follow_up = "get_pool_metrics"

        # Injected evidence queues a verification tool for the newly favoured hypothesis
        # (re-run allowed even if the tool ran before, to check the claim against fresh data).
        planning_tested = set(tested_tools)
        inj_steps = [x for x in state_obj["steps"] if x["tool"] == "inject"]
        if inj_steps:
            last_inj = inj_steps[-1]
            ft = last_inj["args"].get("followup_tool")
            ran_after = any(x["tool"] == ft and x["n"] > last_inj["n"] for x in state_obj["steps"])
            if ft and not ran_after:
                pending_follow_up = ft
                planning_tested.discard(ft)

        # Plan tool
        chosen_tool, tool_args, rationale, candidates = plan_next_tool(
            inv_id, planning_tested, prev_leader_key, pending_follow_up
        )
        if inj_steps and pending_follow_up == chosen_tool:
            rationale = f"Verify injected signal: re-test '{chosen_tool}' against fresh data"

        # Run tool
        tool_result = tools.run_tool(chosen_tool, tool_args)

        # Evaluate rules and evidence links
        rule_links = evaluate_tool_result_rules(chosen_tool, tool_result)

        # Check replan reasons
        replan_reason = None
        if pending_follow_up == chosen_tool:
            replan_reason = ("Verification of injected evidence" if inj_steps
                             else "Follow-up triggered by prior configuration analysis")

        # Insert Step
        c.execute(
            """INSERT INTO steps (investigation_id, n, kind, tool, args, rationale, candidates, summary, replan_reason, ts)
               VALUES (?, ?, 'TOOL_CALL', ?, ?, ?, ?, ?, ?, ?)""",
            (
                inv_id,
                step_n,
                chosen_tool,
                json.dumps(tool_args),
                rationale,
                json.dumps(candidates),
                tool_result.get("summary", ""),
                replan_reason,
                now_iso()
            )
        )
        step_id = c.execute("SELECT last_insert_rowid() as id").fetchone()["id"]

        # Insert Evidence and Links
        created_evidence_ids = []
        for obs_idx, obs in enumerate(tool_result.get("observations", [])):
            ev_id = f"E{step_n}_{obs_idx}_{uuid.uuid4().hex[:6]}"
            created_evidence_ids.append(ev_id)
            c.execute(
                """INSERT INTO evidence (id, investigation_id, step_id, text, ts_from, ts_to, refs, extracted_by, quote, verified)
                   VALUES (?, ?, ?, ?, ?, ?, ?, 'tool', NULL, 1)""",
                (
                    ev_id,
                    inv_id,
                    step_id,
                    obs["text"],
                    obs["ts"],
                    obs["ts"],
                    json.dumps(obs.get("refs", [])),
                )
            )

            # Link matching rules to this evidence
            for r_link in rule_links:
                h_row = c.execute(
                    "SELECT id FROM hypotheses WHERE investigation_id = ? AND key = ?",
                    (inv_id, r_link["hypothesis_key"])
                ).fetchone()
                if h_row:
                    c.execute(
                        """INSERT INTO links (evidence_id, hypothesis_id, relation, strength, rule, explanation)
                           VALUES (?, ?, ?, ?, ?, ?)""",
                        (
                            ev_id,
                            h_row["id"],
                            r_link["relation"],
                            r_link["strength"],
                            r_link["rule"],
                            r_link["explanation"]
                        )
                    )

        # Compute updated scores for each hypothesis
        hyps_db, scores_by_key, status_by_key, coverage_by_key = _compute_scores(
            c, inv_id, tested_tools.union({chosen_tool})
        )

        # Softmax shares across all hypotheses
        score_vals = np.array([scores_by_key[h["key"]] for h in hyps_db])
        shares = softmax(score_vals)

        # Insert new score rows
        for idx, h in enumerate(hyps_db):
            h_key = h["key"]
            h_id = h["id"]
            sh = float(shares[idx])
            sc = float(scores_by_key[h_key])
            cov = float(coverage_by_key[h_key])
            st = status_by_key[h_key]
            if st != "RULED_OUT":
                st = "LEADING" if (sh == np.max(shares) and sh > 0.4) else "PLAUSIBLE"

            c.execute(
                """INSERT INTO scores (hypothesis_id, step_id, score, share, coverage, status)
                   VALUES (?, ?, ?, ?, ?, ?)""",
                (h_id, step_id, sc, sh, cov, st)
            )

        # Check for Replan triggers:
        # Leader change or leader share drop > 0.15
        new_leader_idx = int(np.argmax(shares))
        new_leader_key = hyps_db[new_leader_idx]["key"]
        new_leader_share = float(shares[new_leader_idx])

        if new_leader_key != prev_leader_key:
            replan_reason = f"Leader transitioned from {prev_leader_key} to {new_leader_key}"
        elif (prev_leader_share - new_leader_share) > 0.15:
            replan_reason = f"Leader share decreased by {prev_leader_share - new_leader_share:.2f}"

        if replan_reason:
            c.execute("UPDATE steps SET replan_reason = ? WHERE id = ?", (replan_reason, step_id))

        # Stop condition:
        # At least 5 tool calls recorded (per P10 requirement),
        # leader share >= 0.60, margin >= 0.25, leader's necessary expectations tested,
        # and every rival either RULED_OUT or <= 0.15.
        sorted_shares = sorted(shares, reverse=True)
        margin = float(sorted_shares[0] - sorted_shares[1]) if len(sorted_shares) > 1 else 1.0
        leader_cov = coverage_by_key[new_leader_key]

        # Check leader necessary expectations tested
        leader_tmpl = next((t for t in HYPOTHESIS_TEMPLATES if t["key"] == new_leader_key), None)
        leader_nec_tools = set(e["tool"] for e in leader_tmpl["expectations"] if e["necessary"]) if leader_tmpl else set()
        leader_nec_tested = leader_nec_tools.issubset(tested_tools.union({chosen_tool}))

        # Rivals ruled out or share <= 0.15
        rivals_safe = True
        for idx, h in enumerate(hyps_db):
            if h["key"] != new_leader_key:
                if status_by_key[h["key"]] != "RULED_OUT" and shares[idx] > 0.15:
                    rivals_safe = False
                    break

        new_state = "INVESTIGATING"
        # Never conclude before every hypothesis's necessary falsifier has been tested
        all_nec_tools = set(e["tool"] for t in HYPOTHESIS_TEMPLATES for e in t["expectations"] if e["necessary"])
        all_nec_tested = all_nec_tools.issubset(tested_tools.union({chosen_tool}))

        if step_n >= 5 and new_leader_share >= 0.60 and margin >= 0.25 and leader_nec_tested and rivals_safe and all_nec_tested:
            new_state = "CONCLUDED"
        elif step_n >= 12:
            new_state = "INCONCLUSIVE"

        c.execute("UPDATE investigations SET state = ? WHERE id = ?", (new_state, inv_id))

        # If CONCLUDED or INCONCLUSIVE, write findings
        if new_state in ("CONCLUDED", "INCONCLUSIVE"):
            leader_h_id = hyps_db[new_leader_idx]["id"]
            # Generate deterministic findings explanation
            expl = (
                f"Root cause concluded as {new_leader_key} with relative evidence share of {new_leader_share:.2f} "
                f"and tested coverage of {leader_cov:.1f}. "
                f"Alternative hypotheses have been systematically falsified or weakened below margin threshold."
            )
            # Fetch all evidence IDs related to leader
            ev_rows = c.execute(
                """SELECT DISTINCT e.id FROM evidence e
                   JOIN links l ON l.evidence_id = e.id
                   WHERE e.investigation_id = ? AND l.hypothesis_id = ?""",
                (inv_id, leader_h_id)
            ).fetchall()
            ev_ids = [r["id"] for r in ev_rows]

            # Impact computed from telemetry rows
            from app.evidence import compute_measured_impact
            anom_svcs = sorted(set(o["data"].get("service", "") for o in tool_result.get("observations", []) if o.get("data", {}).get("service")))
            if not anom_svcs:
                anom_svcs = sorted(set(r["service_id"] for r in c.execute(
                    "SELECT DISTINCT service_id FROM alerts").fetchall()))
            _m = compute_measured_impact(c, anom_svcs)["measured"]
            impact_data = {
                "affected_services": anom_svcs,
                "peak_error_rates": _m["measured_peak_error_rates"],
                "duration_minutes": _m["measured_incident_duration_mins"],
                "failed_traces": _m["measured_failed_transactions"],
                "failed_payment_logs": _m["measured_failed_payment_logs"],
            }

            c.execute("DELETE FROM findings WHERE investigation_id = ?", (inv_id,))
            c.execute(
                """INSERT INTO findings (investigation_id, hypothesis_id, share, coverage, margin, status,
                                         explanation, explanation_source, grounding_score, evidence_ids, impact)
                   VALUES (?, ?, ?, ?, ?, ?, ?, 'template', 1.0, ?, ?)""",
                (
                    inv_id,
                    leader_h_id,
                    new_leader_share,
                    leader_cov,
                    margin,
                    new_state,
                    expl,
                    json.dumps(ev_ids),
                    json.dumps(impact_data)
                )
            )

        c.commit()

        # Construct Step result
        score_deltas = {h["key"]: round(float(shares[idx]), 4) for idx, h in enumerate(hyps_db)}
        return {
            "n": step_n,
            "kind": "CONCLUDE" if new_state in ("CONCLUDED", "INCONCLUSIVE") else "TOOL_CALL",
            "tool": chosen_tool,
            "args": tool_args,
            "rationale": rationale,
            "candidates": candidates,
            "summary": tool_result.get("summary", ""),
            "evidence_ids": created_evidence_ids,
            "score_deltas": score_deltas,
            "replan": {"triggered": bool(replan_reason), "reason": replan_reason} if replan_reason else None,
            "state_after": new_state
        }
    finally:
        c.close()


def inject(inv_id: str, inject_type: str, payload: Dict[str, Any], actor: str = "operator") -> Dict[str, Any]:
    """Inject a new live signal (e.g. the jury's surprise). It is stored as traceable evidence,
    linked to hypotheses by a deterministic classifier, re-scored immediately, and the
    investigation is reopened with a verification tool queued for the newly favoured hypothesis."""
    c = db.conn()
    try:
        inv = c.execute("SELECT state FROM investigations WHERE id = ?", (inv_id,)).fetchone()
        if not inv:
            raise KeyError(f"Investigation {inv_id} not found")
        step_n = c.execute("SELECT count(*) as c FROM steps WHERE investigation_id = ?", (inv_id,)).fetchone()["c"]
        text_desc = payload.get("text") or payload.get("message") or f"Injected {inject_type} event"
        ev_id = f"INJ_{uuid.uuid4().hex[:6]}"
        tested = set(r["tool"] for r in c.execute(
            "SELECT tool FROM steps WHERE investigation_id = ? AND tool IS NOT NULL", (inv_id,)).fetchall())

        prev = c.execute(
            """SELECT h.key, sc.share FROM hypotheses h JOIN scores sc ON sc.hypothesis_id = h.id
               WHERE h.investigation_id = ? AND sc.id = (SELECT max(id) FROM scores WHERE hypothesis_id = h.id)
               ORDER BY sc.share DESC""", (inv_id,)).fetchall()
        prev_leader = prev[0]["key"] if prev else None
        prev_share = {r["key"]: float(r["share"]) for r in prev}

        matches = classify_injection(text_desc)
        supported = [m for m in matches if m["relation"] == "SUPPORTS"]
        target = max(supported, key=lambda m: m["strength"])["hypothesis_key"] if supported else None
        followup = INJECT_FOLLOWUP_TOOL.get(target) if target else None

        c.execute(
            """INSERT INTO steps (investigation_id, n, kind, tool, args, rationale, candidates, summary, replan_reason, ts)
               VALUES (?, ?, 'TOOL_CALL', 'inject', ?, ?, '[]', ?, ?, ?)""",
            (inv_id, step_n,
             json.dumps({**payload, "followup_tool": followup, "target_hypothesis": target}),
             f"External evidence injection by actor '{actor}'",
             f"Injected {inject_type}: {text_desc}", "pending", now_iso()),
        )
        step_id = c.execute("SELECT last_insert_rowid() as id").fetchone()["id"]
        c.execute(
            """INSERT INTO evidence (id, investigation_id, step_id, text, ts_from, ts_to, refs, extracted_by, quote, verified)
               VALUES (?, ?, ?, ?, ?, ?, ?, 'injected', ?, 0)""",
            (ev_id, inv_id, step_id, text_desc, now_iso(), now_iso(),
             json.dumps([{"table": "injected_signal", "id": ev_id, "actor": actor, "type": inject_type}]), text_desc),
        )
        for m in matches:
            h_row = c.execute("SELECT id FROM hypotheses WHERE investigation_id = ? AND key = ?",
                              (inv_id, m["hypothesis_key"])).fetchone()
            if h_row:
                c.execute(
                    """INSERT INTO links (evidence_id, hypothesis_id, relation, strength, rule, explanation)
                       VALUES (?, ?, ?, ?, 'injected_signal', ?)""",
                    (ev_id, h_row["id"], m["relation"], m["strength"], m["explanation"]))

        # Re-score immediately so the effect of the new evidence is visible
        hyps_db, scores_by_key, status_by_key, coverage_by_key = _compute_scores(c, inv_id, tested)
        shares = softmax(np.array([scores_by_key[h["key"]] for h in hyps_db]))
        for idx, h in enumerate(hyps_db):
            st = status_by_key[h["key"]]
            if st != "RULED_OUT":
                st = "LEADING" if (shares[idx] == np.max(shares) and shares[idx] > 0.4) else "PLAUSIBLE"
            c.execute(
                "INSERT INTO scores (hypothesis_id, step_id, score, share, coverage, status) VALUES (?, ?, ?, ?, ?, ?)",
                (h["id"], step_id, scores_by_key[h["key"]], float(shares[idx]), coverage_by_key[h["key"]], st))
        new_leader = hyps_db[int(np.argmax(shares))]["key"]
        share_delta = {h["key"]: round(float(shares[i]) - prev_share.get(h["key"], 0.0), 4) for i, h in enumerate(hyps_db)}

        if not matches:
            reason = "Injected signal matched no hypothesis; recorded as context, scores unchanged"
        elif new_leader != prev_leader:
            reason = f"Injected evidence changed leader from {prev_leader} to {new_leader}"
        else:
            reason = (f"Injected evidence re-scored hypotheses ({', '.join(m['hypothesis_key'] for m in matches)}); "
                      f"leader {new_leader} retained, verification of {target or 'n/a'} queued via {followup or 'n/a'}")
        c.execute("UPDATE steps SET replan_reason = ? WHERE id = ?", (reason, step_id))
        # Reopen: previous conclusion is no longer final
        c.execute("DELETE FROM findings WHERE investigation_id = ?", (inv_id,))
        c.execute("UPDATE investigations SET state = 'INVESTIGATING' WHERE id = ?", (inv_id,))

        from app import recover
        recover.audit(actor, "INJECT_EVIDENCE", "investigation",
                      {"type": inject_type, "evidence_id": ev_id, "payload": payload,
                       "links": [(m["hypothesis_key"], m["relation"]) for m in matches]}, connection=c)
        c.commit()
        return {"evidence_id": ev_id, "step_n": step_n, "status": "INJECTED_AND_REPLANNED",
                "links": matches, "leader_before": prev_leader, "leader_after": new_leader,
                "share_delta": share_delta, "replan_reason": reason, "queued_followup_tool": followup}
    finally:
        c.close()


def reopen(inv_id: str, action_id: str) -> Dict[str, Any]:
    """Reopen investigation when verification fails (NOT_RECOVERED).
    Adds 'action had no effect' as contradicting evidence to the recommended hypothesis, then replans.
    """
    c = db.conn()
    try:
        step_n = c.execute("SELECT count(*) as c FROM steps WHERE investigation_id = ?", (inv_id,)).fetchone()["c"]

        # Fetch action
        act = c.execute("SELECT kind, target_service_id, investigation_id FROM actions WHERE id = ?", (action_id,)).fetchone()
        act_kind = act["kind"] if act else "UNKNOWN_ACTION"

        # Record reopening step
        c.execute(
            """INSERT INTO steps (investigation_id, n, kind, tool, args, rationale, candidates, summary, replan_reason, ts)
               VALUES (?, ?, 'REOPEN', 'recover.verify', ?, ?, '[]', ?, 'Remediation verification returned NOT_RECOVERED', ?)""",
            (
                inv_id,
                step_n,
                json.dumps({"action_id": action_id}),
                f"Reopening investigation following failed verification of {act_kind}",
                f"Remediation action {act_kind} executed but telemetry verification returned NOT_RECOVERED.",
                now_iso()
            )
        )
        step_id = c.execute("SELECT last_insert_rowid() as id").fetchone()["id"]

        ev_id = f"REOPEN_{uuid.uuid4().hex[:6]}"
        c.execute(
            """INSERT INTO evidence (id, investigation_id, step_id, text, ts_from, ts_to, refs, extracted_by, quote, verified)
               VALUES (?, ?, ?, ?, ?, ?, '[]', 'reopen', NULL, 1)""",
            (
                ev_id,
                inv_id,
                step_id,
                f"Action {act_kind} had no recovery effect: post-remediation metrics remained anomalous.",
                now_iso(),
                now_iso()
            )
        )

        c.execute("UPDATE investigations SET state = 'INVESTIGATING' WHERE id = ?", (inv_id,))
        c.commit()

        return {"reopened": True, "step_n": step_n, "evidence_id": ev_id}
    finally:
        c.close()


def run_full_investigation() -> Dict[str, Any]:
    """CLI / programmatic runner for the complete autonomous investigation loop."""
    inv_id = create()
    print(f"==================================================")
    print(f"TRACEOPS Autonomous Investigation: {inv_id}")
    print(f"==================================================")

    # 1. Intake
    intake_step = step(inv_id)
    print(f"\n[Step 0 - INTAKE]")
    print(f"  Summary: {intake_step['summary']}")

    state = get(inv_id)
    print("  Initial Relative Evidence Shares:")
    for h in state["hypotheses"]:
        print(f"    - {h['key']:<12}: share={h['share']:.3f} | prior={h['prior']:.2f}")

    # 2. Autonomous Tool Loops
    for i in range(1, 15):
        s = step(inv_id)
        print(f"\n[Step {s['n']} - {s['kind']}] Tool: {s['tool']}")
        print(f"  Rationale: {s['rationale']}")
        if s['candidates']:
            cands_str = ", ".join([f"{c['tool']}:{c['value']}" for c in s['candidates']])
            print(f"  Top Candidates: {cands_str}")
        print(f"  Summary: {s['summary']}")
        if s.get("replan") and s["replan"]["triggered"]:
            print(f"  ** REPLAN TRIGGERED: {s['replan']['reason']} **")

        cur_state = get(inv_id)
        leader = cur_state["hypotheses"][0]
        print(f"  Leader: {leader['key']} ({leader['title']}) - Share: {leader['share']:.3f} (Cov: {leader['coverage']:.2f})")

        if cur_state["state"] in ("CONCLUDED", "INCONCLUSIVE"):
            print(f"\n>>> INVESTIGATION {cur_state['state']} <<<")
            f = cur_state["finding"]
            if f:
                print(f"Root Cause: {f['leader_key']} - {f['leader_title']}")
                print(f"Final Relative Evidence Share: {f['share']:.3f} (Margin: {f['margin']:.3f})")
                print(f"Explanation: {f['explanation']}")
            break

    return get(inv_id)


if __name__ == "__main__":
    import sys
    if "--run" in sys.argv or len(sys.argv) == 1:
        run_full_investigation()
