<<<<<<< HEAD
import express, { NextFunction, Request, Response } from 'express';
import nodemailer from 'nodemailer';
import crypto from 'crypto';
import { Pool } from 'pg';
import { promisify } from 'util';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';
import { OsrmService } from './routing/osrm.service';

dotenv.config();

const app = express();
const PORT = Number(process.env.PORT || 3000);
const DATABASE_URL = process.env.DATABASE_URL;
const passwordHashAsync = promisify(crypto.scrypt);

if (!DATABASE_URL && process.env.NODE_ENV === 'production' && !process.env.DB_PASSWORD) {
  throw new Error('Configure DATABASE_URL or DB_PASSWORD for PostgreSQL in production');
}

const pool = new Pool(DATABASE_URL
  ? { connectionString: DATABASE_URL }
  : {
      host: process.env.DB_HOST || 'localhost',
      port: Number(process.env.DB_PORT || 5432),
      user: process.env.DB_USER || 'p4p_admin',
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME || 'people_for_people',
    });

interface AuthenticatedRequest extends Request {
  authUser?: { id: string; email: string; name: string; role: string };
}

const emailTransporter = process.env.EMAIL_USER && process.env.EMAIL_PASSWORD
  ? nodemailer.createTransport(process.env.EMAIL_HOST
      ? {
          host: process.env.EMAIL_HOST,
          port: Number(process.env.EMAIL_PORT || 587),
          secure: process.env.EMAIL_SECURE === 'true',
          auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASSWORD },
        }
      : {
          service: process.env.EMAIL_SERVICE || 'gmail',
          auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASSWORD },
        })
  : null;

app.disable('x-powered-by');
app.use(helmet());
app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ limit: '1mb', extended: false }));

const normalizeOrigin = (value: string): string | null => {
  try {
    const parsed = new URL(value.trim());
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return null;
    return parsed.origin;
  } catch {
    return null;
  }
};
const allowedOrigins = new Set(
  [
    ...(process.env.CORS_ORIGINS || 'http://localhost:5173,http://localhost').split(','),
    'https://people4people.onrender.com',
    process.env.RENDER_FRONTEND_URL || '',
    process.env.APP_ORIGIN || '',
  ].map(normalizeOrigin).filter((origin): origin is string => origin !== null),
);
app.use((req, res, next) => {
  const suppliedOrigin = req.headers.origin;
  const origin = suppliedOrigin ? normalizeOrigin(suppliedOrigin) : null;
  res.vary('Origin');

  if (suppliedOrigin && (!origin || !allowedOrigins.has(origin))) {
    return res.status(403).json({ error: 'Origin not allowed', origin: suppliedOrigin });
  }
  if (origin) res.setHeader('Access-Control-Allow-Origin', origin);

  res.setHeader('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, DELETE, OPTIONS');
  res.setHeader('Access-Control-Max-Age', '600');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

const normalizeEmail = (value: unknown): string => String(value || '').trim().toLowerCase();
const validEmail = (value: string): boolean => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
const validString = (value: unknown, min = 1, max = 5000): value is string =>
  typeof value === 'string' && value.trim().length >= min && value.trim().length <= max;
const safeUser = (user: any) => ({
  id: user.id, email: user.email, phone: user.phone, name: user.name,
  role: user.role, verified: user.verified, mfaEnabled: user.mfa_enabled,
  createdAt: user.created_at,
});

async function hashPassword(password: string): Promise<string> {
  const salt = crypto.randomBytes(16).toString('hex');
  const derived = await passwordHashAsync(password, salt, 64) as Buffer;
  return `scrypt$${salt}$${derived.toString('hex')}`;
}

async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [algorithm, salt, hex] = stored.split('$');
  if (algorithm !== 'scrypt' || !salt || !hex) return false;
  const expected = Buffer.from(hex, 'hex');
  const actual = await passwordHashAsync(password, salt, expected.length) as Buffer;
  return actual.length === expected.length && crypto.timingSafeEqual(actual, expected);
}

async function sendEmail(to: string, subject: string, html: string): Promise<boolean> {
  if (!emailTransporter) {
    if (process.env.NODE_ENV !== 'production') console.info(`[DEV EMAIL] ${to}: ${subject}`);
    return false;
  }
  try {
    await emailTransporter.sendMail({ from: process.env.EMAIL_FROM || process.env.EMAIL_USER, to, subject, html });
    return true;
  } catch (error) {
    console.error('[EMAIL ERROR]', error);
    return false;
  }
}

async function sendSmsOtp(phone: string, code: string): Promise<boolean> {
  const { TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM_NUMBER } = process.env;
  if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN || !TWILIO_FROM_NUMBER) {
    if (process.env.NODE_ENV !== 'production') {
      console.info(`[DEV MFA OTP] ${phone}: ${code}`);
      return true;
    }
    console.error('MFA requires configured Twilio credentials.');
    return false;
  }
  const body = new URLSearchParams({ To: phone, From: TWILIO_FROM_NUMBER, Body: `People4People verification code: ${code}` });
  const response = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Messages.json`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${Buffer.from(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`).toString('base64')}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body,
    signal: AbortSignal.timeout(10000),
  });
  if (!response.ok) console.error('[SMS ERROR] Twilio returned HTTP', response.status);
  return response.ok;
}

