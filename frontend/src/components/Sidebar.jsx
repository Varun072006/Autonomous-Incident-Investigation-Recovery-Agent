import React from 'react';
import { NavLink } from 'react-router-dom';
import {
  Activity,
  GitBranch,
  PlaySquare,
  ShieldCheck,
  Cpu,
  Layers,
  Database,
  Sliders,
  FileText,
  LogOut,
  Users,
  Settings,
  ShieldAlert,
  Boxes
} from 'lucide-react';

export default function Sidebar({ llmStatus }) {
  const navSections = [
    {
      group: 'BUILD',
      items: [
        { name: 'Overview', path: '/', icon: Activity },
        { name: 'Plan & run', path: '/plan-and-run', icon: PlaySquare },
        { name: 'Workflows', path: '/workflow-canvas', icon: GitBranch },
        { name: 'Investigation arena', path: '/investigation', icon: Layers }
      ]
    },
    {
      group: 'OPERATE',
      items: [
        { name: 'Runs', path: '/runs', icon: PlaySquare },
        { name: 'Approvals', path: '/recovery', icon: ShieldCheck },
        { name: 'Agents', path: '/agents', icon: Users, badge: 'active' },
        { name: 'Evidence lineage', path: '/evidence', icon: Database },
        { name: 'Connectors', path: '/outages', icon: Boxes }
      ]
    },
    {
      group: 'GOVERN',
      items: [
        { name: 'Policies', path: '/policies', icon: ShieldAlert },
        { name: 'Observability', path: '/observability', icon: Activity }
      ]
    },
    {
      group: 'PLATFORM',
      items: [
        { name: 'Organization', path: '/organization', icon: Settings }
      ]
    }
  ];

  return (
    <aside className="w-64 bg-white text-slate-700 flex flex-col justify-between border-r border-slate-200 flex-shrink-0 select-none h-screen">
      <div className="flex flex-col flex-1 overflow-hidden">
        {/* Brand Header */}
        <div className="h-14 flex items-center px-4 border-b border-slate-100 flex-shrink-0">
          <div className="w-7 h-7 rounded-md bg-[#0F172A] flex items-center justify-center text-white mr-2.5 shadow-xs">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2L2 7l10 5 10-5-10-5z" />
              <path d="M2 17l10 5 10-5" />
              <path d="M2 12l10 5 10-5" />
            </svg>
          </div>
          <div>
            <div className="text-xs font-bold text-slate-900 tracking-tight flex items-center leading-none">
              TRACEOPS
            </div>
            <div className="text-[10px] text-slate-400 tracking-tight mt-0.5">
              Agent control plane
            </div>
          </div>
        </div>

        {/* Navigation Sections */}
        <div className="py-3 px-2 space-y-4 overflow-y-auto flex-1">
          {navSections.map((sec) => (
            <div key={sec.group}>
              <div className="px-2.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                {sec.group}
              </div>
              <div className="space-y-0.5">
                {sec.items.map((item) => {
                  const Icon = item.icon;
                  return (
                    <NavLink
                      key={item.path}
                      to={item.path}
                      className={({ isActive }) =>
                        `flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs transition-colors ${
                          isActive
                            ? 'bg-slate-100/90 text-slate-900 font-semibold shadow-xs'
                            : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                        }`
                      }
                    >
                      <div className="flex items-center space-x-2 truncate">
                        <Icon className="w-3.5 h-3.5 flex-shrink-0 text-slate-500" />
                        <span className="truncate">{item.name}</span>
                      </div>
                      {item.badge && (
                        <span className="px-1.5 py-0.2 rounded-full text-[9px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                          {item.badge}
                        </span>
                      )}
                    </NavLink>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* User profile footer matching screenshot */}
      <div className="p-3 border-t border-slate-100 flex-shrink-0 bg-white">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2.5">
            <div className="w-7 h-7 rounded-md bg-[#0F172A] flex items-center justify-center text-white text-[11px] font-bold tracking-tight shadow-xs">
              AA
            </div>
            <div className="leading-tight">
              <div className="text-xs font-semibold text-slate-900">Avery Admin</div>
              <div className="text-[10px] text-slate-400 font-mono">admin</div>
            </div>
          </div>
          <button title="Sign out" className="text-slate-400 hover:text-slate-600 transition-colors p-1">
            <LogOut className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </aside>
  );
}
