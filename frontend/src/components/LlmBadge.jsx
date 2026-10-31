import React from 'react';
import { Cpu, CheckCircle2, AlertCircle, Zap } from 'lucide-react';

export default function LlmBadge({ narration }) {
  if (!narration) return null;

  const isTemplate = narration.source === 'template' || narration.provider === 'deterministic_template';

  return (
    <div className="flex flex-wrap items-center gap-2 p-2.5 rounded-lg border bg-slate-50 border-slate-200 text-xs">
      <div className="flex items-center space-x-1.5 font-medium text-slate-700">
        <Cpu className="w-4 h-4 text-teal-600" />
        <span>Provider:</span>
        <span className="font-mono bg-white px-2 py-0.5 rounded border border-slate-200 text-slate-900">
          {narration.provider || 'Template'}
        </span>
      </div>

      <div className="flex items-center space-x-1.5 text-slate-600">
        <span>Model:</span>
        <span className="font-mono bg-white px-2 py-0.5 rounded border border-slate-200">
          {narration.model || 'template'}
        </span>
      </div>

      <div className="flex items-center space-x-1.5">
        {isTemplate ? (
          <span className="inline-flex items-center text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200 font-medium">
            <AlertCircle className="w-3.5 h-3.5 mr-1" />
            Deterministic Template Fallback
          </span>
        ) : (
          <span className="inline-flex items-center text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 font-medium">
            <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
            Grounded Score: {Math.round((narration.grounding_score || 1.0) * 100)}%
          </span>
        )}
      </div>

      {narration.latency_ms > 0 && (
        <div className="flex items-center text-slate-500 ml-auto">
          <Zap className="w-3.5 h-3.5 mr-1 text-amber-500" />
          <span>{narration.latency_ms.toFixed(0)} ms</span>
        </div>
      )}
    </div>
  );
}