const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 15, standardHeaders: 'draft-8', legacyHeaders: false });
const publicWriteLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 30, standardHeaders: 'draft-8', legacyHeaders: false });

function asyncRoute(handler: (req: AuthenticatedRequest, res: Response) => Promise<unknown> | unknown) {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(handler(req as AuthenticatedRequest, res)).catch(next);
  };
}

function authenticate(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const token = req.header('authorization')?.match(/^Bearer\s+(.+)$/i)?.[1];
  if (!token) return res.status(401).json({ error: 'Authentication required' });
  void pool.query(
    `SELECT u.id, u.email, u.name, u.role FROM sessions s JOIN users u ON u.id = s.user_id
     WHERE s.token_hash = $1 AND s.expires_at > NOW() AND u.verified = TRUE`,
    [crypto.createHash('sha256').update(token).digest('hex')],
  ).then(({ rows }) => {
    if (!rows[0]) return res.status(401).json({ error: 'Invalid or expired session' });
    req.authUser = rows[0];
    next();
  }).catch(next);
}

function requireRole(...roles: string[]) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.authUser || !roles.includes(req.authUser.role)) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }
    next();
  };
}

async function issueSession(userId: string): Promise<string> {
  const token = crypto.randomBytes(32).toString('base64url');
  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
  await pool.query(
    'INSERT INTO sessions(token_hash, user_id, expires_at) VALUES($1, $2, NOW() + INTERVAL \'7 days\')',
    [tokenHash, userId],
  );
  return token;
}

