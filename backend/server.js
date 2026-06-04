require('dotenv').config();
const express = require('express');
const http = require('http');
const path = require('path');
const fs = require('fs');
const socketIo = require('socket.io');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const cookieParser = require('cookie-parser');
const db = require('./db');

const authRoutes = require('./api/auth');
const linksRoutes = require('./api/links');
const dataRoutes = require('./api/data');
const sessionsRoutes = require('./api/sessions');
const adminRoutes = require('./api/admin');
const webhookRoutes = require('./api/webhook');
const exportRoutes = require('./api/export');
const themeRoutes = require('./api/theme');

const app = express();
app.set('trust proxy', true);
const server = http.createServer(app);

app.use(cors({ origin: true, credentials: true }));
app.use((req, res, next) => {
  const origin = req.headers.origin;
  res.header('Access-Control-Allow-Origin', origin);
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
  res.header('Access-Control-Allow-Credentials', 'true');
  if (req.method === 'OPTIONS') return res.sendStatus(200);
  next();
});

const io = socketIo(server, {
  cors: { origin: true, methods: ['GET', 'POST'], credentials: true }
});

app.use(express.json({ limit: '5mb' }));
app.use(cookieParser());

const dataDir = path.join(__dirname, 'data');
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

const requiredJsonFiles = ['users','links','sessions','trash','menuItems','routeLogs','clicks','referrals','themes'];
requiredJsonFiles.forEach(file => {
  const filePath = path.join(dataDir, file + '.json');
  if (!fs.existsSync(filePath)) { fs.writeFileSync(filePath, '[]', 'utf-8'); }
});

const logDir = path.join(__dirname, 'logs');
if (!fs.existsSync(logDir)) fs.mkdirSync(logDir, { recursive: true });
const errorLogStream = fs.createWriteStream(path.join(logDir, 'error.log'), { flags: 'a' });
const originalConsoleError = console.error;
console.error = function(...args) {
  const timestamp = new Date().toISOString();
  const message = args.map(a => (typeof a === 'object' ? JSON.stringify(a) : String(a))).join(' ');
  errorLogStream.write(`[${timestamp}] ERROR: ${message}\n`);
  originalConsoleError.apply(console, args);
};

const demoPath = path.join(__dirname, '..', '_demo');
const limiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 2000, message: { message: 'Too many requests' }, skipSuccessfulRequests: false });
app.use('/api/', limiter);

const visitorSockets = {};
app.set('io', io);
app.set('visitorSockets', visitorSockets);

app.use('/demo', (req, res, next) => {
  const originalUrl = req.originalUrl;
  const pathAfterDemo = originalUrl.replace('/demo', '');
  const cleanPath = pathAfterDemo.split('?')[0].replace(/\/$/, '');
  const parts = cleanPath.split('/').filter(p => p && p.length > 0);
  let filePath = path.join(demoPath, cleanPath);
  if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) return res.sendFile(filePath);
  const lastPart = parts[parts.length - 1];
  if (lastPart && !lastPart.includes('.') && lastPart.length > 3) {
    const folderPath = parts.slice(0, -1).join('/');
    const indexPath = path.join(demoPath, folderPath, 'index.html');
    if (fs.existsSync(indexPath)) return res.sendFile(indexPath);
    if (parts.length === 1) { const rootIndex = path.join(demoPath, 'index.html'); if (fs.existsSync(rootIndex)) return res.sendFile(rootIndex); }
  }
  filePath = path.join(demoPath, cleanPath, 'index.html');
  if (fs.existsSync(filePath)) return res.sendFile(filePath);
  next();
});
app.use('/demo', express.static(demoPath));

app.use('/api/auth', authRoutes);
app.use('/api/links', linksRoutes);
app.use('/api/data', dataRoutes);
app.use('/api/sessions', sessionsRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/webhook', webhookRoutes);
app.use('/api/export', exportRoutes);
app.use('/api/theme', themeRoutes);

app.use((err, req, res, next) => {
  console.error('Unhandled error:', err.message, '\nStack:', err.stack);
  res.status(500).json({ message: 'Internal server error' });
});

io.on('connection', (socket) => {
  console.log('Socket connected:', socket.id);
  socket.on('joinUserRoom', (userId) => { if (userId) socket.join('user_' + userId); });
  socket.on('session_init', (data) => {
    const { visitorId, trackingCode } = data;
    if (visitorId) { visitorSockets[visitorId] = socket.id; socket.visitorId = visitorId; socket.trackingCode = trackingCode; }
  });
  socket.on('joinRoom', (trackingCode) => { if (trackingCode) socket.join('room_' + trackingCode); });
  socket.on('disconnect', () => {
    if (socket.visitorId && visitorSockets[socket.visitorId]) delete visitorSockets[socket.visitorId];
    const all = db.sessions.read();
    let changed = false;
    all.forEach(s => { if (s.visitorId === socket.visitorId && s.isLive) { s.isLive = false; s.status = 'Offline'; s.lastActivity = new Date().toISOString(); changed = true; } });
    if (changed) { db.sessions.write(all); io.emit('sessionsUpdated', {}); }
  });
});

setInterval(() => {
  const all = db.sessions.read();
  const now = Date.now();
  let changed = false;
  all.forEach(s => { if (!s.lastActivity) return; if (s.isLive && (now - new Date(s.lastActivity).getTime()) / 1000 > 25) { s.isLive = false; s.status = 'Offline'; changed = true; } });
  if (changed) { db.sessions.write(all); io.emit('sessionsUpdated', {}); }
}, 5000);

async function seed() {
  const bcrypt = require('bcryptjs');
  const users = db.users.read();
  if (users.length === 0) {
    const h1 = await bcrypt.hash('admin123', 12);
    db.users.write([{ _id: 'u_admin', name: 'Admin', fullName: 'Admin User', username: 'admin', email: 'admin@controlhub.local', password: h1, role: 'admin', status: 'active', trackingCode: 'ka4rb4lf7', phone: '', facebook: '', profilePic: '', referralCode: '', parentId: null, parentUsername: null, createdBy: null, created_at: new Date().toISOString() }]);
    console.log('Seeded Admin user (admin@controlhub.local)');
  }
}

const PORT = process.env.PORT || 5000;
db.connect().then(() => { seed().then(() => { server.listen(PORT, () => { console.log('Backend running on port ' + PORT); }); }); });