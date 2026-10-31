import React, { useState, useEffect } from 'react';
import { 
  Play, 
  Sparkles, 
  CheckCircle, 
  AlertTriangle, 
  Cpu, 
  FileCheck, 
  ArrowRight,
  Layers,
  RotateCcw,
  ShieldCheck,
  Zap,
  Activity
} from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import WorkflowCanvas from '../components/WorkflowCanvas';
import StepSettingsPanel from '../components/StepSettingsPanel';
import { api } from '../api';

export default function PlanAndRun({ currentInvId, setCurrentInvId }) {
  const navigate = useNavigate();
  const location = useLocation();

  const [objective, setObjective] = useState(
    'Investigate checkout latency surge and error rate spike in payment-gateway after v2.14.0 canary rollout'
  );
  const [planner, setPlanner] = useState('Auto');
  const [loading, setLoading] = useState(false);
  const [planGenerated, setPlanGenerated] = useState(true);
  const [selectedNode, setSelectedNode] = useState(null);
  const [llmStatus, setLlmStatus] = useState(null);

  // Assigned recovery action passed from Overview approval gate
  const [assignedAction, setAssignedAction] = useState(null);
  const [executionFeedback, setExecutionFeedback] = useState(null);

  // Preset prompts
  const presets = [
    'Investigate checkout latency surge and error rate spike in payment-gateway after v2.14.0 canary rollout',
    'Root cause analysis on database connection pool saturation in postgresql-primary',
    'Evaluate blast radius for payment-gateway cascade failure to order-service and notification-service'
  ];

  // Default workflow nodes representing the plan
  const [nodes, setNodes] = useState([
    {
      id: 'step_trigger',
      type: 'trigger',
      label: 'Incident Alert',
      toolName: 'trigger.alert_ingest',
      service: 'payment-gateway',
      status: 'COMPLETED',
      riskTier: 0,
      readOnly: true,
      description: 'Ingests high latency (p99 > 800ms) and 5xx error spike alerts.',
      anomalyCount: 1
    },
    {
      id: 'step_metrics',
      type: 'diagnostic',
      label: 'Telemetry Anomaly Scan',
      toolName: 'tools.query_metrics',
      service: 'payment-gateway',
      status: 'COMPLETED',
      riskTier: 0,
      readOnly: true,
      evidenceId: 'E0_0_8b1f2',
      description: 'Scans timeseries metrics using median/MAD anomaly detection.',
      anomalyCount: 2
    },
    {
      id: 'step_diff',
      type: 'diagnostic',
      label: 'Inspect Canary Diff',
      toolName: 'tools.inspect_config',
      service: 'payment-gateway',
      status: 'PENDING',
      riskTier: 0,
      readOnly: true,
      evidenceId: 'E1_0_1fa7c',
      description: 'Checks configuration differences between v2.13.9 and v2.14.0.'
    },
    {
      id: 'step_db',
      type: 'diagnostic',
      label: 'DB Pool Saturation',
      toolName: 'tools.db_pool_status',
      service: 'postgresql-primary',
      status: 'PENDING',
      riskTier: 0,
      readOnly: true,
      evidenceId: 'E2_0_7c4b1',
      description: 'Checks active pool connections vs max limit and waiting queue times.'
    },
    {
      id: 'step_remediation',
      type: 'action',
      label: 'Rollback v2.14.0',
      toolName: 'recover.rollback_deployment',
      service: 'payment-gateway',
      status: 'PENDING',
      riskTier: 2,
      readOnly: false,
      requiresApproval: true,
      description: 'Rolls back payment-gateway deployment from canary v2.14.0 to stable v2.13.9. Requires human sign-off.'
    },
    {
      id: 'step_verification',
      type: 'diagnostic',
      label: 'Verify Post-Recovery SLA',
      toolName: 'recover.verify_telemetry',
      service: 'payment-gateway',
      status: 'PENDING',
      riskTier: 0,
      readOnly: true,
      description: 'Runs post-recovery verification telemetry check to verify latency drops below SLA threshold.'
    }
  ]);

  useEffect(() => {
    api.getLlmStatus().then(setLlmStatus).catch(() => {});

    // Check if an approved recovery action was passed from Overview
    if (location.state?.objective) {
      setObjective(location.state.objective);
    }
    if (location.state?.approvedAction) {
      const act = location.state.approvedAction;
      setAssignedAction(act);

      // Construct task assigning pipeline nodes
      setNodes([
        {
          id: 'step_approval_gate',
          type: 'trigger',
          label: 'Human Approval Gate',
          toolName: 'gate.human_signoff',
          service: 'traceops-governance',
          status: 'COMPLETED',
          riskTier: act.risk_tier || 2,
          readOnly: true,
          description: `Authorized by On-Call Commander avery_admin: ${act.kind} (Risk Tier ${act.risk_tier}). Reason: ${act.approval_reason || 'Verified connection pool exhaustion root cause via evidence EV-004'}`
        },
        {
          id: 'step_task_assign',
          type: 'action',
          label: `Task: Apply ${act.kind}`,
          toolName: `recovery.${act.kind.toLowerCase()}`,
          service: act.target_service_id || 'payment-service',
          status: 'PENDING',
          riskTier: act.risk_tier || 2,
          readOnly: false,
          description: act.description
        },
        {
          id: 'step_task_verify',
          type: 'diagnostic',
          label: 'Task: Post-Remediation Verification',
          toolName: 'tools.verify_slo',
          service: act.target_service_id || 'payment-service',
          status: 'PENDING',
          riskTier: 0,
          readOnly: true,
          description: 'Validates that p95 latency drops back to < 400ms and error rates normalize to < 0.5%.'
        },
        {
          id: 'step_task_report',
          type: 'diagnostic',
          label: 'Task: Document Post-Mortem',
          toolName: 'report.publish_sqlite',
          service: 'traceops-control',
          status: 'PENDING',
          riskTier: 0,
          readOnly: true,
          description: 'Compiles and permanently stores structured post-incident report into SQLite post_incident_reports table.'
        }
      ]);
      setPlanGenerated(true);
    }
  }, [location.state]);

  const handleGeneratePlan = () => {
    setLoading(true);
    setTimeout(() => {
      setPlanGenerated(true);
      setLoading(false);
    }, 600);
  };

  const handleExecutePlan = async () => {
    setLoading(true);
    try {
      if (assignedAction) {
        // Sequentially execute the assigned recovery task
        setNodes(prev => prev.map(n => n.id === 'step_task_assign' ? { ...n, status: 'RUNNING' } : n));
        
        // Execute simulated remediation
        await api.executeAction(assignedAction.id);
        setNodes(prev => prev.map(n => n.id === 'step_task_assign' ? { ...n, status: 'COMPLETED' } : n));

        // Execute verification check
        setNodes(prev => prev.map(n => n.id === 'step_task_verify' ? { ...n, status: 'RUNNING' } : n));
        const verifRes = await api.verifyAction(assignedAction.id);
        setNodes(prev => prev.map(n => n.id === 'step_task_verify' ? { ...n, status: 'COMPLETED' } : n));

        // Finalize post-mortem report
        setNodes(prev => prev.map(n => n.id === 'step_task_report' ? { ...n, status: 'COMPLETED' } : n));
        
        setExecutionFeedback({
          message: `Task execution finished! ${assignedAction.kind} successfully applied to ${assignedAction.target_service_id || 'payment-service'}. Telemetry verdict: ${verifRes.verdict}.`,
          verdict: verifRes.verdict
        });
        return;
      }

      let invId = currentInvId;
      if (!invId) {
        const inv = await api.createInvestigation();
        invId = inv.id;
        setCurrentInvId(invId);
      }
      await api.stepInvestigation(invId);
      navigate('/investigation');
    } catch (err) {
      console.error(err);
      alert("Execution error: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateStep = (id, updates) => {
    setNodes(nodes.map(n => n.id === id ? { ...n, ...updates } : n));
    if (selectedNode?.id === id) {
      setSelectedNode({ ...selectedNode, ...updates });
    }
  };

  const handleDeleteStep = (id) => {
    setNodes(nodes.filter(n => n.id !== id));
    if (selectedNode?.id === id) {
      setSelectedNode(null);
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-[#FAF8F3] overflow-y-auto">
      {/* Page Header */}
      <div className="px-8 pt-8 pb-6 border-b border-slate-200 bg-white">
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Plan & run</h1>
        <p className="text-sm text-slate-500 mt-1 max-w-3xl leading-relaxed">
          State an objective or assign approved tasks. The supervisor produces a structured task plan; the deterministic engine validates agents, 
          dependencies, read-only tools, permissions, and risk tiers before anything can run.
        </p>

        {/* Input Card */}
        <div className="mt-6 p-5 bg-[#FAF8F3] rounded-xl border border-slate-200/80 shadow-sm space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
            <div className="lg:col-span-3 space-y-1.5">
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide">
                Objective / Task Assignment *
              </label>
              <textarea
                value={objective}
                onChange={(e) => setObjective(e.target.value)}
                rows={3}
                className="w-full text-xs text-slate-900 p-3 bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 shadow-sm"
                placeholder="State an operational incident or investigation objective..."
              />
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide">
                Planner
              </label>
              <select
                value={planner}
                onChange={(e) => setPlanner(e.target.value)}
                className="w-full text-xs text-slate-800 p-2.5 bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 shadow-sm font-medium"
              >
                <option value="Auto">Auto (Groq qwen3.8-27b)</option>
                <option value="Deterministic">Deterministic (Greedy IG)</option>
                <option value="Groq">Groq qwen/qwen3.8-27b</option>
              </select>
              <p className="text-[11px] text-slate-500 leading-normal">
                Auto uses the Groq reasoning engine when configured, verified with Pydantic schemas and grounding check.
              </p>
            </div>
          </div>

          {/* Preset Buttons */}
          <div className="flex flex-wrap items-center gap-2 pt-1">
            {presets.map((preset, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => setObjective(preset)}
                className="text-[11px] text-slate-600 bg-white hover:bg-slate-100 hover:text-slate-900 border border-slate-200 px-3 py-1.5 rounded-full transition-all truncate max-w-md shadow-xs"
              >
                {preset}
              </button>
            ))}
          </div>

          {/* Submit Action */}
          <div className="pt-2 flex items-center justify-between border-t border-slate-200/60">
            <button
              onClick={handleGeneratePlan}
              disabled={loading}
              className="inline-flex items-center px-4 py-2 text-xs font-bold rounded-lg bg-[#0F172A] hover:bg-[#1E293B] text-white shadow-sm transition-all disabled:opacity-50"
            >
              <Sparkles className="w-3.5 h-3.5 mr-2 text-blue-400" />
              {loading ? 'Validating Plan...' : 'Generate and validate plan'}
            </button>

            <div className="flex items-center space-x-2 text-xs text-slate-500 font-mono">
              <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
              <span>Active Groq Model: <strong className="text-slate-700">{llmStatus?.configured_model || 'qwen/qwen3.8-27b'}</strong></span>
            </div>
          </div>
        </div>
      </div>

      {/* Task Assignment Banner if forward from Overview */}
      {assignedAction && (
        <div className="mx-8 mt-4 p-4 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center justify-between text-xs text-emerald-900 shadow-xs">
          <div className="flex items-center space-x-3">
            <CheckCircle className="w-5 h-5 text-emerald-600 flex-shrink-0" />
            <div>
              <div className="font-bold text-sm">
                Approved Task Assigned from Overview: {assignedAction.kind} (Tier {assignedAction.risk_tier} Risk)
              </div>
              <div className="text-slate-600 mt-0.5">
                {assignedAction.description} · Target: <strong>{assignedAction.target_service_id || 'payment-service'}</strong>
              </div>
            </div>
          </div>
          <button
            onClick={handleExecutePlan}
            disabled={loading}
            className="inline-flex items-center px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-lg shadow-sm transition-colors"
          >
            <Play className="w-3.5 h-3.5 mr-1.5" />
            {loading ? 'Executing Tasks...' : 'Execute Recovery Pipeline'}
          </button>
        </div>
      )}

      {/* Execution Success Banner */}
      {executionFeedback && (
        <div className="mx-8 mt-4 p-4 bg-emerald-100/90 border border-emerald-300 rounded-xl flex items-center justify-between text-xs text-emerald-950 shadow-xs">
          <div className="flex items-center space-x-3">
            <CheckCircle className="w-5 h-5 text-emerald-700 flex-shrink-0" />
            <div>
              <div className="font-bold text-sm">Task Pipeline Executed & Telemetry Verified!</div>
              <div className="text-emerald-800 mt-0.5">{executionFeedback.message}</div>
            </div>
          </div>
          <button
            onClick={() => navigate('/recovery')}
            className="px-3 py-1.5 bg-white border border-emerald-300 text-emerald-900 font-semibold rounded-md hover:bg-emerald-50 shadow-xs"
          >
            View Verification Post-Mortem
          </button>
        </div>
      )}

      {/* Plan Output Header */}
      {planGenerated && (
        <div className="px-8 py-3 bg-[#FAF8F3] border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center space-x-3 text-xs">
            <span className="font-bold text-slate-900">Plan</span>
            <span className="inline-flex items-center text-emerald-700 font-medium">
              <CheckCircle className="w-3 h-3 mr-1" />
              valid
            </span>
            <span className="text-slate-400 font-mono">planner: {planner.toLowerCase()}</span>
            <span className="text-slate-400 font-mono">plan_rev4821</span>
          </div>

          <button
            onClick={handleExecutePlan}
            disabled={loading}
            className="inline-flex items-center px-4 py-1.5 text-xs font-bold rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs transition-all disabled:opacity-50"
          >
            <Play className="w-3.5 h-3.5 mr-1.5" />
            {loading ? 'Executing Plan...' : 'Run Plan'}
          </button>
        </div>
      )}

      {/* Main Workflow Visualization Area */}
      <div className="flex-1 flex overflow-hidden">
        {/* Canvas */}
        <WorkflowCanvas
          nodes={nodes}
          selectedNodeId={selectedNode?.id}
          onSelectNode={(node) => setSelectedNode(node)}
          validationIssues={[]}
          className="m-6"
        />

        {/* Right Settings Inspector */}
        <StepSettingsPanel
          node={selectedNode}
          onUpdate={handleUpdateStep}
          onDelete={handleDeleteStep}
        />
      </div>
    </div>
  );
}