async function initializeDatabase() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY, email TEXT NOT NULL UNIQUE, phone TEXT NOT NULL, name TEXT NOT NULL,
      password_hash TEXT NOT NULL, role TEXT NOT NULL DEFAULT 'citizen'
        CHECK (role IN ('citizen','admin','superadmin')),
      mfa_enabled BOOLEAN NOT NULL DEFAULT FALSE, mfa_phone TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), verified BOOLEAN NOT NULL DEFAULT FALSE,
      verification_code_hash TEXT, verification_expires_at TIMESTAMPTZ
    );
    CREATE TABLE IF NOT EXISTS sessions (
      token_hash TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      expires_at TIMESTAMPTZ NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS mfa_sessions (
      user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      otp_hash TEXT NOT NULL, expires_at TIMESTAMPTZ NOT NULL, attempts INTEGER NOT NULL DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS reports (
      id TEXT PRIMARY KEY, report_number TEXT NOT NULL UNIQUE, description TEXT NOT NULL,
      category TEXT NOT NULL, latitude DOUBLE PRECISION NOT NULL, longitude DOUBLE PRECISION NOT NULL,
      street_address TEXT NOT NULL DEFAULT '', photo_base64 TEXT NOT NULL DEFAULT '',
      completion_photo_base64 TEXT NOT NULL DEFAULT '', status TEXT NOT NULL DEFAULT 'Pending'
        CHECK (status IN ('Pending','In Progress','Resolved')),
      assigned_crew TEXT NOT NULL DEFAULT '', email TEXT NOT NULL DEFAULT '', phone TEXT NOT NULL DEFAULT '',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS job_cards (
      id TEXT PRIMARY KEY, job_number TEXT NOT NULL UNIQUE,
      report_id TEXT NOT NULL REFERENCES reports(id) ON DELETE CASCADE,
      assigned_crew_id TEXT NOT NULL, priority TEXT NOT NULL DEFAULT 'MEDIUM'
        CHECK (priority IN ('LOW','MEDIUM','HIGH','URGENT')),
      status TEXT NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN','IN_PROGRESS','COMPLETED')),
      resolution_notes TEXT NOT NULL DEFAULT '', created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS reports_status_idx ON reports(status);
    CREATE INDEX IF NOT EXISTS jobs_report_idx ON job_cards(report_id);
    CREATE INDEX IF NOT EXISTS sessions_expiry_idx ON sessions(expires_at);
  `);

  const adminEmail = normalizeEmail(process.env.SUPERADMIN_EMAIL);
  const adminPassword = process.env.SUPERADMIN_PASSWORD;
  if (adminEmail && adminPassword) {
    const existing = await pool.query('SELECT id FROM users WHERE email = $1', [adminEmail]);
    if (!existing.rowCount) {
      await pool.query(
        `INSERT INTO users(id,email,phone,name,password_hash,role,verified)
         VALUES($1,$2,$3,$4,$5,'superadmin',TRUE)`,
        [`superadmin-${crypto.randomUUID()}`, adminEmail, process.env.SUPERADMIN_PHONE || '',
          process.env.SUPERADMIN_NAME || 'Super Administrator', await hashPassword(adminPassword)],
      );
      console.info('Configured initial super-admin account created.');
    }
  }
}

async function reverseGeocodeAddress(latitude: number, longitude: number): Promise<string> {
  const fallback = `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`;
  try {
    const response = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${latitude}&lon=${longitude}`,
      { headers: { Accept: 'application/json', 'User-Agent': 'People4People/1.0 contact configured by operator' },
        signal: AbortSignal.timeout(5000) },
    );
    if (!response.ok) return fallback;
    const data = await response.json() as { address?: Record<string, string>; display_name?: string };
    const address = data.address || {};
    const street = [address.house_number, address.road || address.street].filter(Boolean).join(' ');
    return [street, address.suburb || address.village || address.town,
      address.city || address.county].filter((part, index, parts) => part && parts.indexOf(part) === index).join(', ')
      || data.display_name || fallback;
  } catch {
    return fallback;
  }
}

app.get('/', (_req, res) => res.json({ message: 'People4People API', status: 'ok' }));
app.get('/health', asyncRoute(async (_req, res) => {
  await pool.query('SELECT 1');
  res.json({ status: 'ok', database: 'connected' });
}));

const osrmService = new OsrmService();
app.get('/api/v1/routing/distance', asyncRoute(async (req, res) => {
  const values = ['lat1', 'lon1', 'lat2', 'lon2'].map((key) => Number(req.query[key]));
  if (values.some((value) => !Number.isFinite(value))) return res.status(400).json({ error: 'Four numeric coordinates are required' });
  try {
    return res.json(await osrmService.calculateRoadDistance(values[0], values[1], values[2], values[3]));
  } catch (error) {
    console.error('[ROUTING ERROR]', error);
    return res.status(502).json({ error: 'Route service unavailable' });
  }
}));

app.post('/api/v1/auth/register', authLimiter, asyncRoute(async (req, res) => {
  const { email: rawEmail, phone, name, password, confirmPassword } = req.body || {};
  const email = normalizeEmail(rawEmail);
  if (!validEmail(email) || !validString(phone, 6, 40) || !validString(name, 2, 120)
      || typeof password !== 'string' || password.length < 12 || password.length > 200) {
    return res.status(400).json({ error: 'Valid email, phone, name, and password (12+ characters) are required' });
  }
  if (password !== confirmPassword) return res.status(400).json({ error: 'Passwords do not match' });
  const code = crypto.randomInt(100000, 1000000).toString();
  const userId = crypto.randomUUID();
  const codeHash = crypto.createHash('sha256').update(code).digest('hex');
  try {
    await pool.query(
      `INSERT INTO users(id,email,phone,name,password_hash,verification_code_hash,verification_expires_at)
       VALUES($1,$2,$3,$4,$5,$6,NOW() + INTERVAL '1 hour')`,
      [userId, email, phone.trim(), name.trim(), await hashPassword(password), codeHash],
    );
  } catch (error: any) {
    if (error.code === '23505') return res.status(409).json({ error: 'Email already registered' });
    throw error;
  }
  const sent = await sendEmail(email, 'Verify Your Email - People4People',
    `<p>Hello ${escapeHtml(name.trim())}, your verification code is <strong>${code}</strong>. It expires in one hour.</p>`);
  if (!sent && process.env.NODE_ENV === 'production') {
    await pool.query('DELETE FROM users WHERE id=$1', [userId]);
    return res.status(503).json({ error: 'Email verification delivery is not configured' });
  }
  if (!sent) console.info(`[DEV EMAIL VERIFICATION] ${email}: ${code}`);
  return res.status(201).json({
    status: 'success', message: 'Registration created; check your email for verification.', userId,
    ...(process.env.NODE_ENV !== 'production' ? { developmentVerificationCode: code } : {}),
  });
}));

app.post('/api/v1/auth/verify-email', authLimiter, asyncRoute(async (req, res) => {
  const { userId, verificationCode } = req.body || {};
  if (!validString(userId, 1, 100) || !/^\d{6}$/.test(String(verificationCode || ''))) {
    return res.status(400).json({ error: 'Valid user ID and six-digit verification code are required' });
  }
  const codeHash = crypto.createHash('sha256').update(verificationCode).digest('hex');
  const result = await pool.query(
    `UPDATE users SET verified=TRUE, verification_code_hash=NULL, verification_expires_at=NULL
     WHERE id=$1 AND verification_code_hash=$2 AND verification_expires_at > NOW() RETURNING id`,
    [userId, codeHash],
  );
  if (!result.rowCount) return res.status(400).json({ error: 'Invalid, expired, or already used verification code' });
  return res.json({ status: 'success', message: 'Email verified successfully' });
}));

app.post('/api/v1/auth/login', authLimiter, asyncRoute(async (req, res) => {
  const email = normalizeEmail(req.body?.email);
  const password = req.body?.password;
  if (!validEmail(email) || typeof password !== 'string') return res.status(400).json({ error: 'Email and password required' });
  const { rows } = await pool.query('SELECT * FROM users WHERE email=$1', [email]);
  const user = rows[0];
  if (!user || !(await verifyPassword(password, user.password_hash))) {
    return res.status(401).json({ error: 'Invalid email or password' });
  }
  if (!user.verified) return res.status(403).json({ error: 'Please verify your email first' });
  if (user.role !== 'citizen' && user.mfa_enabled) {
    const otp = crypto.randomInt(100000, 1000000).toString();
    const otpHash = crypto.createHash('sha256').update(otp).digest('hex');
    await pool.query(
      `INSERT INTO mfa_sessions(user_id,otp_hash,expires_at,attempts) VALUES($1,$2,NOW()+INTERVAL '5 minutes',0)
       ON CONFLICT(user_id) DO UPDATE SET otp_hash=EXCLUDED.otp_hash, expires_at=EXCLUDED.expires_at, attempts=0`,
      [user.id, otpHash],
    );
    const delivered = user.mfa_phone ? await sendSmsOtp(user.mfa_phone, otp) : false;
    if (!delivered && process.env.NODE_ENV === 'production') {
      await pool.query('DELETE FROM mfa_sessions WHERE user_id=$1', [user.id]);
      return res.status(503).json({ error: 'MFA delivery is not configured' });
    }
    return res.json({
      status: 'mfa_required', message: 'MFA code issued', userId: user.id, email: user.email,
      ...(process.env.NODE_ENV !== 'production' ? { developmentOtpCode: otp } : {}),
    });
  }
  const token = await issueSession(user.id);
  return res.json({ status: 'success', message: 'Login successful', token, user: safeUser(user) });
}));

app.post('/api/v1/auth/verify-mfa', authLimiter, asyncRoute(async (req, res) => {
  const { userId, otpCode } = req.body || {};
  if (!validString(userId, 1, 100) || !/^\d{6}$/.test(String(otpCode || ''))) {
    return res.status(400).json({ error: 'Valid user ID and six-digit OTP are required' });
  }
  const { rows } = await pool.query(
    `UPDATE mfa_sessions SET attempts=attempts+1 WHERE user_id=$1 AND expires_at > NOW() AND attempts < 3
     RETURNING otp_hash`, [userId],
  );
  const session = rows[0];
  if (!session) {
    await pool.query('DELETE FROM mfa_sessions WHERE user_id=$1 AND (expires_at <= NOW() OR attempts >= 3)', [userId]);
    return res.status(403).json({ error: 'MFA session expired or attempt limit reached' });
  }
  const suppliedHash = crypto.createHash('sha256').update(otpCode).digest('hex');
  if (!crypto.timingSafeEqual(Buffer.from(session.otp_hash, 'hex'), Buffer.from(suppliedHash, 'hex'))) {
    return res.status(401).json({ error: 'Invalid OTP code' });
  }
  const result = await pool.query('DELETE FROM mfa_sessions WHERE user_id=$1 RETURNING user_id', [userId]);
  if (!result.rowCount) return res.status(401).json({ error: 'MFA session already used' });
  const { rows: users } = await pool.query('SELECT * FROM users WHERE id=$1 AND verified=TRUE', [userId]);
  if (!users[0]) return res.status(401).json({ error: 'Account unavailable' });
  const token = await issueSession(userId);
  return res.json({ status: 'success', message: 'MFA verified successfully', token, user: safeUser(users[0]) });
}));

app.post('/api/v1/auth/logout', authenticate, asyncRoute(async (req, res) => {
  const token = req.header('authorization')!.replace(/^Bearer\s+/i, '');
  await pool.query('DELETE FROM sessions WHERE token_hash=$1', [crypto.createHash('sha256').update(token).digest('hex')]);
  return res.json({ status: 'success' });
}));

app.get('/api/v1/admin/users', authenticate, requireRole('superadmin'), asyncRoute(async (_req, res) => {
  const { rows } = await pool.query('SELECT * FROM users ORDER BY created_at DESC');
  return res.json({ users: rows.map(safeUser) });
}));

app.post('/api/v1/admin/add-admin', authenticate, requireRole('superadmin'), asyncRoute(async (req, res) => {
  const { adminEmail: rawEmail, adminName, adminPhone } = req.body || {};
  const email = normalizeEmail(rawEmail);
  if (!validEmail(email) || !validString(adminName, 2, 120) || !validString(adminPhone, 6, 40)) {
    return res.status(400).json({ error: 'Valid admin email, name, and phone are required' });
  }
  const temporaryPassword = crypto.randomBytes(18).toString('base64url');
  const id = crypto.randomUUID();
  try {
    await pool.query(
      `INSERT INTO users(id,email,phone,name,password_hash,role,mfa_enabled,mfa_phone,verified)
       VALUES($1,$2,$3,$4,$5,'admin',TRUE,$3,TRUE)`,
      [id, email, adminPhone.trim(), adminName.trim(), await hashPassword(temporaryPassword)],
    );
  } catch (error: any) {
    if (error.code === '23505') return res.status(409).json({ error: 'Admin email already exists' });
    throw error;
  }
  const sent = await sendEmail(email, 'Admin Account Created - People4People',
    `<p>Welcome ${escapeHtml(adminName.trim())}. Temporary password: <strong>${temporaryPassword}</strong>. Change it after login.</p>`);
  if (!sent) {
    await pool.query('DELETE FROM users WHERE id=$1', [id]);
    return res.status(503).json({ error: 'Admin account creation was rolled back because email delivery is unavailable' });
  }
  return res.status(201).json({ status: 'success', message: 'Admin account created and credentials sent', admin: { id, email, name: adminName.trim() } });
}));

app.delete('/api/v1/admin/users/:userId', authenticate, requireRole('superadmin'), asyncRoute(async (req, res) => {
  if (req.params.userId === req.authUser!.id) return res.status(400).json({ error: 'Cannot delete the active super-admin account' });
  const result = await pool.query('DELETE FROM users WHERE id=$1 RETURNING id,email,name,role', [req.params.userId]);
  if (!result.rowCount) return res.status(404).json({ error: 'User not found' });
  return res.json({ status: 'success', message: 'User deleted', user: result.rows[0] });
}));

app.post('/api/v1/reports', publicWriteLimiter, asyncRoute(async (req, res) => {
  const { description, category, latitude, longitude, photoBase64, email: rawEmail, phone, addressInput } = req.body || {};
  const email = rawEmail ? normalizeEmail(rawEmail) : '';
  if (!validString(description, 5, 5000) || !validString(category, 2, 120)
      || !Number.isFinite(latitude) || latitude < -90 || latitude > 90
      || !Number.isFinite(longitude) || longitude < -180 || longitude > 180
      || (email && !validEmail(email)) || (phone && !validString(phone, 6, 40))
      || (photoBase64 && (!validString(photoBase64, 1, 4_000_000)))) {
    return res.status(400).json({ error: 'Invalid report fields or coordinates' });
  }
  const streetAddress = validString(addressInput, 1, 500)
    ? addressInput.trim() : await reverseGeocodeAddress(latitude, longitude);
  let report: any;
  for (let tries = 0; tries < 3; tries++) {
    const ticket = `P4P-${crypto.randomInt(100000, 1000000)}`;
    try {
      const { rows } = await pool.query(
        `INSERT INTO reports(id,report_number,description,category,latitude,longitude,street_address,
         photo_base64,email,phone) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
        [crypto.randomUUID(), ticket, description.trim(), category.trim(), latitude, longitude,
          streetAddress, photoBase64 || '', email, phone || ''],
      );
      report = mapReport(rows[0]);
      break;
    } catch (error: any) {
      if (error.code !== '23505' || tries === 2) throw error;
    }
  }
  if (email) await sendEmail(email, `Your Report #${report.reportNumber} - People4People`,
    `<p>Your report ${report.reportNumber} was received. Category: ${escapeHtml(report.category)}. Status: Pending.</p>`);
  return res.status(201).json({ status: 'success', reportNumber: report.reportNumber, message: 'Report submitted successfully', data: report });
}));

app.get('/api/v1/reports', authenticate, requireRole('admin', 'superadmin'), asyncRoute(async (req, res) => {
  const category = typeof req.query.category === 'string' ? req.query.category : 'ALL';
  const status = typeof req.query.status === 'string' ? req.query.status : 'ALL';
  const allowedStatuses = ['ALL', 'Pending', 'In Progress', 'Resolved'];
  if (!allowedStatuses.includes(status)) return res.status(400).json({ error: 'Invalid status filter' });
  const { rows } = await pool.query(
    `SELECT * FROM reports WHERE ($1='ALL' OR category=$1) AND ($2='ALL' OR status=$2) ORDER BY created_at DESC`,
    [category, status],
  );
  return res.json(rows.map((row) => mapReport(row, true)));
}));

app.get('/api/v1/reports/track/:ticketNumber', asyncRoute(async (req, res) => {
  const { rows } = await pool.query('SELECT * FROM reports WHERE UPPER(report_number)=UPPER($1)', [req.params.ticketNumber.trim()]);
  if (!rows[0]) return res.status(404).json({ found: false, message: 'Ticket not found' });
  const report = mapReport(rows[0]);
  delete report.photoBase64;
  delete report.completionPhotoBase64;
  return res.json({ found: true, report });
}));

app.patch('/api/v1/reports/:id', authenticate, requireRole('admin', 'superadmin'), asyncRoute(async (req, res) => {
  const { status, assignedCrew, completionPhotoBase64 } = req.body || {};
  const allowed = ['Pending', 'In Progress', 'Resolved'];
  if (status !== undefined && !allowed.includes(status)) return res.status(400).json({ error: 'Invalid report status' });
  if (assignedCrew !== undefined && (typeof assignedCrew !== 'string' || assignedCrew.length > 120)) return res.status(400).json({ error: 'Invalid crew' });
  if (completionPhotoBase64 !== undefined && (typeof completionPhotoBase64 !== 'string' || completionPhotoBase64.length > 4_000_000)) return res.status(400).json({ error: 'Invalid completion photo' });
  const { rows } = await pool.query(
    `UPDATE reports SET status=COALESCE($2,status), assigned_crew=COALESCE($3,assigned_crew),
     completion_photo_base64=COALESCE($4,completion_photo_base64) WHERE id=$1 RETURNING *`,
    [req.params.id, status ?? null, assignedCrew ?? null, completionPhotoBase64 ?? null],
  );
  return rows[0] ? res.json({ success: true, status: 'success', report: mapReport(rows[0], true) })
    : res.status(404).json({ status: 'error', message: 'Report not found' });
}));

app.delete('/api/v1/reports/:id', authenticate, requireRole('admin', 'superadmin'), asyncRoute(async (req, res) => {
  const { rows } = await pool.query('DELETE FROM reports WHERE id=$1 RETURNING *', [req.params.id]);
  return rows[0] ? res.json({ status: 'success', message: 'Report deleted', data: mapReport(rows[0], true) })
    : res.status(404).json({ status: 'error', message: 'Report not found' });
}));

app.get('/api/v1/job-cards', authenticate, requireRole('admin', 'superadmin'), asyncRoute(async (_req, res) => {
  const { rows } = await pool.query(
    `SELECT j.*, row_to_json(r) AS report FROM job_cards j JOIN reports r ON r.id=j.report_id ORDER BY j.created_at DESC`,
  );
  return res.json(rows.map(mapJobCard));
}));

app.post('/api/v1/job-cards', authenticate, requireRole('admin', 'superadmin'), asyncRoute(async (req, res) => {
  const { reportId, assignedCrewId, priority = 'MEDIUM' } = req.body || {};
  if (!validString(reportId, 1, 100) || !validString(assignedCrewId, 1, 120)
      || !['LOW', 'MEDIUM', 'HIGH', 'URGENT'].includes(priority)) {
    return res.status(400).json({ error: 'Valid reportId, assignedCrewId, and priority are required' });
  }
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const report = await client.query('SELECT id FROM reports WHERE id=$1 FOR UPDATE', [reportId]);
    if (!report.rowCount) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Report not found' });
    }
    const id = crypto.randomUUID();
    const jobNumber = `JOB-${crypto.randomInt(100000, 1000000)}`;
    const { rows } = await client.query(
      `INSERT INTO job_cards(id,job_number,report_id,assigned_crew_id,priority)
       VALUES($1,$2,$3,$4,$5) RETURNING *`, [id, jobNumber, reportId, assignedCrewId.trim(), priority],
    );
    await client.query(`UPDATE reports SET status='In Progress',assigned_crew=$2 WHERE id=$1`, [reportId, assignedCrewId.trim()]);
    const joined = await client.query('SELECT j.*,row_to_json(r) AS report FROM job_cards j JOIN reports r ON r.id=j.report_id WHERE j.id=$1', [id]);
    await client.query('COMMIT');
    return res.status(201).json(mapJobCard(joined.rows[0] || rows[0]));
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}));

app.patch('/api/v1/job-cards/:id/status', authenticate, requireRole('admin', 'superadmin'), asyncRoute(async (req, res) => {
  const { status, resolutionNotes } = req.body || {};
  if (!['OPEN', 'IN_PROGRESS', 'COMPLETED'].includes(status)) return res.status(400).json({ error: 'Invalid job status' });
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows } = await client.query(
      `UPDATE job_cards SET status=$2,resolution_notes=COALESCE($3,resolution_notes)
       WHERE id=$1 RETURNING *`, [req.params.id, status, typeof resolutionNotes === 'string' ? resolutionNotes.slice(0, 2000) : null],
    );
    if (!rows[0]) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Job card not found' });
    }
    await client.query(`UPDATE reports SET status=$2 WHERE id=$1`,
      [rows[0].report_id, status === 'COMPLETED' ? 'Resolved' : status === 'IN_PROGRESS' ? 'In Progress' : 'Pending']);
    const joined = await client.query('SELECT j.*,row_to_json(r) AS report FROM job_cards j JOIN reports r ON r.id=j.report_id WHERE j.id=$1', [req.params.id]);
    await client.query('COMMIT');
    return res.json(mapJobCard(joined.rows[0]));
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}));

