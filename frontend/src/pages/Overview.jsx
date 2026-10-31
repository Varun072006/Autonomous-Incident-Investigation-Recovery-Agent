import React, { useEffect, useState } from 'react';
import { 
  ShieldAlert, 
  AlertTriangle, 
  Clock, 
  Layers, 
  TrendingUp, 
  Cpu, 
  Activity, 
  RefreshCw,
  Play,
  CheckCircle,
  ExternalLink,
  ChevronRight,
  Database,
  Server
} from 'lucide-react';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, ReferenceLine } from 'recharts';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';
import DependencyGraph from '../components/DependencyGraph';

export default function Overview() {
  const navigate = useNavigate();

  const [incident, setIncident] = useState(null);
  const [graphData, setGraphData] = useState(null);
  const [timeline, setTimeline] = useState([]);
  const [metrics, setMetrics] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedService, setSelectedService] = useState(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const [inc, graph, tl, coLatency, coErrors, payPool, dbCpu] = await Promise.all([
        api.getIncident(),
        api.getGraph(),
        api.getTimeline(),
        api.getMetrics('checkout-api', 'p95_latency_ms'),
        api.getMetrics('checkout-api', 'error_rate'),
        api.getMetrics('payment-service', 'pool_active'),
        api.getMetrics('payments-db', 'cpu_utilization')
      ]);

      setIncident(inc);
      setGraphData(graph);
      setTimeline(tl);

      if (graph?.nodes?.length > 0) {
        // Default to the most critical anomalous node
        const crit = graph.nodes.find(n => n.status === 'critical') || graph.nodes[0];
        setSelectedService(crit);
      }

      // Merge metrics by timestamp for clean multi-line charts
      const chartMap = {};
      coLatency.forEach(m => {
        const timeKey = m.ts.slice(11, 16);
        chartMap[timeKey] = { time: timeKey, co_latency: m.value };
      });
      coErrors.forEach(m => {
        const timeKey = m.ts.slice(11, 16);
        if (chartMap[timeKey]) chartMap[timeKey].co_err = (m.value * 100);
      });
      payPool.forEach(m => {
        const timeKey = m.ts.slice(11, 16);
        if (chartMap[timeKey]) chartMap[timeKey].pool_active = m.value;
      });
      dbCpu.forEach(m => {
        const timeKey = m.ts.slice(11, 16);
        if (chartMap[timeKey]) chartMap[timeKey].db_cpu = m.value;
      });

      setMetrics(Object.values(chartMap));
    } catch (err) {
      console.error("Overview fetch error:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  return (
    <div className="flex-1 flex flex-col h-full bg-[#F8FAFC] overflow-y-auto select-none">
      {/* Top Page Header matching Reference UI */}
      <div className="px-8 pt-7 pb-5 bg-white border-b border-slate-200/80">
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center space-x-2">
              <h1 className="text-xl font-bold text-slate-900 tracking-tight">Overview</h1>
              <span className="text-[10px] font-semibold text-rose-700 bg-rose-50 border border-rose-200 px-2 py-0.5 rounded-full">
                Active Incident
              </span>
              <span className="text-[10px] font-mono text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
                Fixture: Seed 42
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-1 max-w-3xl leading-relaxed">
              Real-time operational topology, anomaly blast radius calculation, and service dependency telemetry.
            </p>
          </div>

          <div className="flex items-center space-x-2.5">
            <button
              onClick={loadData}
              className="inline-flex items-center px-3 py-1.5 text-xs font-medium rounded-md border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 shadow-xs transition-colors"
            >
              <RefreshCw className={`w-3.5 h-3.5 mr-1.5 text-slate-400 ${loading ? 'animate-spin' : ''}`} />
              Refresh Signals
            </button>
            <button
              onClick={() => navigate('/plan-and-run')}
              className="inline-flex items-center px-3.5 py-1.5 text-xs font-semibold rounded-md bg-[#0F172A] hover:bg-[#1E293B] text-white shadow-xs transition-colors"
            >
              <Play className="w-3.5 h-3.5 mr-1.5 fill-current" />
              Plan & Investigate
            </button>
          </div>
        </div>

        {/* Metric KPI Strip (Clean, Refined Typography) */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6">
          <div className="p-4 bg-white rounded-xl border border-slate-200/90 shadow-xs">
            <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
              Peak Checkout p95
            </div>
            <div className="text-2xl font-bold text-slate-900 tracking-tight mt-1">
              5.4s
            </div>
            <div className="text-[11px] text-rose-600 font-mono mt-0.5">
              Baseline: 380ms (14x surge)
            </div>
          </div>

          <div className="p-4 bg-white rounded-xl border border-slate-200/90 shadow-xs">
            <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
              Peak Error Rate
            </div>
            <div className="text-2xl font-bold text-slate-900 tracking-tight mt-1">
              14.0%
            </div>
            <div className="text-[11px] text-rose-600 font-mono mt-0.5">
              Baseline: 0.3% error rate
            </div>
          </div>

          <div className="p-4 bg-white rounded-xl border border-slate-200/90 shadow-xs">
            <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
              Blast Radius
            </div>
            <div className="text-2xl font-bold text-slate-900 tracking-tight mt-1">
              3 Services
            </div>
            <div className="text-[11px] text-slate-500 font-mono mt-0.5">
              gateway · checkout · payment
            </div>
          </div>

          <div className="p-4 bg-white rounded-xl border border-slate-200/90 shadow-xs">
            <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
              Active Alerts
            </div>
            <div className="text-2xl font-bold text-slate-900 tracking-tight mt-1">
              4 Alerts
            </div>
            <div className="text-[11px] text-slate-500 font-mono mt-0.5">
              p95 latency · 5xx rate · pool_active
            </div>
          </div>
        </div>
      </div>

      {/* Main Content Area: Topology on Left, Service Inspector on Right */}
      <div className="p-8 space-y-6 flex-1">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
          {/* Topology Canvas Card (cols 1-2) */}
          <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200/90 shadow-xs p-6 flex flex-col justify-between">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div>
                <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                  Service Dependency Topology
                </h3>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Live directional graph representing service call dependencies and anomaly propagation path.
                </p>
              </div>
              <span className="text-[11px] font-mono text-slate-400">
                8 services · 7 edges
              </span>
            </div>

            <DependencyGraph
              graphData={graphData}
              selectedNodeId={selectedService?.id}
              onSelectNode={(node) => setSelectedService(node)}
            />
          </div>

          {/* Right Inspector Card matching Image 3 style */}
          <div className="bg-white rounded-xl border border-slate-200/90 shadow-xs p-6 space-y-5">
            {/* Header */}
            <div>
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <div className="w-5 h-5 rounded-md bg-slate-100 flex items-center justify-center text-slate-700">
                    <Server className="w-3.5 h-3.5" />
                  </div>
                  <h3 className="text-sm font-bold text-slate-900 tracking-tight truncate max-w-[170px]">
                    {selectedService?.name || 'payment-service'}
                  </h3>
                </div>
                <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${
                  selectedService?.status === 'critical'
                    ? 'text-rose-700 bg-rose-50 border-rose-200'
                    : selectedService?.status === 'warning'
                    ? 'text-amber-700 bg-amber-50 border-amber-200'
                    : 'text-emerald-700 bg-emerald-50 border-emerald-200'
                }`}>
                  {selectedService?.status === 'critical' ? 'anomalous' : selectedService?.status || 'healthy'}
                </span>
              </div>
              <div className="text-[10px] font-mono text-slate-400 mt-1">
                service · Tier {selectedService?.tier || '1'} · v2.14.0
              </div>
            </div>

            {/* Description paragraph */}
            <p className="text-xs text-slate-600 leading-relaxed font-sans">
              {selectedService?.id === 'payment-service'
                ? 'Primary payment execution domain. Identified as causal anomaly origin due to connection pool starvation.'
                : selectedService?.id === 'checkout-api'
                ? 'High-throughput checkout gateway orchestrating order completion. Experiencing cascading timeouts.'
                : `Service node responsible for ${selectedService?.name} operational workload in production.`}
            </p>

            {/* Action buttons row matching screenshot */}
            <div className="flex flex-wrap items-center gap-1.5 pt-1">
              <button 
                onClick={() => navigate('/investigation')}
                className="inline-flex items-center px-2.5 py-1 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-md hover:bg-slate-50 transition-colors shadow-xs"
              >
                Inspect Telemetry
              </button>
              <button 
                onClick={() => navigate('/evidence')}
                className="inline-flex items-center px-2.5 py-1 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-md hover:bg-slate-50 transition-colors shadow-xs"
              >
                View Evidence
              </button>
              <button 
                onClick={() => navigate('/recovery')}
                className="inline-flex items-center px-2.5 py-1 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-md hover:bg-slate-50 transition-colors shadow-xs"
              >
                Safe Recovery
              </button>
            </div>

            {/* Key-Value Metadata Grid matching screenshot */}
            <div className="space-y-2 text-xs pt-3 border-t border-slate-100">
              <div className="flex items-start justify-between py-1">
                <span className="text-slate-500 font-normal">Service Tier</span>
                <span className="text-slate-800 font-medium">Tier {selectedService?.tier || '1'}</span>
              </div>
              <div className="flex items-start justify-between py-1">
                <span className="text-slate-500 font-normal">Active Revision</span>
                <span className="text-slate-800 font-mono text-[11px] font-semibold">v2.14.0 (canary)</span>
              </div>
              <div className="flex items-start justify-between py-1">
                <span className="text-slate-500 font-normal">p95 Latency</span>
                <span className={`font-mono text-[11px] font-semibold ${
                  selectedService?.status === 'critical' ? 'text-rose-600' : 'text-slate-800'
                }`}>
                  {selectedService?.status === 'critical' ? '5,120 ms (Anomalous)' : '185 ms (Normal)'}
                </span>
              </div>
              <div className="flex items-start justify-between py-1">
                <span className="text-slate-500 font-normal">Error Rate</span>
                <span className={`font-mono text-[11px] font-semibold ${
                  selectedService?.status === 'critical' ? 'text-rose-600' : 'text-slate-800'
                }`}>
                  {selectedService?.status === 'critical' ? '14.0%' : '0.2%'}
                </span>
              </div>
              <div className="flex items-start justify-between py-1">
                <span className="text-slate-500 font-normal">Connection Pool</span>
                <span className="text-slate-800 font-mono text-[11px]">
                  {selectedService?.id === 'payment-service' ? '10/10 (Saturated)' : 'Nominal'}
                </span>
              </div>
            </div>

            {/* UPSTREAM / DOWNSTREAM PILLS */}
            <div className="space-y-1.5 pt-3 border-t border-slate-100">
              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                DEPENDENCY PATH
              </div>
              <div className="flex flex-wrap gap-1.5">
                <span className="text-[11px] font-mono text-slate-700 bg-slate-100 px-2 py-0.5 rounded font-medium">
                  caller: checkout-api
                </span>
                <span className="text-[11px] font-mono text-slate-700 bg-slate-100 px-2 py-0.5 rounded font-medium">
                  downstream: payments-db
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Telemetry Charts Row */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Chart 1: Latency */}
          <div className="bg-white p-5 rounded-xl border border-slate-200/90 shadow-xs">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                  Checkout API p95 Latency (ms)
                </h4>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Timeseries latency spike detected at 13:32 UTC following canary rollout.
                </p>
              </div>
              <span className="text-[11px] font-mono text-slate-400">Deploy: 13:28 UTC</span>
            </div>
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={metrics}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
                  <XAxis dataKey="time" stroke="#94A3B8" fontSize={10} />
                  <YAxis stroke="#94A3B8" fontSize={10} />
                  <Tooltip />
                  <Line type="monotone" dataKey="co_latency" stroke="#EF4444" strokeWidth={2} dot={false} name="p95 Latency" />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Chart 2: Error Rate */}
          <div className="bg-white p-5 rounded-xl border border-slate-200/90 shadow-xs">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                  Checkout 5xx Error Rate (%)
                </h4>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Downstream payment gateway error cascade exceeding 5% SLA threshold.
                </p>
              </div>
              <span className="text-[11px] font-mono text-slate-400">Threshold: 5.0%</span>
            </div>
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={metrics}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
                  <XAxis dataKey="time" stroke="#94A3B8" fontSize={10} />
                  <YAxis stroke="#94A3B8" fontSize={10} />
                  <Tooltip />
                  <Line type="monotone" dataKey="co_err" stroke="#F43F5E" strokeWidth={2} dot={false} name="Error Rate %" />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* Chronological Incident Timeline Table */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
              CHRONOLOGICAL INCIDENT TIMELINE
            </h3>
            <span className="text-[11px] font-mono text-slate-400">
              {timeline.length} operational events ordered by UTC timestamp
            </span>
          </div>

          <div className="bg-white rounded-xl border border-slate-200/90 overflow-hidden shadow-xs">
            <table className="w-full text-left text-xs text-slate-600">
              <thead className="bg-[#F8FAFC] text-[10px] uppercase font-bold text-slate-400 tracking-wider border-b border-slate-200">
                <tr>
                  <th className="py-2.5 px-4 font-bold">Timestamp</th>
                  <th className="py-2.5 px-4 font-bold">Event Type</th>
                  <th className="py-2.5 px-4 font-bold">Event Title</th>
                  <th className="py-2.5 px-4 font-bold">Operational Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {timeline.map((event, idx) => (
                  <tr key={idx} className="hover:bg-slate-50 transition-colors">
                    <td className="py-3 px-4 font-mono text-slate-500 text-[11px] whitespace-nowrap">
                      {event.ts ? event.ts.replace('T', ' ').replace('Z', ' UTC') : '—'}
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap">
                      <span className={`text-[10px] font-mono font-semibold px-2 py-0.5 rounded ${
                        event.type === 'DEPLOYMENT'
                          ? 'bg-blue-50 text-blue-700 border border-blue-200'
                          : event.type === 'CONFIG_CHANGE'
                          ? 'bg-purple-50 text-purple-700 border border-purple-200'
                          : event.type === 'ANOMALY_ONSET'
                          ? 'bg-rose-50 text-rose-700 border border-rose-200'
                          : 'bg-slate-100 text-slate-700'
                      }`}>
                        {event.type}
                      </span>
                    </td>
                    <td className="py-3 px-4 font-semibold text-slate-900 whitespace-nowrap">
                      {event.title}
                    </td>
                    <td className="py-3 px-4 text-slate-600 text-[11px]">
                      {event.details}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
