/**
 * TRACEOPS API client
 * Connects directly to FastAPI backend at /api
 */

const BASE_URL = import.meta.env.VITE_API_URL || '';

export async function request(endpoint, options = {}) {
  const url = `${BASE_URL}${endpoint}`;
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {})
  };

  const response = await fetch(url, {
    ...options,
    headers
  });

  if (!response.ok) {
    let errorDetail = response.statusText;
    try {
      const errJson = await response.json();
      errorDetail = errJson.detail || JSON.stringify(errJson);
    } catch (_) {}
    const err = new Error(typeof errorDetail === 'string' ? errorDetail : JSON.stringify(errorDetail));
    err.status = response.status;
    err.detail = errorDetail;
    throw err;
  }

  return response.json();
}

export const api = {
  getHealth: () => request('/api/health'),
  getIncident: () => request('/api/incident'),
  getGraph: () => request('/api/graph'),
  getTimeline: (since, until) => {
    const params = new URLSearchParams();
    if (since) params.append('since', since);
    if (until) params.append('until', until);
    const qs = params.toString() ? `?${params.toString()}` : '';
    return request(`/api/timeline${qs}`);
  },
  getMetrics: (service, metric, branch = 'incident') => {
    const params = new URLSearchParams();
    if (service) params.append('service', service);
    if (metric) params.append('metric', metric);
    params.append('branch', branch);
    return request(`/api/metrics?${params.toString()}`);
  },
  resetDatabase: () => request('/api/reset', { method: 'POST' }),

  // Investigation
  createInvestigation: () => request('/api/investigation', { method: 'POST' }),
  stepInvestigation: (id) => request(`/api/investigation/${id}/step`, { method: 'POST' }),
  getInvestigation: (id) => request(`/api/investigation/${id}`),
  getEvidence: (id, hypothesis) => {
    const qs = hypothesis ? `?hypothesis=${hypothesis}` : '';
    return request(`/api/investigation/${id}/evidence${qs}`);
  },
  injectEvidence: (id, type, payload, actor = 'operator') =>
    request(`/api/investigation/${id}/inject`, {
      method: 'POST',
      body: JSON.stringify({ type, payload, actor })
    }),
  narrateInvestigation: (id) => request(`/api/investigation/${id}/narrate`, { method: 'POST' }),
  baselineInvestigation: (id) => request(`/api/investigation/${id}/baseline`, { method: 'POST' }),
  getProofBundle: (id) => request(`/api/investigation/${id}/proof`),

  // LLM Status
  getLlmStatus: () => request('/api/llm'),
  getLlmCalls: (id) => request(`/api/investigation/${id}/llm-calls`),

  // Actions & Recovery
  getActions: (investigationId) => request(`/api/actions?investigation=${investigationId}`),
  approveAction: (id, by = 'oncall_lead', reason = '', confirmedEvidenceReviewed = false) =>
    request(`/api/actions/${id}/approve`, {
      method: 'POST',
      body: JSON.stringify({ by, reason, confirmed_evidence_reviewed: confirmedEvidenceReviewed })
    }),
  rejectAction: (id, by = 'oncall_lead', reason = '') =>
    request(`/api/actions/${id}/reject`, {
      method: 'POST',
      body: JSON.stringify({ by, reason })
    }),
  executeAction: (id) => request(`/api/actions/${id}/execute`, { method: 'POST' }),
  verifyAction: (id) => request(`/api/actions/${id}/verify`, { method: 'POST' }),

  // Admin & Outages
  toggleToolOutage: (tool, enabled) =>
    request('/api/admin/outage', {
      method: 'POST',
      body: JSON.stringify({ tool, enabled })
    }),
  verifyAudit: () => request('/api/audit/verify')
};

