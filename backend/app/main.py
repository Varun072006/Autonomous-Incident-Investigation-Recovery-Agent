"""FastAPI Application for TRACEOPS Autonomous Incident Investigation System."""
from typing import Any, Dict, List, Optional
from fastapi import FastAPI, HTTPException, Query, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app import config, db, engine, evidence, llm, recover, seed, tools
from app.schemas import (
    ActionDecisionRequest,
    ActionResponse,
    HealthResponse,
    IncidentSummary,
    InjectRequest,
    InvestigationResponse,
    LlmStatusResponse,
    OutageToggleRequest,
    StepResponse,
    VerificationResponse,
)

app = FastAPI(
    title="TRACEOPS API",
    description="Autonomous Incident Investigation, Root-Cause Analysis and Safe Recovery API",
    version="1.0.0",
)

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=[config.settings.FRONTEND_ORIGIN, "http://localhost:5173", "http://127.0.0.1:5173", "*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def on_startup():
    db.init()
    # Check if database has services seeded, if not seed automatically
    c = db.ro_conn()
    try:
        cnt = c.execute("SELECT count(*) as c FROM services").fetchone()["c"]
        if cnt == 0:
            seed.run()
    finally:
        c.close()


@app.get("/api/health", response_model=HealthResponse)
def get_health():
    c = db.ro_conn()
    try:
        c.execute("SELECT 1").fetchone()
        db_ok = True
    except Exception:
        db_ok = False
    finally:
        c.close()

    return HealthResponse(
        status="ok",
        version="1.0.0",
        db_initialized=db_ok,
        scenario_window="13:00-14:40 UTC (2026-10-30)"
    )


@app.get("/api/incident", response_model=IncidentSummary)
def get_incident():
    c = db.ro_conn()
    try:
        svcs = c.execute("SELECT count(*) as c FROM services").fetchone()["c"]
        anoms = tools.detect_anomalies()
        anom_svcs = sorted(list(set(obs["data"]["service"] for obs in anoms.get("observations", []))))
        blast = evidence.calculate_blast_radius()

        return IncidentSummary(
            title="High Latency and Payment Failure Cascade",
            severity="CRITICAL",
            window="2026-10-30T13:00:00Z to 2026-10-30T14:40:00Z",
            services_count=svcs,
            anomalous_services=anom_svcs,
            blast_radius=blast.get("total_affected_count", len(anom_svcs))
        )
    finally:
        c.close()


@app.get("/api/graph")
def get_dependency_graph():
    c = db.ro_conn()
    try:
        svcs = c.execute("SELECT id, name, kind, tier FROM services").fetchall()
        deps = c.execute("SELECT caller_id, callee_id FROM dependencies").fetchall()

        # Compute health status based on real anomaly detection
        anoms = tools.detect_anomalies()
        anomalous_svcs = set(obs["data"]["service"] for obs in anoms.get("observations", []))
        blast = evidence.calculate_blast_radius()
        affected_svcs = set(blast.get("affected_services", []))

        nodes = []
        for s in svcs:
            sid = s["id"]
            if sid in anomalous_svcs:
                st = "critical"
            elif sid in affected_svcs:
                st = "warning"
            else:
                st = "healthy"

            nodes.append({
                "id": sid,
                "name": s["name"],
                "kind": s["kind"],
                "tier": s["tier"],
                "status": st
            })

        edges = [{"source": d["caller_id"], "target": d["callee_id"]} for d in deps]
        return {"nodes": nodes, "edges": edges}
    finally:
        c.close()


@app.get("/api/timeline")
def get_timeline(since: Optional[str] = None, until: Optional[str] = None):
    return evidence.build_unified_timeline(since, until)


@app.get("/api/metrics")
def get_metrics(
    service: Optional[str] = None,
    metric: Optional[str] = None,
    branch: str = "incident"
):
    c = db.ro_conn()
    try:
        sql = "SELECT id, service_id, name, ts, value, branch FROM metrics WHERE branch = ?"
        params: List[Any] = [branch]
        if service:
            sql += " AND service_id = ?"
            params.append(service)
        if metric:
            sql += " AND name = ?"
            params.append(metric)
        sql += " ORDER BY ts ASC"

        rows = c.execute(sql, params).fetchall()
        return [dict(r) for r in rows]
    finally:
        c.close()


@app.post("/api/reset")
def reset_database():
    chk = seed.run()
    return {"status": "RESET_AND_SEEDED", "checksum": chk}


# --- Investigation Routes ---

@app.post("/api/investigation")
def create_investigation():
    inv_id = engine.create()
    state = engine.get(inv_id)
    return {"id": inv_id, "state": state["state"], "started_at": state["started_at"]}


@app.post("/api/investigation/{id}/step", response_model=StepResponse)
def execute_step(id: str):
    try:
        res = engine.step(id)
        return res
    except KeyError:
        raise HTTPException(status_code=404, detail=f"Investigation {id} not found")


@app.get("/api/investigation/{id}", response_model=InvestigationResponse)
def get_investigation(id: str):
    try:
        res = engine.get(id)
        return res
    except KeyError:
        raise HTTPException(status_code=404, detail=f"Investigation {id} not found")


@app.get("/api/investigation/{id}/evidence")
def get_evidence(id: str, hypothesis: Optional[str] = None):
    return evidence.get_investigation_evidence(id, hypothesis)


@app.post("/api/investigation/{id}/inject")
def inject_evidence(id: str, req: InjectRequest):
    try:
        res = engine.inject(id, req.type, req.payload, req.actor)
        return res
    except Exception as e:
        raise HTTPException(status_code=422, detail=str(e))


@app.post("/api/investigation/{id}/narrate")
def narrate_investigation(id: str):
    return llm.narrate(id)


@app.post("/api/investigation/{id}/baseline")
def baseline_investigation(id: str):
    return llm.baseline(id)


@app.get("/api/investigation/{id}/proof")
def get_proof_bundle(id: str):
    return recover.proof(id)


@app.get("/api/llm", response_model=LlmStatusResponse)
def get_llm_status():
    return llm.status()


@app.get("/api/investigation/{id}/llm-calls")
def get_llm_calls(id: str):
    c = db.ro_conn()
    try:
        rows = c.execute("SELECT * FROM llm_calls WHERE investigation_id = ? ORDER BY id DESC", (id,)).fetchall()
        return [dict(r) for r in rows]
    finally:
        c.close()


@app.get("/api/investigation/{id}/claims")
def get_llm_claims(id: str):
    c = db.ro_conn()
    try:
        rows = c.execute(
            """SELECT c.* FROM llm_claims c
               JOIN llm_calls lc ON c.llm_call_id = lc.id
               WHERE lc.investigation_id = ? ORDER BY c.id ASC""",
            (id,)
        ).fetchall()
        return [dict(r) for r in rows]
    finally:
        c.close()


# --- Recovery Routes ---

@app.get("/api/actions")
def get_actions(investigation: str):
    return recover.recommend(investigation)


@app.post("/api/actions/{id}/approve")
def approve_action(id: str, req: ActionDecisionRequest):
    res = recover.approve(id, req.by, req.reason, req.confirmed_evidence_reviewed)
    if not res.get("approved"):
        raise HTTPException(status_code=409, detail=res)
    return res


@app.post("/api/actions/{id}/reject")
def reject_action(id: str, req: ActionDecisionRequest):
    return recover.reject(id, req.by, req.reason)


@app.post("/api/actions/{id}/execute")
def execute_action(id: str):
    res = recover.execute(id)
    if not res.get("executed"):
        status_c = res.get("status_code", 409)
        raise HTTPException(status_code=status_c, detail=res)
    return res


@app.post("/api/actions/{id}/verify")
def verify_action(id: str):
    res = recover.verify(id)
    # If verification returned NOT_RECOVERED, automatically trigger engine.reopen
    if res.get("verdict") == "NOT_RECOVERED":
        c = db.ro_conn()
        try:
            act = c.execute("SELECT investigation_id FROM actions WHERE id = ?", (id,)).fetchone()
            if act:
                engine.reopen(act["investigation_id"], id)
        finally:
            c.close()
    return res


# --- Admin & Outages ---

@app.post("/api/admin/outage")
def toggle_tool_outage(req: OutageToggleRequest):
    tools.set_tool_outage(req.tool, req.enabled)
    return {"tool": req.tool, "outage_enabled": req.enabled, "active_outages": tools.get_tool_outages()}


@app.get("/api/audit/verify")
def verify_audit():
    return recover.verify_audit_chain()

