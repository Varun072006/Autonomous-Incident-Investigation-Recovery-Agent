"""Database access module for TRACEOPS SQLite evidence store."""
import os
import sqlite3
from pathlib import Path
from typing import Optional

DB_FILE = Path(__file__).resolve().parent.parent / "traceops.db"


def get_db_path() -> Path:
    return Path(os.environ.get("TRACEOPS_DB_PATH", str(DB_FILE)))


def conn() -> sqlite3.Connection:
    """Return a read-write connection with foreign keys and WAL mode."""
    db_path = get_db_path()
    connection = sqlite3.connect(str(db_path), timeout=30.0)
    connection.row_factory = sqlite3.Row
    connection.execute("PRAGMA foreign_keys = ON;")
    connection.execute("PRAGMA journal_mode = WAL;")
    return connection


def ro_conn() -> sqlite3.Connection:
    """Return a read-only connection."""
    db_path = get_db_path()
    # URI connection with ro mode
    uri = f"file:{db_path.as_posix()}?mode=ro"
    try:
        connection = sqlite3.connect(uri, uri=True, timeout=30.0)
    except sqlite3.OperationalError:
        # Fallback if file doesn't exist yet in URI mode
        connection = sqlite3.connect(str(db_path), timeout=30.0)
    connection.row_factory = sqlite3.Row
    connection.execute("PRAGMA foreign_keys = ON;")
    return connection


