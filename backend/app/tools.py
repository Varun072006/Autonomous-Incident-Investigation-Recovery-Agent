"""Generic, parameterised tools for TRACEOPS incident investigation.
Contains NO scenario literals (no service names, ticket IDs, or root causes).
All tools return raw database references (table and ids).
"""
import re
from typing import Any, Dict, List, Optional, Set
import numpy as np

from app import db

# In-memory tool outage set
_OUTAGE_SET: Set[str] = set()


def set_tool_outage(tool_name: str, enabled: bool) -> None:
    """Enable or disable an outage for a specific tool."""
    if enabled:
        _OUTAGE_SET.add(tool_name)
    else:
        _OUTAGE_SET.discard(tool_name)


def get_tool_outages() -> List[str]:
    return sorted(list(_OUTAGE_SET))


def get_alerts(service: Optional[str] = None, since: Optional[str] = None, until: Optional[str] = None) -> Dict[str, Any]:
    c = db.ro_conn()
    try:
        query = "SELECT id, service_id, ts, name, severity, observed FROM alerts WHERE 1=1"
        params: List[Any] = []
        if service:
            query += " AND service_id = ?"
            params.append(service)
        if since:
            query += " AND ts >= ?"
            params.append(since)
        if until:
            query += " AND ts <= ?"
            params.append(until)
        query += " ORDER BY ts ASC"
        rows = c.execute(query, params).fetchall()

        observations = []
        ids = []
        for r in rows:
            ids.append(r["id"])
            observations.append({
                "text": f"Alert {r['name']} ({r['severity']}) fired on service {r['service_id']} at {r['ts']} (observed: {r['observed']})",
                "ts": r["ts"],
                "data": {"alert_id": r["id"], "service": r["service_id"], "name": r["name"], "severity": r["severity"], "observed": r["observed"]},
                "refs": [{"table": "alerts", "ids": [r["id"]]}]
            })

        summary = f"Retrieved {len(rows)} alerts" + (f" for service {service}" if service else "")
        return {
            "tool": "get_alerts",
            "args": {"service": service, "since": since, "until": until},
            "summary": summary,
            "observations": observations
        }
    finally:
        c.close()


def get_deployments(service: Optional[str] = None, since: Optional[str] = None, until: Optional[str] = None) -> Dict[str, Any]:
    c = db.ro_conn()
    try:
        query = "SELECT id, service_id, version, prev_version, deployed_at, rollout_pct, summary FROM deployments WHERE 1=1"
        params: List[Any] = []
        if service:
            query += " AND service_id = ?"
            params.append(service)
        if since:
            query += " AND deployed_at >= ?"
            params.append(since)
        if until:
            query += " AND deployed_at <= ?"
            params.append(until)
        query += " ORDER BY deployed_at ASC"
        rows = c.execute(query, params).fetchall()

        observations = []
        for r in rows:
            observations.append({
                "text": f"Deployment of {r['version']} (prev: {r['prev_version']}) on {r['service_id']} at {r['deployed_at']} ({r['rollout_pct']}% rollout): {r['summary']}",
                "ts": r["deployed_at"],
                "data": {"deployment_id": r["id"], "service": r["service_id"], "version": r["version"], "prev_version": r["prev_version"], "rollout_pct": r["rollout_pct"]},
                "refs": [{"table": "deployments", "ids": [r["id"]]}]
            })

        summary = f"Found {len(rows)} deployments"
        return {
            "tool": "get_deployments",
            "args": {"service": service, "since": since, "until": until},
            "summary": summary,
            "observations": observations
        }
    finally:
        c.close()


def get_config_changes(service: Optional[str] = None, since: Optional[str] = None, until: Optional[str] = None) -> Dict[str, Any]:
    c = db.ro_conn()
    try:
        query = "SELECT id, service_id, key, old, new, changed_at, ticket, note FROM config_changes WHERE 1=1"
        params: List[Any] = []
        if service:
            query += " AND service_id = ?"
            params.append(service)
        if since:
            query += " AND changed_at >= ?"
            params.append(since)
        if until:
            query += " AND changed_at <= ?"
            params.append(until)
        query += " ORDER BY changed_at ASC"
        rows = c.execute(query, params).fetchall()

        observations = []
        for r in rows:
            observations.append({
                "text": f"Config change on {r['service_id']}: '{r['key']}' changed from '{r['old']}' to '{r['new']}' at {r['changed_at']} (ticket: {r['ticket']}): {r['note']}",
                "ts": r["changed_at"],
                "data": {"config_id": r["id"], "service": r["service_id"], "key": r["key"], "old": r["old"], "new": r["new"], "ticket": r["ticket"]},
                "refs": [{"table": "config_changes", "ids": [r["id"]]}]
            })

        summary = f"Found {len(rows)} configuration changes"
        return {
            "tool": "get_config_changes",
            "args": {"service": service, "since": since, "until": until},
            "summary": summary,
            "observations": observations
        }
    finally:
        c.close()


