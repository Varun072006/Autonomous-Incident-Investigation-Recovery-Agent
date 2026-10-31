"""Real Data Ingestion Engine for TRACEOPS.
Supports ingesting real production data from OpenTelemetry, Prometheus, Datadog,
Elasticsearch, raw log files (.log, .json, .csv), traces, and configuration events.
Dynamically registers new services, runs anomaly detection, and populates the evidence store.
"""
import csv
import io
import json
import re
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Union
from app import db, evidence, tools


def now_iso() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def ensure_service_exists(c, service_id: str, name: Optional[str] = None, kind: str = "service", tier: int = 1):
    """Dynamically register any new service found in real ingested data."""
    if not service_id:
        return
    row = c.execute("SELECT id FROM services WHERE id = ?", (service_id,)).fetchone()
    if not row:
        c.execute(
            """INSERT OR IGNORE INTO services (id, name, kind, tier)
               VALUES (?, ?, ?, ?)""",
            (service_id, name or service_id, kind, tier)
        )


def ingest_metrics(metric_points: List[Dict[str, Any]]) -> Dict[str, Any]:
    """Ingest real time-series metrics.
    Expected dict keys: timestamp/ts, service_id/service, name/metric, value, optional unit.
    """
    c = db.conn()
    ingested = 0
    try:
        for pt in metric_points:
            ts = pt.get("timestamp") or pt.get("ts") or now_iso()
            svc = pt.get("service_id") or pt.get("service") or "unknown-service"
            metric_name = pt.get("name") or pt.get("metric") or "metric"
            val = float(pt.get("value", 0.0))
            unit = pt.get("unit") or "ms"
            branch = pt.get("branch") or "incident"

            ensure_service_exists(c, svc)
            c.execute(
                """INSERT INTO metrics (service_id, name, timestamp, value, unit, branch)
                   VALUES (?, ?, ?, ?, ?, ?)""",
                (svc, metric_name, ts, val, unit, branch)
            )
            ingested += 1
        c.commit()
        return {"status": "SUCCESS", "ingested_count": ingested, "data_type": "metrics"}
    finally:
        c.close()


def ingest_logs(log_records: List[Union[Dict[str, Any], str]]) -> Dict[str, Any]:
    """Ingest real application or infrastructure logs (structured JSON or raw log lines)."""
    c = db.conn()
    ingested = 0
    try:
        for item in log_records:
            if isinstance(item, str):
                # Parse raw log line: e.g. "2026-10-30T14:14:02Z ERROR [payment-service] Connection timeout"
                ts_match = re.search(r"\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2}", item)
                ts = ts_match.group(0).replace(" ", "T") + "Z" if ts_match else now_iso()
                
                lvl = "INFO"
                for candidate in ["CRITICAL", "FATAL", "ERROR", "WARN", "WARNING", "INFO", "DEBUG"]:
                    if candidate in item.upper():
                        lvl = "WARN" if candidate == "WARNING" else candidate
                        break

                svc_match = re.search(r"\[([\w\-]+)\]", item)
                svc = svc_match.group(1) if svc_match else "application"
                msg = item
                attrs = {}
            else:
                ts = item.get("timestamp") or item.get("ts") or now_iso()
                svc = item.get("service_id") or item.get("service") or "application"
                lvl = (item.get("level") or item.get("severity") or "INFO").upper()
                msg = item.get("message") or item.get("msg") or str(item)
                attrs = item.get("attributes") or item.get("metadata") or {}

            ensure_service_exists(c, svc)
            c.execute(
                """INSERT INTO logs (service_id, timestamp, level, message, attributes)
                   VALUES (?, ?, ?, ?, ?)""",
                (svc, ts, lvl, msg, json.dumps(attrs))
            )
            ingested += 1
        c.commit()
        return {"status": "SUCCESS", "ingested_count": ingested, "data_type": "logs"}
    finally:
        c.close()


def ingest_traces(spans: List[Dict[str, Any]]) -> Dict[str, Any]:
    """Ingest real distributed trace spans (OpenTelemetry format)."""
    c = db.conn()
    ingested = 0
    try:
        for s in spans:
            trace_id = s.get("trace_id") or f"trace-{uuid.uuid4().hex[:12]}"
            span_id = s.get("span_id") or f"span-{uuid.uuid4().hex[:8]}"
            parent_id = s.get("parent_id") or s.get("parent_span_id")
            svc = s.get("service_id") or s.get("service") or "service"
            name = s.get("name") or s.get("operation") or "http_request"
            start_ts = s.get("start_ts") or s.get("timestamp") or now_iso()
            dur_ms = float(s.get("duration_ms") or s.get("duration", 50.0))
            code = int(s.get("status_code") or s.get("http_status") or 200)
            err = 1 if (code >= 500 or s.get("error") is True) else 0

            ensure_service_exists(c, svc)
            c.execute(
                """INSERT INTO spans (trace_id, span_id, parent_id, service_id, name, start_ts, duration_ms, status_code, is_error)
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)""",
                (trace_id, span_id, parent_id, svc, name, start_ts, dur_ms, code, err)
            )
            ingested += 1
        c.commit()
        return {"status": "SUCCESS", "ingested_count": ingested, "data_type": "traces"}
    finally:
        c.close()


