import express from 'express';
import nodemailer from 'nodemailer';
import crypto from 'crypto';

const app = express();
const PORT = 3000;

// Increase payload limit for image uploads
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// CORS middleware
app.use((req, res, next) => {
  // 1. Get the domain making the request
  const origin = req.headers.origin;
  
  // 2. Define which domains are allowed to talk to your API
  const allowedOrigins = [
    'http://localhost:5173',                      // Your local Vite frontend
    'https://onrender.com'          // Replace with your actual live Render frontend URL
  ];

  // 3. If the request is from an allowed domain, set the header dynamically
  if (allowedOrigins.includes(origin)) {
    res.header('Access-Control-Allow-Origin', origin);
  }

  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
  
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

// User interfaces
interface User {
  id: string;
  email: string;
  phone: string;
  name: string;
  passwordHash: string;
  role: 'citizen' | 'admin' | 'superadmin';
  mfaEnabled: boolean;
  mfaPhone?: string;
  mfaSecret?: string;
  createdAt: string;
  verified: boolean;
  verificationCode?: string;
  verificationCodeExpiry?: number;
}

interface MFASession {
  userId: string;
  otpCode: string;
  otpExpiry: number;
  attempts: number;
}

interface Address {
  house_number?: string;
  road?: string;
  street?: string;
  suburb?: string;
  village?: string;
  town?: string;
  city?: string;
  county?: string;
}

interface GeocodingResponse {
  address?: Address;
  display_name?: string;
}

// In-memory storage
let users: User[] = [];
let reports: any[] = [];
let mfaSessions: MFASession[] = [];

// Create super admin on startup
const createSuperAdmin = () => {
  const existingSuperAdmin = users.find(u => u.role === 'superadmin');
  if (!existingSuperAdmin) {
    const superAdmin: User = {
      id: 'superadmin-1',
      email: 'superadmin@people4people.co.za',
      phone: '+27711234567',
      name: 'Super Administrator',
      passwordHash: hashPassword('SuperAdmin@123'),
      role: 'superadmin',
      mfaEnabled: false,
      createdAt: new Date().toISOString(),
      verified: true,
    };
    users.push(superAdmin);
    console.log('Super Admin created:', superAdmin.email);
  }
};

// Email transporter
const emailTransporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER || 'people4people.sa@gmail.com',
    pass: process.env.EMAIL_PASSWORD || 'app-specific-password',
  },
});

// Hash password
const hashPassword = (password: string): string => {
  return crypto.createHash('sha256').update(password).digest('hex');
};

// Generate OTP
const generateOTP = (): string => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

// Send email
const sendEmail = async (email: string, subject: string, htmlContent: string) => {
  try {
    await emailTransporter.sendMail({
      from: 'people4people.sa@gmail.com',
      to: email,
      subject: subject,
      html: htmlContent,
    });
    console.log(`[EMAIL] Sent to ${email}`);
    return true;
  } catch (error) {
    console.error(`[EMAIL ERROR] ${error}`);
    return false;
  }
};

// Send SMS OTP
const sendSMSOTP = async (phoneNumber: string, otpCode: string) => {
  try {
    console.log(`[SMS OTP] To: ${phoneNumber} - OTP: ${otpCode}`);
    // TODO: Integrate with actual SMS provider (Twilio, AfriSoft)
    return true;
  } catch (error) {
    console.error(`[SMS ERROR] ${error}`);
    return false;
  }
};

