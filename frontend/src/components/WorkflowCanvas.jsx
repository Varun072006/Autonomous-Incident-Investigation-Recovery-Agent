import React, { useState } from 'react';
import { 
  ZoomIn, 
  ZoomOut, 
  Maximize2, 
  Play, 
  CheckCircle, 
  AlertTriangle, 
  ShieldAlert, 
  ShieldCheck, 
  Layers, 
  ChevronDown, 
  ChevronUp,
  Cpu
} from 'lucide-react';

export default function WorkflowCanvas({
  nodes = [],
  selectedNodeId = null,
  onSelectNode,
  validationIssues = [],
  className = ""
}) {
  const [zoomLevel, setZoomLevel] = useState(1);
  const [isValidationOpen, setIsValidationOpen] = useState(false);

  const handleZoom = (delta) => {
    setZoomLevel((prev) => Math.max(0.6, Math.min(1.5, prev + delta)));
  };

  const handleResetZoom = () => {
    setZoomLevel(1);
  };

  const getRiskBadge = (tier) => {
    if (tier === 0 || tier === undefined) {
      return (
        <span className="inline-flex items-center text-[10px] text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">
          <ShieldCheck className="w-2.5 h-2.5 mr-1 text-emerald-600" />
          Autonomous
        </span>
      );
    }
    if (tier === 1) {
      return (
        <span className="inline-flex items-center text-[10px] text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded border border-blue-200">
          Standard
        </span>
      );
    }
    if (tier === 2) {
      return (
        <span className="inline-flex items-center text-[10px] text-amber-800 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200 font-medium">
          <AlertTriangle className="w-2.5 h-2.5 mr-1 text-amber-600" />
          Medium risk
        </span>
      );
    }
    return (
      <span className="inline-flex items-center text-[10px] text-red-700 bg-red-50 px-1.5 py-0.5 rounded border border-red-200 font-medium">
        <ShieldAlert className="w-2.5 h-2.5 mr-1 text-red-600" />
        High risk
      </span>
    );
  };

  const getStatusIndicator = (status) => {
    switch (status) {
      case 'COMPLETED':
      case 'SUCCESS':
        return <div className="w-2 h-2 rounded-full bg-emerald-500" title="Completed" />;
      case 'RUNNING':
        return <div className="w-2 h-2 rounded-full bg-blue-500 animate-ping" title="Running" />;
      case 'FAILED':
        return <div className="w-2 h-2 rounded-full bg-red-500" title="Failed" />;
      default:
        return <div className="w-2 h-2 rounded-full bg-slate-300" title="Pending" />;
    }
  };

  return (
    <div className={`relative flex-1 bg-[#FAFAF9] flex flex-col overflow-hidden border border-slate-200/60 rounded-xl select-none ${className}`}>
      {/* Grid Pattern Background */}
      <div 
        className="absolute inset-0 pointer-events-none opacity-[0.25]"
        style={{
          backgroundImage: 'radial-gradient(#94A3B8 1px, transparent 1px)',
          backgroundSize: '24px 24px'
        }}
      />

      {/* Main Flow Canvas Viewport */}
      <div className="flex-1 overflow-x-auto overflow-y-auto py-8 px-6 flex items-center justify-start min-w-full min-h-[340px]">
        <div 
          className="flex items-center space-x-12 transition-transform duration-150 origin-left"
          style={{ transform: `scale(${zoomLevel})` }}
        >
          {nodes.map((node, index) => {
            const isSelected = selectedNodeId === node.id;
            const hasNext = index < nodes.length - 1;

            return (
              <React.Fragment key={node.id || index}>
                {/* Node Box */}
                <div
                  onClick={() => onSelectNode && onSelectNode(node)}
                  className={`relative w-64 bg-white rounded-xl shadow-sm border transition-all cursor-pointer p-4 group ${
                    isSelected
                      ? 'border-blue-500 ring-2 ring-blue-500/20 shadow-md shadow-blue-500/10'
                      : 'border-slate-200 hover:border-slate-300 hover:shadow'
                  }`}
                >
                  {/* Left Port Dot */}
                  <div className="absolute -left-1.5 top-1/2 -translate-y-1/2 w-3 h-3 bg-white border-2 border-slate-300 rounded-full group-hover:border-blue-400" />
                  
                  {/* Right Port Dot */}
                  <div className="absolute -right-1.5 top-1/2 -translate-y-1/2 w-3 h-3 bg-white border-2 border-slate-300 rounded-full group-hover:border-blue-400" />

                  {/* Header */}
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center space-x-2">
                      <div className="p-1 rounded bg-slate-50 border border-slate-200 text-slate-600">
                        {node.type === 'trigger' ? (
                          <Play className="w-3.5 h-3.5 text-blue-600 fill-current" />
                        ) : node.type === 'action' ? (
                          <ShieldAlert className="w-3.5 h-3.5 text-amber-600" />
                        ) : (
                          <Cpu className="w-3.5 h-3.5 text-slate-700" />
                        )}
                      </div>
                      <div className="truncate">
                        <div className="text-xs font-bold text-slate-800 truncate">
                          {node.label || node.name}
                        </div>
                        <div className="text-[10px] font-mono text-slate-400 truncate">
                          {node.toolName || node.handler || 'step.diagnostic'}
                        </div>
                      </div>
                    </div>
                    {getStatusIndicator(node.status)}
                  </div>

                  {/* Subtitle / Service / Description */}
                  {node.service && (
                    <div className="text-[11px] text-slate-500 mb-2 truncate">
                      Target: <span className="font-mono text-slate-700">{node.service}</span>
                    </div>
                  )}

                  {/* Badges footer */}
                  <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                    <div>{getRiskBadge(node.riskTier)}</div>
                    {node.anomalyCount > 0 && (
                      <span className="text-[10px] font-semibold text-rose-600 bg-rose-50 px-1.5 py-0.5 rounded border border-rose-200 flex items-center">
                        <AlertTriangle className="w-2.5 h-2.5 mr-0.5" />
                        {node.anomalyCount} issue{node.anomalyCount > 1 ? 's' : ''}
                      </span>
                    )}
                    {node.evidenceId && (
                      <span className="text-[10px] font-mono text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded">
                        {node.evidenceId}
                      </span>
                    )}
                  </div>
                </div>

                {/* SVG Arrow Connector */}
                {hasNext && (
                  <div className="flex items-center justify-center -mx-4 z-0 pointer-events-none">
                    <svg width="48" height="24" viewBox="0 0 48 24" className="text-slate-300">
                      <path
                        d="M 0 12 L 40 12"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeDasharray={node.status === 'RUNNING' ? "4 4" : "none"}
                      />
                      <polygon points="40,8 48,12 40,16" fill="currentColor" />
                    </svg>
                  </div>
                )}
              </React.Fragment>
            );
          })}
        </div>
      </div>

      {/* Floating Canvas Controls (Bottom Left) */}
      <div className="absolute left-4 bottom-14 flex items-center bg-white border border-slate-200 rounded-lg shadow-sm p-1 space-x-1 z-20">
        <button
          onClick={() => handleZoom(0.1)}
          className="p-1.5 hover:bg-slate-100 rounded text-slate-600 hover:text-slate-900 transition-colors"
          title="Zoom in"
        >
          <ZoomIn className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={() => handleZoom(-0.1)}
          className="p-1.5 hover:bg-slate-100 rounded text-slate-600 hover:text-slate-900 transition-colors"
          title="Zoom out"
        >
          <ZoomOut className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={handleResetZoom}
          className="p-1.5 hover:bg-slate-100 rounded text-slate-600 hover:text-slate-900 transition-colors"
          title="Reset zoom"
        >
          <Maximize2 className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Floating Mini Map (Bottom Right) */}
      <div className="absolute right-4 bottom-14 bg-white/90 backdrop-blur-sm border border-slate-200 rounded-lg shadow-md p-2 w-36 h-24 hidden md:flex flex-col justify-between z-20 pointer-events-none">
        <div className="flex-1 flex items-center justify-around px-1">
          {nodes.map((node, i) => (
            <div
              key={i}
              className={`w-4 h-3 rounded-sm ${
                selectedNodeId === node.id ? 'bg-blue-600' : 'bg-slate-800'
              }`}
            />
          ))}
        </div>
        <div className="text-[9px] font-mono text-center text-slate-400 bg-slate-100 rounded py-0.5">
          Mini Map
        </div>
      </div>

      {/* Collapsible Validation Drawer (Bottom Bar) */}
      <div className="border-t border-slate-200 bg-white z-30 transition-all">
        <button
          onClick={() => setIsValidationOpen(!isValidationOpen)}
          className="w-full px-5 py-2.5 flex items-center justify-between text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
        >
          <div className="flex items-center space-x-2">
            <span className="font-bold text-slate-900">
              Validation · {validationIssues.length || 0}
            </span>
            {validationIssues.length === 0 ? (
              <span className="text-[11px] text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded font-medium flex items-center">
                <CheckCircle className="w-3 h-3 mr-1 text-emerald-600" />
                All invariants & safe boundaries satisfied
              </span>
            ) : (
              <span className="text-[11px] text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded font-medium flex items-center">
                <AlertTriangle className="w-3 h-3 mr-1 text-amber-600" />
                {validationIssues.length} check{validationIssues.length > 1 ? 's' : ''} flagged
              </span>
            )}
          </div>
          <div className="flex items-center space-x-2 text-slate-400">
            {isValidationOpen ? (
              <ChevronDown className="w-4 h-4" />
            ) : (
              <ChevronUp className="w-4 h-4" />
            )}
          </div>
        </button>

        {isValidationOpen && (
          <div className="px-5 pb-3 max-h-40 overflow-y-auto space-y-2 border-t border-slate-100 pt-2">
            {validationIssues.length === 0 ? (
              <div className="text-xs text-slate-500 py-1 flex items-center space-x-2">
                <CheckCircle className="w-3.5 h-3.5 text-emerald-600 flex-shrink-0" />
                <span>Deterministic invariant: Baseline error rate diff = 1.60% (≤ 2.0%). Recovery requires human approval.</span>
              </div>
            ) : (
              validationIssues.map((issue, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between text-xs text-amber-800 bg-amber-50/70 p-2 rounded border border-amber-200/80"
                >
                  <div className="flex items-center space-x-2">
                    <AlertTriangle className="w-3.5 h-3.5 text-amber-600 flex-shrink-0" />
                    <span>{issue.message || issue}</span>
                  </div>
                  {issue.step && (
                    <button
                      onClick={() => onSelectNode && onSelectNode({ id: issue.step })}
                      className="text-blue-600 hover:underline font-mono text-[11px]"
                    >
                      Go to step
                    </button>
                  )}
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}
