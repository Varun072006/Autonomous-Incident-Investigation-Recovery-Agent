"""Pydantic schemas for TRACEOPS API and LLM contracts."""
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field


class HealthResponse(BaseModel):
    status: str = "ok"
    version: str = "1.0.0"
    db_initialized: bool
    scenario_window: str = "13:00-14:40 UTC (2026-10-30)"


class IncidentSummary(BaseModel):
    title: str
    severity: str
    window: str
    services_count: int
    anomalous_services: List[str]
    blast_radius: int


class CandidateTool(BaseModel):
    tool: str
    value: float


class ReplanInfo(BaseModel):
    triggered: bool
    reason: Optional[str] = None


class StepResponse(BaseModel):
    n: int
    kind: str  # INTAKE | TOOL_CALL | CONCLUDE | REOPEN
    tool: Optional[str] = None
    args: Dict[str, Any] = Field(default_factory=dict)
    rationale: Optional[str] = None
    candidates: List[CandidateTool] = Field(default_factory=list)
    summary: str
    evidence_ids: List[str] = Field(default_factory=list)
    score_deltas: Dict[str, float] = Field(default_factory=dict)
    replan: Optional[ReplanInfo] = None
    state_after: str = "INVESTIGATING"


class ScoreHistoryItem(BaseModel):
    n: int
    share: float


class HypothesisResponse(BaseModel):
    id: str
    key: str
    title: str
    category: str
    prior: float
    status: str  # LEADING | PLAUSIBLE | WEAKENED | RULED_OUT
    score: float
    share: float
    coverage: float
    supporting: int
    contradicting: int
    score_history: List[ScoreHistoryItem] = Field(default_factory=list)


class FindingResponse(BaseModel):
    leader_key: str
    leader_title: str
    share: float
    coverage: float
    margin: float
    status: str
    explanation: str
    explanation_source: str
    grounding_score: float
    evidence_ids: List[str]
    impact: Dict[str, Any]


class InvestigationResponse(BaseModel):
    id: str
    state: str
    started_at: str
    hypotheses: List[HypothesisResponse]
    steps: List[StepResponse]
    finding: Optional[FindingResponse] = None
    impact: Optional[Dict[str, Any]] = None


class EvidenceLink(BaseModel):
    hypothesis_id: str
    relation: str  # SUPPORTS | CONTRADICTS | NEUTRAL
    strength: float
    rule: str
    explanation: str


class EvidenceItem(BaseModel):
    id: str
    investigation_id: str
    step_id: Optional[int] = None
    text: str
    ts_from: str
    ts_to: str
    refs: List[Dict[str, Any]] = Field(default_factory=list)
    extracted_by: str = "tool"
    quote: Optional[str] = None
    verified: int = 1
    links: List[EvidenceLink] = Field(default_factory=list)


class InjectRequest(BaseModel):
    type: str  # alert | log | config_change | metric | ticket
    payload: Dict[str, Any]
    actor: str = "operator"


class ActionResponse(BaseModel):
    id: str
    investigation_id: str
    target_service_id: str
    kind: str
    risk_tier: int
    description: str
    rollback_plan: str
    recommended: int
    status: str  # PENDING | APPROVED | REJECTED | EXECUTED_SIM | VERIFIED | NOT_RECOVERED
    approved_by: Optional[str] = None
    approval_reason: Optional[str] = None
    decided_at: Optional[str] = None
    executed_at: Optional[str] = None


class ActionDecisionRequest(BaseModel):
    by: str = "oncall_lead"
    reason: Optional[str] = None
    confirmed_evidence_reviewed: bool = False


class VerificationResponse(BaseModel):
    verdict: str  # VERIFIED | NOT_RECOVERED | INCONCLUSIVE
    checks: Dict[str, Any]
    checked_at: str


class OutageToggleRequest(BaseModel):
    tool: str
    enabled: bool


class LlmStatusResponse(BaseModel):
    configured_order: List[str]
    active_provider: str
    active_model: str
    cache_enabled: bool
    last_latency_ms: Optional[float] = None
    total_calls_logged: int


# Narrator Schema
class NarratorSentence(BaseModel):
    text: str
    cites: List[str]


class NarratorOutput(BaseModel):
    sentences: List[NarratorSentence]
    caveats: List[str] = Field(default_factory=list)


# Baseline Guess Schema
class BaselineOutput(BaseModel):
    root_cause_category: str
    reasoning: str
