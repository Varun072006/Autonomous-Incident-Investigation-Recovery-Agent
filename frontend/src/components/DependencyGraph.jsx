import React from 'react';
import { Server, Database, Cloud, ShieldAlert, Cpu } from 'lucide-react';

export default function DependencyGraph({ graphData, selectedNodeId, onSelectNode }) {
  if (!graphData || !graphData.nodes) {
    return (
      <div className="h-64 flex items-center justify-center text-xs text-slate-400">
        Loading service dependency topology...
      </div>
    );
  }

  // Generously-spaced coordinates so nodes never overlap or get clipped
  const positions = {
    'web-frontend': { x: 88, y: 150, type: 'Edge Client', tier: 'Tier 0' },
    'api-gateway': { x: 255, y: 150, type: 'API Gateway', tier: 'Tier 1' },
    'checkout-api': { x: 435, y: 150, type: 'Orchestrator', tier: 'Tier 1' },
    'inventory-service': { x: 650, y: 65, type: 'Inventory Domain', tier: 'Tier 2' },
    'payment-service': { x: 650, y: 235, type: 'Payment Domain', tier: 'Tier 1' },
    'orders-db': { x: 865, y: 65, type: 'Document DB', tier: 'Tier 1' },
    'payments-db': { x: 865, y: 195, type: 'PostgreSQL Primary', tier: 'Tier 0' },
    'payment-gateway': { x: 865, y: 285, type: 'Third-Party Stripe', tier: 'External' }
  };

  const getNodeStyles = (status, isSelected) => {
    let dotColor = '#10B981'; // emerald
    let badgeText = 'Healthy';
    let badgeClass = 'bg-emerald-50 text-emerald-700 border-emerald-200';

    if (status === 'critical') {
      dotColor = '#EF4444'; // rose
      badgeText = 'Anomalous';
      badgeClass = 'bg-rose-50 text-rose-700 border-rose-200';
    } else if (status === 'warning') {
      dotColor = '#F59E0B'; // amber
      badgeText = 'Degraded';
      badgeClass = 'bg-amber-50 text-amber-700 border-amber-200';
    }

    return {
      dotColor,
      badgeText,
      badgeClass,
      border: isSelected ? '#2563EB' : '#E2E8F0',
      shadow: isSelected ? 'drop-shadow(0 4px 6px rgba(37, 99, 235, 0.15))' : 'drop-shadow(0 1px 2px rgba(0, 0, 0, 0.05))'
    };
  };

  const NODE_W = 154;
  const NODE_H = 56;
  const HALF_W = NODE_W / 2;
  const HALF_H = NODE_H / 2;

  return (
    <div className="w-full flex flex-col select-none">
      <div className="overflow-x-auto overflow-y-hidden py-1">
        <svg viewBox="0 0 970 340" className="w-full min-w-[760px] h-[310px]">
          <defs>
            <marker
              id="topo-arrow"
              viewBox="0 0 10 10"
              refX="8"
              refY="5"
              markerWidth="6"
              markerHeight="6"
              orient="auto-start-reverse"
            >
              <path d="M 0 1.5 L 8 5 L 0 8.5 z" fill="#94A3B8" />
            </marker>
          </defs>

          {/* Connectors */}
          {graphData.edges.map((edge, idx) => {
            const p1 = positions[edge.source] || { x: 80, y: 80 };
            const p2 = positions[edge.target] || { x: 120, y: 120 };
            const isCriticalPath = (edge.source === 'checkout-api' && edge.target === 'payment-service') ||
                                   (edge.source === 'payment-service' && edge.target === 'payments-db');

            // Draw curved path connecting right port of p1 to left port of p2
            const startX = p1.x + HALF_W;
            const startY = p1.y;
            const endX = p2.x - HALF_W;
            const endY = p2.y;
            const dx = (endX - startX) * 0.5;
            const pathData = `M ${startX} ${startY} C ${startX + dx} ${startY}, ${endX - dx} ${endY}, ${endX} ${endY}`;

            return (
              <path
                key={idx}
                d={pathData}
                fill="none"
                stroke={isCriticalPath ? '#F87171' : '#CBD5E1'}
                strokeWidth={isCriticalPath ? '2' : '1.5'}
                strokeDasharray={isCriticalPath ? '4 3' : 'none'}
                markerEnd="url(#topo-arrow)"
              />
            );
          })}

          {/* Service Nodes */}
          {graphData.nodes.map((node) => {
            const meta = positions[node.id] || { x: 100, y: 100, type: 'Service', tier: 'Tier 1' };
            const isSelected = selectedNodeId === node.id;
            const styles = getNodeStyles(node.status, isSelected);

            return (
              <g
                key={node.id}
                transform={`translate(${meta.x - HALF_W}, ${meta.y - HALF_H})`}
                className="cursor-pointer transition-colors"
                onClick={() => onSelectNode && onSelectNode(node)}
                style={{ filter: styles.shadow }}
              >
                {/* Node Box */}
                <rect
                  width={NODE_W}
                  height={NODE_H}
                  rx="9"
                  fill="#FFFFFF"
                  stroke={styles.border}
                  strokeWidth={isSelected ? '2' : '1.2'}
                />

                {/* Left/Right Port Dots */}
                <circle cx="0" cy={HALF_H} r="3" fill="#FFFFFF" stroke="#94A3B8" strokeWidth="1.5" />
                <circle cx={NODE_W} cy={HALF_H} r="3" fill="#FFFFFF" stroke="#94A3B8" strokeWidth="1.5" />

                {/* Health Status Dot */}
                <circle cx="15" cy="18" r="4" fill={styles.dotColor} />

                {/* Service Name */}
                <text
                  x="25"
                  y="21"
                  fill="#0F172A"
                  fontSize="11"
                  fontWeight="600"
                  fontFamily="Inter, system-ui, sans-serif"
                >
                  {node.name}
                </text>

                {/* Service Subtitle / Type (Line 2) */}
                <text
                  x="25"
                  y="35"
                  fill="#64748B"
                  fontSize="9.5"
                  fontWeight="400"
                  fontFamily="Inter, system-ui, sans-serif"
                >
                  {meta.type}
                </text>

                {/* Tier Badge (Line 3 - separated so never collides) */}
                <text
                  x="25"
                  y="47"
                  fill="#94A3B8"
                  fontSize="8.5"
                  fontFamily="JetBrains Mono, monospace"
                  fontWeight="500"
                >
                  {meta.tier}
                </text>

                {/* Anomalous / Degraded status flag on the right if applicable */}
                {node.status === 'critical' && (
                  <text
                    x={NODE_W - 10}
                    y="47"
                    textAnchor="end"
                    fill="#EF4444"
                    fontSize="8.5"
                    fontWeight="600"
                    fontFamily="Inter, system-ui, sans-serif"
                  >
                    Anomalous
                  </text>
                )}
                {node.status === 'warning' && (
                  <text
                    x={NODE_W - 10}
                    y="47"
                    textAnchor="end"
                    fill="#F59E0B"
                    fontSize="8.5"
                    fontWeight="600"
                    fontFamily="Inter, system-ui, sans-serif"
                  >
                    Affected
                  </text>
                )}
              </g>
            );
          })}
        </svg>
      </div>

      {/* Legend Footer */}
      <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-[11px] text-slate-500 px-1">
        <div className="flex items-center space-x-4">
          <span className="flex items-center">
            <span className="w-2 h-2 rounded-full bg-emerald-500 mr-1.5" /> Healthy
          </span>
          <span className="flex items-center">
            <span className="w-2 h-2 rounded-full bg-amber-500 mr-1.5" /> Affected Caller
          </span>
          <span className="flex items-center">
            <span className="w-2 h-2 rounded-full bg-rose-500 mr-1.5" /> Anomalous Origin
          </span>
        </div>
        <span className="text-[10px] text-slate-400 font-mono">
          Click any service node to inspect telemetry
        </span>
      </div>
    </div>
  );
}
