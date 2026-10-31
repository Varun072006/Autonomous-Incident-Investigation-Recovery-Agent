import React from 'react';
import { 
  ShieldAlert, 
  ShieldCheck, 
  AlertTriangle, 
  Trash2, 
  Sliders, 
  Database, 
  ExternalLink,
  Cpu,
  Layers,
  Edit3,
  Plus,
  Power,
  Archive,
  X
} from 'lucide-react';

export default function StepSettingsPanel({ 
  selectedStep, 
  onClose, 
  onUpdateStep,
  onDeleteStep 
}) {
  if (!selectedStep) {
    return (
      <aside className="w-84 bg-white border border-slate-200/90 rounded-xl flex flex-col p-6 text-slate-400 text-sm justify-center items-center text-center shadow-xs">
        <Layers className="w-9 h-9 mb-2.5 text-slate-300 stroke-[1.5]" />
        <p className="font-semibold text-xs text-slate-700">No step selected</p>
        <p className="text-[11px] text-slate-400 mt-1 max-w-[200px]">
          Click any node on the workflow canvas to inspect its permissions, budgets, and evidence.
        </p>
      </aside>
    );
  }

  const {
    id,
    label,
    toolName,
    category = 'diagnostic',
    riskTier = 0,
    service = 'payment-gateway',
    params = {},
    evidence = [],
    status = 'PENDING',
    readOnly = true,
    requiresApproval = false,
    description = ''
  } = selectedStep;

  return (
    <aside className="w-84 bg-white border border-slate-200/90 rounded-xl shadow-xs flex flex-col justify-between overflow-y-auto max-h-[calc(100vh-120px)] select-none">
      <div className="p-5 space-y-4">
        {/* Header matching Image 3 inspector card */}
        <div>
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <div className="w-5 h-5 rounded-md bg-slate-100 flex items-center justify-center text-slate-700">
                <Cpu className="w-3 h-3" />
              </div>
              <h3 className="text-xs font-bold text-slate-900 tracking-tight truncate max-w-[170px]">
                {label || toolName}
              </h3>
            </div>
            <div className="flex items-center space-x-1.5">
              <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                active
              </span>
              <button onClick={onClose} className="text-slate-400 hover:text-slate-600 p-0.5">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
          <div className="text-[10px] font-mono text-slate-400 mt-1 truncate">
            {toolName || 'step.diagnostic'} · v1
          </div>
        </div>

        {/* Description paragraph */}
        <p className="text-xs text-slate-600 leading-relaxed font-sans">
          {description || `Executes ${toolName} to collect structured telemetry and test diagnostic hypotheses.`}
        </p>

        {/* Action buttons row matching screenshot */}
        <div className="flex flex-wrap items-center gap-1 pt-1">
          <button className="inline-flex items-center px-2 py-1 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-md hover:bg-slate-50 transition-colors shadow-xs">
            <Edit3 className="w-3 h-3 mr-1 text-slate-400" />
            Edit
          </button>
          <button className="inline-flex items-center px-2 py-1 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-md hover:bg-slate-50 transition-colors shadow-xs">
            <Plus className="w-3 h-3 mr-1 text-slate-400" />
            Add step
          </button>
          <button className="inline-flex items-center px-2 py-1 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-md hover:bg-slate-50 transition-colors shadow-xs">
            <Power className="w-3 h-3 mr-1 text-slate-400" />
            Disable
          </button>
          <button className="inline-flex items-center px-2 py-1 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-md hover:bg-slate-50 transition-colors shadow-xs">
            <Archive className="w-3 h-3 mr-1 text-slate-400" />
            Archive
          </button>
        </div>

        {/* Key-Value Metadata Grid matching screenshot */}
        <div className="space-y-2 text-xs pt-3 border-t border-slate-100">
          <div className="flex items-start justify-between py-0.5">
            <span className="text-slate-500 font-normal">Reports to</span>
            <span className="text-slate-800 font-medium">Incident Supervisor</span>
          </div>
          <div className="flex items-start justify-between py-0.5">
            <span className="text-slate-500 font-normal">Model</span>
            <span className="text-slate-800 font-mono text-[11px] font-semibold text-right">
              {readOnly ? 'deterministic' : 'qwen/qwen3.8-27b'}
            </span>
          </div>
          <div className="flex items-start justify-between py-0.5">
            <span className="text-slate-500 font-normal">Permissions</span>
            <span className="text-slate-800 font-mono text-[11px]">
              {readOnly ? 'read' : `Tier ${riskTier} (gate)`}
            </span>
          </div>
          <div className="flex items-start justify-between py-0.5">
            <span className="text-slate-500 font-normal">Budgets</span>
            <span className="text-slate-800 font-mono text-[10px] text-right">
              10 tool calls · 120s
            </span>
          </div>
          <div className="flex items-start justify-between py-0.5">
            <span className="text-slate-500 font-normal">Retries</span>
            <span className="text-slate-800 font-mono text-[11px]">2, backoff 0.5s → 8s</span>
          </div>
          <div className="flex items-start justify-between py-0.5">
            <span className="text-slate-500 font-normal">Task runs</span>
            <span className="text-slate-800 font-mono text-[11px]">
              {status === 'COMPLETED' ? '1 (0 failed)' : '0 (0 failed)'}
            </span>
          </div>
        </div>

        {/* DELEGATES TO / TARGET SERVICE */}
        <div className="space-y-1.5 pt-3 border-t border-slate-100">
          <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
            TARGET SERVICE
          </div>
          <div className="flex flex-wrap gap-1.5">
            <span className="text-[11px] font-mono text-slate-800 bg-slate-100 px-2 py-0.5 rounded font-semibold border border-slate-200">
              {service}
            </span>
          </div>
        </div>

        {/* CAPABILITIES / PROVIDES */}
        <div className="space-y-1.5 pt-3 border-t border-slate-100">
          <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
            CAPABILITIES
          </div>
          <div className="flex flex-wrap gap-1.5">
            {['evidence_id', 'p99_latency_ms', 'anomaly_score'].map((cap) => (
              <span
                key={cap}
                className="text-[10px] font-mono text-slate-600 bg-slate-100 px-2 py-0.5 rounded"
              >
                {cap}
              </span>
            ))}
          </div>
        </div>

        {/* Attached Evidence records */}
        {evidence && evidence.length > 0 && (
          <div className="space-y-1.5 pt-3 border-t border-slate-100">
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center justify-between">
              <span>ATTACHED EVIDENCE</span>
              <span className="text-[10px] font-mono text-blue-600 bg-blue-50 px-1.5 py-0.2 rounded">
                {evidence.length}
              </span>
            </div>
            <div className="space-y-1 max-h-28 overflow-y-auto">
              {evidence.map((ev) => (
                <div
                  key={ev.evidence_id || ev}
                  className="text-[10px] p-1.5 bg-slate-50 rounded border border-slate-200 font-mono text-slate-800"
                >
                  <span className="font-bold text-blue-600">
                    {ev.evidence_id || ev}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Bottom Delete Button */}
      <div className="p-3 border-t border-slate-100 bg-[#F8FAFC] flex items-center justify-between">
        <button
          onClick={() => onDeleteStep?.(id)}
          className="inline-flex items-center px-2.5 py-1 text-xs font-medium text-red-600 hover:text-red-700 hover:bg-red-50 rounded border border-red-200 transition-colors"
        >
          <Trash2 className="w-3 h-3 mr-1" />
          Delete step
        </button>
        <span className="text-[10px] text-slate-400 font-mono">
          {readOnly ? 'Zero-risk' : `Tier ${riskTier}`}
        </span>
      </div>
    </aside>
  );
}
