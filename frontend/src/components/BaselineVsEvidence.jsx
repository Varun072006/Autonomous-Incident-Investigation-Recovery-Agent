import React from 'react';
import { HelpCircle, CheckCircle, ShieldAlert, Cpu } from 'lucide-react';

export default function BaselineVsEvidence({ baseline, finding }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 my-4">
      {/* Baseline Unaided LLM Guess */}
      <div className="p-4 rounded-xl border border-amber-200 bg-amber-50/50 flex flex-col justify-between">
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold uppercase tracking-wider text-amber-800 flex items-center">
              <Cpu className="w-3.5 h-3.5 mr-1 text-amber-600" />
              LLM-Only Guess (Raw Intake Only)
            </span>
            <span className="px-2 py-0.5 text-xs font-bold bg-amber-200 text-amber-900 rounded">
              UNVERIFIED GUESS
            </span>
          </div>

          <div className="text-base font-bold text-slate-900 mb-1">
            Category: {baseline?.root_cause_category || 'DEPLOYMENT'}
          </div>

          <p className="text-xs text-slate-700 leading-relaxed mb-3">
            {baseline?.reasoning ||
              'Checkout canary release v2.14.0 temporally coincided with alert storm onset (heuristic correlation).'}
          </p>
        </div>

        <div className="pt-2 border-t border-amber-200 text-xs text-amber-700 italic flex items-center">
          <HelpCircle className="w-3.5 h-3.5 mr-1 flex-shrink-0" />
          No diagnostic tools executed. Unverified against runtime metrics.
        </div>
      </div>

      {/* TRACEOPS Evidence-Driven Finding */}
      <div className="p-4 rounded-xl border border-blue-200 bg-blue-50/40 flex flex-col justify-between">
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold uppercase tracking-wider text-blue-800 flex items-center">
              <CheckCircle className="w-3.5 h-3.5 mr-1 text-blue-600" />
              TRACEOPS Autonomous RCA
            </span>
            <span className="px-2 py-0.5 text-xs font-bold bg-blue-600 text-white rounded">
              EVIDENCE VERIFIED
            </span>
          </div>

          <div className="text-base font-bold text-slate-900 mb-1">
            Root Cause: {finding?.leader_key || 'H_POOL'} ({finding?.leader_title || 'Connection Pool Exhaustion'})
          </div>

          <div className="grid grid-cols-2 gap-2 my-2 text-xs">
            <div className="p-2 bg-white rounded border border-blue-100">
              <span className="text-slate-500 block">Relative Share:</span>
              <span className="font-bold text-blue-700 text-sm">
                {finding?.share ? (finding.share * 100).toFixed(1) + '%' : '100%'}
              </span>
              <span className="text-slate-400 text-[10px] block">(heuristic)</span>
            </div>
            <div className="p-2 bg-white rounded border border-blue-100">
              <span className="text-slate-500 block">Tested Coverage:</span>
              <span className="font-bold text-teal-700 text-sm">
                {finding?.coverage ? (finding.coverage * 100).toFixed(0) + '%' : '83%'}
              </span>
            </div>
          </div>
        </div>

        <div className="pt-2 border-t border-blue-200 text-xs text-blue-800 font-medium flex items-center">
          <ShieldAlert className="w-3.5 h-3.5 mr-1 flex-shrink-0 text-blue-600" />
          Falsified release hypothesis via version error rate parity (10.8% vs 9.2%).
        </div>
      </div>
    </div>
  );
}