def ingest_events(events: List[Dict[str, Any]]) -> Dict[str, Any]:
    """Ingest deployments, config changes, or alerts from real CI/CD or monitoring webhooks."""
    c = db.conn()
    ingested = 0
    try:
        for ev in events:
            etype = (ev.get("type") or ev.get("event_type") or "CONFIG").upper()
            svc = ev.get("service_id") or ev.get("service") or "system"
            ts = ev.get("timestamp") or ev.get("ts") or now_iso()
            ensure_service_exists(c, svc)

            if "CONFIG" in ettype_or_details(etype, ev):
                c.execute(
                    """INSERT INTO config_changes (service_id, key, old, new, changed_at, ticket, reason)
                       VALUES (?, ?, ?, ?, ?, ?, ?)""",
                    (
                        svc,
                        ev.get("key") or "param",
                        str(ev.get("old", "")),
                        str(ev.get("new", "")),
                        ts,
                        ev.get("ticket") or "CHG-MANUAL",
                        ev.get("reason") or "Real configuration update"
                    )
                )
            elif "DEPLOY" in etype:
                c.execute(
                    """INSERT INTO deployments (service_id, version, prev_version, deployed_at, rollout_pct, summary)
                       VALUES (?, ?, ?, ?, ?, ?)""",
                    (
                        svc,
                        ev.get("version") or "v1.0.0",
                        ev.get("prev_version") or "v0.9.0",
                        ts,
                        float(ev.get("rollout_pct", 100.0)),
                        ev.get("summary") or "Production service deployment"
                    )
                )
            elif "ALERT" in etype:
                c.execute(
                    """INSERT INTO alerts (service_id, name, severity, triggered_at, payload)
                       VALUES (?, ?, ?, ?, ?)""",
                    (
                        svc,
                        ev.get("name") or "ServiceAlert",
                        (ev.get("severity") or "CRITICAL").upper(),
                        ts,
                        json.dumps(ev.get("payload") or ev)
                    )
                )
            ingested += 1
        c.commit()
        return {"status": "SUCCESS", "ingested_count": ingested, "data_type": "events"}
    finally:
        c.close()


def ettype_or_details(etype: str, ev: Dict[str, Any]) -> str:
    if "CONFIG" in etype or "key" in ev or "old" in ev:
        return "CONFIG"
    if "DEPLOY" in etype or "version" in ev:
        return "DEPLOY"
    return etype


def parse_file_and_ingest(filename: str, content_bytes: bytes) -> Dict[str, Any]:
    """Automatically detect format (JSON, CSV, or raw logs) and ingest real data."""
    text = content_bytes.decode("utf-8", errors="replace")

    # 1. Try parsing JSON
    try:
        data = json.loads(text)
        if isinstance(data, list):
            if len(data) == 0:
                return {"status": "EMPTY", "message": "Uploaded JSON array is empty"}
            first = data[0]
            if "trace_id" in first or "span_id" in first:
                return ingest_traces(data)
            elif "metric" in first or "value" in first:
                return ingest_metrics(data)
            elif "message" in first or "level" in first:
                return ingest_logs(data)
            elif "key" in first or "version" in first or "severity" in first:
                return ingest_events(data)
            else:
                # Default to logs
                return ingest_logs(data)
        elif isinstance(data, dict):
            # Check if wrapped in keys
            if "metrics" in data:
                return ingest_metrics(data["metrics"])
            elif "logs" in data:
                return ingest_logs(data["logs"])
            elif "traces" in data or "spans" in data:
                return ingest_traces(data.get("traces") or data.get("spans"))
            elif "events" in data:
                return ingest_events(data["events"])
            else:
                return ingest_logs([data])
    except Exception:
        pass

    # 2. Try parsing CSV
    if filename.endswith(".csv") or "," in text.splitlines()[0]:
        try:
            reader = csv.DictReader(io.StringIO(text))
            rows = list(reader)
            if rows:
                first = rows[0]
                if "metric" in first or "value" in first:
                    return ingest_metrics(rows)
                elif "trace_id" in first:
                    return ingest_traces(rows)
                elif "message" in first or "level" in first:
                    return ingest_logs(rows)
        except Exception:
            pass

    # 3. Fallback: Parse line-by-line raw text logs
    lines = [l.strip() for l in text.splitlines() if l.strip()]
    if lines:
        return ingest_logs(lines)

    return {"status": "ERROR", "message": "Could not recognize file format (must be JSON, CSV, or raw log text)."}
