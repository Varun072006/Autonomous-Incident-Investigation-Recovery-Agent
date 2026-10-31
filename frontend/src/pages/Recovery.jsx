import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ShieldCheck, ShieldAlert, CheckCircle2, AlertOctagon, RefreshCw, Download, Play, Check, X, FileText, Cpu, AlertTriangle } from 'lucide-react';
import { api } from '../api';
import GroundedText from '../components/GroundedText';
import LlmBadge from '../components/LlmBadge';
import BaselineVsEvidence from '../components/BaselineVsEvidence';

export default function Recovery({ currentInvId }) {
  const [investigation, setInvestigation] = useState(null);
  const [actions, setActions] = useState([]);
  const [narration, setNarration] = useState(null);
  const [baseline, setBaseline] = useState(null);
  const [loading, setLoading] = useState(true);
  const [actionModal, setActionModal] = useState(null); // { action, type: 'approve' | 'reject' }
  const [approvalReason, setApprovalReason] = useState('');
  const [reviewedConfirmed, setReviewedConfirmed] = useState(false);
  const [verifyingId, setVerifyingId] = useState(null);
  const [verificationResult, setVerificationResult] = useState(null);
  const [reportData, setReportData] = useState(null);
  const [reportLoading, setReportLoading] = useState(false);

  const loadReport = async () => {
    setReportLoading(true);
    try { setReportData(await api.getPostIncidentReport(currentInvId)); }
    catch (e) { setReportData({ error: e.message }); }
    finally { setReportLoading(false); }
  };

  const loadData = async () => {
    if (!currentInvId) return;
    setLoading(true);
    try {
      const [inv, acts, bl] = await Promise.all([
        api.getInvestigation(currentInvId),
        api.getActions(currentInvId),
        api.baselineInvestigation(currentInvId)
      ]);
      setInvestigation(inv);
      setActions(acts);
      setBaseline(bl);

      // Async fetch narrative (template first, then LLM)
      api.narrateInvestigation(currentInvId)
        .then(setNarration)
        .catch(() => {});
    } catch (err) {
      console.error("Recovery load error:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [currentInvId]);

  const handleApprove = async () => {
    if (!actionModal?.action) return;
    try {
      await api.approveAction(
        actionModal.action.id,
        'oncall_lead',
        approvalReason,
        reviewedConfirmed
      );
      setActionModal(null);
      setApprovalReason('');
      setReviewedConfirmed(false);
      loadData();
    } catch (err) {
      alert("Approval blocked: " + err.message);
    }
  };

  const handleReject = async () => {
    if (!actionModal?.action) return;
    try {
      await api.rejectAction(actionModal.action.id, 'oncall_lead', approvalReason);
      setActionModal(null);
      setApprovalReason('');
      loadData();
    } catch (err) {
      alert("Reject failed: " + err.message);
    }
  };

  const handleExecute = async (actionId) => {
    try {
      const res = await api.executeAction(actionId);
      alert(res.message);
      loadData();
    } catch (err) {
      alert("Execution Blocked (HTTP 409): " + (err.detail?.message || err.message));
    }
  };

  const handleVerify = async (actionId) => {
    setVerifyingId(actionId);
    try {
      const res = await api.verifyAction(actionId);
      setVerificationResult(res);
      loadData();
    } catch (err) {
      alert("Verification check failed: " + err.message);
    } finally {
      setVerifyingId(null);
    }
  };

  const isReopened = investigation?.state === 'NOT_RECOVERED' || investigation?.state === 'INVESTIGATING';

  return (
    <div className="flex-1 flex flex-col h-full bg-[#F8FAFC] overflow-y-auto select-none">
      {/* Top Header matching Reference UI */}
      <div className="px-8 pt-7 pb-5 bg-white border-b border-slate-200/80">
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center space-x-2">
              <h1 className="text-xl font-bold text-slate-900 tracking-tight">
                Approvals & Safe Recovery
              </h1>
              <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                Human Gate Active
              </span>
              <span className="text-[10px] font-mono text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
                SIMULATED
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-1 max-w-3xl leading-relaxed">
              Tier 2 and Tier 3 recovery actions require explicit human authorization before execution. Post-fix telemetry SLA is strictly verified.
            </p>
          </div>

          <div className="flex items-center space-x-2">
            <span className="text-[11px] font-mono text-slate-500 bg-slate-100 px-2.5 py-1 rounded border border-slate-200">
              State: <strong className="text-slate-800">{investigation?.state || 'CONCLUDED'}</strong>
            </span>
          </div>
        </div>
      </div>

      <div className="p-8 space-y-6 flex-1">
        {/* Reopened Banner if verification failed */}
        {investigation?.state === 'NOT_RECOVERED' && (
          <div className="p-4 rounded-xl border border-rose-300 bg-rose-50 text-rose-900 flex items-center justify-between shadow-xs">
            <div className="flex items-center space-x-3">
              <AlertOctagon className="w-6 h-6 text-rose-600 flex-shrink-0" />
              <div>
                <div className="font-bold text-sm">Remediation Ineffective: Incident Reopened</div>
                <div className="text-xs text-rose-700">
                  Action executed but verification telemetry returned NOT_RECOVERED. Engine automatically added failure as contradicting evidence and replanned.
                </div>
              </div>
            </div>
            <Link
              to="/investigation"
              className="px-3 py-1.5 rounded-md bg-rose-600 hover:bg-rose-700 text-white font-semibold text-xs shadow-xs"
            >
              Go to Investigation →
            </Link>
          </div>
        )}

        {/* Root Cause Finding Header */}
        <div className="bg-white rounded-xl border border-slate-200/90 p-6 shadow-xs">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <div className="flex items-center space-x-2">
                <span className="text-base font-bold text-slate-900">
                  Concluded Root Cause: {investigation?.finding?.leader_title || 'Connection Pool Exhaustion'}
                </span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
                  {investigation?.finding?.leader_key || 'H_POOL'}
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-1">
                Relative evidence share: {investigation?.finding?.share ? (investigation.finding.share * 100).toFixed(1) + '%' : '100%'} (heuristic) • Tested coverage: {investigation?.finding?.coverage ? (investigation.finding.coverage * 100).toFixed(0) + '%' : '83%'}
              </p>
            </div>
          </div>

          {/* Side-by-side: Unaided LLM Guess vs TRACEOPS Evidence Result */}
          <BaselineVsEvidence baseline={baseline} finding={investigation?.finding} />
        </div>

      {/* Grounded Narrative Report with Citations */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-bold uppercase tracking-wider text-slate-800">
              Grounded Incident Narrative
            </h2>
            <span className="text-xs text-slate-500">
              Every sentence is cited with [E#] chips verified by grounding validator
            </span>
          </div>
          <LlmBadge narration={narration} />
        </div>

        <GroundedText narrative={narration} />
      </div>

      {/* Risk-Tiered Remediation Actions */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-sm font-bold uppercase tracking-wider text-slate-800">
              Risk-Tiered Action Catalog & Human Gates
            </h2>
            <span className="text-xs text-slate-500">
              Tier 2 requires human approval. Tier 3 requires approval plus mandatory written justification.
            </span>
          </div>
          <span className="px-2 py-0.5 text-xs font-semibold rounded bg-amber-100 text-amber-800 border border-amber-200">
            SIMULATED EXECUTION
          </span>
        </div>

        <div className="space-y-4">
          {actions.map((act) => {
            const isApproved = act.status === 'APPROVED';
            const isExecuted = act.status === 'EXECUTED_SIM';
            const isVerified = act.status === 'VERIFIED';
            const isFailed = act.status === 'NOT_RECOVERED';
            const isRejected = act.status === 'REJECTED';

            return (
              <div
                key={act.id}
                className={`p-4 rounded-xl border transition-all ${
                  act.recommended ? 'border-blue-300 bg-blue-50/20 ring-1 ring-blue-300' : 'border-slate-200 bg-white'
                }`}
              >
                <div className="flex flex-wrap items-start justify-between gap-3 mb-2">
                  <div>
                    <div className="flex items-center space-x-2">
                      <span className="font-mono text-sm font-bold text-slate-900">{act.kind}</span>
                      <span className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                        act.risk_tier === 1 ? 'bg-slate-100 text-slate-700' :
                        act.risk_tier === 2 ? 'bg-amber-100 text-amber-800' : 'bg-rose-100 text-rose-800'
                      }`}>
                        Tier {act.risk_tier} Risk
                      </span>
                      {act.recommended ? (
                        <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-blue-600 text-white">
                          RECOMMENDED
                        </span>
                      ) : null}
                    </div>
                    <div className="text-xs text-slate-700 mt-1">{act.description}</div>
                  </div>

                  {/* Status Badge */}
                  <span className={`px-2.5 py-1 rounded-md text-xs font-bold ${
                    isVerified ? 'bg-emerald-100 text-emerald-800 border border-emerald-300' :
                    isFailed ? 'bg-rose-100 text-rose-800 border border-rose-300' :
                    isExecuted ? 'bg-purple-100 text-purple-800 border border-purple-300' :
                    isApproved ? 'bg-blue-100 text-blue-800 border border-blue-300' :
                    isRejected ? 'bg-slate-200 text-slate-600 line-through' :
                    'bg-slate-100 text-slate-700 border border-slate-200'
                  }`}>
                    {act.status}
                  </span>
                </div>

                <div className="text-xs text-slate-500 font-mono mb-3">
                  Target Service: <span className="font-semibold text-slate-700">{act.target_service_id}</span> • Rollback: {act.rollback_plan}
                </div>

                {/* Action Buttons */}
                <div className="flex flex-wrap items-center gap-2 pt-3 border-t border-slate-100 text-xs">
                  {act.status === 'PENDING' && (
                    <>
                      <button
                        onClick={() => setActionModal({ action: act, type: 'approve' })}
                        className="px-3 py-1.5 rounded-lg bg-emerald-600 text-white font-semibold hover:bg-emerald-700"
                      >
                        Approve Candidate
                      </button>
                      <button
                        onClick={() => setActionModal({ action: act, type: 'reject' })}
                        className="px-3 py-1.5 rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-50"
                      >
                        Reject
                      </button>
                    </>
                  )}

                  <button
                    onClick={() => handleExecute(act.id)}
                    disabled={isExecuted || isVerified || isRejected}
                    className={`px-3 py-1.5 rounded-lg font-semibold transition-colors ${
                      isApproved
                        ? 'bg-blue-600 text-white hover:bg-blue-700 shadow-sm'
                        : 'border border-slate-300 text-slate-400 bg-slate-50 cursor-not-allowed'
                    }`}
                  >
                    Execute (SIMULATED)
                  </button>

                  <button
                    onClick={() => handleVerify(act.id)}
                    disabled={!isExecuted || isVerified}
                    className="px-3 py-1.5 rounded-lg bg-teal-600 text-white font-semibold hover:bg-teal-700 disabled:opacity-40"
                  >
                    {verifyingId === act.id ? 'Checking Telemetry...' : 'Verify Telemetry'}
                  </button>

                  {act.approved_by && (
                    <span className="text-slate-400 text-[11px] ml-auto font-mono">
                      Approved by: {act.approved_by}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Verification Results Panel */}
      {verificationResult && (
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-bold uppercase tracking-wider text-slate-800 flex items-center">
              <ShieldCheck className="w-4 h-4 mr-1.5 text-teal-600" />
              5-Minute Post-Action Telemetry Verification
            </span>
            <span className={`px-2.5 py-0.5 rounded text-xs font-bold ${
              verificationResult.verdict === 'VERIFIED'
                ? 'bg-emerald-100 text-emerald-800'
                : 'bg-rose-100 text-rose-800'
            }`}>
              VERDICT: {verificationResult.verdict}
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
            {Object.entries(verificationResult.checks || {}).map(([chkKey, chkVal]) => (
              <div key={chkKey} className="p-3 rounded-lg border border-slate-100 bg-slate-50">
                <div className="font-semibold text-slate-800 capitalize mb-1">
                  {chkKey.replace(/_/g, ' ')}
                </div>
                <div className="flex items-center justify-between mt-2">
                  <span className={`font-bold ${chkVal.passed ? 'text-emerald-700' : 'text-rose-700'}`}>
                    {chkVal.passed ? 'PASSED ✓' : 'FAILED ✗'}
                  </span>
                  <span className="font-mono text-slate-500">
                    {chkVal.observed_avg_ms ? `${chkVal.observed_avg_ms}ms` : ''}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Approve/Reject Modal Dialog */}
      {actionModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl border border-slate-200 shadow-xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-center justify-between">
              <span className="font-bold text-slate-900 text-base">
                {actionModal.type === 'approve' ? 'Approve Action' : 'Reject Action'}: {actionModal.action.kind}
              </span>
              <button onClick={() => setActionModal(null)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-slate-600">
              Risk Tier: <span className="font-bold">Tier {actionModal.action.risk_tier}</span>.
              {actionModal.action.risk_tier >= 3 && ' Written justification is mandatory for Tier 3 actions.'}
            </p>

            <div>
              <label className="text-xs font-medium text-slate-700 block mb-1">
                Justification / Operational Reason:
              </label>
              <textarea
                value={approvalReason}
                onChange={(e) => setApprovalReason(e.target.value)}
                placeholder="Enter justification for this action approval..."
                rows={3}
                className="w-full text-xs p-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>

            {/* Confidence Gate Confirmation */}
            {(investigation?.state === 'INCONCLUSIVE' || (investigation?.finding?.margin || 1) < 0.25) && (
              <label className="flex items-start space-x-2 text-xs text-slate-700 p-2.5 rounded bg-amber-50 border border-amber-200">
                <input
                  type="checkbox"
                  checked={reviewedConfirmed}
                  onChange={(e) => setReviewedConfirmed(e.target.checked)}
                  className="mt-0.5 rounded text-blue-600"
                />
                <span>I explicitly confirm that I have reviewed the supporting and contradicting evidence for this inconclusive candidate.</span>
              </label>
            )}

            <div className="flex justify-end space-x-2 pt-2 border-t border-slate-100 text-xs font-semibold">
              <button
                onClick={() => setActionModal(null)}
                className="px-3 py-1.5 rounded-lg border border-slate-300 text-slate-600 hover:bg-slate-50"
              >
                Cancel
              </button>
              {actionModal.type === 'approve' ? (
                <button
                  onClick={handleApprove}
                  className="px-4 py-1.5 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700"
                >
                  Confirm Approval
                </button>
              ) : (
                <button
                  onClick={handleReject}
                  className="px-4 py-1.5 rounded-lg bg-rose-600 text-white hover:bg-rose-700"
                >
                  Confirm Rejection
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      <section className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm mt-6" data-testid="report-panel">
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-800 flex items-center">
            <FileText className="w-4 h-4 mr-1 text-blue-600" /> Post-Incident Report (derived from stored evidence)
          </span>
          <button onClick={loadReport} disabled={reportLoading || !currentInvId}
            className="px-3 py-1.5 text-xs font-semibold rounded bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50">
            {reportLoading ? 'Generating…' : 'Generate Report'}
          </button>
        </div>
        {reportData?.error && <div className="text-xs text-red-700">{reportData.error}</div>}
        {reportData && !reportData.error && (
          <div className="text-xs space-y-3 text-slate-700">
            <div><span className="font-semibold">{reportData.title}</span> — <span className="px-1.5 py-0.5 rounded bg-slate-100">{reportData.report_status}</span></div>
            <p>{reportData.summary}</p>
            <div>
              <div className="font-semibold mb-1">Hypotheses</div>
              {reportData.competing_hypotheses.map(h => (
                <div key={h.key} className="mb-1">
                  <b>{h.key}</b> {h.status} · share {h.relative_evidence_share} · supporting [{h.supporting_evidence_ids.slice(0,3).join(', ')}] · contradicting [{h.contradicting_evidence_ids.slice(0,3).join(', ')}]
                </div>
              ))}
            </div>
            <div>
              <div className="font-semibold mb-1">Why alternatives were rejected</div>
              {reportData.rejected_hypotheses.map(h => <div key={h.key}><b>{h.key}</b>: {h.rejection_reason}</div>)}
            </div>
            <div>
              <div className="font-semibold mb-1">Adaptation</div>
              {reportData.adaptation.replans.length === 0 && <div>No replans.</div>}
              {reportData.adaptation.replans.map((r, i) => <div key={i}>Step {r.step}: {r.reason}</div>)}
            </div>
            <div>
              <div className="font-semibold mb-1">Recovery outcome: {reportData.recovery_outcome.verdict}</div>
              {reportData.before_and_after_verification
                ? <pre className="bg-slate-50 p-2 rounded overflow-auto">{JSON.stringify(reportData.before_and_after_verification, null, 2)}</pre>
                : <div>No verified recovery yet.</div>}
            </div>
          </div>
        )}
      </section>
      </div>
    </div>
  );
}

