import React, { useState, useEffect } from 'react';
import { apiService } from '../services/api';

export const AdminDashboard: React.FC = () => {
  const [reports, setReports] = useState<any[]>([]);
  const [jobCards, setJobCards] = useState<any[]>([]);
  const [selectedReportId, setSelectedReportId] = useState('');
  const [crewId, setCrewId] = useState('Crew-Alpha-DurbanNorth');

  const loadData = async () => {
    const repData = await apiService.getReports();
    const jobData = await apiService.getJobCards();
    setReports(repData || []);
    setJobCards(jobData || []);
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleCreateJob = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedReportId) return;
    await apiService.createJobCard(selectedReportId, crewId);
    setSelectedReportId('');
    loadData();
  };

  const handleCloseJob = async (jobId: string) => {
    await apiService.updateJobStatus(jobId, 'COMPLETED', 'Work verified and resolved on site.');
    loadData();
  };

  return (
    <div style={{ padding: '16px', backgroundColor: '#FFF', borderRadius: '8px', border: '1px solid #DDD' }}>
      <h2>National & Provincial Admin Console</h2>
      
      {/* KPI Stats */}
      <div style={{ display: 'flex', gap: '16px', marginBottom: '20px' }}>
        <div style={cardStyle}><strong>Total Reports:</strong> {reports.length}</div>
        <div style={cardStyle}><strong>Active Job Cards:</strong> {jobCards.length}</div>
        <div style={cardStyle}><strong>Resolved:</strong> {jobCards.filter(j => j.status === 'COMPLETED').length}</div>
      </div>

      {/* Assign Job Section */}
      <form onSubmit={handleCreateJob} style={{ marginBottom: '24px', padding: '12px', background: '#F1F3F5', borderRadius: '6px' }}>
        <h3>Assign Incident to Field Crew</h3>
        <select value={selectedReportId} onChange={(e) => setSelectedReportId(e.target.value)} required style={{ padding: '8px', width: '100%', marginBottom: '8px' }}>
          <option value="">Select Unassigned Incident Report...</option>
<<<<<<< HEAD
          {reports.filter(r => r.status === 'Pending').map((r) => (
=======
          {reports.filter(r => r.status === 'NEW').map((r) => (
>>>>>>> fd97a80cb2fd24b1c20bc0898a0bcd57512d0ac2
            <option key={r.id} value={r.id}>{r.reportNumber} - {r.category}: {r.description}</option>
          ))}
        </select>
        <button type="submit" style={{ padding: '8px 16px', backgroundColor: '#005A36', color: '#FFF', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>
          Generate & Assign Job Card
        </button>
      </form>

      {/* Job Cards Queue */}
      <h3>Active Job Cards Queue</h3>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ background: '#E9ECEF', textAlign: 'left' }}>
            <th style={thStyle}>Job #</th>
            <th style={thStyle}>Report #</th>
            <th style={thStyle}>Assigned Crew</th>
            <th style={thStyle}>Status</th>
            <th style={thStyle}>Action</th>
          </tr>
        </thead>
        <tbody>
          {jobCards.map((job) => (
            <tr key={job.id} style={{ borderBottom: '1px solid #EEE' }}>
              <td style={tdStyle}>{job.jobNumber}</td>
              <td style={tdStyle}>{job.report?.reportNumber}</td>
              <td style={tdStyle}>{job.assignedCrewId}</td>
              <td style={tdStyle}><strong>{job.status}</strong></td>
              <td style={tdStyle}>
                {job.status !== 'COMPLETED' && (
                  <button onClick={() => handleCloseJob(job.id)} style={{ padding: '4px 8px', backgroundColor: '#28A745', color: '#FFF', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>
                    Mark Resolved
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

const cardStyle = { flex: 1, padding: '12px', background: '#E9ECEF', borderRadius: '6px', textAlign: 'center' as const };
const thStyle = { padding: '8px' };
const tdStyle = { padding: '8px' };