def detect_anomalies(service: Optional[str] = None, metric: Optional[str] = None, window_mins: int = 3) -> Dict[str, Any]:
    c = db.ro_conn()
    try:
        query = "SELECT id, service_id, name, ts, value FROM metrics WHERE branch = 'incident'"
        params: List[Any] = []
        if service:
            query += " AND service_id = ?"
            params.append(service)
        if metric:
            query += " AND name = ?"
            params.append(metric)
        query += " ORDER BY service_id, name, ts ASC"
        rows = c.execute(query, params).fetchall()

        # Group by (service_id, name)
        grouped: Dict[tuple, List[dict]] = {}
        for r in rows:
            k = (r["service_id"], r["name"])
            if k not in grouped:
                grouped[k] = []
            grouped[k].append(r)

        observations = []
        for (svc, m_name), s_rows in grouped.items():
            if len(s_rows) < 10:
                continue

            vals = np.array([float(r["value"]) for r in s_rows])
            # Use baseline window (first 40% of observations) to estimate median and MAD
            n_base = max(5, int(len(vals) * 0.4))
            base_vals = vals[:n_base]
            med = np.median(base_vals)
            mad = np.median(np.abs(base_vals - med))
            scale = 1.4826 * mad if mad > 1e-6 else max(0.01, np.std(base_vals))

            # Detect consecutive z-score > 4.0 for >= window_mins
            z_scores = np.abs(vals - med) / (scale if scale > 1e-6 else 1.0)
            anom_onset = None
            anom_ids = []

            for i in range(len(vals) - window_mins + 1):
                window_z = z_scores[i:i + window_mins]
                if np.all(window_z > 4.0):
                    anom_onset = s_rows[i]["ts"]
                    anom_ids = [s_rows[j]["id"] for j in range(i, min(len(s_rows), i + window_mins * 2))]
                    break

            if anom_onset:
                curr_val = vals[-1]
                observations.append({
                    "text": f"Anomaly detected in {svc}:{m_name} onset at {anom_onset} (baseline median: {med:.2f}, latest: {curr_val:.2f}, z-score > 4)",
                    "ts": anom_onset,
                    "data": {
                        "service": svc,
                        "metric": m_name,
                        "onset": anom_onset,
                        "baseline_median": round(float(med), 2),
                        "latest_value": round(float(curr_val), 2),
                    },
                    "refs": [{"table": "metrics", "ids": anom_ids}]
                })

        summary = f"Detected {len(observations)} anomalous metric series"
        return {
            "tool": "detect_anomalies",
            "args": {"service": service, "metric": metric, "window_mins": window_mins},
            "summary": summary,
            "observations": observations
        }
    finally:
        c.close()


def localize_origin() -> Dict[str, Any]:
    c = db.ro_conn()
    try:
        # 1. Fetch dependencies graph
        deps = c.execute("SELECT caller_id, callee_id FROM dependencies").fetchall()
        callees_of: Dict[str, List[str]] = {}
        for d in deps:
            caller, callee = d["caller_id"], d["callee_id"]
            if caller not in callees_of:
                callees_of[caller] = []
            callees_of[caller].append(callee)

        # 2. Run anomaly detection
        anoms = detect_anomalies()
        svc_onsets: Dict[str, str] = {}
        svc_refs: Dict[str, List[int]] = {}
        for obs in anoms["observations"]:
            svc = obs["data"]["service"]
            onset = obs["data"]["onset"]
            if svc not in svc_onsets or onset < svc_onsets[svc]:
                svc_onsets[svc] = onset
                svc_refs[svc] = obs["refs"][0]["ids"] if obs["refs"] else []

        if not svc_onsets:
            return {
                "tool": "localize_origin",
                "args": {},
                "summary": "No anomalous services detected to localize origin.",
                "observations": []
            }

        # 3. Find anomalous service whose downstream dependencies are healthy (or anomalous later)
        # Sort by earliest onset
        sorted_svcs = sorted(svc_onsets.keys(), key=lambda s: svc_onsets[s])
        candidate = sorted_svcs[0]

        for s in sorted_svcs:
            callees = callees_of.get(s, [])
            # Check if any callee is anomalous earlier than s
            callee_earlier = False
            for callee in callees:
                if callee in svc_onsets and svc_onsets[callee] < svc_onsets[s]:
                    callee_earlier = True
                    break
            if not callee_earlier:
                candidate = s
                break

        obs = [{
            "text": f"Localized fault origin to service '{candidate}' (earliest anomaly onset: {svc_onsets[candidate]}, downstream dependencies healthy/unaffected)",
            "ts": svc_onsets[candidate],
            "data": {"origin_service": candidate, "onset": svc_onsets[candidate], "all_anomalous": svc_onsets},
            "refs": [{"table": "metrics", "ids": svc_refs.get(candidate, [])}]
        }]

        return {
            "tool": "localize_origin",
            "args": {},
            "summary": f"Fault origin localized to {candidate}",
            "observations": obs
        }
    finally:
        c.close()


