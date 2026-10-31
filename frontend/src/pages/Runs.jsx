import React, { useState, useEffect } from 'react';
import { PlaySquare, CheckCircle, Clock, AlertTriangle, ShieldCheck, ArrowRight, RefreshCw, Layers } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';

export default function Runs() {
  const navigate = useNavigate();
  const [runs, setRuns] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchRuns = async () => {
    setLoading(true);
    try {
      const data = await api.getRuns();
      setRuns(data);
    } catch (err) {
      console.error("Failed to fetch runs:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRuns();
  }, []);

  return (
    <div className="flex-1 flex flex-col h-full bg-[#F8FAFC] overflow-y-auto select-none">
      {/* Page Header */}
      <div className="px-8 pt-7 pb-5 bg-white border-b border-slate-200/80">
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center space-x-2">
              <h1 className="text-xl font-bold text-slate-900 tracking-tight">Investigation Runs</h1>
              <span className="text-[10px] font-semibold text-blue-700 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded-full">
                {runs.length} Executed
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Deterministic autonomous audit trail tracking step transitions, diagnostic tool invocations, and hypothesis evaluations.
            </p>
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={fetchRuns}
              className="inline-flex items-center px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors shadow-xs"
            >
              <RefreshCw className="w-3.5 h-3.5 mr-1.5 text-slate-500" />
              Refresh Runs
            </button>
            <button
              onClick={() => navigate('/investigation')}
              className="inline-flex items-center px-3 py-1.5 text-xs font-medium text-white bg-slate-900 rounded-lg hover:bg-slate-800 transition-colors shadow-xs"
            >
              <PlaySquare className="w-3.5 h-3.5 mr-1.5" />
              Launch Investigation
            </button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="p-8 space-y-6 flex-1">
        <div className="bg-white rounded-xl border border-slate-200/90 shadow-xs overflow-hidden">
          <div className="px-5 py-3.5 border-b border-slate-100 flex items-center justify-between">
            <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
              Autonomous Run History & State Transitions
            </h3>
            <span className="text-[11px] font-mono text-slate-400">
              UTC ISO-8601 internal logs
            </span>
          </div>

          <table className="w-full text-left text-xs text-slate-600">
            <thead className="bg-[#F8FAFC] text-[10px] uppercase font-bold text-slate-400 tracking-wider border-b border-slate-200">
              <tr>
                <th className="py-2.5 px-4 font-bold">Run ID</th>
                <th className="py-2.5 px-4 font-bold">Target Incident</th>
                <th className="py-2.5 px-4 font-bold">Execution State</th>
                <th className="py-2.5 px-4 font-bold">Diagnostic Steps</th>
                <th className="py-2.5 px-4 font-bold">Top Root Cause</th>
                <th className="py-2.5 px-4 font-bold">Evidence Confidence</th>
                <th className="py-2.5 px-4 font-bold">Started At</th>
                <th className="py-2.5 px-4 font-bold text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {runs.length === 0 ? (
                <tr>
                  <td colSpan="8" className="py-8 text-center text-xs text-slate-400">
                    No runs recorded yet. Launch an investigation from the Investigation Arena.
                  </td>
                </tr>
              ) : (
                runs.map((r) => (
                  <tr key={r.id} className="hover:bg-slate-50 transition-colors">
                    <td className="py-3 px-4 font-mono text-[11px] font-semibold text-slate-900 whitespace-nowrap">
                      {r.id}
                    </td>
                    <td className="py-3 px-4 font-medium text-slate-800">
                      {r.target_incident}
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap">
                      <span className={`text-[10px] font-mono font-semibold px-2 py-0.5 rounded ${
                        r.state === 'CONCLUDED'
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : r.state === 'INVESTIGATING'
                          ? 'bg-blue-50 text-blue-700 border border-blue-200'
                          : 'bg-slate-100 text-slate-700'
                      }`}>
                        {r.state}
                      </span>
                    </td>
                    <td className="py-3 px-4 font-mono text-[11px] text-slate-600">
                      {r.step_count} diagnostic checks
                    </td>
                    <td className="py-3 px-4 font-mono text-[11px] text-rose-600 font-medium">
                      {r.top_hypothesis}
                    </td>
                    <td className="py-3 px-4 font-mono text-[11px] text-slate-800 font-semibold">
                      {Math.round(r.confidence * 100)}%
                    </td>
                    <td className="py-3 px-4 font-mono text-slate-400 text-[11px]">
                      {r.started_at ? r.started_at.replace('T', ' ').slice(0, 19) + ' UTC' : '—'}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <button
                        onClick={() => navigate('/investigation')}
                        className="inline-flex items-center text-xs font-semibold text-blue-600 hover:text-blue-800 transition-colors"
                      >
                        Inspect Trace <ArrowRight className="w-3 h-3 ml-1" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

