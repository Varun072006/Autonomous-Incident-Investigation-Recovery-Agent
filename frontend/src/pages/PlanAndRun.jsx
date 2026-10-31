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
  RotateCcw
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import WorkflowCanvas from '../components/WorkflowCanvas';
import StepSettingsPanel from '../components/StepSettingsPanel';
import { api } from '../api';

export default function PlanAndRun({ currentInvId, setCurrentInvId }) {
  const navigate = useNavigate();

  const [objective, setObjective] = useState(
    'Investigate checkout latency surge and error rate spike in payment-gateway after v2.14.0 canary rollout'
  );
  const [planner, setPlanner] = useState('Auto');
  const [loading, setLoading] = useState(false);
  const [planGenerated, setPlanGenerated] = useState(true);
  const [selectedNode, setSelectedNode] = useState(null);
  const [llmStatus, setLlmStatus] = useState(null);

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
  }, []);

  const handleGeneratePlan = () => {
    setLoading(true);
    // Simulate plan synthesis
    setTimeout(() => {
      setPlanGenerated(true);
      setLoading(false);
    }, 600);
  };

  const handleExecutePlan = async () => {
    setLoading(true);
    try {
      let invId = currentInvId;
      if (!invId) {
        const inv = await api.createInvestigation();
        invId = inv.id;
        setCurrentInvId(invId);
      }
      // Trigger intake step
      await api.stepInvestigation(invId);
      // Navigate to investigation arena
      navigate('/investigation');
    } catch (err) {
      console.error(err);
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
          State an objective. The supervisor produces a structured task plan; the deterministic engine validates agents, 
          dependencies, read-only tools, permissions, and risk tiers before anything can run.
        </p>

        {/* Input Card */}
        <div className="mt-6 p-5 bg-[#FAF8F3] rounded-xl border border-slate-200/80 shadow-sm space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
            <div className="lg:col-span-3 space-y-1.5">
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide">
                Objective *
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

      {/* Plan Output Header */}
      {planGenerated && (
        <div className="px-8 py-3 bg-[#FAF8F3] border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <span className="text-xs font-bold text-slate-900">Plan</span>
            <span className="text-[11px] text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded font-medium flex items-center">
              <CheckCircle className="w-3 h-3 mr-1 text-emerald-600" />
              valid
            </span>
            <span className="text-[11px] text-slate-500 font-mono">
              planner: <span className="font-semibold text-slate-700">{planner.toLowerCase()}</span>
            </span>
            <span className="text-[11px] text-slate-400 font-mono">
              plan_to_{currentInvId ? currentInvId.slice(0, 8) : '42a8d9b0'}
            </span>
          </div>

          <div className="flex items-center space-x-3">
            <button
              onClick={handleExecutePlan}
              className="inline-flex items-center px-4 py-1.5 text-xs font-semibold rounded-md bg-blue-600 hover:bg-blue-700 text-white shadow-sm transition-all"
            >
              <Play className="w-3.5 h-3.5 mr-1.5 fill-current" />
              Execute Plan & Run Investigation
            </button>
          </div>
        </div>
      )}

      {/* Workflow Canvas & Inspector Area */}
      {planGenerated && (
        <div className="flex flex-col p-6 space-y-6">
          <div className="flex overflow-hidden gap-4 min-h-[460px]">
            <WorkflowCanvas
              nodes={nodes}
              selectedNodeId={selectedNode?.id}
              onSelectNode={(node) => setSelectedNode(node)}
              validationIssues={[
                { message: 'All diagnostic tools operate strictly in read-only mode.', step: 'step_metrics' },
                { message: 'Rollback v2.14.0 is classified as Tier 2 and requires human approval.', step: 'step_remediation' }
              ]}
              className="h-full min-h-[440px]"
            />

            {selectedNode && (
              <StepSettingsPanel
                selectedStep={selectedNode}
                onClose={() => setSelectedNode(null)}
                onUpdateStep={handleUpdateStep}
                onDeleteStep={handleDeleteStep}
              />
            )}
          </div>

          {/* ALL PLANNED STEPS Table matching Image 3 */}
          <div className="space-y-3 pt-2">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                ALL PLANNED STEPS & TOOLS
              </h3>
              <span className="text-[11px] font-mono text-slate-400">
                {nodes.length} registered steps
              </span>
            </div>

            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs">
              <table className="w-full text-left text-xs text-slate-600">
                <thead className="bg-[#F8FAFC] text-[10px] uppercase font-bold text-slate-400 tracking-wider border-b border-slate-200">
                  <tr>
                    <th className="py-2.5 px-4 font-bold">Step Name</th>
                    <th className="py-2.5 px-4 font-bold">Handler / Tool</th>
                    <th className="py-2.5 px-4 font-bold">Status</th>
                    <th className="py-2.5 px-4 font-bold">Target Service</th>
                    <th className="py-2.5 px-4 font-bold">Risk Tier</th>
                    <th className="py-2.5 px-4 font-bold">Evidence ID</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {nodes.map((node) => (
                    <tr
                      key={node.id}
                      onClick={() => setSelectedNode(node)}
                      className={`hover:bg-slate-50 cursor-pointer transition-colors ${
                        selectedNode?.id === node.id ? 'bg-blue-50/40' : ''
                      }`}
                    >
                      <td className="py-3 px-4 font-semibold text-slate-900 flex items-center space-x-2">
                        <div className={`w-2 h-2 rounded-full ${node.status === 'COMPLETED' ? 'bg-emerald-500' : 'bg-slate-300'}`}></div>
                        <span>{node.label}</span>
                      </td>
                      <td className="py-3 px-4 font-mono text-slate-500">{node.toolName}</td>
                      <td className="py-3 px-4">
                        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                          node.status === 'COMPLETED'
                            ? 'text-emerald-700 bg-emerald-50 border border-emerald-200'
                            : 'text-slate-600 bg-slate-100'
                        }`}>
                          {node.status}
                        </span>
                      </td>
                      <td className="py-3 px-4 font-mono text-slate-700 text-[11px]">{node.service}</td>
                      <td className="py-3 px-4 font-mono text-slate-600">
                        {node.riskTier === 0 ? 'Tier 0 (Auto)' : `Tier ${node.riskTier} (Gate)`}
                      </td>
                      <td className="py-3 px-4 font-mono text-blue-600 text-[11px]">
                        {node.evidenceId || '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
