const API_BASE_URL = import.meta.env.VITE_API_URL || '/api/v1';

const authHeaders = (): Record<string, string> => {
  const token = localStorage.getItem('token');
  return token ? { Authorization: `Bearer ${token}` } : {};
};
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api/v1';

export const apiService = {
  async createReport(reportData: { description: string; category: string; latitude: number; longitude: number }) {
    const res = await fetch(`${API_BASE_URL}/reports`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(reportData),
    });
    return res.json();
  },

  async getReports() {
    const res = await fetch(`${API_BASE_URL}/reports`, { headers: authHeaders() });
    return res.json();
  },

  async getJobCards() {
    const res = await fetch(`${API_BASE_URL}/job-cards`, { headers: authHeaders() });
    return res.json();
  },

  async createJobCard(reportId: string, assignedCrewId: string, priority = 'MEDIUM') {
    const res = await fetch(`${API_BASE_URL}/job-cards`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify({ reportId, assignedCrewId, priority }),
    });
    return res.json();
  },

  async updateJobStatus(id: string, status: string, resolutionNotes?: string) {
    const res = await fetch(`${API_BASE_URL}/job-cards/${id}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify({ status, resolutionNotes }),
    });
    return res.json();
  },
};