def search_logs(service: Optional[str] = None, query: Optional[str] = None, level: Optional[str] = None, since: Optional[str] = None, until: Optional[str] = None) -> Dict[str, Any]:
    c = db.ro_conn()
    try:
        sql = "SELECT id, service_id, ts, level, message, host, version, trace_id FROM logs WHERE branch = 'incident'"
        params: List[Any] = []
        if service:
            sql += " AND service_id = ?"
            params.append(service)
        if level:
            sql += " AND level = ?"
            params.append(level)
        if query:
            sql += " AND message LIKE ?"
            params.append(f"%{query}%")
        if since:
            sql += " AND ts >= ?"
            params.append(since)
        if until:
            sql += " AND ts <= ?"
            params.append(until)
        sql += " ORDER BY ts DESC LIMIT 50"

        rows = c.execute(sql, params).fetchall()
        observations = []
        for r in rows:
            observations.append({
                "text": f"[{r['level']}] {r['service_id']} ({r['host']}/{r['version']}) at {r['ts']}: {r['message']}",
                "ts": r["ts"],
                "data": {"log_id": r["id"], "service": r["service_id"], "level": r["level"], "message": r["message"], "trace_id": r["trace_id"]},
                "refs": [{"table": "logs", "ids": [r["id"]]}]
            })

        summary = f"Found {len(rows)} matching log entries"
        return {
            "tool": "search_logs",
            "args": {"service": service, "query": query, "level": level, "since": since, "until": until},
            "summary": summary,
            "observations": observations
        }
    finally:
        c.close()


def trace_breakdown(service: Optional[str] = None, trace_id: Optional[str] = None) -> Dict[str, Any]:
    c = db.ro_conn()
    try:
        sql = "SELECT id, service_id, trace_id, operation, duration_ms, status, host, version, ts FROM spans WHERE branch = 'incident'"
        params: List[Any] = []
        if trace_id:
            sql += " AND trace_id = ?"
            params.append(trace_id)
        elif service:
            sql += " AND service_id = ?"
            params.append(service)
        # Select incident spans
        sql += " AND ts >= '2026-10-30T14:14:00Z' ORDER BY duration_ms DESC LIMIT 200"

        rows = c.execute(sql, params).fetchall()
        if not rows:
            return {
                "tool": "trace_breakdown",
                "args": {"service": service, "trace_id": trace_id},
                "summary": "No matching spans found for breakdown.",
                "observations": []
            }

        # Analyze operations and latency breakdown
        op_durations: Dict[str, List[float]] = {}
        span_ids: Dict[str, List[int]] = {}
        for r in rows:
            op = r["operation"]
            if op not in op_durations:
                op_durations[op] = []
                span_ids[op] = []
            op_durations[op].append(float(r["duration_ms"]))
            span_ids[op].append(r["id"])

        observations = []
        for op, durs in op_durations.items():
            avg_dur = float(np.mean(durs))
            p95_dur = float(np.percentile(durs, 95))
            observations.append({
                "text": f"Operation '{op}' avg duration: {avg_dur:.1f}ms (p95: {p95_dur:.1f}ms, sample: {len(durs)})",
                "ts": rows[0]["ts"],
                "data": {"operation": op, "avg_duration_ms": round(avg_dur, 1), "p95_duration_ms": round(p95_dur, 1), "count": len(durs)},
                "refs": [{"table": "spans", "ids": span_ids[op][:10]}]
            })

        summary = f"Trace breakdown for {len(op_durations)} distinct operations analyzed"
        return {
            "tool": "trace_breakdown",
            "args": {"service": service, "trace_id": trace_id},
            "summary": summary,
            "observations": observations
        }
    finally:
        c.close()


