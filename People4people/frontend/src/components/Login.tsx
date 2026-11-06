import React, { useState } from 'react';

interface LoginProps {
  onLoginSuccess: (user: any) => void;
  onShowRegister: () => void;
}

export const Login: React.FC<LoginProps> = ({ onLoginSuccess, onShowRegister }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (!email || !password) {
        setError('Please enter email and password');
        setLoading(false);
        return;
      }

      const response = await fetch('/api/v1/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();

      if (response.ok) {
        if (data.status === 'mfa_required') {
          // Admin MFA is verified separately before a session is issued.
          onLoginSuccess({
            ...data,
            mfaRequired: true,
          });
        } else {
          // Citizen or admin without MFA
          localStorage.setItem('user', JSON.stringify(data.user));
          localStorage.setItem('token', data.token);
          onLoginSuccess(data.user);
        }
      } else {
        setError(data.error || 'Login failed');
      }
    } catch (err) {
      setError('Network connection error.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ 
      display: 'flex', 
      justifyContent: 'center', 
      alignItems: 'center', 
      minHeight: '100vh', 
      background: 'linear-gradient(135deg, #005A36 0%, #004428 100%)',
      fontFamily: 'Arial, sans-serif'
    }}>
      <div style={{ 
        background: '#FFF', 
        padding: '40px', 
        borderRadius: '8px', 
        boxShadow: '0 10px 30px rgba(0, 0, 0, 0.2)',
        width: '100%',
        maxWidth: '400px'
      }}>
        <div style={{ textAlign: 'center', marginBottom: '30px' }}>
          <h1 style={{ color: '#005A36', margin: '0 0 8px 0' }}>PEOPLE FOR PEOPLE</h1>
          <p style={{ color: '#666', margin: '0', fontSize: '14px' }}>Community Service Delivery Platform</p>
        </div>

        <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {error && (
            <div style={{ 
              padding: '12px', 
              background: '#F8D7DA', 
              color: '#721C24', 
              borderRadius: '4px',
              fontSize: '14px'
            }}>
              {error}
            </div>
          )}

          <div>
            <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '6px', color: '#333' }}>
              Email Address
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="your.email@example.com"
              style={{
                width: '100%',
                padding: '12px',
                border: '1px solid #CCC',
                borderRadius: '4px',
                fontSize: '14px',
                boxSizing: 'border-box',
              }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '6px', color: '#333' }}>
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter your password"
              style={{
                width: '100%',
                padding: '12px',
                border: '1px solid #CCC',
                borderRadius: '4px',
                fontSize: '14px',
                boxSizing: 'border-box',
              }}
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            style={{
              padding: '12px',
              background: loading ? '#CCCCCC' : '#005A36',
              color: '#FFF',
              border: 'none',
              borderRadius: '4px',
              fontWeight: 'bold',
              cursor: loading ? 'not-allowed' : 'pointer',
              fontSize: '16px',
            }}
          >
            {loading ? 'Logging in...' : 'Login'}
          </button>
        </form>

        <div style={{ marginTop: '20px', textAlign: 'center', borderTop: '1px solid #EEE', paddingTop: '20px' }}>
          <p style={{ margin: '0 0 12px 0', fontSize: '14px', color: '#666' }}>Don't have an account?</p>
          <button
            onClick={onShowRegister}
            style={{
              padding: '10px 20px',
              background: '#E6F0EC',
              color: '#005A36',
              border: '1px solid #005A36',
              borderRadius: '4px',
              cursor: 'pointer',
              fontWeight: 'bold',
            }}
          >
            Create Account
          </button>
        </div>

        <div style={{ marginTop: '20px', padding: '12px', background: '#F0F8FF', borderRadius: '4px' }}>
          <p style={{ margin: '0 0 8px 0', fontWeight: 'bold', color: '#004085', fontSize: '12px' }}>Demo Credentials:</p>
          <p style={{ margin: '4px 0', fontSize: '11px', color: '#004085' }}>
            Demo accounts are configured by the system administrator.
          </p>
        </div>
      </div>
    </div>
  );
};
