import React, { useState, useEffect } from 'react';
import { ShieldAlert, ShieldCheck, AlertTriangle, Lock, Cpu, Settings, CheckCircle } from 'lucide-react';
import { api } from '../api';

export default function Policies() {
  const [policies, setPolicies] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.getPolicies()
      .then(setPolicies)
      .catch(err => console.error("Failed to load policies:", err))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="flex-1 flex flex-col h-full bg-[#F8FAFC] overflow-y-auto select-none">
      {/* Header */}
      <div className="px-8 pt-7 pb-5 bg-white border-b border-slate-200/80">
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center space-x-2">
              <h1 className="text-xl font-bold text-slate-900 tracking-tight">Recovery Governance & Safety Policies</h1>
              <span className="text-[10px] font-semibold text-purple-700 bg-purple-50 border border-purple-200 px-2 py-0.5 rounded-full">
                Strict Guardrails Active
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Enforces risk classification tiers, human approval gates, maximum blast-radius ceilings, and SLA error budget breakers.
            </p>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="p-8 space-y-6 flex-1 max-w-6xl">
        {/* Risk Tiers Matrix */}
        <div className="bg-white rounded-xl border border-slate-200/90 shadow-xs p-6 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div>
              <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                Action Risk Classification & Approval Matrix
              </h3>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Every recovery action in the catalog is bound to deterministic execution rules before mutation.
              </p>
            </div>
            <span className="text-[11px] font-mono text-slate-400">
              4 Tier Levels
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
            {policies?.recovery_tiers?.map((t) => (
              <div
                key={t.tier}
                className="p-4 rounded-lg border border-slate-200 bg-slate-50/50 flex flex-col justify-between space-y-3"
              >
                <div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-900">
                      Tier {t.tier}: {t.name}
                    </span>
                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${
                      t.approval_required
                        ? 'text-amber-800 bg-amber-50 border-amber-200'
                        : 'text-emerald-700 bg-emerald-50 border-emerald-200'
                    }`}>
                      {t.approval_required ? 'Approval Required' : 'Autonomous Allowed'}
                    </span>
                  </div>
                  <p className="text-xs text-slate-600 mt-2 leading-relaxed">
                    {t.description}
                  </p>
                </div>
                {t.enforcement && (
                  <div className="text-[11px] font-mono text-purple-700 bg-purple-50 p-2 rounded border border-purple-200">
                    Enforcement: {t.enforcement}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Guardrail Ceilings */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white rounded-xl border border-slate-200/90 shadow-xs p-6 space-y-4">
            <div className="flex items-center space-x-2">
              <ShieldAlert className="w-4 h-4 text-rose-600" />
              <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                Blast Radius Ceiling
              </h3>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed">
              If an incident cascade exceeds 4 interconnected service nodes or a call depth greater than 3, automated remediation is halted immediately to protect upstream availability.
            </p>
            <div className="p-3 bg-slate-50 rounded-lg space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-500">Max Node Ceiling:</span>
                <span className="font-mono font-bold text-slate-900">4 Services</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Max Depth Level:</span>
                <span className="font-mono font-bold text-slate-900">Level 3</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Threshold Action:</span>
                <span className="font-mono text-rose-600 font-semibold">PAGE_INCIDENT_COMMANDER</span>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-slate-200/90 shadow-xs p-6 space-y-4">
            <div className="flex items-center space-x-2">
              <Lock className="w-4 h-4 text-blue-600" />
              <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                SLA Error Budget Circuit Breaker
              </h3>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed">
              Continuously monitors multi-window burn rate. If the burn rate exceeds 5.0x, actions are prioritized to stop customer bleeding before root-cause deep diagnosis.
            </p>
            <div className="p-3 bg-slate-50 rounded-lg space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-500">Max Burn Rate Limit:</span>
                <span className="font-mono font-bold text-slate-900">5.0x</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Current Burn Rate:</span>
                <span className="font-mono text-amber-600 font-semibold">4.2x (Elevated)</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Auto-Rollback Timeout:</span>
                <span className="font-mono font-bold text-slate-900">120 Seconds</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