SCHEMA_SQL = """
CREATE TABLE IF NOT EXISTS services (
    id TEXT PRIMARY KEY,
    name TEXT UNIQUE NOT NULL,
    kind TEXT CHECK(kind IN ('service', 'db', 'external')) NOT NULL,
    tier INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS dependencies (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    caller_id TEXT NOT NULL REFERENCES services(id),
    callee_id TEXT NOT NULL REFERENCES services(id)
);

CREATE TABLE IF NOT EXISTS deployments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    service_id TEXT NOT NULL REFERENCES services(id),
    version TEXT NOT NULL,
    prev_version TEXT NOT NULL,
    deployed_at TEXT NOT NULL,
    rollout_pct REAL NOT NULL,
    summary TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS config_changes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    service_id TEXT NOT NULL REFERENCES services(id),
    key TEXT NOT NULL,
    old TEXT NOT NULL,
    new TEXT NOT NULL,
    changed_at TEXT NOT NULL,
    ticket TEXT NOT NULL,
    note TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS metrics (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    service_id TEXT NOT NULL REFERENCES services(id),
    name TEXT NOT NULL,
    ts TEXT NOT NULL,
    value REAL NOT NULL,
    branch TEXT DEFAULT 'incident' NOT NULL
);

CREATE TABLE IF NOT EXISTS logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    service_id TEXT NOT NULL REFERENCES services(id),
    ts TEXT NOT NULL,
    level TEXT NOT NULL,
    message TEXT NOT NULL,
    host TEXT NOT NULL,
    version TEXT NOT NULL,
    trace_id TEXT,
    branch TEXT DEFAULT 'incident' NOT NULL,
    origin TEXT
);

CREATE TABLE IF NOT EXISTS spans (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    service_id TEXT NOT NULL REFERENCES services(id),
    trace_id TEXT NOT NULL,
    operation TEXT NOT NULL,
    duration_ms REAL NOT NULL,
    status TEXT NOT NULL,
    host TEXT NOT NULL,
    version TEXT NOT NULL,
    ts TEXT NOT NULL,
    branch TEXT DEFAULT 'incident' NOT NULL
);

CREATE TABLE IF NOT EXISTS alerts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    service_id TEXT NOT NULL REFERENCES services(id),
    ts TEXT NOT NULL,
    name TEXT NOT NULL,
    severity TEXT NOT NULL,
    observed REAL NOT NULL
);

CREATE TABLE IF NOT EXISTS tickets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    service_id TEXT REFERENCES services(id),
    ts TEXT NOT NULL,
    source TEXT NOT NULL,
    text TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS past_incidents (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    symptoms TEXT NOT NULL,
    root_cause TEXT NOT NULL,
    resolution TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS investigations (
    id TEXT PRIMARY KEY,
    state TEXT CHECK(state IN ('CREATED', 'INVESTIGATING', 'CONCLUDED', 'INCONCLUSIVE', 'EXECUTED_SIM', 'VERIFIED', 'NOT_RECOVERED')) NOT NULL,
    started_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS hypotheses (
    id TEXT PRIMARY KEY,
    investigation_id TEXT NOT NULL REFERENCES investigations(id),
    key TEXT NOT NULL,
    title TEXT NOT NULL,
    category TEXT NOT NULL,
    prior REAL NOT NULL
);

CREATE TABLE IF NOT EXISTS steps (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    investigation_id TEXT NOT NULL REFERENCES investigations(id),
    n INTEGER NOT NULL,
    kind TEXT CHECK(kind IN ('INTAKE', 'TOOL_CALL', 'CONCLUDE', 'REOPEN')) NOT NULL,
    tool TEXT,
    args TEXT,
    rationale TEXT,
    candidates TEXT,
    summary TEXT NOT NULL,
    replan_reason TEXT,
    ts TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS evidence (
    id TEXT PRIMARY KEY,
    investigation_id TEXT NOT NULL REFERENCES investigations(id),
    step_id INTEGER REFERENCES steps(id),
    text TEXT NOT NULL,
    ts_from TEXT NOT NULL,
    ts_to TEXT NOT NULL,
    refs TEXT NOT NULL,
    extracted_by TEXT DEFAULT 'tool' NOT NULL,
    quote TEXT,
    verified INTEGER DEFAULT 1 NOT NULL
);

CREATE TABLE IF NOT EXISTS links (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    evidence_id TEXT NOT NULL REFERENCES evidence(id),
    hypothesis_id TEXT NOT NULL REFERENCES hypotheses(id),
    relation TEXT CHECK(relation IN ('SUPPORTS', 'CONTRADICTS', 'NEUTRAL')) NOT NULL,
    strength REAL NOT NULL,
    rule TEXT NOT NULL,
    explanation TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS scores (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    hypothesis_id TEXT NOT NULL REFERENCES hypotheses(id),
    step_id INTEGER NOT NULL REFERENCES steps(id),
    score REAL NOT NULL,
    share REAL NOT NULL,
    coverage REAL NOT NULL,
    status TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS findings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    investigation_id TEXT NOT NULL REFERENCES investigations(id),
    hypothesis_id TEXT NOT NULL REFERENCES hypotheses(id),
    share REAL NOT NULL,
    coverage REAL NOT NULL,
    margin REAL NOT NULL,
    status TEXT NOT NULL,
    explanation TEXT NOT NULL,
    explanation_source TEXT DEFAULT 'template' NOT NULL,
    grounding_score REAL DEFAULT 1.0 NOT NULL,
    evidence_ids TEXT NOT NULL,
    impact TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS actions (
    id TEXT PRIMARY KEY,
    investigation_id TEXT NOT NULL REFERENCES investigations(id),
    target_service_id TEXT NOT NULL REFERENCES services(id),
    kind TEXT NOT NULL,
    risk_tier INTEGER NOT NULL,
    description TEXT NOT NULL,
    rollback_plan TEXT NOT NULL,
    recommended INTEGER DEFAULT 0 NOT NULL,
    status TEXT CHECK(status IN ('PENDING', 'APPROVED', 'REJECTED', 'EXECUTED_SIM', 'VERIFIED', 'NOT_RECOVERED')) NOT NULL,
    approved_by TEXT,
    approval_reason TEXT,
    decided_at TEXT,
    executed_at TEXT
);

CREATE TABLE IF NOT EXISTS verifications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    action_id TEXT NOT NULL REFERENCES actions(id),
    verdict TEXT CHECK(verdict IN ('VERIFIED', 'NOT_RECOVERED')) NOT NULL,
    checks TEXT NOT NULL,
    checked_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS audit_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ts TEXT NOT NULL,
    actor TEXT NOT NULL,
    event TEXT NOT NULL,
    entity TEXT NOT NULL,
    details TEXT NOT NULL,
    prev_hash TEXT,
    row_hash TEXT
);

CREATE TABLE IF NOT EXISTS llm_calls (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    investigation_id TEXT REFERENCES investigations(id),
    step_id INTEGER REFERENCES steps(id),
    role TEXT NOT NULL,
    provider TEXT NOT NULL,
    model TEXT NOT NULL,
    prompt_hash TEXT NOT NULL,
    prompt_text TEXT NOT NULL,
    response_text TEXT,
    parsed_json TEXT,
    latency_ms REAL,
    tokens INTEGER,
    temperature REAL,
    status TEXT NOT NULL,
    validation_report TEXT,
    cache_hit INTEGER DEFAULT 0 NOT NULL,
    created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS llm_claims (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    llm_call_id INTEGER NOT NULL REFERENCES llm_calls(id),
    claim_text TEXT NOT NULL,
    cited_evidence_ids TEXT NOT NULL,
    grounded INTEGER NOT NULL,
    reason TEXT
);

CREATE INDEX IF NOT EXISTS idx_metrics ON metrics(service_id, name, ts, branch);
CREATE INDEX IF NOT EXISTS idx_logs ON logs(service_id, ts);
CREATE INDEX IF NOT EXISTS idx_spans ON spans(service_id, ts, branch);
"""


def init():
    """Create all tables and indexes if they do not exist."""
    c = conn()
    try:
        c.executescript(SCHEMA_SQL)
        c.commit()
    finally:
        c.close()


def reset():
    """Drop and recreate all tables cleanly."""
    c = conn()
    try:
        tables = [
            "llm_claims", "llm_calls", "verifications", "actions", "findings",
            "scores", "links", "evidence", "steps", "hypotheses", "investigations",
            "past_incidents", "tickets", "alerts", "spans", "logs", "metrics",
            "config_changes", "deployments", "dependencies", "services", "audit_log"
        ]
        c.execute("PRAGMA foreign_keys = OFF;")
        for t in tables:
            c.execute(f"DROP TABLE IF EXISTS {t};")
        c.execute("PRAGMA foreign_keys = ON;")
        c.executescript(SCHEMA_SQL)
        c.commit()
    finally:
        c.close()


if __name__ == "__main__":
    init()
    print("Database initialized successfully.")
