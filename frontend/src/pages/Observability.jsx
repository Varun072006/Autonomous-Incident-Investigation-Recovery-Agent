import React, { useState, useEffect } from 'react';
import { Activity, RefreshCw, AlertCircle, Database, Server, TrendingUp, Zap } from 'lucide-react';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';
import { api } from '../api';

export default function Observability() {
  const [stats, setStats] = useState(null);
  const [metrics, setMetrics] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [s, coLat] = await Promise.all([
        api.getObservabilityStats(),
        api.getMetrics('checkout-api', 'p95_latency_ms')
      ]);
      setStats(s);

      const chartData = coLat.map(m => ({
        time: m.ts.slice(11, 16),
        p95: m.value,
        baseline: 380
      }));
      setMetrics(chartData);
    } catch (err) {
      console.error("Failed to fetch observability data:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  return (
    <div className="flex-1 flex flex-col h-full bg-[#F8FAFC] overflow-y-auto select-none">
      {/* Header */}
      <div className="px-8 pt-7 pb-5 bg-white border-b border-slate-200/80">
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center space-x-2">
              <h1 className="text-xl font-bold text-slate-900 tracking-tight">Observability & SLO Telemetry</h1>
              <span className="text-[10px] font-semibold text-rose-700 bg-rose-50 border border-rose-200 px-2 py-0.5 rounded-full">
                SLO Burn Elevated (4.2x)
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Live service telemetry, connection pool utilization, latency distributions, and median/MAD anomaly detection streams.
            </p>
          </div>
          <button
            onClick={fetchData}
            className="inline-flex items-center px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors shadow-xs"
          >
            <RefreshCw className="w-3.5 h-3.5 mr-1.5 text-slate-500" />
            Refresh Telemetry
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="p-8 space-y-6 flex-1">
        {/* KPI Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-5">
          <div className="bg-white rounded-xl border border-slate-200/90 shadow-xs p-5">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
              30-Day Availability SLO
            </span>
            <div className="text-2xl font-bold text-rose-600 tracking-tight mt-1">
              {stats?.slo_availability || 99.4}%
            </div>
            <div className="text-[11px] text-slate-500 mt-1">
              Target: {stats?.target_slo || 99.95}% (At Risk)
            </div>
          </div>

          <div className="bg-white rounded-xl border border-slate-200/90 shadow-xs p-5">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
              Error Budget Burn Rate
            </span>
            <div className="text-2xl font-bold text-amber-600 tracking-tight mt-1">
              {stats?.current_burn_rate || 4.2}x
            </div>
            <div className="text-[11px] text-slate-500 mt-1">
              {stats?.error_budget_consumed_pct || 34.2}% budget consumed
            </div>
          </div>

          <div className="bg-white rounded-xl border border-slate-200/90 shadow-xs p-5">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
              Payment DB Pool Saturation
            </span>
            <div className="text-2xl font-bold text-rose-600 tracking-tight mt-1">
              {stats?.pool_saturation_pct || 100}%
            </div>
            <div className="text-[11px] text-slate-500 mt-1">
              {stats?.payment_pool_active || 10} / {stats?.payment_pool_max || 10} connections active
            </div>
          </div>

          <div className="bg-white rounded-xl border border-slate-200/90 shadow-xs p-5">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
              Checkout p95 Latency
            </span>
            <div className="text-2xl font-bold text-rose-600 tracking-tight mt-1">
              {Math.round(stats?.checkout_p95_current_ms || 5420)} ms
            </div>
            <div className="text-[11px] text-slate-500 mt-1">
              Baseline: {stats?.checkout_p95_baseline_ms || 380} ms (14x surge)
            </div>
          </div>
        </div>

        {/* Latency Timeseries Chart */}
        <div className="bg-white p-6 rounded-xl border border-slate-200/90 shadow-xs">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                Telemetry Anomaly Spike (Median/MAD Anomaly Window)
              </h3>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Timeseries latency trajectory comparing live p95 vs normal operating baseline.
              </p>
            </div>
            <span className="text-[11px] font-mono text-slate-400">checkout-api</span>
          </div>

          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={metrics}>
                <defs>
                  <linearGradient id="p95Grad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#EF4444" stopOpacity={0.25}/>
                    <stop offset="95%" stopColor="#EF4444" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
                <XAxis dataKey="time" stroke="#94A3B8" fontSize={10} />
                <YAxis stroke="#94A3B8" fontSize={10} />
                <Tooltip />
                <Area type="monotone" dataKey="p95" stroke="#EF4444" strokeWidth={2} fillOpacity={1} fill="url(#p95Grad)" name="Live p95 ms" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
}