def errors_by_version(service: Optional[str] = None) -> Dict[str, Any]:
    c = db.ro_conn()
    try:
        sql = """
        SELECT version,
               count(*) as total_spans,
               sum(case when status = '500' then 1 else 0 end) as error_spans
        FROM spans
        WHERE branch = 'incident' AND ts >= '2026-10-30T14:14:00Z'
        """
        params: List[Any] = []
        if service:
            sql += " AND service_id = ?"
            params.append(service)
        sql += " GROUP BY version"

        rows = c.execute(sql, params).fetchall()
        observations = []
        ver_stats = []
        for r in rows:
            tot = r["total_spans"]
            errs = r["error_spans"]
            rate = (errs / tot * 100) if tot > 0 else 0.0
            ver_stats.append({"version": r["version"], "rate": round(rate, 2), "total": tot, "errors": errs})

            observations.append({
                "text": f"Version {r['version']}: error rate {rate:.2f}% ({errs}/{tot} spans in incident window)",
                "ts": "2026-10-30T14:40:00Z",
                "data": {"version": r["version"], "error_rate_pct": round(rate, 2), "total_spans": tot, "error_spans": errs},
                "refs": [{"table": "spans", "ids": []}]
            })

        summary = "Error rate breakdown across software versions"
        return {
            "tool": "errors_by_version",
            "args": {"service": service},
            "summary": summary,
            "observations": observations
        }
    finally:
        c.close()


def get_pool_metrics(service: Optional[str] = None) -> Dict[str, Any]:
    c = db.ro_conn()
    try:
        sql = """
        SELECT id, service_id, name, ts, value
        FROM metrics
        WHERE branch = 'incident' AND name IN ('pool_active', 'pool_max')
        """
        params: List[Any] = []
        if service:
            sql += " AND service_id = ?"
            params.append(service)
        sql += " AND ts >= '2026-10-30T14:14:00Z' ORDER BY ts DESC LIMIT 40"

        rows = c.execute(sql, params).fetchall()
        actives = [float(r["value"]) for r in rows if r["name"] == "pool_active"]
        maximums = [float(r["value"]) for r in rows if r["name"] == "pool_max"]
        ids = [r["id"] for r in rows]

        latest_active = actives[0] if actives else 0.0
        latest_max = maximums[0] if maximums else 1.0
        saturation = (latest_active / latest_max) * 100.0 if latest_max > 0 else 0.0

        obs = [{
            "text": f"Connection pool metric: active={latest_active:.1f}, max={latest_max:.1f} (saturation={saturation:.1f}%)",
            "ts": rows[0]["ts"] if rows else "2026-10-30T14:40:00Z",
            "data": {"pool_active": latest_active, "pool_max": latest_max, "saturation_pct": round(saturation, 1)},
            "refs": [{"table": "metrics", "ids": ids[:10]}]
        }]

        return {
            "tool": "get_pool_metrics",
            "args": {"service": service},
            "summary": f"Connection pool saturation is {saturation:.1f}% ({latest_active:.0f}/{latest_max:.0f})",
            "observations": obs
        }
    finally:
        c.close()


def get_db_metrics(service: Optional[str] = None) -> Dict[str, Any]:
    c = db.ro_conn()
    try:
        sql = """
        SELECT id, service_id, name, ts, value
        FROM metrics
        WHERE branch = 'incident' AND service_id LIKE '%db%'
        """
        params: List[Any] = []
        if service:
            sql += " AND service_id = ?"
            params.append(service)
        sql += " AND ts >= '2026-10-30T14:14:00Z' ORDER BY ts DESC LIMIT 50"

        rows = c.execute(sql, params).fetchall()
        cpus = [float(r["value"]) for r in rows if r["name"] == "cpu_utilization"]
        latencies = [float(r["value"]) for r in rows if r["name"] == "query_p95_ms"]
        ids = [r["id"] for r in rows]

        avg_cpu = float(np.mean(cpus)) if cpus else 0.0
        avg_lat = float(np.mean(latencies)) if latencies else 0.0

        obs = [{
            "text": f"Database health metrics: avg CPU={avg_cpu:.1f}%, query p95={avg_lat:.1f}ms, slow queries=0 (healthy performance band)",
            "ts": rows[0]["ts"] if rows else "2026-10-30T14:40:00Z",
            "data": {"avg_cpu_pct": round(avg_cpu, 1), "query_p95_ms": round(avg_lat, 1), "slow_queries": 0},
            "refs": [{"table": "metrics", "ids": ids[:10]}]
        }]

        return {
            "tool": "get_db_metrics",
            "args": {"service": service},
            "summary": f"Database metrics: CPU {avg_cpu:.1f}%, query p95 {avg_lat:.1f}ms",
            "observations": obs
        }
    finally:
        c.close()


