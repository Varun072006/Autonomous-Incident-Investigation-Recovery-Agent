"""Tests for database initialization, schema integrity, and constraints."""
import sqlite3
import pytest
from app import db, seed


def test_schema_tables_exist():
    db.init()
    conn = db.ro_conn()
    try:
        tables = conn.execute("SELECT name FROM sqlite_master WHERE type='table'").fetchall()
        t_names = [r["name"] for r in tables]
        required = [
            "services", "dependencies", "deployments", "config_changes",
            "metrics", "logs", "spans", "alerts", "tickets", "past_incidents",
            "investigations", "hypotheses", "steps", "evidence", "links",
            "scores", "findings", "actions", "verifications", "audit_log",
            "llm_calls", "llm_claims"
        ]
        for req in required:
            assert req in t_names, f"Missing table {req}"
    finally:
        conn.close()


def test_seed_determinism():
    c1 = seed.run()
    c2 = seed.run()
    assert c1 == c2, f"Seed run is not deterministic: {c1} != {c2}"


def test_foreign_keys_enforced():
    conn = db.conn()
    try:
        # Inserting a deployment for a nonexistent service should fail
        with pytest.raises(sqlite3.IntegrityError):
            conn.execute(
                """INSERT INTO deployments (service_id, version, prev_version, deployed_at, rollout_pct, summary)
                   VALUES ('nonexistent-service', 'v1.0.0', 'v0.9.0', '2026-10-30T14:00:00Z', 100.0, 'test')"""
            )
            conn.commit()
    finally:
        conn.close()


def test_readonly_connection_cannot_write():
    r_conn = db.ro_conn()
    try:
        # Direct write attempt on read-only connection
        with pytest.raises(sqlite3.OperationalError):
            r_conn.execute("INSERT INTO tickets (ts, source, text) VALUES ('2026-10-30T14:00:00Z', 'test', 'test')")
            r_conn.commit()
    finally:
        r_conn.close()

