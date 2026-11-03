import React, { useState } from 'react';

interface MFAProps {
  userId: string;
  adminEmail: string;
  onMFASuccess: (user: any) => void;
  onBackToLogin: () => void;
}

export const MFA: React.FC<MFAProps> = ({ userId, adminEmail, onMFASuccess, onBackToLogin }) => {
  const [otpCode, setOtpCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');

  const handleVerifyMFA = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    if (!otpCode || otpCode.length !== 6) {
      setError('Please enter the 6-digit code');
      setLoading(false);
      return;
    }

    try {
      const response = await fetch('/api/v1/auth/verify-mfa', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          otpCode,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        setSuccessMsg('✅ Authentication successful!');
        localStorage.setItem('user', JSON.stringify(data.user));
        localStorage.setItem('token', data.token);
        setTimeout(() => {
          onMFASuccess(data.user);
        }, 1000);
      } else {
        setError(data.error || 'Invalid OTP code');
      }
    } catch (err) {
      setError('Network error. Please try again.');
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
        maxWidth: '420px'
      }}>
        <div style={{ textAlign: 'center', marginBottom: '30px' }}>
          <h1 style={{ color: '#005A36', margin: '0 0 8px 0' }}>🔐 MFA Verification</h1>
          <p style={{ color: '#666', margin: '0', fontSize: '14px' }}>{adminEmail}</p>
        </div>

        <form onSubmit={handleVerifyMFA} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {error && (
            <div style={{ 
              padding: '12px', 
              background: '#F8D7DA', 
              color: '#721C24', 
              borderRadius: '4px',
              fontSize: '14px'
            }}>
              ⚠️ {error}
            </div>
          )}

          {successMsg && (
            <div style={{ 
              padding: '12px', 
              background: '#D4EDDA', 
              color: '#155724', 
              borderRadius: '4px',
              fontSize: '14px'
            }}>
              {successMsg}
            </div>
          )}

          <div style={{ padding: '16px', background: '#F0F8FF', borderRadius: '6px' }}>
            <p style={{ margin: '0 0 8px 0', fontWeight: 'bold', color: '#004085' }}>📱 Check Your Phone</p>
            <p style={{ margin: '0', fontSize: '13px', color: '#004085' }}>
              Enter the 6-digit code sent via SMS to your registered phone number.
            </p>
          </div>

          <div>
            <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '6px', color: '#333' }}>
              One-Time Code
            </label>
            <input
              type="text"
              value={otpCode}
              onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              placeholder="000000"
              maxLength={6}
              style={{
                width: '100%',
                padding: '16px',
                border: '2px solid #CCC',
                borderRadius: '6px',
                fontSize: '28px',
                textAlign: 'center',
                letterSpacing: '8px',
                boxSizing: 'border-box',
                fontWeight: 'bold',
              }}
              autoFocus
            />
            <small style={{ color: '#888', display: 'block', marginTop: '4px' }}>
              Code expires in 5 minutes
            </small>
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
            {loading ? 'Verifying...' : 'Verify & Login'}
          </button>
        </form>

        <div style={{ marginTop: '20px', textAlign: 'center', paddingTop: '16px', borderTop: '1px solid #EEE' }}>
          <button
            onClick={onBackToLogin}
            style={{
              padding: '10px 20px',
              background: 'transparent',
              color: '#005A36',
              border: 'none',
              cursor: 'pointer',
              fontSize: '14px',
              textDecoration: 'underline',
            }}
          >
            Use different account
          </button>
        </div>

        <div style={{ marginTop: '16px', padding: '12px', background: '#FFF3CD', borderRadius: '4px', fontSize: '12px', color: '#856404' }}>
          <p style={{ margin: '0 0 4px 0', fontWeight: 'bold' }}>💡 Future Microsoft Integration</p>
          <p style={{ margin: '0' }}>You can also authenticate using your Microsoft account.</p>
        </div>
      </div>
    </div>
  );
};