// Reverse geocode
const reverseGeocodeAddress = async (latitude: number, longitude: number): Promise<string> => {
  try {
    const response = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}`,
      { headers: { 'Accept': 'application/json' } }
    );
    const data = (await response.json()) as GeocodingResponse;
    if (data.address) {
      const address = data.address;
      const streetNumber = address.house_number || '';
      const street = address.road || address.street || '';
      const suburb = address.suburb || address.village || address.town || '';
      const city = address.city || address.county || '';
      
      const parts = [];
      if (streetNumber && street) {
        parts.push(`${streetNumber} ${street}`);
      } else if (street) {
        parts.push(street);
      }
      if (suburb) parts.push(suburb);
      if (city && city !== suburb) parts.push(city);
      
      return parts.join(', ') || data.display_name || `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`;
    }
    return `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`;
  } catch (error) {
    console.error(`[GEOCODE ERROR] ${error}`);
    return `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`;
  }
};

app.get('/', (req, res) => {
  res.json({ message: 'People4People API' });
});

// ==================== AUTH ENDPOINTS ====================

// REGISTER CITIZEN
app.post('/api/v1/auth/register', async (req, res) => {
  const { email, phone, name, password, confirmPassword } = req.body;

  if (!email || !phone || !name || !password) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  if (password !== confirmPassword) {
    return res.status(400).json({ error: 'Passwords do not match' });
  }

  if (password.length < 8) {
    return res.status(400).json({ error: 'Password must be at least 8 characters' });
  }

  const existingUser = users.find(u => u.email === email);
  if (existingUser) {
    return res.status(400).json({ error: 'Email already registered' });
  }

  const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();

  const newUser: User = {
    id: `user-${Date.now()}`,
    email,
    phone,
    name,
    passwordHash: hashPassword(password),
    role: 'citizen',
    mfaEnabled: false,
    createdAt: new Date().toISOString(),
    verified: false,
    verificationCode,
    verificationCodeExpiry: Date.now() + 3600000, // 1 hour
  };

  users.push(newUser);

  // Send verification email
  const emailContent = `
    <div style="font-family: Arial, sans-serif; color: #333; max-width: 600px; margin: 0 auto;">
      <div style="background: #005A36; color: #FFF; padding: 20px; text-align: center; border-radius: 8px 8px 0 0;">
        <h1 style="margin: 0;">PEOPLE FOR PEOPLE</h1>
        <p style="margin: 4px 0 0 0;">Verify Your Email</p>
      </div>
      <div style="padding: 20px; background: #FFF; border: 1px solid #DDD; border-radius: 0 0 8px 8px;">
        <h2 style="color: #005A36; margin-top: 0;">Welcome, ${name}!</h2>
        <p>Thank you for registering with People4People. Please verify your email to activate your account.</p>
        
        <div style="background: #E6F0EC; padding: 16px; border-radius: 8px; margin: 20px 0; text-align: center;">
          <p style="margin: 0 0 8px 0;"><strong>Verification Code:</strong></p>
          <p style="font-size: 32px; color: #005A36; margin: 0; font-weight: bold; letter-spacing: 5px;">${verificationCode}</p>
          <p style="margin: 8px 0 0 0; font-size: 12px; color: #666;">This code expires in 1 hour</p>
        </div>

        <p style="color: #666;">Please enter this code in the verification field to complete your registration.</p>
      </div>
    </div>
  `;

  await sendEmail(email, 'Verify Your Email - People4People', emailContent);

  res.status(201).json({
    status: 'success',
    message: 'Registration successful. Please check your email to verify your account.',
    userId: newUser.id,
  });
});

// VERIFY EMAIL
app.post('/api/v1/auth/verify-email', (req, res) => {
  const { userId, verificationCode } = req.body;

  if (!userId || !verificationCode) {
    return res.status(400).json({ error: 'Missing verification code' });
  }

  const user = users.find(u => u.id === userId);
  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }

  if (user.verificationCodeExpiry && Date.now() > user.verificationCodeExpiry) {
    return res.status(400).json({ error: 'Verification code expired' });
  }

  if (user.verificationCode !== verificationCode) {
    return res.status(400).json({ error: 'Invalid verification code' });
  }

  user.verified = true;
  user.verificationCode = undefined;
  user.verificationCodeExpiry = undefined;

  res.json({
    status: 'success',
    message: 'Email verified successfully',
  });
});

// LOGIN
app.post('/api/v1/auth/login', async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password required' });
  }

  const user = users.find(u => u.email === email);
  if (!user) {
    return res.status(401).json({ error: 'Invalid email or password' });
  }

  if (!user.verified) {
    return res.status(403).json({ error: 'Please verify your email first' });
  }

  if (user.passwordHash !== hashPassword(password)) {
    return res.status(401).json({ error: 'Invalid email or password' });
  }

  // If admin with MFA enabled, require MFA
  if (user.role === 'admin' && user.mfaEnabled) {
    const otpCode = generateOTP();
    const mfaSession: MFASession = {
      userId: user.id,
      otpCode,
      otpExpiry: Date.now() + 300000, // 5 minutes
      attempts: 0,
    };
    mfaSessions.push(mfaSession);

    // Send OTP via SMS
    if (user.mfaPhone) {
      await sendSMSOTP(user.mfaPhone, otpCode);
    }

    return res.json({
      status: 'mfa_required',
      message: 'MFA code sent to your phone',
      userId: user.id,
    });
  }

  // Generate session token (simplified)
  const token = crypto.randomBytes(32).toString('hex');

  res.json({
    status: 'success',
    message: 'Login successful',
    token,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
    },
  });
});

// VERIFY MFA
app.post('/api/v1/auth/verify-mfa', (req, res) => {
  const { userId, otpCode } = req.body;

  if (!userId || !otpCode) {
    return res.status(400).json({ error: 'Missing OTP code' });
  }

  const mfaSession = mfaSessions.find(s => s.userId === userId);
  if (!mfaSession) {
    return res.status(400).json({ error: 'No active MFA session' });
  }

  if (Date.now() > mfaSession.otpExpiry) {
    mfaSessions = mfaSessions.filter(s => s.userId !== userId);
    return res.status(400).json({ error: 'OTP expired' });
  }

  mfaSession.attempts++;
  if (mfaSession.attempts > 3) {
    mfaSessions = mfaSessions.filter(s => s.userId !== userId);
    return res.status(403).json({ error: 'Too many failed attempts' });
  }

  if (mfaSession.otpCode !== otpCode) {
    return res.status(401).json({ error: 'Invalid OTP code' });
  }

  // OTP verified - remove session
  mfaSessions = mfaSessions.filter(s => s.userId !== userId);

  const user = users.find(u => u.id === userId);
  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }

  const token = crypto.randomBytes(32).toString('hex');

  res.json({
    status: 'success',
    message: 'MFA verified successfully',
    token,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
    },
  });
});

// ==================== ADMIN MANAGEMENT ====================

// SUPER ADMIN: ADD NEW ADMIN
app.post('/api/v1/admin/add-admin', async (req, res) => {
  const { superAdminEmail, superAdminPassword, adminEmail, adminName, adminPhone } = req.body;

  if (!superAdminEmail || !superAdminPassword || !adminEmail || !adminName || !adminPhone) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  // Verify super admin
  const superAdmin = users.find(u => u.email === superAdminEmail && u.role === 'superadmin');
  if (!superAdmin) {
    return res.status(401).json({ error: 'Invalid super admin credentials' });
  }

  if (superAdmin.passwordHash !== hashPassword(superAdminPassword)) {
    return res.status(401).json({ error: 'Invalid super admin credentials' });
  }

  const existingAdmin = users.find(u => u.email === adminEmail);
  if (existingAdmin) {
    return res.status(400).json({ error: 'Admin email already exists' });
  }

  const tempPassword = crypto.randomBytes(8).toString('hex').toUpperCase();

  const newAdmin: User = {
    id: `admin-${Date.now()}`,
    email: adminEmail,
    phone: adminPhone,
    name: adminName,
    passwordHash: hashPassword(tempPassword),
    role: 'admin',
    mfaEnabled: true, // Auto-enable MFA for admins
    mfaPhone: adminPhone,
    createdAt: new Date().toISOString(),
    verified: true,
  };

  users.push(newAdmin);

  // Send credentials email
  const emailContent = `
    <div style="font-family: Arial, sans-serif; color: #333; max-width: 600px; margin: 0 auto;">
      <div style="background: #005A36; color: #FFF; padding: 20px; text-align: center; border-radius: 8px 8px 0 0;">
        <h1 style="margin: 0;">PEOPLE FOR PEOPLE</h1>
        <p style="margin: 4px 0 0 0;">Admin Account Created</p>
      </div>
      <div style="padding: 20px; background: #FFF; border: 1px solid #DDD; border-radius: 0 0 8px 8px;">
        <h2 style="color: #005A36; margin-top: 0;">Welcome to the Admin Team, ${adminName}!</h2>
        <p>Your admin account has been created by the Super Administrator.</p>
        
        <div style="background: #E6F0EC; padding: 16px; border-radius: 8px; margin: 20px 0;">
          <p><strong>Email:</strong> ${adminEmail}</p>
          <p><strong>Temporary Password:</strong> <code style="background: #F0F0F0; padding: 4px 8px; border-radius: 4px;">${tempPassword}</code></p>
        </div>

        <p style="color: #666;"><strong>⚠️ Important:</strong></p>
        <ul style="color: #666; margin: 8px 0;">
          <li>Your account has MFA (Multi-Factor Authentication) enabled</li>
          <li>You will receive SMS codes on: ${adminPhone}</li>
          <li>Change your password after first login</li>
          <li>Do not share your credentials</li>
        </ul>

        <p style="margin-top: 20px; color: #666;">Login at: <strong>https://people4people.local</strong></p>
      </div>
    </div>
  `;

  await sendEmail(adminEmail, 'Admin Account Created - People4People', emailContent);

  res.status(201).json({
    status: 'success',
    message: 'Admin account created and credentials sent to email',
    admin: {
      id: newAdmin.id,
      email: newAdmin.email,
      name: newAdmin.name,
    },
  });
});

// GET ALL USERS (Super Admin Only)
app.get('/api/v1/admin/users', (req, res) => {
  const { adminEmail } = req.query;

  const superAdmin = users.find(u => u.email === adminEmail && u.role === 'superadmin');
  if (!superAdmin) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const userList = users.map(u => ({
    id: u.id,
    email: u.email,
    name: u.name,
    phone: u.phone,
    role: u.role,
    verified: u.verified,
    mfaEnabled: u.mfaEnabled,
    createdAt: u.createdAt,
  }));

  res.json({ users: userList });
});

// DELETE USER (Super Admin Only)
app.delete('/api/v1/admin/users/:userId', (req, res) => {
  const { adminEmail, adminPassword } = req.body;

  const superAdmin = users.find(u => u.email === adminEmail && u.role === 'superadmin');
  if (!superAdmin || superAdmin.passwordHash !== hashPassword(adminPassword)) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const userIndex = users.findIndex(u => u.id === req.params.userId);
  if (userIndex === -1) {
    return res.status(404).json({ error: 'User not found' });
  }

  const deletedUser = users.splice(userIndex, 1);

  res.json({
    status: 'success',
    message: 'User deleted successfully',
    user: deletedUser[0],
  });
});

// ==================== REPORT ENDPOINTS ====================

// POST: Create a new report
app.post('/api/v1/reports', async (req, res) => {
  const { description, category, latitude, longitude, photoBase64, email, phone, addressInput } = req.body;

  if (!description || !category || latitude === undefined || longitude === undefined) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  const reportNumber = `P4P-${Math.floor(100000 + Math.random() * 900000)}`;
  let streetAddress = addressInput || '';
  if (!streetAddress) {
    streetAddress = await reverseGeocodeAddress(latitude, longitude);
  }

  const report = {
    id: `report-${Date.now()}`,
    reportNumber,
    description,
    category,
    latitude,
    longitude,
    streetAddress,
    photoBase64: photoBase64 || '',
    completionPhotoBase64: '',
    status: 'Pending',
    assignedCrew: '',
    email: email || '',
    phone: phone || '',
    createdAt: new Date().toISOString(),
  };

  reports.push(report);
  console.log('Report created:', report.reportNumber, 'Address:', streetAddress);

  // Send confirmation email
  if (email) {
    const emailContent = `
      <div style="font-family: Arial, sans-serif; color: #333; max-width: 600px; margin: 0 auto;">
        <div style="background: #005A36; color: #FFF; padding: 20px; text-align: center; border-radius: 8px 8px 0 0;">
          <h1 style="margin: 0;">PEOPLE FOR PEOPLE</h1>
          <p style="margin: 4px 0 0 0;">Community Service Delivery Platform</p>
        </div>
        <div style="padding: 20px; background: #FFF; border: 1px solid #DDD; border-radius: 0 0 8px 8px;">
          <h2 style="color: #005A36; margin-top: 0;">Your Incident Report Has Been Received</h2>
          <p>Thank you for reporting this issue. Your report has been successfully logged.</p>
          
          <div style="background: #E6F0EC; padding: 16px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #005A36;">
            <p style="margin: 0 0 8px 0;"><strong>Ticket Number:</strong></p>
            <p style="font-size: 24px; color: #005A36; margin: 0; font-weight: bold;">${reportNumber}</p>
          </div>

          <table style="width: 100%; border-collapse: collapse; margin: 16px 0;">
            <tr>
              <td style="padding: 8px; border-bottom: 1px solid #EEE;"><strong>Location:</strong></td>
              <td style="padding: 8px; border-bottom: 1px solid #EEE;"><strong style="color: #005A36;">${streetAddress}</strong></td>
            </tr>
            <tr>
              <td style="padding: 8px; border-bottom: 1px solid #EEE;"><strong>Category:</strong></td>
              <td style="padding: 8px; border-bottom: 1px solid #EEE;">${category}</td>
            </tr>
            <tr>
              <td style="padding: 8px;"><strong>Status:</strong></td>
              <td style="padding: 8px;"><span style="background: #FFF3CD; color: #856404; padding: 4px 8px; border-radius: 4px;">Pending Review</span></td>
            </tr>
          </table>
        </div>
      </div>
    `;
    await sendEmail(email, `Your Report #${reportNumber} - People4People`, emailContent);
  }

  res.status(201).json({
    status: 'success',
    reportNumber: report.reportNumber,
    message: 'Report submitted successfully',
    data: report,
  });
});

