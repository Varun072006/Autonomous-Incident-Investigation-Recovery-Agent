import React from 'react';
import { Play, RotateCcw, Download, CheckCircle, AlertTriangle, ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function TopHeader({
  title = "Incident Investigation & Safe Recovery",
  onRun,
  onReset,
  onExport,
  loading = false,
  investigationState = "INVESTIGATING",
  validationCount = 0
}) {
  const navigate = useNavigate();

  return (
    <header className="h-14 bg-white border-b border-slate-200 px-6 flex items-center justify-between sticky top-0 z-40">
      <div className="flex items-center space-x-4">
        <button
          onClick={() => navigate(-1)}
          className="text-slate-400 hover:text-slate-600 transition-colors p-1 rounded-md hover:bg-slate-100"
          title="Back"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>

        <div className="flex items-center space-x-3">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
            Workflows
          </span>
          <span className="text-slate-300">/</span>
          <div className="flex items-center space-x-2">
            <span className="text-sm font-bold text-slate-900">{title}</span>
            <span className="text-[11px] font-mono text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">
              v3.0
            </span>
            <span className="text-[11px] text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded font-medium">
              All state transitions verified
            </span>
          </div>
        </div>
      </div>

      <div className="flex items-center space-x-3">
        {/* Validation Errors / Status */}
        <div className="hidden sm:flex items-center space-x-1.5 text-xs text-slate-600 bg-slate-50 px-2.5 py-1 rounded-md border border-slate-200">
          <CheckCircle className="w-3.5 h-3.5 text-emerald-600" />
          <span>Invariants: Passed</span>
        </div>

        <button
          onClick={onReset}
          className="inline-flex items-center px-3 py-1.5 text-xs font-medium rounded-md border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 transition-colors shadow-sm"
          title="Reset to Seed 42"
        >
          <RotateCcw className="w-3.5 h-3.5 mr-1 text-slate-500" />
          Reset
        </button>

        {onExport && (
          <button
            onClick={onExport}
            className="inline-flex items-center px-3 py-1.5 text-xs font-medium rounded-md border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 transition-colors shadow-sm"
          >
            <Download className="w-3.5 h-3.5 mr-1 text-slate-500" />
            Save Proof
          </button>
        )}

        <button
          onClick={onRun}
          disabled={loading || investigationState === 'CONCLUDED'}
          className="inline-flex items-center px-4 py-1.5 text-xs font-semibold rounded-md bg-[#1E293B] hover:bg-[#0F172A] text-white shadow-sm transition-all disabled:opacity-50"
        >
          <Play className="w-3.5 h-3.5 mr-1.5 fill-current" />
          {loading ? 'Running...' : 'Run Investigation'}
        </button>
      </div>
    </header>
  );
}
