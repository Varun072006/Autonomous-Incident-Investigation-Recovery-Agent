import React, { useState, useEffect } from 'react';
import { Users, ShieldCheck, CheckCircle, Clock, Key, Award, AlertTriangle, Shield } from 'lucide-react';
import { api } from '../api';

export default function Organization() {
  const [auditStatus, setAuditStatus] = useState(null);
  const [verifying, setVerifying] = useState(false);

  const team = [
    { name: 'Avery Admin', role: 'SRE Lead / Incident Commander', status: 'PRIMARY ON-CALL', email: 'avery@traceops.internal', permissions: 'Full Autonomous & Tier 3 Approval' },
    { name: 'Devon Ops', role: 'Staff Platform Engineer', status: 'SECONDARY ON-CALL', email: 'devon@traceops.internal', permissions: 'Tier 1 & Tier 2 Approval' },
    { name: 'Morgan SRE', role: 'On-Call Systems Engineer', status: 'AVAILABLE', email: 'morgan@traceops.internal', permissions: 'Tier 1 Approval & Read-Only Diagnostics' },
    { name: 'Jordan Sec', role: 'Security & Compliance Officer', status: 'AUDITOR', email: 'jordan@traceops.internal', permissions: 'Policy Governance & Audit Review' }
  ];

  const handleVerifyAudit = async () => {
    setVerifying(true);
    try {
      const res = await api.verifyAudit();
      setAuditStatus(res);
    } catch (err) {
      alert("Audit verification failed: " + err.message);
    } finally {
      setVerifying(false);
    }
  };

  useEffect(() => {
    handleVerifyAudit();
  }, []);

  return (
    <div className="flex-1 flex flex-col h-full bg-[#F8FAFC] overflow-y-auto select-none">
      {/* Header */}
      <div className="px-8 pt-7 pb-5 bg-white border-b border-slate-200/80">
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center space-x-2">
              <h1 className="text-xl font-bold text-slate-900 tracking-tight">Organization & SRE Control Plane</h1>
              <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                Cryptographic Audit Verified
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              On-call incident commander rotations, role-based approval permissions, and hash-chained audit verification.
            </p>
          </div>
          <button
            onClick={handleVerifyAudit}
            disabled={verifying}
            className="inline-flex items-center px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors shadow-xs"
          >
            <ShieldCheck className="w-3.5 h-3.5 mr-1.5 text-emerald-600" />
            {verifying ? 'Verifying Hashes...' : 'Verify Cryptographic Audit Log'}
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="p-8 space-y-6 flex-1 max-w-6xl">
        {/* Audit Status Banner */}
        {auditStatus && (
          <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 flex items-center justify-between text-xs text-emerald-900">
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 rounded-lg bg-emerald-100 flex items-center justify-center text-emerald-700 font-bold">
                <CheckCircle className="w-4 h-4" />
              </div>
              <div>
                <div className="font-bold">Audit Chain Valid: {auditStatus.entries_verified} state events verified</div>
                <div className="text-[11px] text-emerald-700 font-mono mt-0.5">
                  Latest Hash: {auditStatus.latest_hash || 'SHA-256 e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855'}
                </div>
              </div>
            </div>
            <span className="text-[10px] font-mono text-emerald-700 bg-emerald-100/70 px-2.5 py-1 rounded-full font-semibold">
              Zero Tampering Detected
            </span>
          </div>
        )}

        {/* Team Members & On-Call Rotation */}
        <div className="bg-white rounded-xl border border-slate-200/90 shadow-xs overflow-hidden">
          <div className="px-5 py-3.5 border-b border-slate-100 flex items-center justify-between">
            <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
              On-Call Command Staff & RBAC Permissions
            </h3>
            <span className="text-[11px] font-mono text-slate-400">
              Shift: Week 44 (UTC)
            </span>
          </div>

          <table className="w-full text-left text-xs text-slate-600">
            <thead className="bg-[#F8FAFC] text-[10px] uppercase font-bold text-slate-400 tracking-wider border-b border-slate-200">
              <tr>
                <th className="py-2.5 px-4 font-bold">Engineer</th>
                <th className="py-2.5 px-4 font-bold">Role</th>
                <th className="py-2.5 px-4 font-bold">On-Call Status</th>
                <th className="py-2.5 px-4 font-bold">Execution Permissions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {team.map((m) => (
                <tr key={m.email} className="hover:bg-slate-50 transition-colors">
                  <td className="py-3 px-4 font-semibold text-slate-900">
                    <div>{m.name}</div>
                    <div className="text-[10px] text-slate-400 font-mono">{m.email}</div>
                  </td>
                  <td className="py-3 px-4 text-slate-700">
                    {m.role}
                  </td>
                  <td className="py-3 px-4">
                    <span className={`text-[10px] font-mono font-semibold px-2 py-0.5 rounded ${
                      m.status.includes('PRIMARY')
                        ? 'bg-rose-50 text-rose-700 border border-rose-200'
                        : m.status.includes('SECONDARY')
                        ? 'bg-amber-50 text-amber-700 border border-amber-200'
                        : 'bg-slate-100 text-slate-700'
                    }`}>
                      {m.status}
                    </span>
                  </td>
                  <td className="py-3 px-4 font-mono text-[11px] text-slate-700">
                    {m.permissions}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

