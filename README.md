# TRACEOPS

**Autonomous Incident Investigation, Root-Cause Analysis and Safe Recovery**

TRACEOPS is an evidence-first AIOps/SRE autonomous investigation system. It ingests multi-layer operational signals (metrics, logs, spans, alerts, deployments, config changes, tickets) into a SQLite evidence store, constructs unified timelines, evaluates competing root-cause hypotheses using Bayesian heuristics, dynamically plans diagnostic checks using information gain, localizes fault origins, classifies remediation risks into strict tiers, blocks unapproved actions with HTTP 409, simulates execution on isolated telemetry branches, and verifies recovery over fresh metrics.

---

## Architecture

```
Raw Data (seed.py) ──► SQLite Evidence Store (WAL) ◄── Proof Manifests (SHA-256)
       │                      ▲
       ▼                      │ writes evidence & links
Tools (12 Read-Only) ◄── Engine (Hypotheses · Scoring · Planner · Replanning)
                              │
               ┌──────────────┴──────────────┐
               ▼                             ▼
       Recovery Workflow            Grounded LLM Gateway
 (Impact · Tiers · Approval ·   (Groq / Ollama / Template ·
  Simulate · Verify · Audit)     Grounding Validator)
               │
               ▼
        FastAPI Backend ──► 4-Page React Operations Console
```

---

## Quick Start

```powershell
.\start.ps1      # seeds DB, starts API :8000 and UI :5173
```

## Manual Start Instructions

### 1. Backend Setup
```bash
# From repository root
$env:PYTHONPATH="backend"

# Install backend dependencies
pip install -r backend/requirements.txt

# Seed SQLite database with deterministic scenario (Seed 42)
python -m app.seed

# Run complete test suite (50 tests)
pytest backend/tests -v

# Run autonomous CLI investigation
python -m app.engine --run

# Start FastAPI server (http://127.0.0.1:8000)
uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

### 2. Frontend Setup
```bash
# In frontend directory
cd frontend
npm install
npm run build
npm run dev
# Dashboard opens at http://localhost:5173
```

---

## Feature Matrix

| Capability | Status | Implementation Details |
|---|---|---|
| Multi-source Seeded Evidence | **COMPLETE** | Metrics, logs, traces, alerts, deployments, config changes, tickets |
| Evidence IDs & Provenance | **COMPLETE** | Every observation linked to raw DB table references and IDs |
| Unified Incident Timeline | **COMPLETE** | UTC-ordered chronology with candidate initiator distinction |
| Dependency Graph & Blast Radius | **COMPLETE** | Interactive SVG graph with status colors from anomaly detection |
| 12 Read-Only Diagnostic Tools | **COMPLETE** | Parameterized tools, in-memory outage toggles, no scenario literals |
| 5 Competing Hypotheses | **COMPLETE** | `H_DEPLOY`, `H_POOL`, `H_DB`, `H_TRAFFIC`, `H_EXTERNAL` |
| Evidence Scoring & Coverage | **COMPLETE** | Prior clamp, Bayesian-inspired heuristic weights, necessary falsifiers |
| Next-Best Diagnostic Planner | **COMPLETE** | Information gain ranking, top-3 candidates logged per step |
| Adaptive Replanning | **COMPLETE** | Dynamic trigger on leader transition, share drop > 0.15, or follow-up |
| Historical Incident Comparison | **COMPLETE** | Jaccard token similarity over historical incidents |
| Groq LLM Integration | **COMPLETE** | OpenAI-compatible gateway with JSON Schema validation and repair |
| Grounding Validator | **COMPLETE** | Verifies `[E#]` citations, drops ungrounded claims, checks numbers |
| Ollama / Template Fallback | **COMPLETE** | Graceful failover; runs offline with `LLM_PROVIDER=none` |
| Risk-Tiered Approval Gate | **COMPLETE** | Tier 0–3 action catalog; HTTP 409 guard on unapproved execution |
| Simulated Recovery | **COMPLETE** | Swaps telemetry branch to `post_<ACTION_KIND>` (labelled SIMULATED) |
| Verification & Reopening | **COMPLETE** | 5-minute metric verification; auto-reopen on `NOT_RECOVERED` |
| Proof Export & Audit Trail | **COMPLETE** | Exportable proof bundle with SHA-256 section manifests |
| 4-Page React Operations Console | **COMPLETE** | Overview, Investigation, Evidence Explorer, Safe Recovery |
| Automated Test Suite | **COMPLETE** | 50 tests passing in pytest (DB, tools, engine, recovery, LLM, API, core) |

---

## 3-Minute Demo Flow

1. **Overview**: View the active incident alert storm, 4 Recharts time-series graphs with deploy & config markers, and interactive dependency graph.
2. **Baseline**: View the unaided LLM guess labelled `UNVERIFIED GUESS` that incorrectly suspects release regression due to temporal correlation alone.
3. **Investigation**: Click "Auto-Run". Watch the engine autonomously execute ~9 tool calls, replan when connection wait times dominate, test every hypothesis's necessary falsifier (version parity, DB health, origin localization) and only then conclude `H_POOL`.
4. **Evidence Lineage**: Open Evidence Explorer, expand observations to inspect raw database rows, and download the cryptographic proof bundle JSON.
5. **Human Control**: Attempt to execute without approval (blocked by HTTP 409). Approve with justification, execute simulation, and verify fresh metrics.


## Surprise-Scenario Demo (Dynamic Adaptation)

On the Investigation page, after the run concludes, use **Inject Dynamic Signal** (e.g. preset *Surprise: DB Failover* or *Vendor Outage*). The engine:
1. stores it as unverified, traceable evidence (`INJ_*`) and links it to hypotheses deterministically,
2. re-scores immediately and reopens the investigation,
3. queues the verifying tool (e.g. `get_db_metrics`), re-tests the claim against fresh telemetry, then re-concludes — the claim is accepted or rejected by data, never by assertion.

The Safe Recovery page's **Generate Report** shows replans, rejected hypotheses with cited evidence IDs, and before/after verification, all derived from stored rows.

## Known Limitations
Telemetry is a deterministic seeded fixture and remediation is simulated (no live infrastructure is touched). Accuracy metrics are measured on this single labelled scenario.