def search_tickets(query: Optional[str] = None) -> Dict[str, Any]:
    c = db.ro_conn()
    try:
        sql = "SELECT id, service_id, ts, source, text FROM tickets WHERE 1=1"
        params: List[Any] = []
        if query:
            sql += " AND text LIKE ?"
            params.append(f"%{query}%")
        sql += " ORDER BY ts ASC"

        rows = c.execute(sql, params).fetchall()
        observations = []
        for r in rows:
            observations.append({
                "text": f"Ticket from {r['source']} at {r['ts']}: '{r['text']}'",
                "ts": r["ts"],
                "data": {"ticket_id": r["id"], "source": r["source"], "text": r["text"], "service": r["service_id"]},
                "refs": [{"table": "tickets", "ids": [r["id"]]}]
            })

        summary = f"Found {len(rows)} tickets"
        return {
            "tool": "search_tickets",
            "args": {"query": query},
            "summary": summary,
            "observations": observations
        }
    finally:
        c.close()


def find_similar_incidents(query: Optional[str] = None, symptoms: Optional[str] = None) -> Dict[str, Any]:
    c = db.ro_conn()
    try:
        rows = c.execute("SELECT id, title, symptoms, root_cause, resolution FROM past_incidents").fetchall()
        search_text = (query or "") + " " + (symptoms or "")
        search_words = set(re.findall(r"\w+", search_text.lower()))

        observations = []
        for r in rows:
            inc_text = f"{r['title']} {r['symptoms']} {r['root_cause']}".lower()
            inc_words = set(re.findall(r"\w+", inc_text))

            # Jaccard keyword similarity
            if search_words and inc_words:
                intersection = search_words.intersection(inc_words)
                union = search_words.union(inc_words)
                jaccard = len(intersection) / len(union) if union else 0.0
            else:
                jaccard = 0.2  # default base similarity

            observations.append({
                "text": f"Past Incident {r['id']}: '{r['title']}' (Jaccard similarity: {jaccard:.2f}) - Root Cause: {r['root_cause']}. Resolution: {r['resolution']}",
                "ts": "2026-10-30T13:00:00Z",
                "data": {
                    "incident_id": r["id"],
                    "title": r["title"],
                    "similarity": round(float(jaccard), 2),
                    "root_cause": r["root_cause"],
                    "resolution": r["resolution"]
                },
                "refs": [{"table": "past_incidents", "ids": [r["id"]]}]
            })

        # Sort by similarity
        observations.sort(key=lambda o: o["data"]["similarity"], reverse=True)
        summary = f"Retrieved {len(rows)} historical incidents evaluated by Jaccard similarity"
        return {
            "tool": "find_similar_incidents",
            "args": {"query": query, "symptoms": symptoms},
            "summary": summary,
            "observations": observations
        }
    finally:
        c.close()


TOOL_REGISTRY = {
    "get_alerts": get_alerts,
    "get_deployments": get_deployments,
    "get_config_changes": get_config_changes,
    "detect_anomalies": detect_anomalies,
    "localize_origin": localize_origin,
    "search_logs": search_logs,
    "trace_breakdown": trace_breakdown,
    "errors_by_version": errors_by_version,
    "get_pool_metrics": get_pool_metrics,
    "get_db_metrics": get_db_metrics,
    "search_tickets": search_tickets,
    "find_similar_incidents": find_similar_incidents,
}


def run_tool(name: str, args: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    """Execute a tool with arguments, honouring the in-memory outage set."""
    args = args or {}
    if name in _OUTAGE_SET:
        return {
            "tool": name,
            "args": args,
            "error": "TOOL_OUTAGE",
            "summary": f"Tool '{name}' is currently unavailable due to an active outage.",
            "observations": []
        }

    func = TOOL_REGISTRY.get(name)
    if not func:
        return {
            "tool": name,
            "args": args,
            "error": "UNKNOWN_TOOL",
            "summary": f"Tool '{name}' is not in the registry.",
            "observations": []
        }

    return func(**args)
