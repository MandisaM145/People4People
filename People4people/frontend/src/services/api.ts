<<<<<<< HEAD
const API_BASE_URL = import.meta.env.VITE_API_URL || '/api/v1';

const authHeaders = (): Record<string, string> => {
  const token = localStorage.getItem('token');
  return token ? { Authorization: `Bearer ${token}` } : {};
};
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api/v1';

export const apiService = {
=======
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api/v1';

export const apiService = {
  // Reports API
>>>>>>> fd97a80cb2fd24b1c20bc0898a0bcd57512d0ac2
  async createReport(reportData: { description: string; category: string; latitude: number; longitude: number }) {
    const res = await fetch(`${API_BASE_URL}/reports`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(reportData),
    });
    return res.json();
  },

  async getReports() {
<<<<<<< HEAD
    const res = await fetch(`${API_BASE_URL}/reports`, { headers: authHeaders() });
    return res.json();
  },

  async getJobCards() {
    const res = await fetch(`${API_BASE_URL}/job-cards`, { headers: authHeaders() });
=======
    const res = await fetch(`${API_BASE_URL}/reports`);
    return res.json();
  },

  // Job Cards API
  async getJobCards() {
    const res = await fetch(`${API_BASE_URL}/job-cards`);
>>>>>>> fd97a80cb2fd24b1c20bc0898a0bcd57512d0ac2
    return res.json();
  },

  async createJobCard(reportId: string, assignedCrewId: string, priority = 'MEDIUM') {
    const res = await fetch(`${API_BASE_URL}/job-cards`, {
      method: 'POST',
<<<<<<< HEAD
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
=======
      headers: { 'Content-Type': 'application/json' },
>>>>>>> fd97a80cb2fd24b1c20bc0898a0bcd57512d0ac2
      body: JSON.stringify({ reportId, assignedCrewId, priority }),
    });
    return res.json();
  },

  async updateJobStatus(id: string, status: string, resolutionNotes?: string) {
    const res = await fetch(`${API_BASE_URL}/job-cards/${id}/status`, {
      method: 'PATCH',
<<<<<<< HEAD
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify({ status, resolutionNotes }),
    });
    return res.json();
  },
};

=======
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status, resolutionNotes }),
    });
    return res.json();
  }
};
>>>>>>> fd97a80cb2fd24b1c20bc0898a0bcd57512d0ac2
