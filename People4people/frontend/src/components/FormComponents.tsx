import React, { useState } from 'react';

interface FormData {
  title: string;
  category: string;
  description: string;
}

export const FormComponent: React.FC = () => {
  const [formData, setFormData] = useState<FormData>({
    title: '',
    category: 'general',
    description: '',
  });

  const [loading, setLoading] = useState<boolean>(false);
  const [statusMessage, setStatusMessage] = useState<string>('');
  const [isError, setIsError] = useState<boolean>(false);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setStatusMessage('');
    setIsError(false);

    try {
      // Calls the Vite proxy route configured for your NestJS backend
      const response = await fetch('/api/form', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Failed to submit form to server.');
      }

      setIsError(false);
      setStatusMessage(data.message || 'Request submitted successfully!');
      
      // Reset form on success
      setFormData({
        title: '',
        category: 'general',
        description: '',
      });
    } catch (error: any) {
      console.error('Submission Error:', error);
      setIsError(true);
      setStatusMessage(
        error.message || 'Network error: Could not connect to backend server.'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={styles.card}>
      <h2 style={styles.heading}>Submit a Service Request</h2>
      <form onSubmit={handleSubmit}>
        <div style={styles.formGroup}>
          <label style={styles.label} htmlFor="title">
            Issue Title
          </label>
          <input
            type="text"
            id="title"
            name="title"
            value={formData.title}
            onChange={handleChange}
            placeholder="e.g., Water Leakage or Pothole"
            required
            style={styles.input}
          />
        </div>

        <div style={styles.formGroup}>
          <label style={styles.label} htmlFor="category">
            Category
          </label>
          <select
            id="category"
            name="category"
            value={formData.category}
            onChange={handleChange}
            style={styles.select}
          >
            <option value="general">General Query</option>
            <option value="water">Water & Sanitation</option>
            <option value="electricity">Electricity</option>
            <option value="roads">Roads & Infrastructure</option>
          </select>
        </div>

        <div style={styles.formGroup}>
          <label style={styles.label} htmlFor="description">
            Description
          </label>
          <textarea
            id="description"
            name="description"
            rows={4}
            value={formData.description}
            onChange={handleChange}
            placeholder="Provide relevant details about your request..."
            required
            style={styles.textarea}
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          style={{
            ...styles.button,
            backgroundColor: loading ? '#94a3b8' : '#2563eb',
            cursor: loading ? 'not-allowed' : 'pointer',
          }}
        >
          {loading ? 'Submitting...' : 'Submit Request'}
        </button>
      </form>

      {statusMessage && (
        <div
          style={{
            ...styles.alert,
            backgroundColor: isError ? '#fef2f2' : '#f0fdf4',
            color: isError ? '#991b1b' : '#166534',
            borderColor: isError ? '#fecaca' : '#bbf7d0',
          }}
        >
          {statusMessage}
        </div>
      )}
    </div>
  );
};

// Inline CSS for clean styling out-of-the-box
const styles: { [key: string]: React.CSSProperties } = {
  card: {
    maxWidth: '500px',
    margin: '20px auto',
    padding: '24px',
    borderRadius: '8px',
    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
    backgroundColor: '#ffffff',
    fontFamily: 'system-ui, -apple-system, sans-serif',
  },
  heading: {
    marginTop: 0,
    marginBottom: '20px',
    fontSize: '1.25rem',
    fontWeight: 600,
    color: '#1e293b',
  },
  formGroup: {
    marginBottom: '16px',
    display: 'flex',
    flexDirection: 'column',
  },
  label: {
    marginBottom: '6px',
    fontSize: '0.875rem',
    fontWeight: 500,
    color: '#334155',
  },
  input: {
    padding: '10px 12px',
    fontSize: '0.875rem',
    borderRadius: '6px',
    border: '1px solid #cbd5e1',
    outline: 'none',
  },
  select: {
    padding: '10px 12px',
    fontSize: '0.875rem',
    borderRadius: '6px',
    border: '1px solid #cbd5e1',
    backgroundColor: '#ffffff',
    outline: 'none',
  },
  textarea: {
    padding: '10px 12px',
    fontSize: '0.875rem',
    borderRadius: '6px',
    border: '1px solid #cbd5e1',
    resize: 'vertical',
    outline: 'none',
  },
  button: {
    width: '100%',
    padding: '12px',
    fontSize: '0.875rem',
    fontWeight: 600,
    color: '#ffffff',
    border: 'none',
    borderRadius: '6px',
    transition: 'background-color 0.2s ease',
  },
  alert: {
    marginTop: '16px',
    padding: '12px',
    borderRadius: '6px',
    border: '1px solid',
    fontSize: '0.875rem',
    textAlign: 'center',
  },
};