import React, { useState } from 'react';

interface RegisterProps {
  onRegistrationSuccess: () => void;
  onBackToLogin: () => void;
}

export const Register: React.FC<RegisterProps> = ({ onRegistrationSuccess, onBackToLogin }) => {
  const [step, setStep] = useState<'register' | 'verify'>('register');
  const [userId, setUserId] = useState('');
  
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    // Validation
    if (!name || !email || !phone || !password) {
      setError('Please fill in all fields');
      setLoading(false);
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      setLoading(false);
      return;
    }

    if (password.length < 8) {
      setError('Password must be at least 8 characters');
      setLoading(false);
      return;
    }

    if (!email.includes('@')) {
      setError('Invalid email address');
      setLoading(false);
      return;
    }

    try {
      const response = await fetch('/api/v1/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          phone,
          name,
          password,
          confirmPassword,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        setUserId(data.userId);
        setSuccessMsg('Verification code sent to your email!');
        setStep('verify');
      } else {
        setError(data.error || 'Registration failed');
      }
    } catch (err) {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    if (!verificationCode) {
      setError('Please enter verification code');
      setLoading(false);
      return;
    }

    try {
      const response = await fetch('/api/v1/auth/verify-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          verificationCode,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        setSuccessMsg('✅ Email verified! You can now login.');
        setTimeout(() => {
          onRegistrationSuccess();
        }, 2000);
      } else {
        setError(data.error || 'Verification failed');
      }
    } catch (err) {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (step === 'register') {
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
          maxWidth: '450px'
        }}>
          <div style={{ textAlign: 'center', marginBottom: '30px' }}>
            <h1 style={{ color: '#005A36', margin: '0 0 8px 0' }}>PEOPLE FOR PEOPLE</h1>
            <p style={{ color: '#666', margin: '0', fontSize: '14px' }}>Create Your Account</p>
          </div>

          <form onSubmit={handleRegister} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
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
                Full Name
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. John Mkhize"
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
                Cell Phone Number
              </label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+27 123 456 7890"
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
                placeholder="Min 8 characters"
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
                Confirm Password
              </label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Re-enter password"
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
              {loading ? 'Creating Account...' : 'Register'}
            </button>
          </form>

          <div style={{ marginTop: '16px', textAlign: 'center', borderTop: '1px solid #EEE', paddingTop: '16px' }}>
            <p style={{ margin: '0 0 8px 0', fontSize: '14px', color: '#666' }}>Already have an account?</p>
            <button
              onClick={onBackToLogin}
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
              Back to Login
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Verification step
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
          <h1 style={{ color: '#005A36', margin: '0 0 8px 0' }}>Verify Email</h1>
          <p style={{ color: '#666', margin: '0', fontSize: '14px' }}>Enter the code sent to {email}</p>
        </div>

        <form onSubmit={handleVerify} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
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

          <div>
            <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '6px', color: '#333' }}>
              Verification Code
            </label>
            <input
              type="text"
              value={verificationCode}
              onChange={(e) => setVerificationCode(e.target.value)}
              placeholder="6-digit code"
              maxLength={6}
              style={{
                width: '100%',
                padding: '12px',
                border: '1px solid #CCC',
                borderRadius: '4px',
                fontSize: '20px',
                textAlign: 'center',
                letterSpacing: '4px',
                boxSizing: 'border-box',
              }}
            />
            <small style={{ color: '#888', display: 'block', marginTop: '4px' }}>
              Check your email for the verification code
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
            {loading ? 'Verifying...' : 'Verify Email'}
          </button>
        </form>

        <div style={{ marginTop: '16px', textAlign: 'center' }}>
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
            Back to Login
          </button>
        </div>
      </div>
    </div>
  );
};
