import React, { useEffect, useState, useRef } from 'react';
import { Play, FastForward, RotateCcw, AlertTriangle, ShieldCheck, Crosshair, ArrowRight, Zap, RefreshCw, PlusCircle, ToggleLeft, ToggleRight } from 'lucide-react';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, Legend } from 'recharts';
import { api } from '../api';

export default function Investigation({ currentInvId, setCurrentInvId }) {
  const [investigation, setInvestigation] = useState(null);
  const [loading, setLoading] = useState(false);
  const [autoRunning, setAutoRunning] = useState(false);
  const [injectType, setInjectType] = useState('alert');
  const [injectText, setInjectText] = useState('');
  const [poolOutage, setPoolOutage] = useState(false);

  const autoRunTimer = useRef(null);

  const loadOrCreate = async () => {
    setLoading(true);
    try {
      let invId = currentInvId;
      if (!invId) {
        const created = await api.createInvestigation();
        invId = created.id;
        setCurrentInvId(invId);
        // Step 0 Intake
        await api.stepInvestigation(invId);
      }
      const data = await api.getInvestigation(invId);
      setInvestigation(data);
    } catch (err) {
      console.error("Load investigation error:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadOrCreate();
    return () => {
      if (autoRunTimer.current) clearInterval(autoRunTimer.current);
    };
  }, [currentInvId]);

  const handleStep = async () => {
    if (!investigation) return;
    setLoading(true);
    try {
      await api.stepInvestigation(investigation.id);
      const updated = await api.getInvestigation(investigation.id);
      setInvestigation(updated);
      if (updated.state === 'CONCLUDED' || updated.state === 'INCONCLUSIVE') {
        stopAutoRun();
      }
    } catch (err) {
      console.error("Step error:", err);
      stopAutoRun();
    } finally {
      setLoading(false);
    }
  };

  const startAutoRun = () => {
    setAutoRunning(true);
    autoRunTimer.current = setInterval(async () => {
      if (!investigation) return;
      try {
        const stepRes = await api.stepInvestigation(investigation.id);
        const updated = await api.getInvestigation(investigation.id);
        setInvestigation(updated);
        if (updated.state === 'CONCLUDED' || updated.state === 'INCONCLUSIVE' || stepRes.state_after === 'CONCLUDED') {
          stopAutoRun();
        }
      } catch (e) {
        stopAutoRun();
      }
    }, 1200);
  };

  const stopAutoRun = () => {
    if (autoRunTimer.current) {
      clearInterval(autoRunTimer.current);
      autoRunTimer.current = null;
    }
    setAutoRunning(false);
  };

  const handleNewInvestigation = async () => {
    stopAutoRun();
    setLoading(true);
    try {
      const created = await api.createInvestigation();
      setCurrentInvId(created.id);
      await api.stepInvestigation(created.id);
      const data = await api.getInvestigation(created.id);
      setInvestigation(data);
    } catch (err) {
      alert("Error creating investigation: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleInject = async (e) => {
    e.preventDefault();
    if (!injectText.trim() || !investigation) return;
    try {
      await api.injectEvidence(investigation.id, injectType, { text: injectText }, 'operator');
      setInjectText('');
      const updated = await api.getInvestigation(investigation.id);
      setInvestigation(updated);
      alert("Evidence injected successfully. Investigation replanned!");
    } catch (err) {
      alert("Injection failed: " + err.message);
    }
  };

  const handleTogglePoolOutage = async () => {
    const newState = !poolOutage;
    setPoolOutage(newState);
    try {
      await api.toggleToolOutage('get_pool_metrics', newState);
    } catch (err) {
      alert("Outage toggle failed: " + err.message);
    }
  };

  // Build Score History chart series
  const buildScoreHistoryData = () => {
    if (!investigation || !investigation.hypotheses) return [];
    const maxN = Math.max(...investigation.steps.map(s => s.n), 0);
    const chartData = [];

    for (let n = 0; n <= maxN; n++) {
      const point = { step: `Step ${n}` };
      investigation.hypotheses.forEach(h => {
        const item = h.score_history.find(sh => sh.n === n);
        point[h.key] = item ? parseFloat((item.share * 100).toFixed(1)) : 0;
      });
      chartData.push(point);
    }
    return chartData;
  };

  const scoreData = buildScoreHistoryData();

  return (
    <div className="flex-1 flex flex-col h-full bg-[#F8FAFC] overflow-y-auto select-none">
      {/* Investigation Controls Header */}
      <div className="px-8 pt-7 pb-5 bg-white border-b border-slate-200/80">
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center space-x-3">
              <h1 className="text-xl font-bold text-slate-900 tracking-tight">
                Investigation Arena
              </h1>
              <span className="font-mono text-xs font-semibold px-2 py-0.5 rounded bg-slate-100 text-slate-700">
                {investigation?.id || 'inv-...'}
              </span>
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border ${
                investigation?.state === 'CONCLUDED' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                investigation?.state === 'INCONCLUSIVE' ? 'bg-amber-50 text-amber-700 border-amber-200' :
                'bg-blue-50 text-blue-700 border-blue-200'
              }`}>
                {investigation?.state || 'INIT'}
              </span>
              <span className="text-[11px] font-mono text-slate-400">
                Steps: {investigation?.steps?.length || 0} / 12 max
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-1 max-w-3xl leading-relaxed">
              Deterministic evidence-driven state machine. Evaluates 5 competing root-cause hypotheses with Bayesian heuristics and Groq narration.
            </p>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={handleStep}
              disabled={loading || autoRunning || investigation?.state === 'CONCLUDED'}
              className="inline-flex items-center px-3 py-1.5 text-xs font-semibold rounded-md bg-[#0F172A] hover:bg-[#1E293B] text-white shadow-xs transition-colors disabled:opacity-50"
            >
              <Play className="w-3.5 h-3.5 mr-1.5 fill-current" />
              Step Once
            </button>

            {autoRunning ? (
              <button
                onClick={stopAutoRun}
                className="inline-flex items-center px-3 py-1.5 text-xs font-semibold rounded-md bg-rose-600 text-white hover:bg-rose-700 shadow-xs transition-colors"
              >
                Pause Auto-Run
              </button>
            ) : (
              <button
                onClick={startAutoRun}
                disabled={loading || investigation?.state === 'CONCLUDED'}
                className="inline-flex items-center px-3 py-1.5 text-xs font-medium rounded-md border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 shadow-xs transition-colors disabled:opacity-50"
              >
                <FastForward className="w-3.5 h-3.5 mr-1.5 text-slate-500" />
                Auto-Run to Conclusion
              </button>
            )}

            <button
              onClick={handleReset}
              className="inline-flex items-center px-3 py-1.5 text-xs font-medium rounded-md border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 shadow-xs transition-colors"
            >
              <RotateCcw className="w-3.5 h-3.5 mr-1.5 text-slate-400" />
              Reset
            </button>
          </div>
        </div>
      </div>

      <div className="p-8 space-y-6 flex-1">
                disabled={loading || investigation?.state === 'CONCLUDED'}
                className="inline-flex items-center px-3.5 py-2 text-xs font-semibold rounded-lg bg-teal-600 text-white hover:bg-teal-700 shadow-sm disabled:opacity-50"
              >
                <FastForward className="w-3.5 h-3.5 mr-1.5" />
                Auto-Run (1.2s)
              </button>
            )}

            <button
              onClick={handleNewInvestigation}
              className="inline-flex items-center px-3 py-2 text-xs font-medium rounded-lg border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 shadow-sm"
            >
              <RotateCcw className="w-3.5 h-3.5 mr-1.5" />
              New
            </button>
          </div>
        </div>
      </div>

      {/* Hypothesis Arena */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-sm font-bold uppercase tracking-wider text-slate-900">
              Hypothesis Arena
            </h2>
            <span className="text-xs text-slate-500">
              Normalized relative evidence share (heuristic, not probability)
            </span>
          </div>
          <span className="text-xs text-slate-400 font-mono">5 Competing Hypotheses</span>
        </div>

        <div className="space-y-3.5">
          {investigation?.hypotheses?.map((h) => {
            const sharePct = (h.share * 100).toFixed(1);
            const covPct = (h.coverage * 100).toFixed(0);
            const isRuledOut = h.status === 'RULED_OUT';
            const isLeading = h.status === 'LEADING';

            return (
              <div
                key={h.id}
                className={`p-3.5 rounded-lg border transition-all ${
                  isLeading ? 'border-blue-300 bg-blue-50/30 ring-1 ring-blue-300' :
                  isRuledOut ? 'border-slate-200 bg-slate-50/80 opacity-60' : 'border-slate-200 bg-white'
                }`}
              >
                <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                  <div className="flex items-center space-x-2">
                    <span className="font-mono text-xs font-bold text-slate-900">{h.key}</span>
                    <span className="text-xs text-slate-700 font-medium">{h.title}</span>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                      isLeading ? 'bg-blue-600 text-white' :
                      isRuledOut ? 'bg-slate-200 text-slate-700' : 'bg-slate-100 text-slate-700'
                    }`}>
                      {h.status}
                    </span>
                  </div>

                  <div className="flex items-center space-x-4 text-xs font-mono">
                    <span className="text-emerald-700 font-semibold">+{h.supporting} supporting</span>
                    <span className="text-rose-700 font-semibold">-{h.contradicting} contradicting</span>
                    <span className="text-slate-500">Cov: {covPct}%</span>
                    <span className="font-bold text-slate-900 text-sm">{sharePct}%</span>
                  </div>
                </div>

                {/* Progress bar */}
                <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                  <div
                    className={`h-2 rounded-full transition-all duration-500 ${
                      isLeading ? 'bg-blue-600' : isRuledOut ? 'bg-slate-400' : 'bg-teal-500'
                    }`}
                    style={{ width: `${Math.max(2, sharePct)}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Score History Chart & Diagnostic Trace */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Score History */}
        <div className="lg:col-span-6 bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-800">
              Hypothesis Relative Share Over Steps
            </span>
            <span className="text-xs text-slate-400 font-mono">Relative evidence share %</span>
          </div>

          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={scoreData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
                <XAxis dataKey="step" stroke="#94A3B8" fontSize={10} />
                <YAxis stroke="#94A3B8" fontSize={10} domain={[0, 100]} />
                <Tooltip />
                <Legend wrapperStyle={{ fontSize: 10 }} />
                <Line type="monotone" dataKey="H_POOL" stroke="#8B5CF6" strokeWidth={2.5} dot={false} name="H_POOL (Connection)" />
                <Line type="monotone" dataKey="H_DEPLOY" stroke="#3B82F6" strokeWidth={1.5} dot={false} name="H_DEPLOY (Release)" />
                <Line type="monotone" dataKey="H_DB" stroke="#10B981" strokeWidth={1.5} dot={false} name="H_DB (Database)" />
                <Line type="monotone" dataKey="H_TRAFFIC" stroke="#F59E0B" strokeWidth={1.5} dot={false} name="H_TRAFFIC (Load)" />
                <Line type="monotone" dataKey="H_EXTERNAL" stroke="#EF4444" strokeWidth={1.5} dot={false} name="H_EXTERNAL (Gateway)" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Diagnostic Tool Trace */}
        <div className="lg:col-span-6 bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-800">
                Diagnostic Planner Trace
              </span>
              <span className="text-xs text-slate-400 font-mono">Top-3 Candidates Logged</span>
            </div>

            <div className="space-y-3 max-h-72 overflow-y-auto pr-1 text-xs">
              {investigation?.steps?.map((s) => (
                <div key={s.id || s.n} className="p-3 rounded-lg border border-slate-100 bg-slate-50/70">
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-bold text-slate-800 font-mono">
                      Step {s.n}: {s.tool || 'INTAKE'}
                    </span>
                    {s.replan?.triggered && (
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-300">
                        REPLAN
                      </span>
                    )}
                  </div>
                  <div className="text-slate-600 mb-1">{s.rationale}</div>
                  {s.candidates?.length > 0 && (
                    <div className="font-mono text-[10px] text-slate-500">
                      Top Candidates: {s.candidates.map(c => `${c.tool} (${c.value})`).join(' • ')}
                    </div>
                  )}
                  {s.replan?.triggered && (
                    <div className="mt-1 text-amber-700 font-medium text-[11px]">
                      Trigger: {s.replan.reason}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Resilience & Injected Controls */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Inject Evidence Form */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-800 flex items-center">
              <PlusCircle className="w-4 h-4 mr-1 text-blue-600" />
              Inject Dynamic Signal (Triggers Replan)
            </span>
          </div>

          <form onSubmit={handleInject} className="space-y-3">
            <div className="grid grid-cols-3 gap-2 text-xs">
              {['alert', 'log', 'ticket'].map((t) => (
                <button
                  type="button"
                  key={t}
                  onClick={() => setInjectType(t)}
                  className={`py-1 rounded border capitalize ${
                    injectType === t ? 'bg-blue-50 border-blue-500 text-blue-700 font-semibold' : 'border-slate-200 text-slate-600'
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>

            <input
              type="text"
              value={injectText}
              onChange={(e) => setInjectText(e.target.value)}
              placeholder="e.g. Spike in 503 errors at api-gateway or payment timeout log"
              className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500"
            />

            <div className="flex items-center justify-between">
              <div className="flex space-x-1.5">
                <button
                  type="button"
                  onClick={() => setInjectText("Gateway latency exceeded 3.2s on /checkout route")}
                  className="px-2 py-0.5 text-[10px] rounded bg-slate-100 text-slate-600 hover:bg-slate-200"
                >
                  Preset: Latency Alert
                </button>
                <button
                  type="button"
                  onClick={() => setInjectText("Multiple user complaints of checkout button unresponsive")}
                  className="px-2 py-0.5 text-[10px] rounded bg-slate-100 text-slate-600 hover:bg-slate-200"
                >
                  Preset: User Ticket
                </button>
              </div>

              <button
                type="submit"
                disabled={!injectText.trim()}
                className="px-3 py-1.5 text-xs font-semibold rounded bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
              >
                Inject Evidence
              </button>
            </div>
          </form>
        </div>

        {/* Resilience Outage Toggles */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-800 flex items-center">
                <AlertTriangle className="w-4 h-4 mr-1 text-amber-600" />
                Tool Outage Simulation
              </span>
              <span className="text-xs text-slate-500 font-mono">In-Memory Failover</span>
            </div>
            <p className="text-xs text-slate-600 mb-4">
              Simulate diagnostic tool outages to observe engine adaptability, coverage adjustments, and fail-safe handling without synthetic hallucination.
            </p>

            <div className="flex items-center justify-between p-3 rounded-lg border border-slate-200 bg-slate-50">
              <div>
                <span className="text-xs font-semibold text-slate-800 block">get_pool_metrics</span>
                <span className="text-[11px] text-slate-500">Connection pool saturation inspection tool</span>
              </div>
              <button
                onClick={handleTogglePoolOutage}
                className="flex items-center text-xs font-semibold px-2.5 py-1 rounded border transition-colors"
                style={{
                  backgroundColor: poolOutage ? '#FEE2E2' : '#F1F5F9',
                  borderColor: poolOutage ? '#FCA5A5' : '#CBD5E1',
                  color: poolOutage ? '#B91C1C' : '#475569'
                }}
              >
                {poolOutage ? (
                  <>
                    <ToggleRight className="w-4 h-4 mr-1 text-red-600" /> Outage Active
                  </>
                ) : (
                  <>
                    <ToggleLeft className="w-4 h-4 mr-1 text-slate-400" /> Operational
                  </>
                )}
              </button>
            </div>
          </div>

          <div className="mt-3 text-[11px] text-slate-400 italic">
            Outages return explicit error ToolResult structure and adjust coverage metrics.
          </div>
        </div>
      </div>
    </div>
  );
}

