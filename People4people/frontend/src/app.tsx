import React, { useState, useEffect } from 'react';
import { LeafletMap } from './components/LeafletMap';
import { Login } from './components/Login';
import { Register } from './components/Register';
import { MFA } from './components/MFA';
import { apiFetch } from './services/http';

type Tab = 'REPORT' | 'TRACK' | 'ADMIN';
type AuthScreen = 'login' | 'register' | 'mfa' | 'app';
type Status = 'Pending' | 'In Progress' | 'Resolved';

interface Report {
  id: string;
  reportNumber: string;
  category: string;
  description: string;
  latitude: number;
  longitude: number;
  streetAddress?: string;
  status: Status;
  assignedCrew?: string;
  photoBase64?: string;
  completionPhotoBase64?: string;
  email?: string;
  phone?: string;
  createdAt: string;
}

interface AddressSuggestion {
  display_name: string;
  lat: number;
  lon: number;
  type?: string;
  address?: {
    house_number?: string;
    road?: string;
  };
}

interface User {
  id: string;
  name: string;
  email: string;
  role: string;
}

export const App: React.FC = () => {
  const [authScreen, setAuthScreen] = useState<AuthScreen>('login');
  const [user, setUser] = useState<User | null>(null);
  const [mfaUserId, setMFAUserId] = useState('');
  const [mfaAdminEmail, setMFAAdminEmail] = useState('');
  const [developmentOtpCode, setDevelopmentOtpCode] = useState('');
  const [activeTab, setActiveTab] = useState<Tab>('REPORT');

  // Location State
  const [lat, setLat] = useState<number>(-29.8587);
  const [lon, setLon] = useState<number>(31.0218);
  const [addressInput, setAddressInput] = useState<string>('');
  const [suggestions, setSuggestions] = useState<AddressSuggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);

  // Submit Form State
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('Damaged Road / Pothole');
  const [photoBase64, setPhotoBase64] = useState<string>('');
  const [statusMsg, setStatusMsg] = useState('');
  const [citizenEmail, setCitizenEmail] = useState('');
  const [citizenPhone, setCitizenPhone] = useState('');

  // Lookup State
  const [searchTicketNum, setSearchTicketNum] = useState('');
  const [trackedReport, setTrackedReport] = useState<Report | null>(null);
  const [trackError, setTrackError] = useState('');

  // Admin Dashboard State
  const [reports, setReports] = useState<Report[]>([]);
  const [filterCategory, setFilterCategory] = useState('ALL');
  const [filterStatus, setFilterStatus] = useState('ALL');
  const [selectedReport, setSelectedReport] = useState<Report | null>(null);
  const [newCrew, setNewCrew] = useState('');
  const [completionPhoto, setCompletionPhoto] = useState<string>('');

  useEffect(() => {
    // Check if user is already logged in
    const storedUser = localStorage.getItem('user');
    if (storedUser) {
      setUser(JSON.parse(storedUser));
      setAuthScreen('app');
    }

    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition((pos) => {
        setLat(pos.coords.latitude);
        setLon(pos.coords.longitude);
      });
    }
    fetchReports();
  }, []);

  const fetchReports = async () => {
    try {
      const query = new URLSearchParams({
        category: filterCategory,
        status: filterStatus,
      }).toString();
      const token = localStorage.getItem('token');
      const res = await apiFetch(`/reports?${query}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      const data = await res.json();
      setReports(data);
    } catch (err) {
      console.error('Failed to load reports:', err);
    }
  };

  useEffect(() => {
    if (activeTab === 'ADMIN') {
      fetchReports();
    }
  }, [filterCategory, filterStatus, activeTab]);

  // Auth handlers
  const handleLoginSuccess = (loginData: any) => {
    if (loginData.mfaRequired) {
      // Admin with MFA - show MFA screen
      setMFAUserId(loginData.userId);
      setMFAAdminEmail(loginData.email);
      setDevelopmentOtpCode(loginData.developmentOtpCode || '');
      setAuthScreen('mfa');
    } else {
      // Citizen or admin without MFA
      setUser(loginData);
      setAuthScreen('app');
    }
  };

  const handleMFASuccess = (userData: User) => {
    setUser(userData);
    setAuthScreen('app');
  };

  const handleRegistrationSuccess = () => {
    setAuthScreen('login');
  };

  const handleLogout = () => {
    localStorage.removeItem('user');
    localStorage.removeItem('token');
    setUser(null);
    // Reset all form fields
    setAddressInput('');
    setDescription('');
    setPhotoBase64('');
    setStatusMsg('');
    setCitizenEmail('');
    setCitizenPhone('');
    setSearchTicketNum('');
    setTrackedReport(null);
    setTrackError('');
    setNewCrew('');
    setCompletionPhoto('');
    setSelectedReport(null);
    setSuggestions([]);
    setShowSuggestions(false);
    setActiveTab('REPORT');
    setAuthScreen('login');
    window.location.reload();
  };

  // Address search
  const handleAddressSearch = async (value: string) => {
    setAddressInput(value);

    if (value.trim().length < 3) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }

    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(
          value
        )}&bounded=1&viewbox=16.5,-34.8,33,-22&extratags=1&addressdetails=1&limit=8`,
        { headers: { 'Accept': 'application/json' } }
      );
      const data = await response.json();
      setSuggestions(data);
      setShowSuggestions(true);
    } catch (err) {
      console.error('Address search error:', err);
      setSuggestions([]);
    }
  };

  const formatAddressWithNumber = (suggestion: AddressSuggestion): string => {
    const parts = [];
    const displayParts = suggestion.display_name.split(',');
    if (displayParts.length > 0) {
      const firstPart = displayParts[0].trim();
      const match = firstPart.match(/^(\d+)\s+(.+)$/);
      if (match) {
        parts.push(`${match[1]} ${match[2]}`);
      } else {
        parts.push(firstPart);
      }
    }
    if (displayParts.length > 1) {
      parts.push(displayParts[1].trim());
    }
    if (displayParts.length > 2) {
      parts.push(displayParts[2].trim());
    }
    return parts.join(', ');
  };

  const handleSuggestionSelect = (suggestion: AddressSuggestion) => {
    const newLat = parseFloat(suggestion.lat.toString());
    const newLon = parseFloat(suggestion.lon.toString());
    setLat(newLat);
    setLon(newLon);
    setAddressInput(formatAddressWithNumber(suggestion));
    setShowSuggestions(false);
    setSuggestions([]);
  };

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setPhotoBase64(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleCompletionPhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setCompletionPhoto(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleLocationChange = (newLat: number, newLon: number) => {
    setLat(newLat);
    setLon(newLon);
    setAddressInput('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatusMsg('');

    if (!citizenEmail && !citizenPhone) {
      setStatusMsg('Please provide at least an email address or phone number to receive ticket updates.');
      return;
    }

    if (citizenEmail && !citizenEmail.includes('@')) {
      setStatusMsg('Please enter a valid email address.');
      return;
    }

    setStatusMsg('Submitting report and sending confirmation...');

    try {
      const response = await apiFetch('/reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          description,
          category,
          latitude: lat,
          longitude: lon,
          addressInput,
          photoBase64,
          email: citizenEmail,
          phone: citizenPhone,
        }),
      });

      const data = await response.json();
      if (response.ok) {
        setStatusMsg(`✅ Report submitted! Ticket: ${data.reportNumber}\n📧 Confirmation sent to email\n📱 SMS sent to phone (if provided)`);
        setDescription('');
        setPhotoBase64('');
        setAddressInput('');
        setCitizenEmail('');
        setCitizenPhone('');
        setTimeout(() => setStatusMsg(''), 8000);
      } else {
        setStatusMsg('❌ Error submitting report. Please try again.');
      }
    } catch (err) {
      setStatusMsg('❌ Network connection error.');
    }
  };

  const handleTrackTicket = async (e: React.FormEvent) => {
    e.preventDefault();
    setTrackError('');
    setTrackedReport(null);

    try {
      const res = await apiFetch(`/reports/track/${encodeURIComponent(searchTicketNum)}`);
      const data = await res.json();
      if (data.found) {
        setTrackedReport(data.report);
      } else {
        setTrackError(data.message || 'Ticket not found.');
      }
    } catch (err) {
      setTrackError('Could not reach server.');
    }
  };

  const handleUpdateStatus = async (id: string, newStatus: Status) => {
    try {
      const updateData: any = {
        status: newStatus,
        assignedCrew: newCrew || undefined,
      };

      if (newStatus === 'Resolved' && completionPhoto) {
        updateData.completionPhotoBase64 = completionPhoto;
      }

      const token = localStorage.getItem('token');
      const res = await apiFetch(`/reports/${id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(updateData),
      });
      const data = await res.json();
      if (data.success) {
        setSelectedReport(data.report);
        setCompletionPhoto('');
        fetchReports();
      }
    } catch (err) {
      console.error('Update failed:', err);
    }
  };

  const getStatusBadgeStyle = (status: Status) => {
    switch (status) {
      case 'Pending':
        return { background: '#FFF3CD', color: '#856404' };
      case 'In Progress':
        return { background: '#CCE5FF', color: '#004085' };
      case 'Resolved':
        return { background: '#D4EDDA', color: '#155724' };
    }
  };

  // Auth screens
  if (authScreen === 'login') {
    return <Login onLoginSuccess={handleLoginSuccess} onShowRegister={() => setAuthScreen('register')} />;
  }

  if (authScreen === 'register') {
    return <Register onRegistrationSuccess={handleRegistrationSuccess} onBackToLogin={() => setAuthScreen('login')} />;
  }

  if (authScreen === 'mfa') {
    return <MFA userId={mfaUserId} adminEmail={mfaAdminEmail} onMFASuccess={handleMFASuccess} onBackToLogin={() => setAuthScreen('login')} />;
  }

  // Main app
  if (!user) {
    return <Login onLoginSuccess={handleLoginSuccess} onShowRegister={() => setAuthScreen('register')} />;
  }

  return (
    <div style={{ fontFamily: 'Arial, sans-serif', maxWidth: '900px', margin: '0 auto', padding: '16px' }}>
      <header style={{ backgroundColor: '#005A36', color: '#FFF', padding: '16px', borderRadius: '8px', textAlign: 'center', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ margin: 0 }}>PEOPLE FOR PEOPLE</h1>
          <p style={{ margin: '4px 0 0 0' }}>Community Service Delivery Platform</p>
        </div>
        <div style={{ textAlign: 'right' }}>
          <p style={{ margin: '0 0 8px 0', fontSize: '14px' }}>👤 {user.name} ({user.role})</p>
          <button 
            onClick={handleLogout}
            style={{ padding: '6px 12px', background: '#FFF', color: '#005A36', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold', fontSize: '12px' }}
          >
            Logout
          </button>
        </div>
      </header>

      {/* Navigation Bar */}
      <nav style={{ display: 'flex', gap: '8px', margin: '16px 0' }}>
        <button
          onClick={() => setActiveTab('REPORT')}
          style={{ flex: 1, padding: '12px', background: activeTab === 'REPORT' ? '#005A36' : '#EEE', color: activeTab === 'REPORT' ? '#FFF' : '#000', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}
        >
          Submit Issue
        </button>
        <button
          onClick={() => setActiveTab('TRACK')}
          style={{ flex: 1, padding: '12px', background: activeTab === 'TRACK' ? '#005A36' : '#EEE', color: activeTab === 'TRACK' ? '#FFF' : '#000', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}
        >
          Track Ticket Status
        </button>
        {(user.role === 'admin' || user.role === 'superadmin') && (
          <button
            onClick={() => setActiveTab('ADMIN')}
            style={{ flex: 1, padding: '12px', background: activeTab === 'ADMIN' ? '#005A36' : '#EEE', color: activeTab === 'ADMIN' ? '#FFF' : '#000', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}
          >
            Admin Dashboard
          </button>
        )}
      </nav>

      {/* TAB 1: SUBMIT ISSUE */}
      {activeTab === 'REPORT' && (
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <h3>Submit Incident Report</h3>

          {statusMsg && (
            <div style={{ padding: '12px', background: statusMsg.includes('✅') ? '#D4EDDA' : '#F8D7DA', color: statusMsg.includes('✅') ? '#155724' : '#721C24', borderRadius: '4px', whiteSpace: 'pre-line', lineHeight: '1.5' }}>
              {statusMsg}
            </div>
          )}

          <label>Category:</label>
          <select value={category} onChange={(e) => setCategory(e.target.value)} style={{ padding: '8px', borderRadius: '4px' }}>
            <option>Damaged Road / Pothole</option>
            <option>Water Leak / Pipe Burst</option>
            <option>Sanitation / Drainage</option>
            <option>Streetlight Fault</option>
            <option>Illegal Dumping</option>
          </select>

          <label>Description:</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            required
            rows={4}
            style={{ padding: '8px', borderRadius: '4px' }}
          />

          <label>🔍 Search Address (with street number, businesses, landmarks):</label>
          <div style={{ position: 'relative' }}>
            <input
              type="text"
              placeholder="Search: 123 Main Street, Hospital, School, Clinic, Mall..."
              value={addressInput}
              onChange={(e) => handleAddressSearch(e.target.value)}
              onFocus={() => suggestions.length > 0 && setShowSuggestions(true)}
              style={{
                width: '100%',
                padding: '10px',
                borderRadius: '4px',
                border: '1px solid #CCC',
                boxSizing: 'border-box',
              }}
            />
            {showSuggestions && suggestions.length > 0 && (
              <div
                style={{
                  position: 'absolute',
                  top: '100%',
                  left: 0,
                  right: 0,
                  background: '#FFF',
                  border: '1px solid #CCC',
                  borderTop: 'none',
                  borderRadius: '0 0 4px 4px',
                  maxHeight: '250px',
                  overflowY: 'auto',
                  zIndex: 1000,
                  boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
                }}
              >
                {suggestions.map((suggestion, idx) => (
                  <div
                    key={idx}
                    onClick={() => handleSuggestionSelect(suggestion)}
                    style={{
                      padding: '12px',
                      borderBottom: idx < suggestions.length - 1 ? '1px solid #EEE' : 'none',
                      cursor: 'pointer',
                      background: idx % 2 === 0 ? '#FFF' : '#F9F9F9',
                      transition: 'background 0.2s',
                    }}
                    onMouseEnter={(e) => {
                      (e.currentTarget as HTMLElement).style.background = '#E6F0EC';
                    }}
                    onMouseLeave={(e) => {
                      (e.currentTarget as HTMLElement).style.background = idx % 2 === 0 ? '#FFF' : '#F9F9F9';
                    }}
                  >
                    <strong style={{ display: 'block', fontSize: '14px' }}>
                      {suggestion.type === 'amenity' || suggestion.type === 'shop' || suggestion.type === 'building' 
                        ? '🏢 ' 
                        : suggestion.type === 'highway' || suggestion.type === 'street' 
                        ? '🛣️ ' 
                        : '📍 '}
                      {formatAddressWithNumber(suggestion).split(',')[0]}
                    </strong>
                    <span style={{ fontSize: '12px', color: '#888' }}>{formatAddressWithNumber(suggestion)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <p style={{ fontSize: '12px', color: '#666', margin: '0' }}>Current Location: {lat.toFixed(4)}, {lon.toFixed(4)}</p>

          <label>Attach Photo Evidence:</label>
          <input type="file" accept="image/*" onChange={handlePhotoUpload} style={{ padding: '4px' }} />
          {photoBase64 && (
            <img src={photoBase64} alt="Preview" style={{ width: '100%', maxHeight: '200px', objectFit: 'cover', borderRadius: '4px', marginTop: '8px' }} />
          )}

          <div style={{ padding: '12px', background: '#F0F8FF', borderRadius: '4px' }}>
            <p style={{ margin: '0 0 8px 0', fontWeight: 'bold', color: '#004085' }}>📧 Notification Details (receive ticket updates):</p>
            
            <label style={{ display: 'block', fontSize: '13px', fontWeight: 'bold', marginBottom: '4px' }}>Email Address:</label>
            <input
              type="email"
              value={citizenEmail}
              onChange={(e) => setCitizenEmail(e.target.value)}
              placeholder="your.email@example.com"
              style={{
                width: '100%',
                padding: '8px',
                borderRadius: '4px',
                border: '1px solid #CCC',
                boxSizing: 'border-box',
                marginBottom: '8px',
              }}
            />

            <label style={{ display: 'block', fontSize: '13px', fontWeight: 'bold', marginBottom: '4px' }}>Cell Phone Number (optional for SMS):</label>
            <input
              type="tel"
              value={citizenPhone}
              onChange={(e) => setCitizenPhone(e.target.value)}
              placeholder="+27 123 456 7890"
              style={{
                width: '100%',
                padding: '8px',
                borderRadius: '4px',
                border: '1px solid #CCC',
                boxSizing: 'border-box',
              }}
            />
            <small style={{ color: '#666', display: 'block', marginTop: '4px' }}>At least email or phone required</small>
          </div>

          <label>Incident Location Pinpoint:</label>
          <LeafletMap latitude={lat} longitude={lon} isInteractive={true} onLocationChange={handleLocationChange} />

          <button type="submit" style={{ padding: '12px', background: '#005A36', color: '#FFF', border: 'none', borderRadius: '4px', fontWeight: 'bold', cursor: 'pointer' }}>
            Dispatch Incident Report
          </button>
        </form>
      )}

      {/* TAB 2: TICKET TRACKER */}
      {activeTab === 'TRACK' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <h3>Public Ticket Tracker</h3>
          <form onSubmit={handleTrackTicket} style={{ display: 'flex', gap: '8px' }}>
            <input
              type="text"
              placeholder="Enter Report Number (e.g. P4P-102938)"
              value={searchTicketNum}
              onChange={(e) => setSearchTicketNum(e.target.value)}
              required
              style={{ flex: 1, padding: '10px', borderRadius: '4px', border: '1px solid #CCC' }}
            />
            <button type="submit" style={{ padding: '10px 16px', background: '#005A36', color: '#FFF', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}>
              Track
            </button>
          </form>

          {trackError && <p style={{ color: '#721C24', background: '#F8D7DA', padding: '10px', borderRadius: '4px' }}>{trackError}</p>}

          {trackedReport && (
            <div style={{ padding: '16px', border: '1px solid #DDD', borderRadius: '8px', background: '#FAFAFA' }}>
              <h4>Ticket Details: {trackedReport.reportNumber}</h4>
              <p><strong>Category:</strong> {trackedReport.category}</p>
              <p><strong>Description:</strong> {trackedReport.description}</p>
              <p><strong style={{ color: '#005A36', fontSize: '16px' }}>📍 Location: {trackedReport.streetAddress || `${trackedReport.latitude.toFixed(4)}, ${trackedReport.longitude.toFixed(4)}`}</strong></p>
              <p>
                <strong>Status:</strong>{' '}
                <span style={{ padding: '4px 8px', borderRadius: '4px', fontWeight: 'bold', ...getStatusBadgeStyle(trackedReport.status) }}>
                  {trackedReport.status}
                </span>
              </p>
              {trackedReport.assignedCrew && <p><strong>Assigned Crew:</strong> {trackedReport.assignedCrew}</p>}
              {trackedReport.photoBase64 && (
                <div>
                  <p><strong>Submitted Photo:</strong></p>
                  <img src={trackedReport.photoBase64} alt="Incident" style={{ width: '100%', maxHeight: '250px', objectFit: 'cover', borderRadius: '4px' }} />
                </div>
              )}
              {trackedReport.completionPhotoBase64 && (
                <div style={{ marginTop: '16px' }}>
                  <p><strong>✅ Completion Photo (Job Finished):</strong></p>
                  <img src={trackedReport.completionPhotoBase64} alt="Completion" style={{ width: '100%', maxHeight: '250px', objectFit: 'cover', borderRadius: '4px' }} />
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* TAB 3: ADMIN DASHBOARD */}
      {activeTab === 'ADMIN' && (user.role === 'admin' || user.role === 'superadmin') && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <h3>Administrative Dashboard {user.role === 'superadmin' && '(Super Admin)'}</h3>

          <div style={{ display: 'flex', gap: '12px', background: '#F0F0F0', padding: '12px', borderRadius: '6px' }}>
            <div>
              <label style={{ fontSize: '12px', fontWeight: 'bold', display: 'block' }}>Filter Status:</label>
              <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} style={{ padding: '6px', borderRadius: '4px' }}>
                <option value="ALL">All Statuses</option>
                <option value="Pending">Pending</option>
                <option value="In Progress">In Progress</option>
                <option value="Resolved">Resolved</option>
              </select>
            </div>

            <div>
              <label style={{ fontSize: '12px', fontWeight: 'bold', display: 'block' }}>Filter Category:</label>
              <select value={filterCategory} onChange={(e) => setFilterCategory(e.target.value)} style={{ padding: '6px', borderRadius: '4px' }}>
                <option value="ALL">All Categories</option>
                <option value="Damaged Road / Pothole">Damaged Road / Pothole</option>
                <option value="Water Leak / Pipe Burst">Water Leak / Pipe Burst</option>
                <option value="Sanitation / Drainage">Sanitation / Drainage</option>
                <option value="Streetlight Fault">Streetlight Fault</option>
                <option value="Illegal Dumping">Illegal Dumping</option>
              </select>
            </div>
          </div>

          <LeafletMap latitude={lat} longitude={lon} reports={reports} isInteractive={false} />

          <h4>Logged Incidents ({reports.length})</h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {reports.map((rep) => (
              <div
                key={rep.id}
                onClick={() => {
                  setSelectedReport(rep);
                  setCompletionPhoto('');
                }}
                style={{
                  padding: '12px',
                  border: '1px solid #CCC',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  background: selectedReport?.id === rep.id ? '#E6F0EC' : '#FFF',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <strong>{rep.reportNumber} — {rep.category}</strong>
                  <span style={{ padding: '4px 8px', borderRadius: '4px', fontSize: '12px', fontWeight: 'bold', ...getStatusBadgeStyle(rep.status) }}>
                    {rep.status}
                  </span>
                </div>
                <p style={{ margin: '4px 0', fontSize: '14px', color: '#555' }}>{rep.description}</p>
                <p style={{ margin: '4px 0', fontSize: '12px', color: '#005A36', fontWeight: 'bold' }}>📍 {rep.streetAddress || `${rep.latitude.toFixed(4)}, ${rep.longitude.toFixed(4)}`}</p>
              </div>
            ))}
          </div>

          {selectedReport && (
            <div style={{ border: '2px solid #005A36', padding: '16px', borderRadius: '8px', background: '#FFF' }}>
              <h4>Manage Ticket: {selectedReport.reportNumber}</h4>
              <p><strong>Category:</strong> {selectedReport.category}</p>
              <p><strong>Description:</strong> {selectedReport.description}</p>
              <p><strong style={{ fontSize: '16px', color: '#005A36' }}>📍 Location: {selectedReport.streetAddress || `${selectedReport.latitude.toFixed(4)}, ${selectedReport.longitude.toFixed(4)}`}</strong></p>
              <p style={{ fontSize: '12px', color: '#666' }}>Coordinates: {selectedReport.latitude.toFixed(4)}, {selectedReport.longitude.toFixed(4)}</p>
              {selectedReport.email && <p><strong>Citizen Email:</strong> {selectedReport.email}</p>}
              {selectedReport.phone && <p><strong>Citizen Phone:</strong> {selectedReport.phone}</p>}
              {selectedReport.photoBase64 && (
                <div style={{ marginBottom: '12px' }}>
                  <p><strong>Incident Photo:</strong></p>
                  <img src={selectedReport.photoBase64} alt="Proof" style={{ width: '100%', maxHeight: '200px', objectFit: 'cover', borderRadius: '4px' }} />
                </div>
              )}

              {selectedReport.completionPhotoBase64 && (
                <div style={{ marginBottom: '12px', padding: '12px', background: '#D4EDDA', borderRadius: '4px' }}>
                  <p><strong>✅ Completion Photo (Job Finished):</strong></p>
                  <img src={selectedReport.completionPhotoBase64} alt="Completion" style={{ width: '100%', maxHeight: '200px', objectFit: 'cover', borderRadius: '4px' }} />
                </div>
              )}

              <div style={{ margin: '12px 0' }}>
                <label style={{ display: 'block', fontWeight: 'bold' }}>Assign Work Crew:</label>
                <input
                  type="text"
                  placeholder="e.g. Roads Unit 2"
                  value={newCrew}
                  onChange={(e) => setNewCrew(e.target.value)}
                  style={{ padding: '8px', width: '100%', borderRadius: '4px', border: '1px solid #CCC', marginTop: '4px' }}
                />
              </div>

              {selectedReport.status !== 'Resolved' && (
                <div style={{ margin: '12px 0', padding: '12px', background: '#F0F8FF', borderRadius: '4px' }}>
                  <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '8px' }}>📸 Attach Completion Photo (Before Marking Resolved):</label>
                  <input 
                    type="file" 
                    accept="image/*" 
                    onChange={handleCompletionPhotoUpload} 
                    style={{ padding: '4px', width: '100%' }} 
                  />
                  {completionPhoto && (
                    <div style={{ marginTop: '8px' }}>
                      <img src={completionPhoto} alt="Completion Preview" style={{ width: '100%', maxHeight: '150px', objectFit: 'cover', borderRadius: '4px' }} />
                    </div>
                  )}
                </div>
              )}

              <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
                <button onClick={() => handleUpdateStatus(selectedReport.id, 'Pending')} style={{ flex: 1, padding: '8px', background: '#FFC107', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}>Set Pending</button>
                <button onClick={() => handleUpdateStatus(selectedReport.id, 'In Progress')} style={{ flex: 1, padding: '8px', background: '#17A2B8', color: '#FFF', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}>Set In Progress</button>
                <button 
                  onClick={() => {
                    if (!completionPhoto && selectedReport.status !== 'Resolved') {
                      alert('Please attach a completion photo before marking as resolved');
                      return;
                    }
                    handleUpdateStatus(selectedReport.id, 'Resolved');
                  }} 
                  style={{ flex: 1, padding: '8px', background: '#28A745', color: '#FFF', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}
                >
                  {selectedReport.status === 'Resolved' ? '✅ Resolved' : 'Set Resolved'}
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default App;
