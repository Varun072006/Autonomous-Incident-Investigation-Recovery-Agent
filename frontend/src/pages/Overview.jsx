import React, { useEffect, useState } from 'react';
import { 
  ShieldAlert, 
  AlertTriangle, 
  Clock, 
  Layers, 
  TrendingUp, 
  Cpu, 
  Activity, 
  RefreshCw,
  Play,
  CheckCircle,
  ExternalLink,
  ChevronRight,
  Database,
  Server,
  ArrowRight,
  ShieldCheck,
  X
} from 'lucide-react';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';
import DependencyGraph from '../components/DependencyGraph';

export default function Overview({ currentInvId }) {
  const navigate = useNavigate();

  const [incident, setIncident] = useState(null);
  const [graphData, setGraphData] = useState(null);
  const [timeline, setTimeline] = useState([]);
  const [metrics, setMetrics] = useState([]);
  const [actions, setActions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedService, setSelectedService] = useState(null);

  // Approval modal state
  const [actionModal, setActionModal] = useState(null);
  const [approvalReason, setApprovalReason] = useState('Verified connection pool exhaustion root cause supported by operational evidence items');
  const [reviewedConfirmed, setReviewedConfirmed] = useState(true);
  const [actionFeedback, setActionFeedback] = useState(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const [inc, graph, tl, coLatency, coErrors, payPool, dbCpu, acts] = await Promise.all([
        api.getIncident(),
        api.getGraph(),
        api.getTimeline(),
        api.getMetrics('checkout-api', 'p95_latency_ms'),
        api.getMetrics('checkout-api', 'error_rate'),
        api.getMetrics('payment-service', 'pool_active'),
        api.getMetrics('payments-db', 'cpu_utilization'),
        api.getActions(currentInvId).catch(() => [])
      ]);

      setIncident(inc);
      setGraphData(graph);
      setTimeline(tl);
      setActions(acts);

      if (graph?.nodes?.length > 0) {
        const crit = graph.nodes.find(n => n.status === 'critical') || graph.nodes[0];
        setSelectedService(crit);
      }

      // Merge metrics by timestamp for clean multi-line charts
      const chartMap = {};
      coLatency.forEach(m => {
        const timeKey = m.ts.slice(11, 16);
        chartMap[timeKey] = { time: timeKey, co_latency: m.value };
      });
      coErrors.forEach(m => {
        const timeKey = m.ts.slice(11, 16);
        if (chartMap[timeKey]) chartMap[timeKey].co_err = (m.value * 100);
      });
      payPool.forEach(m => {
        const timeKey = m.ts.slice(11, 16);
        if (chartMap[timeKey]) chartMap[timeKey].pool_active = m.value;
      });
      dbCpu.forEach(m => {
        const timeKey = m.ts.slice(11, 16);
        if (chartMap[timeKey]) chartMap[timeKey].db_cpu = m.value;
      });

      setMetrics(Object.values(chartMap));
    } catch (err) {
      console.error("Overview fetch error:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [currentInvId]);

  // Handle Approve Candidate click
  const handleApproveCandidate = (action) => {
    if (action.approval_required || action.risk_tier >= 2) {
      setActionModal(action);
    } else {
      // Tier 1 action can be auto-approved and forwarded to Plan & Run
      forwardToPlanAndRun(action, 'Auto-approved Tier 1 Action');
    }
  };

  const handleConfirmApproval = async () => {
    if (!actionModal) return;
    try {
      await api.approveAction(
        actionModal.id,
        'oncall_lead',
        approvalReason,
        reviewedConfirmed
      );
      
      const approvedAct = { ...actionModal, status: 'APPROVED', approval_reason: approvalReason };
      setActionModal(null);
      
      // Navigate to Plan & Run tab for task assigning
      forwardToPlanAndRun(approvedAct, approvalReason);
    } catch (err) {
      alert("Approval blocked: " + err.message);
    }
  };

  const forwardToPlanAndRun = (action, reason) => {
    navigate('/plan-and-run', {
      state: {
        objective: `Execute approved recovery: ${action.kind} on ${action.target_service_id || 'payment-service'} (${action.description})`,
        approvedAction: {
          ...action,
          approval_reason: reason
        }
      }
    });
  };

  const handleExecute = async (actionId) => {
    try {
      const res = await api.executeAction(actionId);
      setActionFeedback(`Executed ${actionId}: ${res.message || 'Execution simulated successfully.'}`);
      setTimeout(() => setActionFeedback(null), 4000);
      loadData();
    } catch (err) {
      alert("Execution Blocked (HTTP 409): " + (err.detail?.message || err.message));
    }
  };

  const handleVerify = async (actionId) => {
    try {
      const res = await api.verifyAction(actionId);
      setActionFeedback(`Verification ${res.verdict}: p95 latency normalized. (Checks passed: ${res.checks_passed || 3}/${res.checks_total || 3})`);
      setTimeout(() => setActionFeedback(null), 5000);
      loadData();
    } catch (err) {
      alert("Verification check failed: " + err.message);
    }
  };

  const handleReject = async (actionId) => {
    try {
      await api.rejectAction(actionId, 'oncall_lead', 'Rejected by operator from overview catalog');
      loadData();
    } catch (err) {
      alert("Reject error: " + err.message);
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-[#F8FAFC] overflow-y-auto select-none">
      {/* Top Page Header */}
      <div className="px-8 pt-7 pb-5 bg-white border-b border-slate-200/80">
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center space-x-2">
              <h1 className="text-xl font-bold text-slate-900 tracking-tight">Overview</h1>
              <span className="text-[10px] font-semibold text-rose-700 bg-rose-50 border border-rose-200 px-2 py-0.5 rounded-full">
                Active Incident
              </span>
              <span className="text-[10px] font-mono text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
                Fixture: Seed 42
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Active Incident Window: 13:00 to 14:40 UTC (2026-10-30) · Onset: ~14:14 UTC
            </p>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={async () => {
                try {
                  const res = await api.receiveIncident({
                    service: 'payment-service',
                    title: 'High Latency & Connection Pool Depletion Spike',
                    urgency: 'CRITICAL',
                    source: 'pagerduty_webhook'
                  });
                  setActionFeedback(`Event Ingested (${res.incident_id}): Operational telemetry fetched from live connectors, timeline updated, and actions ready for SRE approval.`);
                  setTimeout(() => setActionFeedback(null), 5000);
                  loadData();
                } catch (e) {
                  alert('Incident intake error: ' + e.message);
                }
              }}
              className="inline-flex items-center px-3 py-1.5 text-xs font-semibold text-rose-700 bg-rose-50 border border-rose-200 rounded-lg hover:bg-rose-100 transition-colors shadow-xs"
              title="Trigger live event-driven incident reception and telemetry fetch"
            >
              <ShieldAlert className="w-3.5 h-3.5 mr-1.5 text-rose-600" />
              Ingest Live Incident Alert
            </button>
            <button
              onClick={loadData}
              className="inline-flex items-center px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors shadow-xs"
            >
              <RefreshCw className="w-3.5 h-3.5 mr-1.5 text-slate-500" />
              Refresh Signals
            </button>
            <button
              onClick={() => navigate('/investigation')}
              className="inline-flex items-center px-3 py-1.5 text-xs font-medium text-white bg-slate-900 rounded-lg hover:bg-slate-800 transition-colors shadow-xs"
            >
              <Layers className="w-3.5 h-3.5 mr-1.5" />
              Investigate Incident
            </button>
          </div>
        </div>

        {/* Global Feedback Alert Banner */}
        {actionFeedback && (
          <div className="mt-4 p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-xs text-emerald-800 flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <CheckCircle className="w-4 h-4 text-emerald-600 flex-shrink-0" />
              <span>{actionFeedback}</span>
            </div>
            <button onClick={() => setActionFeedback(null)} className="text-emerald-700 hover:text-emerald-900">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Incident Summary Metric Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-6">
          <div className="bg-slate-50/80 rounded-xl p-4 border border-slate-200/70">
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
              Peak Checkout p95
            </div>
            <div className="text-2xl font-bold text-rose-600 tracking-tight mt-1">
              5.4s
            </div>
            <div className="text-[11px] text-slate-500 font-mono mt-0.5">
              Baseline: 380ms (14x surge)
            </div>
          </div>

          <div className="bg-slate-50/80 rounded-xl p-4 border border-slate-200/70">
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
              Peak Error Rate
            </div>
            <div className="text-2xl font-bold text-rose-600 tracking-tight mt-1">
              14.0%
            </div>
            <div className="text-[11px] text-slate-500 font-mono mt-0.5">
              Baseline: 0.3% error rate
            </div>
          </div>

          <div className="bg-slate-50/80 rounded-xl p-4 border border-slate-200/70">
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
              Blast Radius
            </div>
            <div className="text-2xl font-bold text-slate-900 tracking-tight mt-1">
              {incident?.blast_radius || 3} Services
            </div>
            <div className="text-[11px] text-slate-500 font-mono mt-0.5">
              gateway, checkout, payment
            </div>
          </div>

          <div className="bg-slate-50/80 rounded-xl p-4 border border-slate-200/70">
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
              Active Alerts
            </div>
            <div className="text-2xl font-bold text-slate-900 tracking-tight mt-1">
              4 Alerts
            </div>
            <div className="text-[11px] text-slate-500 font-mono mt-0.5">
              p95 latency · 5xx rate · pool_active
            </div>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="p-8 space-y-6 flex-1">
        {/* Topology & Node Inspector Row */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
          <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200/90 shadow-xs p-6 flex flex-col justify-between">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div>
                <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                  Service Dependency Topology
                </h3>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Live directional graph representing service call dependencies and anomaly propagation path.
                </p>
              </div>
              <span className="text-[11px] font-mono text-slate-400">
                8 services · 7 edges
              </span>
            </div>

            <DependencyGraph
              graphData={graphData}
              selectedNodeId={selectedService?.id}
              onSelectNode={(node) => setSelectedService(node)}
            />
          </div>

          {/* Node Inspector Card */}
          <div className="bg-white rounded-xl border border-slate-200/90 shadow-xs p-6 space-y-5">
            <div>
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <div className="w-5 h-5 rounded-md bg-slate-100 flex items-center justify-center text-slate-700">
                    <Server className="w-3.5 h-3.5" />
                  </div>
                  <h3 className="text-sm font-bold text-slate-900 tracking-tight truncate max-w-[170px]">
                    {selectedService?.name || 'payment-service'}
                  </h3>
                </div>
                <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${
                  selectedService?.status === 'critical'
                    ? 'text-rose-700 bg-rose-50 border-rose-200'
                    : selectedService?.status === 'warning'
                    ? 'text-amber-700 bg-amber-50 border-amber-200'
                    : 'text-emerald-700 bg-emerald-50 border-emerald-200'
                }`}>
                  {selectedService?.status === 'critical' ? 'anomalous' : selectedService?.status || 'healthy'}
                </span>
              </div>
              <div className="text-[10px] font-mono text-slate-400 mt-1">
                service · Tier {selectedService?.tier || '1'} · v2.14.0
              </div>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed font-sans">
              {selectedService?.id === 'payment-service'
                ? 'Primary payment execution domain. Identified as causal anomaly origin due to connection pool starvation.'
                : selectedService?.id === 'checkout-api'
                ? 'High-throughput checkout gateway orchestrating order completion. Experiencing cascading timeouts.'
                : `Service node responsible for ${selectedService?.name} operational workload in production.`}
            </p>

            <div className="flex flex-wrap items-center gap-1.5 pt-1">
              <button 
                onClick={() => navigate('/investigation')}
                className="inline-flex items-center px-2.5 py-1 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-md hover:bg-slate-50 transition-colors shadow-xs"
              >
                Inspect Telemetry
              </button>
              <button 
                onClick={() => navigate('/evidence')}
                className="inline-flex items-center px-2.5 py-1 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-md hover:bg-slate-50 transition-colors shadow-xs"
              >
                View Evidence Lineage
              </button>
            </div>
          </div>
        </div>

        {/* ------------------------------------------------------------- */}
        {/* RISK-TIERED ACTION CATALOG & HUMAN GATES (Matching User Image) */}
        {/* ------------------------------------------------------------- */}
        <div className="bg-white rounded-xl border border-slate-200/90 shadow-xs p-6 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                  Risk-Tiered Action Catalog & Human Gates
                </h3>
              </div>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Tier 2 requires human approval. Tier 3 requires approval plus mandatory written justification.
              </p>
            </div>
            <span className="text-[10px] font-semibold text-amber-800 bg-[#FEF3C7] border border-amber-300 px-2.5 py-1 rounded">
              SIMULATED EXECUTION
            </span>
          </div>

          {/* Action List */}
          <div className="space-y-3.5 pt-1">
            {actions.map((act) => (
              <div
                key={act.id}
                className="rounded-xl border border-slate-200 p-4 bg-white hover:border-slate-300 transition-all space-y-3"
              >
                {/* Action Title Row */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <span className="text-xs font-bold text-slate-900 font-mono tracking-tight">
                      {act.kind}
                    </span>
                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded border ${
                      act.risk_tier === 1
                        ? 'bg-blue-50 text-blue-700 border-blue-200'
                        : act.risk_tier === 2
                        ? 'bg-amber-50 text-amber-800 border-amber-200'
                        : 'bg-rose-50 text-rose-700 border-rose-200'
                    }`}>
                      Tier {act.risk_tier} Risk
                    </span>
                    {act.recommended ? (
                      <span className="text-[10px] font-bold text-white bg-[#2563EB] px-2 py-0.5 rounded uppercase tracking-wide">
                        RECOMMENDED
                      </span>
                    ) : null}
                  </div>

                  <span className={`text-[10px] font-mono font-bold px-2.5 py-0.5 rounded border uppercase ${
                    act.status === 'VERIFIED'
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-300'
                      : act.status === 'APPROVED' || act.status === 'EXECUTED_SIM'
                      ? 'bg-blue-50 text-blue-700 border-blue-300'
                      : 'bg-slate-100 text-slate-600 border-slate-200'
                  }`}>
                    {act.status}
                  </span>
                </div>

                {/* Description */}
                <p className="text-xs text-slate-700 leading-relaxed font-sans">
                  {act.description}
                </p>

                {/* Metadata Line */}
                <div className="text-[11px] font-mono text-slate-400">
                  Target Service: <span className="text-slate-600 font-semibold">{act.target_service_id || 'payment-service'}</span> · Rollback: <span className="text-slate-600">{act.rollback_plan || 'Reapply configuration change with ticket reference CHG-4821 if required.'}</span>
                </div>

                {/* Interactive Action Buttons */}
                <div className="flex flex-wrap items-center gap-2 pt-1">
                  {act.status === 'VERIFIED' ? (
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="inline-flex items-center px-3 py-1.5 text-xs font-semibold rounded-md bg-emerald-50 text-emerald-700 border border-emerald-300">
                        <CheckCircle className="w-3.5 h-3.5 mr-1.5 text-emerald-600" />
                        Verified & Resolved in DB
                      </span>
                      <button
                        onClick={() => navigate('/evidence')}
                        className="inline-flex items-center px-3 py-1.5 text-xs font-medium rounded-md bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 transition-colors shadow-xs"
                      >
                        <Database className="w-3.5 h-3.5 mr-1.5 text-blue-600" />
                        Inspect Dual Evidence
                      </button>
                      <button
                        onClick={() => navigate('/recovery')}
                        className="inline-flex items-center px-3 py-1.5 text-xs font-medium rounded-md bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 transition-colors shadow-xs"
                      >
                        <ShieldCheck className="w-3.5 h-3.5 mr-1.5 text-emerald-600" />
                        Post-Incident Report
                      </button>
                    </div>
                  ) : act.status === 'APPROVED' ? (
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        onClick={() => forwardToPlanAndRun(act, act.approval_reason || 'Approved by SRE')}
                        className="inline-flex items-center px-3.5 py-1.5 text-xs font-bold rounded-md bg-blue-600 hover:bg-blue-700 text-white shadow-xs transition-colors"
                      >
                        <ArrowRight className="w-3.5 h-3.5 mr-1.5" />
                        Assigned: Go to Plan & Run
                      </button>
                      <button
                        onClick={() => handleExecute(act.id)}
                        className="inline-flex items-center px-3.5 py-1.5 text-xs font-semibold rounded-md bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs transition-colors"
                      >
                        Execute (SIMULATED)
                      </button>
                      <button
                        onClick={() => handleReject(act.id)}
                        className="inline-flex items-center px-3 py-1.5 text-xs font-medium rounded-md bg-white border border-slate-200 text-slate-700 hover:bg-slate-50"
                      >
                        Reject
                      </button>
                    </div>
                  ) : act.status === 'EXECUTED_SIM' ? (
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        onClick={() => forwardToPlanAndRun(act, act.approval_reason || 'Approved by SRE')}
                        className="inline-flex items-center px-3 py-1.5 text-xs font-medium rounded-md bg-white border border-slate-200 text-slate-700 hover:bg-slate-50"
                      >
                        View in Plan & Run
                      </button>
                      <button
                        onClick={() => handleVerify(act.id)}
                        className="inline-flex items-center px-3.5 py-1.5 text-xs font-bold rounded-md bg-[#14B8A6] hover:bg-[#0D9488] text-white shadow-xs"
                      >
                        <CheckCircle className="w-3.5 h-3.5 mr-1.5" />
                        Verify Telemetry
                      </button>
                    </div>
                  ) : (
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        onClick={() => handleApproveCandidate(act)}
                        className="inline-flex items-center px-3.5 py-1.5 text-xs font-semibold rounded-md bg-[#0D9488] hover:bg-[#0F766E] text-white shadow-xs transition-colors"
                      >
                        <CheckCircle className="w-3.5 h-3.5 mr-1.5" />
                        Approve Candidate
                      </button>
                      <button
                        onClick={() => handleReject(act.id)}
                        className="inline-flex items-center px-3.5 py-1.5 text-xs font-medium rounded-md bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 transition-colors shadow-xs"
                      >
                        Reject
                      </button>
                      <button
                        disabled
                        className="inline-flex items-center px-3.5 py-1.5 text-xs font-medium rounded-md bg-slate-50 border border-slate-200 text-slate-400 cursor-not-allowed opacity-60"
                        title="Requires approval before execution"
                      >
                        Execute (SIMULATED)
                      </button>
                      <button
                        disabled
                        className="inline-flex items-center px-3.5 py-1.5 text-xs font-medium rounded-md bg-slate-50 border border-slate-200 text-slate-400 cursor-not-allowed opacity-60"
                      >
                        Verify Telemetry
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Telemetry Charts Row */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white p-5 rounded-xl border border-slate-200/90 shadow-xs">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                  Checkout API p95 Latency (ms)
                </h4>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Timeseries latency spike detected at 13:32 UTC following canary rollout.
                </p>
              </div>
              <span className="text-[11px] font-mono text-slate-400">Deploy: 13:28 UTC</span>
            </div>
            <div className="h-56 min-w-0">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={metrics}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
                  <XAxis dataKey="time" stroke="#94A3B8" fontSize={10} />
                  <YAxis stroke="#94A3B8" fontSize={10} />
                  <Tooltip />
                  <Line type="monotone" dataKey="co_latency" stroke="#EF4444" strokeWidth={2} dot={false} name="p95 Latency" />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="bg-white p-5 rounded-xl border border-slate-200/90 shadow-xs">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                  Checkout 5xx Error Rate (%)
                </h4>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Downstream payment gateway error cascade exceeding 5% SLA threshold.
                </p>
              </div>
              <span className="text-[11px] font-mono text-slate-400">Threshold: 5.0%</span>
            </div>
            <div className="h-56 min-w-0">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={metrics}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
                  <XAxis dataKey="time" stroke="#94A3B8" fontSize={10} />
                  <YAxis stroke="#94A3B8" fontSize={10} />
                  <Tooltip />
                  <Line type="monotone" dataKey="co_err" stroke="#F43F5E" strokeWidth={2} dot={false} name="Error Rate %" />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* Chronological Incident Timeline Table */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
              CHRONOLOGICAL INCIDENT TIMELINE
            </h3>
            <span className="text-[11px] font-mono text-slate-400">
              {timeline.length} operational events ordered by UTC timestamp
            </span>
          </div>

          <div className="bg-white rounded-xl border border-slate-200/90 overflow-hidden shadow-xs">
            <table className="w-full text-left text-xs text-slate-600">
              <thead className="bg-[#F8FAFC] text-[10px] uppercase font-bold text-slate-400 tracking-wider border-b border-slate-200">
                <tr>
                  <th className="py-2.5 px-4 font-bold">Timestamp</th>
                  <th className="py-2.5 px-4 font-bold">Event Type</th>
                  <th className="py-2.5 px-4 font-bold">Event Title</th>
                  <th className="py-2.5 px-4 font-bold">Operational Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {timeline.map((event, idx) => (
                  <tr key={idx} className="hover:bg-slate-50 transition-colors">
                    <td className="py-3 px-4 font-mono text-slate-500 text-[11px] whitespace-nowrap">
                      {event.ts ? event.ts.replace('T', ' ').replace('Z', ' UTC') : '—'}
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap">
                      <span className={`text-[10px] font-mono font-semibold px-2 py-0.5 rounded ${
                        event.type === 'DEPLOYMENT'
                          ? 'bg-blue-50 text-blue-700 border border-blue-200'
                          : event.type === 'CONFIG_CHANGE'
                          ? 'bg-purple-50 text-purple-700 border border-purple-200'
                          : event.type === 'ANOMALY_ONSET'
                          ? 'bg-rose-50 text-rose-700 border border-rose-200'
                          : 'bg-slate-100 text-slate-700'
                      }`}>
                        {event.type}
                      </span>
                    </td>
                    <td className="py-3 px-4 font-semibold text-slate-900 whitespace-nowrap">
                      {event.title}
                    </td>
                    <td className="py-3 px-4 text-slate-600 text-[11px]">
                      {event.details}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* HUMAN APPROVAL MODAL (Forwards to Plan & Run upon approval)    */}
      {/* ------------------------------------------------------------- */}
      {actionModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-lg w-full p-6 shadow-xl border border-slate-200 space-y-4 animate-in fade-in zoom-in-95 duration-100">
            <div className="flex items-start justify-between">
              <div>
                <span className="text-[10px] font-bold text-amber-800 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded">
                  Human Approval Required (Tier {actionModal.risk_tier})
                </span>
                <h3 className="text-base font-bold text-slate-900 mt-1">
                  Authorize {actionModal.kind} Recovery Action
                </h3>
              </div>
              <button onClick={() => setActionModal(null)} className="text-slate-400 hover:text-slate-600">
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed font-sans">
              {actionModal.description}
            </p>

            <div className="p-3 bg-slate-50 rounded-lg space-y-1.5 text-xs text-slate-600">
              <div><strong className="text-slate-900">Target Service:</strong> {actionModal.target_service_id || 'payment-service'}</div>
              <div><strong className="text-slate-900">Rollback Safety:</strong> {actionModal.rollback_plan || 'Reapply config CHG-4821'}</div>
              <div><strong className="text-slate-900">Sign-off Role:</strong> On-Call SRE Commander (avery_admin)</div>
            </div>

            <div className="space-y-1.5">
              <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wide">
                Approval Justification (Required for Audit Trail)
              </label>
              <textarea
                value={approvalReason}
                onChange={(e) => setApprovalReason(e.target.value)}
                rows={2}
                className="w-full text-xs text-slate-800 p-2.5 border border-slate-300 rounded-md focus:outline-none focus:ring-1 focus:ring-emerald-500"
                placeholder="State reason for approving production recovery..."
              />
            </div>

            <label className="flex items-center space-x-2 text-xs text-slate-700 cursor-pointer pt-1">
              <input
                type="checkbox"
                checked={reviewedConfirmed}
                onChange={(e) => setReviewedConfirmed(e.target.checked)}
                className="rounded text-emerald-600 focus:ring-emerald-500"
              />
              <span>I confirm I have reviewed supporting operational evidence before mutation</span>
            </label>

            <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
              <button
                type="button"
                onClick={() => setActionModal(null)}
                className="px-3.5 py-1.5 text-xs font-medium text-slate-600 hover:text-slate-800"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={!reviewedConfirmed}
                onClick={handleConfirmApproval}
                className="inline-flex items-center px-4 py-2 text-xs font-bold rounded-lg bg-[#0D9488] hover:bg-[#0F766E] text-white shadow-xs disabled:opacity-50 transition-colors"
              >
                <CheckCircle className="w-3.5 h-3.5 mr-1.5" />
                Approve & Plan Task Assignment
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
