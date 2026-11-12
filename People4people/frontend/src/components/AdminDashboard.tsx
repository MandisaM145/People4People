
import React, { useState, useEffect, useCallback } from 'react';
import { apiService } from '../services/api';

export const AdminDashboard: React.FC = () => {
  const [reports, setReports] = useState<any[]>([]);
  const [jobCards, setJobCards] = useState<any[]>([]);
  const [selectedReportId, setSelectedReportId] = useState('');
  const [crewId, setCrewId] = useState('Crew-Alpha-DurbanNorth');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setError('');

      const [repData, jobData] = await Promise.all([
        apiService.getReports(),
        apiService.getJobCards()
      ]);

      setReports(repData || []);
      setJobCards(jobData || []);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Unable to load dashboard data.'
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleCreateJob = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedReportId || submitting) return;

    try {
      setSubmitting(true);
      setError('');

      await apiService.createJobCard(selectedReportId, crewId);

      setSelectedReportId('');
      await loadData();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Unable to create job card.'
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleCloseJob = async (jobId: string) => {
    try {
      setError('');

      await apiService.updateJobStatus(
        jobId,
        'COMPLETED',
        'Work verified and resolved on site.'
      );

      await loadData();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Unable to update job status.'
      );
    }
  };

  const completedJobs = jobCards.filter(
    job => job.status === 'COMPLETED'
  ).length;

  const activeJobs = jobCards.filter(
    job => job.status !== 'COMPLETED'
  ).length;

  return (
    <div
      style={{
        padding: '16px',
        backgroundColor: '#FFF',
        borderRadius: '8px',
        border: '1px solid #DDD'
      }}
    >
      <h2>National & Provincial Admin Console</h2>

      {error && (
        <div
          role="alert"
          style={{
            padding: '12px',
            background: '#F8D7DA',
            color: '#721C24',
            borderRadius: '6px',
            marginBottom: '16px'
          }}
        >
          {error}
        </div>
      )}

      {/* KPI Stats */}
      <div
        style={{
          display: 'flex',
          gap: '16px',
          marginBottom: '20px',
          flexWrap: 'wrap'
        }}
      >
        <div style={cardStyle}>
          <strong>Total Reports:</strong>
          <div>{reports.length}</div>
        </div>

        <div style={cardStyle}>
          <strong>Active Job Cards:</strong>
          <div>{activeJobs}</div>
        </div>

        <div style={cardStyle}>
          <strong>Resolved:</strong>
          <div>{completedJobs}</div>
        </div>
      </div>

      {/* Assign Job Section */}
      <form
        onSubmit={handleCreateJob}
        style={{
          marginBottom: '24px',
          padding: '12px',
          background: '#F1F3F5',
          borderRadius: '6px'
        }}
      >
        <h3>Assign Incident to Field Crew</h3>

        <select
          value={selectedReportId}
          onChange={e => setSelectedReportId(e.target.value)}
          required
          style={{
            padding: '8px',
            width: '100%',
            marginBottom: '8px'
          }}
        >
          <option value="">
            Select Unassigned Incident Report...
          </option>

          {reports
            .filter(report => report.status === 'NEW')
            .map(report => (
              <option key={report.id} value={report.id}>
                {report.reportNumber} - {report.category}: {report.description}
              </option>
            ))}
        </select>

        <input
          type="text"
          value={crewId}
          onChange={e => setCrewId(e.target.value)}
          placeholder="Field crew ID"
          required
          style={{
            padding: '8px',
            width: '100%',
            marginBottom: '8px',
            boxSizing: 'border-box'
          }}
        />

        <button
          type="submit"
          disabled={submitting || loading}
          style={{
            padding: '8px 16px',
            backgroundColor: '#005A36',
            color: '#FFF',
            border: 'none',
            borderRadius: '4px',
            cursor: submitting ? 'not-allowed' : 'pointer'
          }}
        >
          {submitting ? 'Assigning...' : 'Generate & Assign Job Card'}
        </button>
      </form>

      {/* Job Cards Queue */}
      <h3>Active Job Cards Queue</h3>

      {loading ? (
        <p>Loading dashboard data...</p>
      ) : jobCards.length === 0 ? (
        <p>No job cards available.</p>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table
            style={{
              width: '100%',
              borderCollapse: 'collapse'
            }}
          >
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
              {jobCards.map(job => (
                <tr
                  key={job.id}
                  style={{ borderBottom: '1px solid #EEE' }}
                >
                  <td style={tdStyle}>{job.jobNumber}</td>
                  <td style={tdStyle}>{job.report?.reportNumber || 'N/A'}</td>
                  <td style={tdStyle}>{job.assignedCrewId}</td>
                  <td style={tdStyle}>
                    <strong>{job.status}</strong>
                  </td>
                  <td style={tdStyle}>
                    {job.status !== 'COMPLETED' && (
                      <button
                        type="button"
                        onClick={() => handleCloseJob(job.id)}
                        style={{
                          padding: '4px 8px',
                          backgroundColor: '#28A745',
                          color: '#FFF',
                          border: 'none',
                          borderRadius: '4px',
                          cursor: 'pointer'
                        }}
                      >
                        Mark Resolved
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

const cardStyle = {
  flex: 1,
  minWidth: '150px',
  padding: '12px',
  background: '#E9ECEF',
  borderRadius: '6px',
  textAlign: 'center' as const
};

const thStyle = { padding: '8px' };

const tdStyle = { padding: '8px' };
