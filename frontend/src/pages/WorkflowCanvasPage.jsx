import React, { useState, useEffect } from 'react';
import { 
  Play, 
  Save, 
  RotateCcw, 
  Plus, 
  CheckCircle, 
  AlertTriangle, 
  Layers, 
  Search, 
  ShieldCheck, 
  ShieldAlert, 
  Cpu, 
  Database,
  ArrowLeft
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import WorkflowCanvas from '../components/WorkflowCanvas';
import StepSettingsPanel from '../components/StepSettingsPanel';
import { api } from '../api';

export default function WorkflowCanvasPage({ currentInvId, setCurrentInvId }) {
  const navigate = useNavigate();

  const [workflowName, setWorkflowName] = useState('Payment Incident Auto-Triage & Recovery');
  const [loading, setLoading] = useState(false);
  const [selectedNode, setSelectedNode] = useState(null);
  const [searchStepQuery, setSearchStepQuery] = useState('');

  // Step library matching the available tools and actions in traceops
  const stepLibrary = [
    {
      category: 'Diagnostic Tools',
      items: [
        {
          id_prefix: 'diag_metrics',
          type: 'diagnostic',
          label: 'Query Metrics',
          toolName: 'tools.query_metrics',
          service: 'payment-gateway',
          riskTier: 0,
          readOnly: true,
          description: 'Fetches timeseries p99 latency, request rates, and 5xx error metrics using median/MAD anomaly detection.'
        },
        {
          id_prefix: 'diag_logs',
          type: 'diagnostic',
          label: 'Search Logs',
          toolName: 'tools.search_logs',
          service: 'payment-gateway',
          riskTier: 0,
          readOnly: true,
          description: 'Searches application and infrastructure logs for stack traces, connection pool timeouts, and fatal errors.'
        },
        {
          id_prefix: 'diag_traces',
          type: 'diagnostic',
          label: 'Trace Downstream',
          toolName: 'tools.trace_downstream',
          service: 'payment-gateway',
          riskTier: 0,
          readOnly: true,
          description: 'Traces distributed spans to identify the exact service origin of latency anomalies.'
        },
        {
          id_prefix: 'diag_config',
          type: 'diagnostic',
          label: 'Inspect Config Diff',
          toolName: 'tools.inspect_config',
          service: 'payment-gateway',
          riskTier: 0,
          readOnly: true,
          description: 'Compares active configuration and environment parameters between canary v2.14.0 and stable v2.13.9.'
        },
        {
          id_prefix: 'diag_pool',
          type: 'diagnostic',
          label: 'DB Pool Stats',
          toolName: 'tools.db_pool_status',
          service: 'postgresql-primary',
          riskTier: 0,
          readOnly: true,
          description: 'Queries active connection pool utilization and queue wait times on postgresql-primary.'
        }
      ]
    },
    {
      category: 'Remediation Actions',
      items: [
        {
          id_prefix: 'act_rollback',
          type: 'action',
          label: 'Rollback v2.14.0',
          toolName: 'recover.rollback_deployment',
          service: 'payment-gateway',
          riskTier: 2,
          readOnly: false,
          requiresApproval: true,
          description: 'Rolls back payment-gateway deployment from canary v2.14.0 to stable v2.13.9. Requires human sign-off.'
        },
        {
          id_prefix: 'act_pool_tune',
          type: 'action',
          label: 'Expand Pool Limit',
          toolName: 'recover.tune_pool',
          service: 'postgresql-primary',
          riskTier: 1,
          readOnly: false,
          requiresApproval: false,
          description: 'Dynamically bumps max_connections from 20 to 50 on the connection pool. Pre-authorized Standard action.'
        },
        {
          id_prefix: 'act_circuit_breaker',
          type: 'action',
          label: 'Trip Circuit Breaker',
          toolName: 'recover.circuit_breaker',
          service: 'payment-gateway',
          riskTier: 2,
          readOnly: false,
          requiresApproval: true,
          description: 'Temporarily sheds non-essential traffic to downstream payment providers. Requires service owner sign-off.'
        }
      ]
    },
    {
      category: 'Verification Probes',
      items: [
        {
          id_prefix: 'verif_telemetry',
          type: 'diagnostic',
          label: 'Verify Post-Fix SLA',
          toolName: 'recover.verify_telemetry',
          service: 'payment-gateway',
          riskTier: 0,
          readOnly: true,
          description: 'Queries fresh telemetry after recovery execution to verify whether p99 latency returned to baseline.'
        },
        {
          id_prefix: 'verif_audit',
          type: 'diagnostic',
          label: 'Audit Log Hash Check',
          toolName: 'recover.verify_audit_chain',
          service: 'system',
          riskTier: 0,
          readOnly: true,
          description: 'Verifies the cryptographic SHA-256 tamper-evident hash chain across all state transitions.'
        }
      ]
    }
  ];

  // Active workflow nodes
  const [nodes, setNodes] = useState([
    {
      id: 'step_trigger',
      type: 'trigger',
      label: 'Incident Trigger',
      toolName: 'trigger.manual',
      service: 'payment-gateway',
      status: 'COMPLETED',
      riskTier: 0,
      readOnly: true,
      description: 'Initial intake trigger triggered by elevated latency alert.'
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
      anomalyCount: 2,
      evidenceId: 'E0_0_8b1f2',
      description: 'Scans timeseries metrics using median/MAD anomaly detection.'
    },
    {
      id: 'step_diff',
      type: 'diagnostic',
      label: 'Inspect Config Diff',
      toolName: 'tools.inspect_config',
      service: 'payment-gateway',
      status: 'PENDING',
      riskTier: 0,
      readOnly: true,
      evidenceId: 'E1_0_1fa7c',
      description: 'Checks configuration differences between v2.13.9 and v2.14.0.'
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
      label: 'Verify Post-Fix SLA',
      toolName: 'recover.verify_telemetry',
      service: 'payment-gateway',
      status: 'PENDING',
      riskTier: 0,
      readOnly: true,
      description: 'Queries fresh telemetry after recovery execution to verify whether p99 latency returned to baseline.'
    }
  ]);

  const handleAddStep = (item) => {
    const newId = `step_${Date.now()}`;
    const newNode = {
      ...item,
      id: newId,
      status: 'PENDING'
    };
    setNodes([...nodes, newNode]);
    setSelectedNode(newNode);
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

  const handleRun = async () => {
    setLoading(true);
    try {
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
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-[#FAF8F3] overflow-hidden">
      {/* Top Workflow Bar matching Image 1 */}
      <header className="h-14 bg-white border-b border-slate-200 px-6 flex items-center justify-between sticky top-0 z-40 select-none">
        <div className="flex items-center space-x-4">
          <button
            onClick={() => navigate('/plan-and-run')}
            className="text-slate-400 hover:text-slate-600 transition-colors p-1 rounded-md hover:bg-slate-100 flex items-center text-xs font-semibold"
            title="Workflows"
          >
            <ArrowLeft className="w-3.5 h-3.5 mr-1" />
            Workflows
          </button>

          <span className="text-slate-300">/</span>

          <div className="flex items-center space-x-2">
            <input
              type="text"
              value={workflowName}
              onChange={(e) => setWorkflowName(e.target.value)}
              className="text-sm font-bold text-slate-900 border border-transparent hover:border-slate-300 focus:border-blue-500 rounded px-2 py-1 bg-transparent focus:bg-white transition-all outline-none"
            />
            <span className="text-[11px] font-mono text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">
              v1
            </span>
            <span className="text-[11px] text-slate-400 font-medium">
              All changes saved
            </span>
          </div>
        </div>

        <div className="flex items-center space-x-3">
          {/* Validation count */}
          <div className="flex items-center space-x-1.5 text-xs text-amber-700 bg-amber-50 px-2.5 py-1 rounded-md border border-amber-200">
            <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
            <span>2 validation checks active</span>
          </div>

          <button
            onClick={() => {}}
            className="inline-flex items-center px-3 py-1.5 text-xs font-medium rounded-md border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 transition-colors shadow-sm"
          >
            <Save className="w-3.5 h-3.5 mr-1 text-slate-500" />
            Save
          </button>

          <button
            onClick={handleRun}
            disabled={loading}
            className="inline-flex items-center px-4 py-1.5 text-xs font-semibold rounded-md bg-[#1E293B] hover:bg-[#0F172A] text-white shadow-sm transition-all disabled:opacity-50"
          >
            <Play className="w-3.5 h-3.5 mr-1.5 fill-current" />
            {loading ? 'Running...' : 'Run'}
          </button>
        </div>
      </header>

      {/* Main 3-Column Layout: Steps Library | Canvas | Step Settings */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left STEPS Library Drawer */}
        <aside className="w-72 bg-white border-r border-slate-200 flex flex-col justify-between overflow-y-auto select-none">
          <div className="p-4 space-y-4">
            <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
              STEPS
            </div>

            {/* Step search */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search steps & tools..."
                value={searchStepQuery}
                onChange={(e) => setSearchStepQuery(e.target.value)}
                className="w-full text-xs pl-8 pr-3 py-1.5 border border-slate-200 rounded-md bg-slate-50 focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-500 text-slate-800"
              />
            </div>

            {/* Categorized Steps */}
            <div className="space-y-5">
              {stepLibrary.map((category) => {
                const filteredItems = category.items.filter(item => 
                  item.label.toLowerCase().includes(searchStepQuery.toLowerCase()) ||
                  item.toolName.toLowerCase().includes(searchStepQuery.toLowerCase())
                );
                if (filteredItems.length === 0) return null;

                return (
                  <div key={category.category} className="space-y-2">
                    <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                      {category.category}
                    </div>
                    <div className="space-y-1.5">
                      {filteredItems.map((item) => (
                        <div
                          key={item.toolName}
                          className="p-2.5 rounded-lg border border-slate-200 bg-white hover:border-blue-400 hover:shadow-xs transition-all flex items-start justify-between group"
                        >
                          <div className="pr-2 truncate">
                            <div className="text-xs font-semibold text-slate-800 truncate">
                              {item.label}
                            </div>
                            <div className="text-[10px] text-slate-400 truncate mt-0.5">
                              {item.description}
                            </div>
                          </div>
                          <button
                            onClick={() => handleAddStep(item)}
                            className="p-1 rounded text-slate-400 group-hover:text-blue-600 group-hover:bg-blue-50 transition-colors"
                            title="Add step to canvas"
                          >
                            <Plus className="w-4 h-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </aside>

        {/* Center Canvas */}
        <div className="flex-1 flex flex-col p-4 overflow-hidden">
          <WorkflowCanvas
            nodes={nodes}
            selectedNodeId={selectedNode?.id}
            onSelectNode={(node) => setSelectedNode(node)}
            validationIssues={[
              { message: 'Rollback requires Tier 2 explicit human approval before execution.', step: 'step_remediation' },
              { message: 'All 12 diagnostic tools operate strictly in read-only mode.', step: 'step_metrics' }
            ]}
            className="flex-1"
          />
        </div>

        {/* Right Step Settings Inspector */}
        <StepSettingsPanel
          selectedStep={selectedNode}
          onClose={() => setSelectedNode(null)}
          onUpdateStep={handleUpdateStep}
          onDeleteStep={handleDeleteStep}
        />
      </div>
    </div>
  );
}
