import React, { useState } from 'react';
import { ShieldCheck, AlertOctagon, ChevronDown, ChevronRight, FileText } from 'lucide-react';

export default function GroundedText({ narrative, evidenceMap = {} }) {
  const [showRejected, setShowRejected] = useState(false);
  const [activeCitation, setActiveCitation] = useState(null);

  if (!narrative) {
    return <div className="text-slate-400 italic text-sm">No narrative generated yet.</div>;
  }

  const sentences = narrative.sentences || [];
  const rejectedClaims = (narrative.claim_reports || []).filter(c => !c.grounded);

  return (
    <div className="space-y-4">
      {/* Grounded Text Area */}
      <div className="bg-white p-4 rounded-lg border border-slate-200 leading-relaxed text-slate-800 text-sm space-y-2">
        {sentences.length > 0 ? (
          sentences.map((sent, idx) => (
            <span key={idx} className="mr-1.5 inline">
              {sent.text}{' '}
              {sent.cites && sent.cites.map((citeId) => (
                <span
                  key={citeId}
                  className="relative inline-block"
                  onMouseEnter={() => setActiveCitation(citeId)}
                  onMouseLeave={() => setActiveCitation(null)}
                >
                  <span className="cursor-pointer inline-flex items-center text-xs font-mono px-1.5 py-0.5 rounded bg-blue-100 hover:bg-blue-200 text-blue-800 border border-blue-300 font-semibold mx-0.5 transition-colors">
                    [{citeId}]
                  </span>

                  {/* Tooltip */}
                  {activeCitation === citeId && (
                    <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 w-80 p-3 bg-slate-900 text-white text-xs rounded-lg shadow-xl z-50 pointer-events-none">
                      <div className="font-semibold text-blue-300 flex items-center mb-1">
                        <FileText className="w-3.5 h-3.5 mr-1" />
                        Evidence Reference: {citeId}
                      </div>
                      <div className="text-slate-200 line-clamp-4">
                        {evidenceMap[citeId] || `Observation recorded for ${citeId}`}
                      </div>
                    </div>
                  )}
                </span>
              ))}
            </span>
          ))
        ) : (
          <p>{narrative.text}</p>
        )}
      </div>

      {/* Rejected Claims Section */}
      {rejectedClaims.length > 0 && (
        <div className="border border-rose-200 rounded-lg overflow-hidden bg-rose-50 text-xs">
          <button
            onClick={() => setShowRejected(!showRejected)}
            className="w-full px-3 py-2 text-left font-medium text-rose-800 flex items-center justify-between hover:bg-rose-100 transition-colors"
          >
            <div className="flex items-center space-x-2">
              <AlertOctagon className="w-4 h-4 text-rose-600" />
              <span>Rejected by Grounding Validator ({rejectedClaims.length} ungrounded claims dropped)</span>
            </div>
            {showRejected ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
          </button>

          {showRejected && (
            <div className="p-3 border-t border-rose-200 space-y-2 bg-white">
              {rejectedClaims.map((claim, idx) => (
                <div key={idx} className="p-2 rounded border border-rose-100 bg-rose-50/50">
                  <div className="line-through text-slate-500 italic mb-1">"{claim.sentence}"</div>
                  <div className="text-rose-700 font-medium">Reason: {claim.reason}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

