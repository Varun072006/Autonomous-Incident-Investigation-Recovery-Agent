import React, { useState, useEffect } from 'react';
import { 
  Users, 
  ShieldCheck, 
  ShieldAlert, 
  Cpu, 
  Plus, 
  Edit3, 
  Power, 
  Archive, 
  ChevronRight,
  Database,
  Search,
  CheckCircle,
  ExternalLink
} from 'lucide-react';
import { api } from '../api';

export default function Agents({ currentInvId }) {
  const [llmStatus, setLlmStatus] = useState(null);
  const [showArchived, setShowArchived] = useState(false);

  useEffect(() => {
    api.getLlmStatus().then(setLlmStatus).catch(() => {});
  }, []);

  const agentsList = [
    {
      id: 'supervisor',
      name: 'Incident Supervisor',
      type: 'supervisor',
      level: 0,
      status: 'active',
      model: llmStatus?.configured_model || 'qwen/qwen3.8-27b',
      toolsCount: 0,
      runs: 14,
      reportsTo: '—',
      permissions: 'read / plan / score',
      budgets: '12 tool calls · 6 model calls · 20,000 tokens · 120s',
      retries: '2, backoff 0.5s → 8s',
      delegatesTo: ['Telemetry Coordinator', 'Infrastructure Coordinator', 'Safe Recovery Coordinator'],
      capabilities: ['hypothesis_generation', 'bayesian_scoring', 'information_gain_planning'],
      description: 'Interprets operational alerts, evaluates competing root-cause hypotheses, selects the next diagnostic check, and delegates to specialist coordinators.',
      instructions: 'Holds no mutating tools. It plans, scores evidence, and delegates; it never executes infrastructure mutations directly without human approval.'
    },
    {
      id: 'coord_telemetry',
      name: 'Telemetry Coordinator',
      type: 'coordinator',
      level: 1,
      status: 'active',
      model: 'deterministic (median/MAD)',
      toolsCount: 4,
      runs: 28,
      reportsTo: 'Incident Supervisor',
      permissions: 'read (metrics)',
      budgets: '20 tool calls · 30s',
      retries: '1, backoff 1s',
      delegatesTo: ['Timeseries Anomaly Specialist', 'Error Rate Specialist'],
      capabilities: ['anomaly_detection', 'blast_radius_calculation'],
      description: 'Coordinates telemetry scans across checkout-api and payment-gateway services using median/MAD anomaly detection.',
      instructions: 'Queries timeseries data in read-only mode. Computes anomaly onset timestamps and propagates evidence to the supervisor.'
    },
    {
      id: 'coord_infra',
      name: 'Infrastructure Coordinator',
      type: 'coordinator',
      level: 1,
      status: 'active',
      model: 'deterministic',
      toolsCount: 5,
      runs: 22,
      reportsTo: 'Incident Supervisor',
      permissions: 'read (logs, traces, db pool)',
      budgets: '15 tool calls · 45s',
      retries: '2, backoff 0.5s → 4s',
      delegatesTo: ['DB Pool Specialist', 'Distributed Trace Specialist', 'Config Diff Specialist'],
      capabilities: ['pool_status_inspection', 'config_diff', 'trace_tree_analysis'],
      description: 'Manages deep diagnostic tools including connection pool utilization, distributed trace waterfalls, and deployment configs.',
      instructions: 'Performs read-only inspection of postgresql-primary pool and canary deployment configuration.'
    },
    {
      id: 'coord_recovery',
      name: 'Safe Recovery Coordinator',
      type: 'coordinator',
      level: 1,
      status: 'active',
      model: 'deterministic + gate',
      toolsCount: 3,
      runs: 9,
      reportsTo: 'Incident Supervisor',
      permissions: 'execute_guarded (Tier 1-3)',
      budgets: '3 action calls · 180s',
      retries: '0 (strictly no retry on mutating actions)',
      delegatesTo: ['Human Approval Gate Specialist', 'Verification Telemetry Specialist'],
      capabilities: ['rollback_execution', 'pool_expansion', 'sla_verification'],
      description: 'Enforces human approval gates for Tier 2 and Tier 3 actions, executes simulated recovery, and validates SLA recovery.',
      instructions: 'Refuses unapproved actions with HTTP 409 Conflict. Requires written human justification for Tier 3 actions.'
    },
    {
      id: 'spec_pool',
      name: 'DB Pool Specialist',
      type: 'specialist',
      level: 2,
      status: 'active',
      model: 'deterministic',
      toolsCount: 2,
      runs: 16,
      reportsTo: 'Infrastructure Coordinator',
      permissions: 'read (db_pool)',
      budgets: '5 tool calls · 15s',
      retries: '1',
      delegatesTo: [],
      capabilities: ['pgbouncer_stats', 'queue_depth_probe'],
      description: 'Inspects active connections vs max limit and waiting queue times on database pools.',
      instructions: 'Captures pool metrics and returns structured evidence with evidence ID.'
    },
    {
      id: 'spec_diff',
      name: 'Config Diff Specialist',
      type: 'specialist',
      level: 2,
      status: 'active',
      model: 'deterministic',
      toolsCount: 1,
      runs: 12,
      reportsTo: 'Infrastructure Coordinator',
      permissions: 'read (k8s_diff)',
      budgets: '2 tool calls · 10s',
      retries: '1',
      delegatesTo: [],
      capabilities: ['environment_diff', 'canary_revision_check'],
      description: 'Compares active configuration parameters and environment variables between canary v2.14.0 and stable v2.13.9.',
      instructions: 'Generates diff records identifying connection pool limit regressions.'
    },
    {
      id: 'spec_verification',
      name: 'Verification Telemetry Specialist',
      type: 'specialist',
      level: 2,
      status: 'active',
      model: 'deterministic',
      toolsCount: 1,
      runs: 8,
      reportsTo: 'Safe Recovery Coordinator',
      permissions: 'read (fresh_telemetry)',
      budgets: '5 tool calls · 30s',
      retries: '2',
      delegatesTo: [],
      capabilities: ['sla_conformance', 'telemetry_verification'],
      description: 'Samples fresh post-recovery operational telemetry to verify p95 latency and error rate return to baseline.',
      instructions: 'Never declares an incident resolved unless verification checks strictly pass.'
    }
  ];

  const [selectedAgent, setSelectedAgent] = useState(agentsList[0]);

  return (
    <div className="flex-1 flex flex-col h-full bg-[#F8FAFC] overflow-y-auto select-none">
      {/* Top Page Header matching Image 3 */}
      <div className="px-8 pt-7 pb-5 bg-white border-b border-slate-200/80">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-xl font-bold text-slate-900 tracking-tight">Agents</h1>
            <p className="text-xs text-slate-500 mt-1 max-w-3xl leading-relaxed">
              The configurable hierarchy the runtime enforces: the supervisor plans, coordinators delegate, specialists 
              act, and each agent may call only the tools in its registry entry.
            </p>
          </div>
          <button className="inline-flex items-center px-3.5 py-1.5 text-xs font-semibold rounded-md bg-[#0F172A] hover:bg-[#1E293B] text-white shadow-xs transition-colors">
            <Plus className="w-3.5 h-3.5 mr-1.5" />
            New agent
          </button>
        </div>
      </div>

      {/* Main Content Area: Hierarchy Canvas on Left, Details Card on Right */}
      <div className="p-8 space-y-8 flex-1">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
          {/* Hierarchy Canvas (cols 1-2) */}
          <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200/90 shadow-xs p-6 overflow-hidden flex flex-col justify-between min-h-[440px]">
            {/* Tree Flow Diagram */}
            <div className="flex-1 flex flex-col items-center justify-center py-4">
              {/* Level 0: Supervisor */}
              <div
                onClick={() => setSelectedAgent(agentsList[0])}
                className={`w-64 bg-white rounded-lg border cursor-pointer p-3 text-center transition-all shadow-xs ${
                  selectedAgent.id === agentsList[0].id
                    ? 'border-blue-500 ring-2 ring-blue-500/20 shadow-md'
                    : 'border-slate-200 hover:border-slate-300'
                }`}
              >
                <div className="flex items-center justify-center space-x-1.5 text-xs font-bold text-slate-900">
                  <div className="w-2 h-2 rounded-full bg-blue-600"></div>
                  <span>{agentsList[0].name}</span>
                </div>
                <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                  L0 · {agentsList[0].toolsCount} tools · Supervisor
                </div>
              </div>

              {/* Connecting Tree Lines SVG */}
              <div className="w-full max-w-md h-8 flex items-center justify-center">
                <svg width="340" height="32" viewBox="0 0 340 32" className="text-slate-300">
                  {/* Vertical stem down from supervisor */}
                  <line x1="170" y1="0" x2="170" y2="16" stroke="currentColor" strokeWidth="1.5" />
                  {/* Horizontal distributor bar */}
                  <line x1="45" y1="16" x2="295" y2="16" stroke="currentColor" strokeWidth="1.5" />
                  {/* Stems down to 3 coordinators */}
                  <line x1="45" y1="16" x2="45" y2="32" stroke="currentColor" strokeWidth="1.5" />
                  <line x1="170" y1="16" x2="170" y2="32" stroke="currentColor" strokeWidth="1.5" />
                  <line x1="295" y1="16" x2="295" y2="32" stroke="currentColor" strokeWidth="1.5" />
                </svg>
              </div>

              {/* Level 1: Coordinators */}
              <div className="grid grid-cols-3 gap-4 w-full">
                {agentsList.slice(1, 4).map((coord) => (
                  <div
                    key={coord.id}
                    onClick={() => setSelectedAgent(coord)}
                    className={`bg-white rounded-lg border cursor-pointer p-2.5 text-center transition-all shadow-xs ${
                      selectedAgent.id === coord.id
                        ? 'border-blue-500 ring-2 ring-blue-500/20 shadow-md'
                        : 'border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <div className="text-[11px] font-bold text-slate-800 truncate">
                      {coord.name}
                    </div>
                    <div className="text-[9px] text-slate-400 font-mono mt-0.5">
                      L1 · {coord.toolsCount} tools
                    </div>
                  </div>
                ))}
              </div>

              {/* Connecting Tree Lines down to Specialists */}
              <div className="w-full max-w-md h-8 flex items-center justify-center">
                <svg width="340" height="32" viewBox="0 0 340 32" className="text-slate-300">
                  <line x1="45" y1="0" x2="45" y2="16" stroke="currentColor" strokeWidth="1.5" />
                  <line x1="170" y1="0" x2="170" y2="16" stroke="currentColor" strokeWidth="1.5" />
                  <line x1="295" y1="0" x2="295" y2="16" stroke="currentColor" strokeWidth="1.5" />
                  <line x1="45" y1="16" x2="295" y2="16" stroke="currentColor" strokeWidth="1.5" />
                  <line x1="45" y1="16" x2="45" y2="32" stroke="currentColor" strokeWidth="1.5" />
                  <line x1="170" y1="16" x2="170" y2="32" stroke="currentColor" strokeWidth="1.5" />
                  <line x1="295" y1="16" x2="295" y2="32" stroke="currentColor" strokeWidth="1.5" />
                </svg>
              </div>

              {/* Level 2: Specialists */}
              <div className="grid grid-cols-3 gap-4 w-full">
                {agentsList.slice(4, 7).map((spec) => (
                  <div
                    key={spec.id}
                    onClick={() => setSelectedAgent(spec)}
                    className={`bg-white rounded-lg border cursor-pointer p-2.5 text-center transition-all shadow-xs ${
                      selectedAgent.id === spec.id
                        ? 'border-blue-500 ring-2 ring-blue-500/20 shadow-md'
                        : 'border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <div className="text-[11px] font-medium text-slate-800 truncate">
                      {spec.name}
                    </div>
                    <div className="text-[9px] text-slate-400 font-mono mt-0.5">
                      L2 · {spec.toolsCount} tools
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Right Inspector Panel matching Image 3 */}
          <div className="bg-white rounded-xl border border-slate-200/90 shadow-xs p-6 space-y-5">
            {/* Header */}
            <div>
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <div className="w-5 h-5 rounded-md bg-slate-100 flex items-center justify-center text-slate-700">
                    <Users className="w-3.5 h-3.5" />
                  </div>
                  <h3 className="text-sm font-bold text-slate-900 tracking-tight">
                    {selectedAgent.name}
                  </h3>
                </div>
                <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                  {selectedAgent.status}
                </span>
              </div>
              <div className="text-[10px] font-mono text-slate-400 mt-1">
                {selectedAgent.type} · supervisor · v1
              </div>
            </div>

            {/* Description paragraph */}
            <p className="text-xs text-slate-600 leading-relaxed">
              {selectedAgent.description}
            </p>

            {/* Action buttons row */}
            <div className="flex flex-wrap items-center gap-1.5 pt-1">
              <button className="inline-flex items-center px-2.5 py-1 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-md hover:bg-slate-50 transition-colors shadow-xs">
                <Edit3 className="w-3 h-3 mr-1 text-slate-400" />
                Edit
              </button>
              <button className="inline-flex items-center px-2.5 py-1 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-md hover:bg-slate-50 transition-colors shadow-xs">
                <Plus className="w-3 h-3 mr-1 text-slate-400" />
                Add coordinator
              </button>
              <button className="inline-flex items-center px-2.5 py-1 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-md hover:bg-slate-50 transition-colors shadow-xs">
                <Power className="w-3 h-3 mr-1 text-slate-400" />
                Disable
              </button>
              <button className="inline-flex items-center px-2.5 py-1 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-md hover:bg-slate-50 transition-colors shadow-xs">
                <Archive className="w-3 h-3 mr-1 text-slate-400" />
                Archive
              </button>
            </div>

            {/* Key-Value Metadata Grid */}
            <div className="space-y-2 text-xs pt-3 border-t border-slate-100">
              <div className="flex items-start justify-between py-1">
                <span className="text-slate-500 font-normal">Reports to</span>
                <span className="text-slate-800 font-medium">{selectedAgent.reportsTo}</span>
              </div>
              <div className="flex items-start justify-between py-1">
                <span className="text-slate-500 font-normal">Model</span>
                <span className="text-slate-800 font-mono text-[11px] font-semibold text-right">
                  {selectedAgent.model}
                </span>
              </div>
              <div className="flex items-start justify-between py-1">
                <span className="text-slate-500 font-normal">Permissions</span>
                <span className="text-slate-800 font-mono text-[11px]">{selectedAgent.permissions}</span>
              </div>
              <div className="flex items-start justify-between py-1">
                <span className="text-slate-500 font-normal">Budgets</span>
                <span className="text-slate-800 font-mono text-[10px] text-right max-w-[180px]">
                  {selectedAgent.budgets}
                </span>
              </div>
              <div className="flex items-start justify-between py-1">
                <span className="text-slate-500 font-normal">Retries</span>
                <span className="text-slate-800 font-mono text-[11px]">{selectedAgent.retries}</span>
              </div>
              <div className="flex items-start justify-between py-1">
                <span className="text-slate-500 font-normal">Task runs</span>
                <span className="text-slate-800 font-mono text-[11px]">{selectedAgent.runs} (0 failed)</span>
              </div>
            </div>

            {/* Delegates To Pills */}
            {selectedAgent.delegatesTo && selectedAgent.delegatesTo.length > 0 && (
              <div className="space-y-1.5 pt-3 border-t border-slate-100">
                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                  DELEGATES TO
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {selectedAgent.delegatesTo.map((del) => (
                    <span
                      key={del}
                      className="text-[11px] text-slate-700 bg-slate-100 px-2 py-0.5 rounded font-medium"
                    >
                      {del}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Capabilities Pills */}
            <div className="space-y-1.5 pt-3 border-t border-slate-100">
              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                CAPABILITIES
              </div>
              <div className="flex flex-wrap gap-1.5">
                {selectedAgent.capabilities.map((cap) => (
                  <span
                    key={cap}
                    className="text-[11px] font-mono text-slate-700 bg-slate-100 px-2 py-0.5 rounded"
                  >
                    {cap}
                  </span>
                ))}
              </div>
            </div>

            {/* Instructions */}
            <div className="space-y-1 pt-3 border-t border-slate-100">
              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                INSTRUCTIONS
              </div>
              <p className="text-[11px] text-slate-500 leading-relaxed font-sans">
                {selectedAgent.instructions}
              </p>
            </div>
          </div>
        </div>

        {/* Bottom Table: ALL AGENTS matching Image 3 */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
              ALL AGENTS
            </h3>
            <label className="flex items-center space-x-2 text-xs text-slate-500 cursor-pointer">
              <input
                type="checkbox"
                checked={showArchived}
                onChange={(e) => setShowArchived(e.target.checked)}
                className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
              />
              <span>Show archived</span>
            </label>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs">
            <table className="w-full text-left text-xs text-slate-600">
              <thead className="bg-[#F8FAFC] text-[10px] uppercase font-bold text-slate-400 tracking-wider border-b border-slate-200">
                <tr>
                  <th className="py-2.5 px-4 font-bold">Agent</th>
                  <th className="py-2.5 px-4 font-bold">Level</th>
                  <th className="py-2.5 px-4 font-bold">Status</th>
                  <th className="py-2.5 px-4 font-bold">Model</th>
                  <th className="py-2.5 px-4 font-bold">Tools</th>
                  <th className="py-2.5 px-4 font-bold">Runs</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {agentsList.map((agent) => (
                  <tr
                    key={agent.id}
                    onClick={() => setSelectedAgent(agent)}
                    className={`hover:bg-slate-50 cursor-pointer transition-colors ${
                      selectedAgent.id === agent.id ? 'bg-blue-50/40' : ''
                    }`}
                  >
                    <td className="py-3 px-4 font-semibold text-slate-900 flex items-center space-x-2">
                      <div className="w-2 h-2 rounded-full bg-slate-400"></div>
                      <span>{agent.name}</span>
                    </td>
                    <td className="py-3 px-4 font-mono text-slate-500">{agent.level}</td>
                    <td className="py-3 px-4">
                      <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                        {agent.status}
                      </span>
                    </td>
                    <td className="py-3 px-4 font-mono text-slate-600 text-[11px]">{agent.model}</td>
                    <td className="py-3 px-4 font-mono text-slate-600">{agent.toolsCount}</td>
                    <td className="py-3 px-4 font-mono text-slate-600">{agent.runs}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

