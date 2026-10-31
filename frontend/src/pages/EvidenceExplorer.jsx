import React, { useEffect, useState } from 'react';
import { Database, Filter, Download, ChevronDown, ChevronRight, Link as LinkIcon, CheckCircle2, XCircle, Search } from 'lucide-react';
import { api } from '../api';

export default function EvidenceExplorer({ currentInvId }) {
  const [evidenceList, setEvidenceList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedHypothesis, setSelectedHypothesis] = useState('');
  const [selectedRelation, setSelectedRelation] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedId, setExpandedId] = useState(null);
  const [downloading, setDownloading] = useState(false);

  const loadEvidence = async () => {
    if (!currentInvId) return;
    setLoading(true);
    try {
      const data = await api.getEvidence(currentInvId, selectedHypothesis || undefined);
      setEvidenceList(data);
    } catch (err) {
      console.error("Evidence fetch error:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadEvidence();
  }, [currentInvId, selectedHypothesis]);

  const handleDownloadProof = async () => {
    if (!currentInvId) return;
    setDownloading(true);
    try {
      const bundle = await api.getProofBundle(currentInvId);
      const blob = new Blob([JSON.stringify(bundle, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `TRACEOPS_Proof_Bundle_${currentInvId}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      alert("Download proof failed: " + err.message);
    } finally {
      setDownloading(false);
    }
  };

  // Filter evidence locally by relation and search
  const filteredEvidence = evidenceList.filter((ev) => {
    if (selectedRelation) {
      const hasRel = ev.links.some(l => l.relation === selectedRelation);
      if (!hasRel) return false;
    }
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return ev.text.toLowerCase().includes(q) || ev.id.toLowerCase().includes(q);
    }
    return true;
  });

  return (
    <div className="space-y-6 pb-12">
      {/* Header and Download Proof */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold text-slate-900 flex items-center">
              <Database className="w-5 h-5 mr-2 text-teal-600" />
              Evidence Explorer & Lineage
            </h1>
            <p className="text-xs text-slate-500 mt-1">
              Every finding claim resolves to stored rows. Inspect raw database references, provenance, and hypothesis linkage.
            </p>
          </div>

          <button
            onClick={handleDownloadProof}
            disabled={downloading || !currentInvId}
            className="inline-flex items-center px-4 py-2 text-xs font-semibold rounded-lg bg-teal-600 text-white hover:bg-teal-700 shadow-sm transition-colors disabled:opacity-50"
          >
            <Download className="w-3.5 h-3.5 mr-1.5" />
            {downloading ? 'Exporting...' : 'Download Proof Bundle (JSON)'}
          </button>
        </div>

        {/* Filter bar */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-4 pt-4 border-t border-slate-100 text-xs">
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search evidence observations..."
              className="w-full pl-8 pr-3 py-1.5 border border-slate-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>

          <select
            value={selectedHypothesis}
            onChange={(e) => setSelectedHypothesis(e.target.value)}
            className="px-3 py-1.5 border border-slate-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white"
          >
            <option value="">All Hypotheses</option>
            <option value="H_POOL">H_POOL (Connection Pool)</option>
            <option value="H_DEPLOY">H_DEPLOY (Release Regression)</option>
            <option value="H_DB">H_DB (Database)</option>
            <option value="H_TRAFFIC">H_TRAFFIC (Traffic Surge)</option>
            <option value="H_EXTERNAL">H_EXTERNAL (Gateway)</option>
          </select>

          <select
            value={selectedRelation}
            onChange={(e) => setSelectedRelation(e.target.value)}
            className="px-3 py-1.5 border border-slate-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white"
          >
            <option value="">All Relations</option>
            <option value="SUPPORTS">Supports (Positive Evidence)</option>
            <option value="CONTRADICTS">Contradicts (Falsification)</option>
            <option value="NEUTRAL">Neutral</option>
          </select>
        </div>
      </div>

      {/* Evidence Table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
        <div className="px-5 py-3 border-b border-slate-100 flex justify-between items-center bg-slate-50">
          <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">
            Evidence Records ({filteredEvidence.length} items)
          </span>
          <span className="text-[11px] text-slate-500">
            Click row to view raw database references
          </span>
        </div>

        {loading ? (
          <div className="p-8 text-center text-slate-400 text-xs">Loading evidence lineage...</div>
        ) : filteredEvidence.length === 0 ? (
          <div className="p-8 text-center text-slate-400 text-xs">No evidence records matched filter criteria.</div>
        ) : (
          <div className="divide-y divide-slate-100 text-xs">
            {filteredEvidence.map((ev) => {
              const isExpanded = expandedId === ev.id;
              return (
                <div key={ev.id} className="hover:bg-slate-50/70 transition-colors">
                  <div
                    className="p-4 cursor-pointer flex items-start justify-between gap-4"
                    onClick={() => setExpandedId(isExpanded ? null : ev.id)}
                  >
                    <div className="flex items-start space-x-3">
                      <button className="mt-0.5 text-slate-400">
                        {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                      </button>

                      <div>
                        <div className="flex items-center space-x-2 mb-1">
                          <span className="font-mono font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                            {ev.id}
                          </span>
                          <span className="text-slate-400 font-mono text-[11px]">
                            {ev.ts_from?.slice(11, 19)} UTC
                          </span>
                          <span className="text-slate-500 font-medium">
                            Extracted: {ev.extracted_by}
                          </span>
                        </div>
                        <div className="text-slate-900 font-medium leading-relaxed">
                          {ev.text}
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-col items-end space-y-1">
                      {ev.links.map((l, lIdx) => (
                        <span
                          key={lIdx}
                          className={`px-2 py-0.5 rounded text-[10px] font-bold inline-flex items-center ${
                            l.relation === 'SUPPORTS' ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' :
                            l.relation === 'CONTRADICTS' ? 'bg-rose-50 text-rose-800 border border-rose-200' :
                            'bg-slate-100 text-slate-700'
                          }`}
                        >
                          {l.relation === 'SUPPORTS' ? <CheckCircle2 className="w-3 h-3 mr-1 text-emerald-600" /> :
                           l.relation === 'CONTRADICTS' ? <XCircle className="w-3 h-3 mr-1 text-rose-600" /> : null}
                          {l.relation} {l.hypothesis_key} ({l.strength})
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Expanded Detail Panel */}
                  {isExpanded && (
                    <div className="px-12 py-3 bg-slate-50/80 border-t border-slate-100 space-y-3">
                      <div>
                        <span className="font-bold text-slate-700 block mb-1">Rule & Explanation:</span>
                        {ev.links.map((l, idx) => (
                          <div key={idx} className="text-slate-600 mb-1">
                            • Rule <span className="font-mono font-semibold">{l.rule}</span>: {l.explanation}
                          </div>
                        ))}
                      </div>

                      {ev.refs && ev.refs.length > 0 && (
                        <div>
                          <span className="font-bold text-slate-700 block mb-1">Raw Database Provenance:</span>
                          <div className="bg-slate-900 text-slate-200 p-2.5 rounded font-mono text-[11px] overflow-x-auto">
                            {JSON.stringify(ev.refs, null, 2)}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

