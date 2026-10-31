import React, { useState, useEffect } from 'react';
import { Boxes, RefreshCw, CheckCircle, Wifi, Database, Server, GitPullRequest, ShieldCheck, Activity } from 'lucide-react';
import { api } from '../api';

export default function Connectors() {
  const [connectors, setConnectors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [syncingId, setSyncingId] = useState(null);
  const [syncFeedback, setSyncFeedback] = useState(null);

  const fetchConnectors = async () => {
    setLoading(true);
    try {
      const data = await api.getConnectors();
      setConnectors(data);
    } catch (err) {
      console.error("Failed to fetch connectors:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchConnectors();
  }, []);

  const handleSync = async (connId) => {
    setSyncingId(connId);
    try {
      const res = await api.syncConnector(connId);
      setSyncFeedback(res.message);
      await fetchConnectors();
      setTimeout(() => setSyncFeedback(null), 4000);
    } catch (err) {
      alert("Sync failed: " + err.message);
    } finally {
      setSyncingId(null);
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-[#F8FAFC] overflow-y-auto select-none">
      {/* Page Header */}
      <div className="px-8 pt-7 pb-5 bg-white border-b border-slate-200/80">
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center space-x-2">
              <h1 className="text-xl font-bold text-slate-900 tracking-tight">Operational Telemetry Connectors</h1>
              <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                8 Active Adapters
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Active adapters feeding the 12 operational evidence streams: traces, logs, time-series metrics, deploys, and config changes.
            </p>
          </div>
          <button
            onClick={fetchConnectors}
            className="inline-flex items-center px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors shadow-xs"
          >
            <RefreshCw className="w-3.5 h-3.5 mr-1.5 text-slate-500" />
            Check Health
          </button>
        </div>

        {syncFeedback && (
          <div className="mt-4 p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-xs text-emerald-800 flex items-center">
            <CheckCircle className="w-4 h-4 mr-2 text-emerald-600 flex-shrink-0" />
            {syncFeedback}
          </div>
        )}
      </div>

      {/* Main Content: Connector Grid */}
      <div className="p-8 space-y-6 flex-1">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {connectors.map((c) => (
            <div
              key={c.id}
              className="bg-white rounded-xl border border-slate-200/90 shadow-xs p-5 flex flex-col justify-between space-y-4 hover:border-slate-300 transition-colors"
            >
              <div>
                <div className="flex items-start justify-between">
                  <div className="flex items-center space-x-2.5">
                    <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center text-slate-700 font-mono text-xs">
                      {c.id.includes('otel') ? <Activity className="w-4 h-4" /> :
                       c.id.includes('db') || c.id.includes('postgres') ? <Database className="w-4 h-4" /> :
                       c.id.includes('git') ? <GitPullRequest className="w-4 h-4" /> :
                       <Server className="w-4 h-4" />}
                    </div>
                    <div>
                      <h3 className="text-xs font-bold text-slate-900 tracking-tight">
                        {c.name}
                      </h3>
                      <span className="text-[10px] font-mono text-slate-400">
                        {c.protocol}
                      </span>
                    </div>
                  </div>
                  <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full flex items-center">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mr-1.5 animate-pulse" />
                    {c.status}
                  </span>
                </div>

                <div className="mt-4 space-y-2 text-xs">
                  <div className="flex items-center justify-between text-slate-500">
                    <span className="text-[11px]">Category:</span>
                    <span className="font-medium text-slate-800">{c.category}</span>
                  </div>
                  <div className="flex items-center justify-between text-slate-500">
                    <span className="text-[11px]">Target Endpoint:</span>
                    <span className="font-mono text-[10px] text-slate-700 truncate max-w-[170px]" title={c.target}>
                      {c.target}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-slate-500">
                    <span className="text-[11px]">Latency Ping:</span>
                    <span className="font-mono text-[11px] text-emerald-600 font-semibold">{c.ping_ms} ms</span>
                  </div>
                  <div className="flex items-center justify-between text-slate-500">
                    <span className="text-[11px]">Events Ingested:</span>
                    <span className="font-mono text-[11px] text-slate-900 font-bold">{c.events_ingested.toLocaleString()}</span>
                  </div>
                </div>
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
                <span className="text-[10px] text-slate-400 font-mono">
                  Tier: {c.tier}
                </span>
                <button
                  disabled={syncingId === c.id}
                  onClick={() => handleSync(c.id)}
                  className="inline-flex items-center px-2.5 py-1 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-md hover:bg-slate-50 transition-colors shadow-xs disabled:opacity-50"
                >
                  <RefreshCw className={`w-3 h-3 mr-1.5 ${syncingId === c.id ? 'animate-spin' : ''}`} />
                  {syncingId === c.id ? 'Syncing...' : 'Sync Telemetry'}
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

