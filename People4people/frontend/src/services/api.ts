import { apiFetch } from './http';

async function apiRequest(endpoint: string, options: RequestInit = {}) {
  const token = localStorage.getItem('token');
  const response = await apiFetch(endpoint, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error || data.message || `API error: ${response.status}`);
  }
  return data;
}

export const apiService = {
  async createReport(reportData: { description: string; category: string; latitude: number; longitude: number }) {
    return apiRequest('/reports', {
      method: 'POST',
      body: JSON.stringify(reportData),
    });
  },

  async getReports() {
    return apiRequest('/reports');
  },

  async getJobCards() {
    return apiRequest('/job-cards');
  },

  async createJobCard(reportId: string, assignedCrewId: string, priority = 'MEDIUM') {
    return apiRequest('/job-cards', {
      method: 'POST',
      body: JSON.stringify({ reportId, assignedCrewId, priority }),
    });
  },

  async updateJobStatus(id: string, status: string, resolutionNotes?: string) {
    return apiRequest(`/job-cards/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status, resolutionNotes }),
    });
  },
};
