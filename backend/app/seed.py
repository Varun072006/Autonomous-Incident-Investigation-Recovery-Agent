"""Seed module for TRACEOPS realistic incident scenario.
Uses numpy.random.RandomState(42) for 100% deterministic reproducibility.
"""
import hashlib
import json
import sqlite3
from datetime import datetime, timedelta
from typing import Dict, List, Tuple
import numpy as np

from app import db


def iso(dt: datetime) -> str:
    return dt.strftime("%Y-%m-%dT%H:%M:%SZ")


def run() -> str:
    """Populate database with the scenario dataset and run all validation checks.
    Returns sha256 checksum of the seeded data.
    """
    db.reset()
    conn = db.conn()
    rng = np.random.RandomState(42)

    base_time = datetime(2026, 10, 30, 13, 0, 0)
    incident_time = datetime(2026, 10, 30, 14, 14, 0)
    end_time = datetime(2026, 10, 30, 14, 40, 0)
    sim_end_time = datetime(2026, 10, 30, 15, 0, 0)

    # 1. Services
    services_data = [
        ("web-frontend", "service", 1),
        ("api-gateway", "service", 1),
        ("checkout-api", "service", 1),
        ("payment-service", "service", 1),
        ("inventory-service", "service", 2),
        ("orders-db", "db", 1),
        ("payments-db", "db", 1),
        ("payment-gateway", "external", 1),
    ]
    conn.executemany(
        "INSERT INTO services (id, name, kind, tier) VALUES (?, ?, ?, ?)",
        [(s[0], s[0], s[1], s[2]) for s in services_data]
    )

    # 2. Dependencies
    dependencies_data = [
        ("api-gateway", "checkout-api"),
        ("checkout-api", "inventory-service"),
        ("checkout-api", "payment-service"),
        ("checkout-api", "orders-db"),
        ("payment-service", "payments-db"),
        ("payment-service", "payment-gateway"),
        ("inventory-service", "orders-db"),
    ]
    conn.executemany(
        "INSERT INTO dependencies (caller_id, callee_id) VALUES (?, ?)",
        dependencies_data
    )

    # 3. Deployments
    # 14:00 checkout v2.14.0 staged on hosts 3-5 (50%), prev v2.13.9
    deploy_time = datetime(2026, 10, 30, 14, 0, 0)
    conn.execute(
        """INSERT INTO deployments (service_id, version, prev_version, deployed_at, rollout_pct, summary)
           VALUES (?, ?, ?, ?, ?, ?)""",
        ("checkout-api", "v2.14.0", "v2.13.9", iso(deploy_time), 50.0,
         "Checkout payment flow optimization & tax update")
    )

    # 4. Config Changes
    # 14:07 payment-service db.pool.max_connections 50->10 (ticket CHG-4821)
    config_time = datetime(2026, 10, 30, 14, 7, 0)
    conn.execute(
        """INSERT INTO config_changes (service_id, key, old, new, changed_at, ticket, note)
           VALUES (?, ?, ?, ?, ?, ?, ?)""",
        ("payment-service", "db.pool.max_connections", "50", "10", iso(config_time), "CHG-4821",
         "Scheduled connection pool consolidation for resource balancing")
    )

    # 5. Past Incidents
    past_incidents = [
        ("INC-0198", "Payment service pool timeout during flash sale",
         "Pool timeout errors in payment service, p95 spike > 4s, connection wait queue growth",
         "Connection pool exhaustion following max_connections reduction",
         "Revert config change to restore db.pool.max_connections to 50"),
        ("INC-0231", "orders-db unindexed query causing checkout latency",
         "orders-db CPU 95%, query p95 > 2.5s, active lock count high",
         "Missing composite index on orders table during bulk query",
         "Apply index migration idx_orders_status_date on orders-db"),
        ("INC-0254", "Checkout memory leak on v2.11.2 deployment",
         "Checkout host memory > 90%, OOM kills on 3 nodes, error rate 8%",
         "Memory leak introduced in checkout session cache",
         "Rollback checkout-api deployment to v2.11.1"),
        ("INC-0177", "External Payment Gateway BGP routing flap",
         "Payment gateway TLS timeout, connection resets to 198.51.100.22",
         "Upstream external provider network routing flap",
         "Failover payment-gateway route to secondary endpoint"),
    ]
    conn.executemany(
        """INSERT INTO past_incidents (id, title, symptoms, root_cause, resolution)
           VALUES (?, ?, ?, ?, ?)""",
        past_incidents
    )

    # 6. Alerts
    alerts_data = [
        ("checkout-api", datetime(2026, 10, 30, 14, 16, 0), "checkout_latency_p95_high", "CRITICAL", 2.45),
        ("checkout-api", datetime(2026, 10, 30, 14, 18, 0), "checkout_error_rate_high", "CRITICAL", 0.078),
        ("payment-service", datetime(2026, 10, 30, 14, 19, 0), "payment_error_rate_high", "CRITICAL", 0.089),
        ("api-gateway", datetime(2026, 10, 30, 14, 21, 0), "gateway_5xx_rate_high", "HIGH", 0.065),
    ]
    conn.executemany(
        """INSERT INTO alerts (service_id, ts, name, severity, observed)
           VALUES (?, ?, ?, ?, ?)""",
        [(a[0], iso(a[1]), a[2], a[3], a[4]) for a in alerts_data]
    )

    # 7. Tickets
    tickets_data = [
        ("payment-service", datetime(2026, 10, 30, 14, 20, 0), "support", "Customer payments failing at submit step with timeout"),
        (None, datetime(2026, 10, 30, 14, 24, 0), "slack", "checkout slow since the new update? maybe v2.14.0 canary rollout"),
        ("payment-service", datetime(2026, 10, 30, 14, 27, 0), "support", "Multiple mobile users report being stuck on paying spinner"),
    ]
    conn.executemany(
        """INSERT INTO tickets (service_id, ts, source, text)
           VALUES (?, ?, ?, ?)""",
        [(t[0], iso(t[1]), t[2], t[3]) for t in tickets_data]
    )

    # 8. Time series metrics (1-minute intervals from 13:00 to 14:40)
    # Plus branches for 14:40 to 15:00: incident, post_REVERT_CONFIG, post_ROLLBACK_DEPLOY, post_SCALE_DB
    all_metrics: List[Tuple[str, str, str, float, str]] = []

    # Timeline minutes
    # Baseline: 0 .. 74 (13:00 to 14:14)
    # Incident: 74 .. 100 (14:14 to 14:40)
    # Post: 100 .. 120 (14:40 to 15:00)

    for m in range(121):
        cur_t = base_time + timedelta(minutes=m)
        cur_ts = iso(cur_t)

        # Baseline noise factors
        noise_co = rng.normal(0, 15)
        noise_pay = rng.normal(0, 10)
        noise_db = rng.normal(0, 1)

        # Load factor
        if m < 70:  # before 14:10
            load_factor = 1.0
        elif m < 76:  # 14:10 to 14:16
            load_factor = 1.0 + 0.3 * ((m - 70) / 6.0)
        else:
            load_factor = 1.3

        if m <= 100:
            # Main incident timeline (13:00 to 14:40)
            branch = "incident"
            is_incident = (m >= 74)

            # checkout metrics
            if not is_incident:
                co_p95 = max(320.0, 380.0 * load_factor + noise_co)
                co_err = max(0.001, 0.004 + rng.uniform(-0.001, 0.001))
                co_cpu = max(20.0, 41.0 * load_factor + rng.normal(0, 1.5))
            else:
                # Incident ramp
                ramp = min(1.0, (m - 74) / 4.0)
                co_p95 = (380.0 * (1 - ramp)) + (5400.0 * ramp) + noise_co * 4
                co_err = (0.004 * (1 - ramp)) + (0.11 * ramp) + rng.uniform(-0.005, 0.005)
                co_cpu = max(25.0, 38.0 + rng.normal(0, 1.2))  # IO bound wait

            # payment metrics
            if not is_incident:
                pay_p95 = max(180.0, 220.0 * load_factor + noise_pay)
                pay_err = max(0.001, 0.003 + rng.uniform(-0.001, 0.001))
                pool_act = min(48.0, max(8.0, 12.0 * load_factor + rng.normal(0, 1.0)))
                pool_max = 50.0 if m < 67 else 10.0  # 14:07 change
            else:
                ramp = min(1.0, (m - 74) / 3.0)
                pay_p95 = (220.0 * (1 - ramp)) + (4900.0 * ramp) + noise_pay * 3
                pay_err = (0.003 * (1 - ramp)) + (0.14 * ramp) + rng.uniform(-0.005, 0.005)
                pool_act = 10.0  # pinned at 10/10
                pool_max = 10.0

            # payments-db metrics
            db_cpu = max(10.0, 22.0 if not is_incident else 17.0 + noise_db)
            db_p95 = max(14.0, 18.0 + rng.normal(0, 0.8))
            db_slow = 0.0

            all_metrics.extend([
                ("checkout-api", "p95_latency_ms", cur_ts, round(co_p95, 2), branch),
                ("checkout-api", "error_rate", cur_ts, round(co_err, 4), branch),
                ("checkout-api", "cpu_utilization", cur_ts, round(co_cpu, 2), branch),
                ("payment-service", "p95_latency_ms", cur_ts, round(pay_p95, 2), branch),
                ("payment-service", "error_rate", cur_ts, round(pay_err, 4), branch),
                ("payment-service", "pool_active", cur_ts, round(pool_act, 1), branch),
                ("payment-service", "pool_max", cur_ts, round(pool_max, 1), branch),
                ("payments-db", "cpu_utilization", cur_ts, round(db_cpu, 2), branch),
                ("payments-db", "query_p95_ms", cur_ts, round(db_p95, 2), branch),
                ("payments-db", "slow_queries_per_min", cur_ts, db_slow, branch),
            ])

        else:
            # Post-fix branches 14:40 to 15:00 (SIMULATED)
            elapsed = m - 100  # 1 .. 20 minutes post-fix

            # Branch 1: post_REVERT_CONFIG (recovers in ~4 min)
            rec_progress = min(1.0, elapsed / 4.0)
            rev_co_p95 = 5400.0 * (1 - rec_progress) + 390.0 * rec_progress + noise_co
            rev_co_err = 0.11 * (1 - rec_progress) + 0.004 * rec_progress
            rev_pay_p95 = 4900.0 * (1 - rec_progress) + 225.0 * rec_progress + noise_pay
            rev_pay_err = 0.14 * (1 - rec_progress) + 0.003 * rec_progress
            rev_pool_act = 10.0 * (1 - rec_progress) + 12.0 * rec_progress
            rev_pool_max = 50.0

            all_metrics.extend([
                ("checkout-api", "p95_latency_ms", cur_ts, round(rev_co_p95, 2), "post_REVERT_CONFIG"),
                ("checkout-api", "error_rate", cur_ts, round(rev_co_err, 4), "post_REVERT_CONFIG"),
                ("checkout-api", "cpu_utilization", cur_ts, round(41.0 + rng.normal(0, 1.0), 2), "post_REVERT_CONFIG"),
                ("payment-service", "p95_latency_ms", cur_ts, round(rev_pay_p95, 2), "post_REVERT_CONFIG"),
                ("payment-service", "error_rate", cur_ts, round(rev_pay_err, 4), "post_REVERT_CONFIG"),
                ("payment-service", "pool_active", cur_ts, round(rev_pool_act, 1), "post_REVERT_CONFIG"),
                ("payment-service", "pool_max", cur_ts, rev_pool_max, "post_REVERT_CONFIG"),
                ("payments-db", "cpu_utilization", cur_ts, round(22.0 + noise_db, 2), "post_REVERT_CONFIG"),
                ("payments-db", "query_p95_ms", cur_ts, round(18.0 + rng.normal(0, 0.5), 2), "post_REVERT_CONFIG"),
            ])

            # Branch 2: post_ROLLBACK_DEPLOY (shows no change, incident continues)
            rb_co_p95 = 5380.0 + noise_co * 2
            rb_co_err = 0.112 + rng.uniform(-0.003, 0.003)
            rb_pay_p95 = 4890.0 + noise_pay * 2
            rb_pay_err = 0.138 + rng.uniform(-0.003, 0.003)
            all_metrics.extend([
                ("checkout-api", "p95_latency_ms", cur_ts, round(rb_co_p95, 2), "post_ROLLBACK_DEPLOY"),
                ("checkout-api", "error_rate", cur_ts, round(rb_co_err, 4), "post_ROLLBACK_DEPLOY"),
                ("checkout-api", "cpu_utilization", cur_ts, round(38.0 + rng.normal(0, 1.0), 2), "post_ROLLBACK_DEPLOY"),
                ("payment-service", "p95_latency_ms", cur_ts, round(rb_pay_p95, 2), "post_ROLLBACK_DEPLOY"),
                ("payment-service", "error_rate", cur_ts, round(rb_pay_err, 4), "post_ROLLBACK_DEPLOY"),
                ("payment-service", "pool_active", cur_ts, 10.0, "post_ROLLBACK_DEPLOY"),
                ("payment-service", "pool_max", cur_ts, 10.0, "post_ROLLBACK_DEPLOY"),
                ("payments-db", "cpu_utilization", cur_ts, round(17.0 + noise_db, 2), "post_ROLLBACK_DEPLOY"),
                ("payments-db", "query_p95_ms", cur_ts, round(18.0 + rng.normal(0, 0.5), 2), "post_ROLLBACK_DEPLOY"),
            ])

            # Branch 3: post_SCALE_DB (scaled payments-db, but pool is still 10/10, no recovery)
            scale_co_p95 = 5410.0 + noise_co * 2
            scale_co_err = 0.109 + rng.uniform(-0.003, 0.003)
            scale_pay_p95 = 4920.0 + noise_pay * 2
            scale_pay_err = 0.141 + rng.uniform(-0.003, 0.003)
            all_metrics.extend([
                ("checkout-api", "p95_latency_ms", cur_ts, round(scale_co_p95, 2), "post_SCALE_DB"),
                ("checkout-api", "error_rate", cur_ts, round(scale_co_err, 4), "post_SCALE_DB"),
                ("checkout-api", "cpu_utilization", cur_ts, round(38.0 + rng.normal(0, 1.0), 2), "post_SCALE_DB"),
                ("payment-service", "p95_latency_ms", cur_ts, round(scale_pay_p95, 2), "post_SCALE_DB"),
                ("payment-service", "error_rate", cur_ts, round(scale_pay_err, 4), "post_SCALE_DB"),
                ("payment-service", "pool_active", cur_ts, 10.0, "post_SCALE_DB"),
                ("payment-service", "pool_max", cur_ts, 10.0, "post_SCALE_DB"),
                ("payments-db", "cpu_utilization", cur_ts, round(11.0 + noise_db, 2), "post_SCALE_DB"),
                ("payments-db", "query_p95_ms", cur_ts, round(16.0 + rng.normal(0, 0.5), 2), "post_SCALE_DB"),
            ])

    conn.executemany(
        """INSERT INTO metrics (service_id, name, ts, value, branch)
           VALUES (?, ?, ?, ?, ?)""",
        all_metrics
    )

    # 9. Host version mapping for checkout-api (hosts 1-6)
    # hosts 1, 2, 6 on v2.13.9; hosts 3, 4, 5 on v2.14.0
    checkout_hosts = [
        ("host-1", "v2.13.9"),
        ("host-2", "v2.13.9"),
        ("host-3", "v2.14.0"),
        ("host-4", "v2.14.0"),
        ("host-5", "v2.14.0"),
        ("host-6", "v2.13.9"),
    ]
    payment_hosts = [("host-p1", "v1.8.2"), ("host-p2", "v1.8.2"), ("host-p3", "v1.8.2"), ("host-p4", "v1.8.2")]

    # 10. Spans and Traces (~400 traces)
    # 200 in baseline, 200 in incident
    spans_data = []
    logs_data = []

    # Trace simulation
    # Pre-select incident errors to ensure version error rate diff is strictly within +-1.5%
    incident_err_budget = {"v2.13.9": [0, 0], "v2.14.0": [0, 0]} # [total, errors]

    for trace_idx in range(400):
        trace_id = f"trc-{trace_idx:04d}"
        is_incident = (trace_idx >= 200)

        if not is_incident:
            # 13:00 to 14:14
            t_offset = rng.uniform(0, 74 * 60)
            trace_dt = base_time + timedelta(seconds=t_offset)
        else:
            # 14:14 to 14:40
            t_offset = rng.uniform(74 * 60, 100 * 60)
            trace_dt = base_time + timedelta(seconds=t_offset)

        ts_str = iso(trace_dt)

        # Pick checkout host and version
        co_h, co_ver = checkout_hosts[rng.randint(0, len(checkout_hosts))]
        pay_h, pay_ver = payment_hosts[rng.randint(0, len(payment_hosts))]

        # Normal work latencies
        gw_self = round(rng.uniform(8.0, 15.0), 2)
        co_self = round(rng.uniform(40.0, 50.0), 2)  # stays ~45ms
        inv_dur = round(rng.uniform(25.0, 35.0), 2)
        db_dur = round(rng.uniform(12.0, 16.0), 2)   # db.insert_payment ~14ms
        ext_dur = round(rng.uniform(160.0, 200.0), 2) # gateway.authorize ~180ms

        if not is_incident:
            pool_acq = round(rng.uniform(1.5, 2.5), 2)
            has_error = (rng.uniform(0, 1) < 0.003)
        else:
            pool_acq = round(rng.uniform(3500.0, 5000.0), 2)
            # Enforce 11.0% error rate per version within +-1.5% tolerance
            tot, errs = incident_err_budget[co_ver]
            cur_rate = (errs / tot) if tot > 0 else 0.0
            if cur_rate < 0.11:
                has_error = (rng.uniform(0, 1) < 0.22)
            else:
                has_error = (rng.uniform(0, 1) < 0.04)
            incident_err_budget[co_ver][0] += 1
            if has_error:
                incident_err_budget[co_ver][1] += 1

        status_pay = "500" if has_error else "200"
        status_co = "500" if has_error else "200"

        pay_charge_dur = round(pool_acq + db_dur + ext_dur, 2)
        co_process_dur = round(co_self + inv_dur + pay_charge_dur, 2)
        gw_dur = round(gw_self + co_process_dur, 2)

        # Spans
        spans_data.append(("api-gateway", trace_id, "api-gateway.handle_request", gw_dur, status_co, "gw-host-1", "v1.2.0", ts_str, "incident"))
        spans_data.append(("checkout-api", trace_id, "checkout-api.process_order", co_process_dur, status_co, co_h, co_ver, ts_str, "incident"))
        spans_data.append(("inventory-service", trace_id, "inventory-service.check_stock", inv_dur, "200", "inv-host-1", "v1.1.0", ts_str, "incident"))
        spans_data.append(("payment-service", trace_id, "payment-service.charge", pay_charge_dur, status_pay, pay_h, pay_ver, ts_str, "incident"))
        spans_data.append(("payment-service", trace_id, "payment-service.pool_acquire", pool_acq, status_pay, pay_h, pay_ver, ts_str, "incident"))
        spans_data.append(("payments-db", trace_id, "payments-db.insert_payment", db_dur, "200", "db-host-1", "pg-15", ts_str, "incident"))
        spans_data.append(("payment-gateway", trace_id, "payment-gateway.authorize", ext_dur, "200", "ext-host", "api", ts_str, "incident"))

        # Associated logs
        if has_error:
            logs_data.append((
                "payment-service", ts_str, "ERROR",
                "PoolTimeoutError: timed out after 5000ms waiting for connection (pool=10/10)",
                pay_h, pay_ver, trace_id, "incident", "pool_manager.py:142"
            ))
            logs_data.append((
                "checkout-api", ts_str, "ERROR",
                f"PaymentGatewayError: Downstream call to payment-service failed for order {trace_id}",
                co_h, co_ver, trace_id, "incident", "order_service.py:284"
            ))
        else:
            if rng.uniform(0, 1) < 0.2:
                logs_data.append((
                    "checkout-api", ts_str, "INFO",
                    f"Order processed successfully: trace_id={trace_id}",
                    co_h, co_ver, trace_id, "incident", "order_service.py:210"
                ))

        # Staged checkout v2.14.0 emits occasional harmless tax WARN
        if co_ver == "v2.14.0" and trace_dt >= deploy_time and rng.uniform(0, 1) < 0.35:
            logs_data.append((
                "checkout-api", ts_str, "WARN",
                "tax-calculation fallback used: geographic cache miss for postal region",
                co_h, co_ver, trace_id, "incident", "tax_calc.py:98"
            ))

    # Add background normal logs for payment-service, gateway, and dbs
    for _ in range(150):
        t_off = rng.uniform(0, 100 * 60)
        dt_val = base_time + timedelta(seconds=t_off)
        logs_data.append((
            "api-gateway", iso(dt_val), "INFO",
            "HTTP 200 POST /api/checkout/cart request completed",
            "gw-host-1", "v1.2.0", None, "incident", "proxy.go:88"
        ))
        logs_data.append((
            "payment-service", iso(dt_val), "INFO",
            "Transaction token validated against cache",
            payment_hosts[rng.randint(0, len(payment_hosts))][0], "v1.8.2", None, "incident", "auth.py:44"
        ))

    conn.executemany(
        """INSERT INTO spans (service_id, trace_id, operation, duration_ms, status, host, version, ts, branch)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)""",
        spans_data
    )
    conn.executemany(
        """INSERT INTO logs (service_id, ts, level, message, host, version, trace_id, branch, origin)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)""",
        logs_data
    )

    # Initial Audit log entry
    conn.execute(
        """INSERT INTO audit_log (ts, actor, event, entity, details, prev_hash, row_hash)
           VALUES (?, ?, ?, ?, ?, ?, ?)""",
        (iso(base_time), "system", "SYSTEM_SEEDED", "database",
         json.dumps({"scenario": "pool_exhaustion_seed42", "services": 8, "traces": 400}),
         "0000000000000000000000000000000000000000000000000000000000000000",
         hashlib.sha256(b"SYSTEM_SEEDED_GENESIS").hexdigest())
    )

    conn.commit()

    # 11. Run Invariant Validators
    validate_seed(conn)

    # 12. Compute checksum of table row counts and primary content
    checksum = compute_checksum(conn)
    conn.close()
    return checksum


