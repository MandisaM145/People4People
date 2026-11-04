const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api/v1';

export const apiService = {
  // Reports API
  async createReport(reportData: { description: string; category: string; latitude: number; longitude: number }) {
    const res = await fetch(`${API_BASE_URL}/reports`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(reportData),
    });
    return res.json();
  },

  async getReports() {
    const res = await fetch(`${API_BASE_URL}/reports`);
    return res.json();
  },

  // Job Cards API
  async getJobCards() {
    const res = await fetch(`${API_BASE_URL}/job-cards`);
    return res.json();
  },

  async createJobCard(reportId: string, assignedCrewId: string, priority = 'MEDIUM') {
    const res = await fetch(`${API_BASE_URL}/job-cards`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reportId, assignedCrewId, priority }),
    });
    return res.json();
  },

  async updateJobStatus(id: string, status: string, resolutionNotes?: string) {
    const res = await fetch(`${API_BASE_URL}/job-cards/${id}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status, resolutionNotes }),
    });
    return res.json();
  }
};
