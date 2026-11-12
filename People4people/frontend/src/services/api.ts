
const API_BASE_URL =
  import.meta.env.VITE_API_URL || 'http://localhost:3000/api/v1';

async function apiRequest(endpoint: string, options: RequestInit = {}) {
  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.message || `API error: ${response.status}`);
  }

  return data;
}

export const apiService = {
  // Reports API
  async createReport(reportData: {
    description: string;
    category: string;
    latitude: number;
    longitude: number;
  }) {
    return apiRequest('/reports', {
      method: 'POST',
      body: JSON.stringify(reportData),
    });
  },

  async getReports() {
    return apiRequest('/reports');
  },

  // Job Cards API
  async getJobCards() {
    return apiRequest('/job-cards');
  },

  async createJobCard(
    reportId: string,
    assignedCrewId: string,
    priority = 'MEDIUM'
  ) {
    return apiRequest('/job-cards', {
      method: 'POST',
      body: JSON.stringify({
        reportId,
        assignedCrewId,
        priority,
      }),
    });
  },

  async updateJobStatus(
    id: string,
    status: string,
    resolutionNotes?: string
  ) {
    return apiRequest(`/job-cards/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({
        status,
        resolutionNotes,
      }),
    });
  },
};