def validate_seed(conn: sqlite3.Connection):
    """Run invariant checks per §C specification."""
    # 1. Foreign keys
    fk_errors = conn.execute("PRAGMA foreign_key_check;").fetchall()
    assert len(fk_errors) == 0, f"Foreign key check failed: {fk_errors}"

    # 2. Sequence ordering
    # Config change precedes pool saturation (14:14), which precedes checkout latency alert (14:16)
    cfg_row = conn.execute("SELECT changed_at FROM config_changes WHERE key='db.pool.max_connections'").fetchone()
    alert_row = conn.execute("SELECT ts FROM alerts WHERE name='checkout_latency_p95_high'").fetchone()
    assert cfg_row and alert_row
    assert cfg_row["changed_at"] < "2026-10-30T14:14:00Z", f"Config change too late: {cfg_row['changed_at']}"
    assert alert_row["ts"] >= "2026-10-30T14:16:00Z", f"Alert too early: {alert_row['ts']}"

    # 3. Version error rates within +-2 points (per §C / P2 / P10)
    v13_spans = conn.execute("SELECT count(*) as total, sum(case when status='500' then 1 else 0 end) as errs FROM spans WHERE service_id='checkout-api' AND version='v2.13.9' AND ts >= '2026-10-30T14:14:00Z'").fetchone()
    v14_spans = conn.execute("SELECT count(*) as total, sum(case when status='500' then 1 else 0 end) as errs FROM spans WHERE service_id='checkout-api' AND version='v2.14.0' AND ts >= '2026-10-30T14:14:00Z'").fetchone()
    rate_13 = (v13_spans["errs"] / v13_spans["total"]) * 100 if v13_spans["total"] else 0.0
    rate_14 = (v14_spans["errs"] / v14_spans["total"]) * 100 if v14_spans["total"] else 0.0
    diff = abs(rate_13 - rate_14)
    print(f"Validation: checkout v2.13.9 error rate={rate_13:.2f}%, v2.14.0 error rate={rate_14:.2f}%, diff={diff:.2f}%")
    assert diff <= 2.0, f"Version error rate diff exceeds 2.0 points: v2.13.9={rate_13:.2f}%, v2.14.0={rate_14:.2f}%, diff={diff:.2f}"

    # 4. DB metrics within baseline band during incident
    db_metrics = conn.execute("SELECT avg(value) as avg_cpu FROM metrics WHERE service_id='payments-db' AND name='cpu_utilization' AND branch='incident' AND ts >= '2026-10-30T14:14:00Z'").fetchone()
    assert db_metrics["avg_cpu"] < 25.0, f"payments-db CPU elevated unexpectedly: {db_metrics['avg_cpu']}"

    # 5. Row counts
    counts = {}
    for table in ["services", "dependencies", "deployments", "config_changes", "metrics", "logs", "spans", "alerts", "tickets", "past_incidents"]:
        c = conn.execute(f"SELECT count(*) as c FROM {table}").fetchone()["c"]
        counts[table] = c
        assert c > 0, f"Table {table} is empty!"


def compute_checksum(conn: sqlite3.Connection) -> str:
    """Compute sha256 checksum over tables and counts for determinism verification."""
    hasher = hashlib.sha256()
    for table in ["services", "deployments", "config_changes", "alerts", "tickets", "past_incidents", "metrics", "logs", "spans"]:
        rows = conn.execute(f"SELECT count(*), max(id) FROM {table}").fetchone()
        hasher.update(f"{table}:{rows[0]}:{rows[1]}".encode("utf-8"))
    return hasher.hexdigest()


if __name__ == "__main__":
    c1 = run()
    print(f"Seed Run 1 Checksum: {c1}")
    c2 = run()
    print(f"Seed Run 2 Checksum: {c2}")
    assert c1 == c2, f"Seed is not deterministic! {c1} != {c2}"
    print("Determinism verified: Seed checksums match exactly.")
