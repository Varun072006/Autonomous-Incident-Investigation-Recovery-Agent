import React, { useEffect, useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { Activity, ShieldAlert, Cpu, Database, RotateCcw, AlertTriangle } from 'lucide-react';
import { api } from '../api';

export default function Navbar({ currentInvId, onReset }) {
  const [llmStatus, setLlmStatus] = useState(null);
  const [resetting, setResetting] = useState(false);
  const location = useLocation();

  useEffect(() => {
    api.getLlmStatus().then(setLlmStatus).catch(() => {});
  }, [location.pathname]);

  const handleReset = async () => {
    if (window.confirm("Reset and re-seed database with initial scenario fixture?")) {
      setResetting(true);
      try {
        await api.resetDatabase();
        if (onReset) onReset();
      } catch (err) {
        alert("Reset failed: " + err.message);
      } finally {
        setResetting(false);
      }
    }
  };

  const navItems = [
    { name: '1. Overview', path: '/' },
    { name: '2. Investigation', path: '/investigation' },
    { name: '3. Evidence Explorer', path: '/evidence' },
    { name: '4. Safe Recovery', path: '/recovery' },
  ];

  return (
    <header className="bg-white border-b border-slate-200 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <div className="flex items-center space-x-6">
            <div className="flex items-center space-x-3">
              <div className="h-9 w-9 rounded-lg bg-blue-600 flex items-center justify-center text-white font-bold tracking-wider shadow-sm">
                TO
              </div>
              <div>
                <span className="font-bold text-lg tracking-tight text-slate-900">TRACEOPS</span>
                <span className="ml-2 px-2 py-0.5 text-xs font-semibold bg-amber-100 text-amber-800 rounded border border-amber-200">
                  SIMULATED
                </span>
              </div>
            </div>

            <nav className="hidden md:flex space-x-1">
              {navItems.map((item) => (
                <NavLink
                  key={item.path}
                  to={item.path}
                  className={({ isActive }) =>
                    `px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                      isActive
                        ? 'bg-blue-50 text-blue-700 font-semibold'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                    }`
                  }
                >
                  {item.name}
                </NavLink>
              ))}
            </nav>
          </div>

          <div className="flex items-center space-x-3">
            {currentInvId && (
              <span className="hidden sm:inline-flex items-center px-2.5 py-1 rounded-md text-xs font-mono bg-slate-100 text-slate-700 border border-slate-200">
                ACTIVE: {currentInvId}
              </span>
            )}

            {llmStatus && (
              <div className="hidden lg:flex items-center space-x-2 px-2.5 py-1 rounded-md text-xs bg-slate-50 border border-slate-200 text-slate-600">
                <Cpu className="w-3.5 h-3.5 text-teal-600" />
                <span>LLM: {llmStatus.active_provider === 'none' ? 'None (Template)' : llmStatus.active_provider}</span>
                {llmStatus.cache_enabled && (
                  <span className="text-teal-700 font-medium">Cache✓</span>
                )}
              </div>
            )}

            <button
              onClick={handleReset}
              disabled={resetting}
              className="inline-flex items-center px-3 py-1.5 text-xs font-medium rounded-md border border-slate-300 text-slate-700 bg-white hover:bg-slate-50 transition-colors shadow-sm disabled:opacity-50"
              title="Reset Database to Seed 42 Baseline"
            >
              <RotateCcw className={`w-3.5 h-3.5 mr-1.5 ${resetting ? 'animate-spin' : ''}`} />
              {resetting ? 'Resetting...' : 'Reset Fixture'}
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}

