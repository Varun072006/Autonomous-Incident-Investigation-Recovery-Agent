# TRACEOPS · Autonomous SRE Incident Investigation & Safe Recovery

[![Python 3.10+](https://img.shields.io/badge/python-3.10+-blue.svg)](https://www.python.org/downloads/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.110+-009688.svg)](https://fastapi.tiangolo.com)
[![React 18](https://img.shields.io/badge/React-18-61DAFB.svg)](https://react.dev/)
[![TailwindCSS](https://img.shields.io/badge/TailwindCSS-v3.4-38B2AC.svg)](https://tailwindcss.com/)
[![Groq AI](https://img.shields.io/badge/Groq%20AI-qwen%2Fqwen3.8--27b-F55036.svg)](https://groq.com)
[![Tests Passing](https://img.shields.io/badge/pytest-50%2F50%20passing-brightgreen.svg)]()
[![License](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](LICENSE)

**TRACEOPS** is an enterprise-grade, evidence-first autonomous incident investigation and safe remediation platform. It ingests multi-layer operational telemetry (metrics, logs, distributed traces, alerts, deployments, configuration diffs), constructs unified UTC timelines, evaluates competing root-cause hypotheses with Bayesian heuristics, localizes fault origins across service dependency graphs, synthesizes remediation workflows using **Groq AI (`qwen/qwen3.8-27b`)**, enforces deterministic human approval gates (Tiers 0–3), executes safe simulations on isolated telemetry branches, and mathematically verifies post-remediation recovery over fresh data.

---

## 🏛️ System Architecture

```
                       ┌────────────────────────────────────────┐
                       │   External Telemetry & Ingestion       │
                       │ (Prometheus · OpenTelemetry · PagerDuty)│
                       └───────────────────┬────────────────────┘
                                           │
                                           ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│                          FASTAPI BACKEND ENGINE                                │
│                                                                                 │
│   ┌──────────────────────┐   ┌──────────────────────┐   ┌───────────────────┐   │
│   │  Multimodal Ingest   │   │  12 Diagnostic Tools │   │ Bayesian Scoring  │   │
│   │  (Metrics/Logs/Diff) │──►│  (In-Memory Outages) │──►│ & Replanning Loop │   │
│   └──────────────────────┘   └──────────────────────┘   └───────────────────┘   │
│              ▲                           ▲                        ▲             │
│              │                           │                        │             │
│   ┌──────────┴───────────┐   ┌───────────┴──────────┐   ┌─────────┴─────────┐   │
│   │ SQLite Store (WAL)   │   │ Groq AI Reasoning    │   │ Risk-Tier Gates   │   │
│   │ • Evidence Lineage   │   │ • qwen/qwen3.8-27b   │   │ • Tier 0–3 Matrix │   │
│   │ • SHA-256 Hash Chain │   │ • Tokens & Latency   │   │ • HTTP 409 Guard  │   │
│   └──────────────────────┘   └──────────────────────┘   └───────────────────┘   │
└──────────────────────────────────────────┬──────────────────────────────────────┘
                                           │ REST API (:8000)
                                           ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│                      12-PAGE REACT OPERATIONS CONSOLE                           │
│                                                                                 │
│  [Overview]        • Live Dependency Topology Graph & Anomaly Heatmap           │
│  [Plan & Run]      • Groq AI Recovery Synthesis & Interactive Pipeline Canvas   │
│  [Investigation]   • Autonomous Step-by-Step Bayesian Investigation Arena       │
│  [Evidence]        • Searchable Lineage Explorer with Raw Provenance            │
│  [Recovery]        • Action Catalog, Approval Sign-Off & Post-Incident Report   │
│  [Runs]            • Historical Investigation Runs & State Transition Audit     │
│  [Connectors]      • Live Telemetry Adapters (Prometheus, K8s, CloudWatch)      │
│  [Policies]        • SRE Blast Radius Ceilings & Error Budget Breakers          │
│  [Observability]   • Live SLO Availability & Connection Pool Gauges             │
│  [Organization]    • On-Call Escalation Rota & SHA-256 Proof Verifier           │
│  [Agents]          • Autonomous SRE Agent Capability & Quota Registry           │
│  [Canvas]          • Freeform Visual Workflow Pipeline Designer                 │
└─────────────────────────────────────────────────────────────────────────────────┘
```

---

## ⚡ Quick Start

### One-Command Launcher (Windows PowerShell)

```powershell
.\start.ps1
```
This automatically:
1. Seeds the SQLite database (`traceops.db`) with deterministic scenario telemetry (Seed 42).
2. Installs frontend dependencies (`npm install` if required).
3. Launches the FastAPI backend daemon at **`http://127.0.0.1:8000`** (Swagger docs at `/docs`).
4. Launches the Vite React frontend at **`http://127.0.0.1:5173`**.

---

### Manual Setup Instructions

#### 1. Backend Setup

```bash
# Set Python path to backend
cd backend
$env:PYTHONPATH="."

# Install dependencies
pip install -r requirements.txt

# Seed SQLite database with deterministic scenario (Seed 42)
python -m app.seed

# Run the complete automated test suite (50 tests passing)
python -m pytest tests -q

# Start the FastAPI server
python -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
```

#### 2. Frontend Setup

```bash
cd frontend

# Install dependencies
npm install

# Build production bundle
npm run build

# Start development server
npm run dev -- --host 127.0.0.1 --port 5173
```

---

## ⚙️ Configuration & Environment Variables

Create or edit `backend/.env`:

```env
# Server Configuration
APP_ENV=development
API_HOST=127.0.0.1
API_PORT=8000
DATABASE_PATH=traceops.db
FRONTEND_ORIGIN=http://localhost:5173

# LLM Reasoning Gateway
LLM_PROVIDER_ORDER=groq,ollama,none
GROQ_API_KEY=your_groq_api_key_here
GROQ_MODEL=qwen/qwen3.8-27b
GROQ_BASE_URL=https://api.groq.com/openai/v1
LLM_TIMEOUT_SECONDS=25
LLM_CACHE=true

# Ollama Fallback (Offline Mode)
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_MODEL=qwen2.5:7b
```

---

## 🎯 Key Capabilities & Production Features

### 1. Event-Driven Telemetry & Real-Time Ingestion
- **No Hardcoded Data**: All telemetry, latency timeseries, connection pool metrics, service statuses, alerts, and configuration audits are dynamically retrieved from the live SQLite database.
- **Event-Driven Intake (`POST /api/incident/receive`)**: On-demand simulation of PagerDuty alerts or webhook ingestion. Dynamically evaluates anomaly propagation across caller-callee topologies and resets candidate actions to `PENDING`.

### 2. Live Groq AI Synthesis (`qwen/qwen3.8-27b`)
- **Direct Groq Cloud API**: Queries Groq API in $\approx 2.3$ seconds with temperature `0.1`.
- **Dynamic Reasoning Artifacts**:
  - Executive assessment correlating active alerts with recent deployment/config changes.
  - Objective AI Safety Verdict (e.g. `APPROVED_MEDIUM_RISK`) and Risk Score (`0.0`–`1.0`).
  - Dynamic multi-step operational recovery pipeline.
  - SLA-driven verification thresholds (checkout p95 $< 570$ ms, error rate $< 1.0\%$, pool saturation $< 80\%$).
- **Evidence Commitment**: Saves `EV-AI-PLAN-xxxx` directly into the SQLite `evidence` table with token consumption, latency, and model parameters.

### 3. Risk-Tiered Governance & Human Approval Gates
- **Tier 0 (Autonomous)**: Read-only diagnostic queries (metrics, logs, traces).
- **Tier 1 (Low-Risk)**: Non-mutating notifications (PagerDuty alerts, outbox dispatches).
- **Tier 2 (Medium-Risk)**: Configuration rollbacks, traffic reroutes. **Requires explicit SRE Lead digital approval**.
- **Tier 3 (High-Risk)**: Binary rollbacks, database failovers, node restarts. **Requires written justification and dual sign-off**.
- **Deterministic Enforcement**: Unapproved mutation attempts are strictly rejected by the backend with **HTTP 409 Conflict**.

### 4. Interactive Workflow Canvas & Inspector
- **Full Viewport Dimensions**: Generous `min-h-[500px]` workspace ensuring zero card clipping.
- **Node Inspector Panel**: Selecting any canvas step displays its execution model (`qwen/qwen3.8-27b` vs `deterministic`), permissions, tool name, timeout budgets, and attached evidence records.
- **Interactive Controls**: Zoom in, zoom out, reset zoom, and expandable invariant validation drawer.

### 5. Dual Evidence Lineage & Cryptographic Integrity
- **Incident & Recovery Proof**: Commits both the 67+ initial incident observations and the post-remediation execution/verification records into SQLite:
  - `EV-AI-PLAN-xxxx`: Groq LLM synthesis reasoning.
  - `EV-REC-EXEC-xxxx`: Execution audit trace authorized by on-call commander.
  - `EV-REC-VERIF-xxxx`: 5-minute post-remediation telemetry validation proof.
- **SHA-256 Tamper-Evident Chain**: Every action and audit event is cryptographically linked with rolling hashes, verifiable at `/api/audit/verify`.

---

## 📡 API Reference

| Endpoint | Method | Description |
|---|---|---|
| `/api/health` | `GET` | Health status and scenario fixture information |
| `/api/incident` | `GET` | Incident summary, affected services, and blast radius |
| `/api/incident/receive` | `POST` | Event-driven webhook ingestion; triggers fresh analysis |
| `/api/graph` | `GET` | Service dependency topology with real anomaly states |
| `/api/timeline` | `GET` | Unified UTC incident event chronology |
| `/api/metrics` | `GET` | Multi-service timeseries metrics by branch (`incident` / `post_*`) |
| `/api/actions` | `GET` | Risk-tiered remediation action catalog for current investigation |
| `/api/actions/{id}/ai-plan` | `POST` | **Groq AI live recovery synthesis** (`qwen/qwen3.8-27b`) |
| `/api/actions/{id}/approve` | `POST` | Digital human gate approval; triggers Groq AI synthesis |
| `/api/actions/{id}/reject` | `POST` | Operator rejection of candidate action |
| `/api/actions/{id}/execute` | `POST` | Execute remediation on simulated branch (enforces approval) |
| `/api/actions/{id}/verify` | `POST` | Post-remediation telemetry verification over fresh metrics |
| `/api/investigation` | `POST` | Initialize fresh autonomous investigation |
| `/api/investigation/{id}/step` | `POST` | Execute single Bayesian information-gain diagnostic step |
| `/api/investigation/{id}/evidence` | `GET` | Retrieve stored evidence records with raw database provenance |
| `/api/investigation/{id}/proof` | `GET` | Cryptographic SHA-256 proof bundle download |
| `/api/investigation/{id}/report` | `GET / POST`| Generate & export formal post-incident report |
| `/api/observability/stats` | `GET` | SLO availability, error budget burn rate, and pool metrics |
| `/api/policies` | `GET` | SRE governance tiers, blast radius ceilings, breakers |
| `/api/audit/verify` | `GET` | Tamper-evident SHA-256 audit chain validation |

---

## 🧪 Automated Test Suite

TRACEOPS includes 50 comprehensive unit and integration tests covering the database layer, diagnostic tools, Bayesian reasoning engine, Groq LLM gateway, recovery simulator, and REST API:

```bash
cd backend
python -m pytest tests -v
```

```text
============================== test session starts ==============================
collected 50 items

tests/test_api.py .........................                                [ 50%]
tests/test_core.py ...                                                     [ 56%]
tests/test_db.py ...                                                       [ 62%]
tests/test_engine.py ......                                                [ 74%]
tests/test_lifecycle.py ...                                                [ 80%]
tests/test_llm.py .....                                                    [ 90%]
tests/test_recovery.py ...                                                 [ 96%]
tests/test_tools.py ..                                                     [100%]

============================== 50 passed in 38.28s ==============================
```

---

## 🎬 5-Minute Production SRE Demo Walkthrough

1. **Overview Dashboard (`/`)**:
   - Inspect the live **Service Dependency Topology**: notice `checkout-api` (orchestrator), `payment-service` (anomalous origin), and `payments-db`.
   - Scroll to the **Risk-Tiered Action Catalog**: view `REVERT_CONFIG` (Tier 2 Risk, Recommended) in `PENDING` state.
   - Click **Approve Candidate**: the Human Approval Gate modal opens detailing root cause `CHG-4821` (pool throttle from 50 to 10). Check "Confirmed Evidence Reviewed" and submit.
2. **Plan & Run (`/plan-and-run`)**:
   - SRE is automatically routed to Plan & Run.
   - Observe the **Live Groq AI Inference Banner**: active model `qwen/qwen3.8-27b`, token count ($\approx 820$), inference latency ($\approx 2.3$ s), and SQLite evidence ID `EV-AI-PLAN-xxxx`.
   - Inspect the **Interactive Workflow Canvas**: 6 dynamic stages synthesized by Groq AI. Click any card to inspect tool details and permissions in the right inspector panel.
3. **Safe Execution & Dual Evidence Persistence**:
   - Click **"Execute Approved SRE Flow & Save Dual Evidence"**.
   - Watch stages transition: `COMPLETED` $\to$ parameter rollback executed $\to$ telemetry verified.
   - Verification confirms: checkout p95 latency restored to **$397$ ms** (target $< 570$ ms), error rate reduced to **$0.4\%$**, and pool active normalized to **$12$ connections**.
4. **Evidence & Post-Incident Review**:
   - Click **"Inspect Saved Evidence"** to navigate to `/evidence`: observe all 75+ records (incident signals + recovery proof `EV-REC-EXEC` and `EV-REC-VERIF`).
   - Click **"Post-Incident Report"** to view `/recovery`: download the complete cryptographic incident report.
5. **Auditing & Governance**:
   - Navigate to `/organization` to verify the **SHA-256 Tamper-Evident Chain** across all recorded actions and sign-offs.

---

## 📄 License
This project is licensed under the Apache 2.0 License.