// GET: List all reports
app.get('/api/v1/reports', (req, res) => {
  const { category, status } = req.query;
  let filtered = reports;

  if (category && category !== 'ALL') {
    filtered = filtered.filter((r) => r.category === category);
  }
  if (status && status !== 'ALL') {
    filtered = filtered.filter((r) => r.status === status);
  }

  res.json(filtered);
});

// GET: Track ticket
app.get('/api/v1/reports/track/:ticketNumber', (req, res) => {
  const { ticketNumber } = req.params;
  const report = reports.find((r) => r.reportNumber === ticketNumber);

  if (report) {
    res.json({ found: true, report });
  } else {
    res.json({ found: false, message: `Ticket ${ticketNumber} not found.` });
  }
});

// PATCH: Update report
app.patch('/api/v1/reports/:id', (req, res) => {
  const { id } = req.params;
  const { status, assignedCrew, completionPhotoBase64 } = req.body;

  const report = reports.find((r) => r.id === id);
  if (!report) {
    return res.status(404).json({ status: 'error', message: 'Report not found' });
  }

  if (status) report.status = status;
  if (assignedCrew) report.assignedCrew = assignedCrew;
  if (completionPhotoBase64) report.completionPhotoBase64 = completionPhotoBase64;

  console.log('Report updated:', report.reportNumber, 'Status:', report.status);

  res.json({ success: true, status: 'success', report });
});

// DELETE: Delete report
app.delete('/api/v1/reports/:id', (req, res) => {
  const { id } = req.params;
  const idx = reports.findIndex((r) => r.id === id);

  if (idx === -1) {
    return res.status(404).json({ status: 'error', message: 'Report not found' });
  }

  const deleted = reports.splice(idx, 1);
  res.json({ status: 'success', message: 'Report deleted', data: deleted[0] });
});

app.listen(PORT, () => {
  createSuperAdmin();
  console.log(`Backend running on port ${PORT}`);
});