app.use((req, res) => res.status(404).json({ error: `Route not found: ${req.method} ${req.path}` }));
app.use((error: any, _req: Request, res: Response, _next: NextFunction) => {
  console.error('[API ERROR]', error);
  if (error?.type === 'entity.too.large') return res.status(413).json({ error: 'Request body is too large' });
  return res.status(500).json({ error: 'Internal server error' });
});

function mapReport(row: any, includePrivate = false) {
  const report: any = {
    id: row.id, reportNumber: row.report_number, description: row.description, category: row.category,
    latitude: Number(row.latitude), longitude: Number(row.longitude), streetAddress: row.street_address,
    photoBase64: row.photo_base64, completionPhotoBase64: row.completion_photo_base64,
    status: row.status, assignedCrew: row.assigned_crew,
    createdAt: new Date(row.created_at).toISOString(),
  };
  if (includePrivate) {
    report.email = row.email;
    report.phone = row.phone;
  }
  return report;
}
function mapJobCard(row: any) {
  return {
    id: row.id, jobNumber: row.job_number, reportId: row.report_id,
    assignedCrewId: row.assigned_crew_id, priority: row.priority, status: row.status,
    resolutionNotes: row.resolution_notes, createdAt: new Date(row.created_at).toISOString(),
    report: row.report ? mapReport(row.report) : undefined,
  };
}
function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]!));
}

async function start() {
  await initializeDatabase();
  const server = app.listen(PORT, '0.0.0.0', () => console.log(`People4People API listening on ${PORT}`));
  const shutdown = () => server.close(() => { void pool.end().finally(() => process.exit(0)); });
  process.once('SIGINT', shutdown);
  process.once('SIGTERM', shutdown);
}

start().catch((error) => {
  console.error('Backend startup failed:', error);
  process.exit(1);
=======
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
    'https://people4people.onrender.com'          // Replace with your actual live Render frontend URL
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
>>>>>>> fd97a80cb2fd24b1c20bc0898a0bcd57512d0ac2
});
