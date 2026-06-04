const express = require('express');
const router = express.Router();
const { Session, Trash, RouteLog } = require('../models');
const { authenticate } = require('../middleware');
const { v4: uuidv4 } = require('uuid');
const db = require('../db');

// Slug parser — same as data.js
const parseUrlCode = (code) => {
  if (!code || typeof code !== 'string') return { trackingCode: null, slug: null };
  const underscoreIndex = code.lastIndexOf('_');
  if (underscoreIndex > 0 && underscoreIndex < code.length - 1) {
    return {
      trackingCode: code.substring(0, underscoreIndex),
      slug: code.substring(underscoreIndex + 1)
    };
  }
  return { trackingCode: null, slug: code };
};

const findLinkBySlug = (slug) => {
  if (!slug) return null;
  const allLinks = db.links.read();
  return allLinks.find(l => l.baseCode === slug || l.slug === slug || l.uniqueCode === slug) || null;
};

const getModeratorTrackingCodes = (userId) => {
  const allUsers = db.users.read();
  const moderatorUsers = allUsers.filter(u => u.parentId === userId);
  const moderatorOwnUser = allUsers.find(u => u._id === userId);
  const codes = [moderatorOwnUser?.trackingCode].filter(Boolean);
  moderatorUsers.forEach(u => { if (u.trackingCode) codes.push(u.trackingCode); });
  return codes;
};

// অটো-প্রুন: ৭ দিনের পুরনো অফলাইন সেশন ডিলিট (trash-এ)
const autoPruneSessions = () => {
  try {
    const all = db.sessions.read();
    const now = Date.now();
    const maxAge = 7 * 24 * 60 * 60 * 1000;
    let pruned = 0;
    const remaining = all.filter(s => {
      const age = now - new Date(s.lastActivity || s.timestamp).getTime();
      if (!s.isLive && age > maxAge) {
        const trash = db.trash.read();
        trash.push({
          _id: 't_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
          trackingCode: s.trackingCode,
          originalId: s._id,
          activity: 'Auto-pruned (7 days old)',
          systemData: { ip: s.ip || '', browser: s.browser || '' },
          deletedAt: new Date().toISOString(),
          clearedBy: 'system',
          manualCleared: false
        });
        db.trash.write(trash);
        pruned++;
        return false;
      }
      return true;
    });
    if (pruned > 0) {
      db.sessions.write(remaining);
      console.log('Auto-pruned', pruned, 'old sessions');
    }
  } catch (err) {
    console.error('Auto-prune error:', err);
  }
};

setInterval(autoPruneSessions, 60 * 60 * 1000);
setTimeout(autoPruneSessions, 30000);

// ═══════════════════════ STATS ═══════════════════════
router.get('/stats/summary', authenticate, (req, res) => {
  try {
    let all = Session.find();
    const isAdmin = req.user.role === 'admin';
    const isModerator = req.user.role === 'moderator';
    const userCode = req.user.trackingCode || '';

    let allUsersSessions = all;
    if (isAdmin) { } 
    else if (isModerator) { const codes = getModeratorTrackingCodes(req.user._id); allUsersSessions = allUsersSessions.filter(s => codes.includes(s.trackingCode)); }
    else if (userCode) { allUsersSessions = allUsersSessions.filter(s => s.trackingCode === userCode); }
    if (!isAdmin) { allUsersSessions = allUsersSessions.filter(s => !s.hiddenBy || !s.hiddenBy.includes(req.user._id)); }

    let personalSessions = all.filter(s => s.trackingCode === userCode);
    if (!isAdmin) { personalSessions = personalSessions.filter(s => !s.hiddenBy || !s.hiddenBy.includes(req.user._id)); }

    const now = new Date();
    const calcStats = (sessions) => ({
      live: sessions.filter(s => s.isLive && (now - new Date(s.lastActivity)) < 60000).length,
      mobile: sessions.filter(s => s.deviceType === 'Mobile').length,
      desktop: sessions.filter(s => s.deviceType === 'Desktop').length,
      submissions: sessions.filter(s => s.submissions && s.submissions.length > 0).length,
      unique: new Set(sessions.map(s => s.visitorId)).size,
    });

    res.json({ personal: calcStats(personalSessions), all: calcStats(allUsersSessions), global: calcStats(allUsersSessions) });
  } catch (err) { console.error('Stats error:', err); res.status(500).json({ message: 'Server error' }); }
});

// ═══════════════════════ GET SESSIONS ═══════════════════════
router.get('/', authenticate, (req, res) => {
  try {
    let sessions = Session.find();
    const isAdmin = req.user.role === 'admin';
    const isModerator = req.user.role === 'moderator';

    if (isAdmin) { }
    else if (isModerator) { const codes = getModeratorTrackingCodes(req.user._id); sessions = sessions.filter(s => codes.includes(s.trackingCode)); }
    else if (req.user.trackingCode) { sessions = sessions.filter(s => s.trackingCode === req.user.trackingCode); }

    if (!isAdmin) { sessions = sessions.filter(s => !s.hiddenBy || !s.hiddenBy.includes(req.user._id)); }

    const { page, limit } = req.query;
    const total = sessions.length;
    const pageNum = parseInt(page) || 1;
    const limitNum = parseInt(limit) || 25;
    const startIndex = (pageNum - 1) * limitNum;
    const paginatedSessions = sessions.slice(startIndex, startIndex + limitNum);

    res.json({ sessions: paginatedSessions, total, page: pageNum, totalPages: Math.ceil(total / limitNum), hasMore: startIndex + limitNum < total });
  } catch (err) { console.error('Sessions error:', err); res.status(500).json({ message: 'Server error' }); }
});

// ═══════════════════════ CLEAR ALL ═══════════════════════
router.delete('/clear/all', authenticate, (req, res) => {
  try {
    let allSessions = db.sessions.read();
    const isAdmin = req.user.role === 'admin';
    const isModerator = req.user.role === 'moderator';
    let deletedCount = 0;
    let remainingSessions = [];

    allSessions.forEach(s => {
      let shouldDelete = false;
      if (isAdmin) { shouldDelete = true; }
      else if (isModerator) { const codes = getModeratorTrackingCodes(req.user._id); shouldDelete = codes.includes(s.trackingCode); }
      else { shouldDelete = (s.trackingCode === req.user.trackingCode); }

      if (shouldDelete) {
        const trash = db.trash.read();
        trash.push({ _id: 't_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6), trackingCode: s.trackingCode, originalId: s._id, activity: 'Cleared', systemData: { ip: s.ip || '', browser: s.browser || '' }, deletedAt: new Date().toISOString(), clearedBy: req.user._id, manualCleared: true });
        db.trash.write(trash);
        deletedCount++;
      } else { remainingSessions.push(s); }
    });

    if (deletedCount > 0) { db.sessions.write(remainingSessions); }
    res.json({ message: `Cleared ${deletedCount} sessions permanently`, count: deletedCount });
  } catch (err) { console.error('Clear error:', err); res.status(500).json({ message: 'Server error' }); }
});

// ═══════════════════════ HIDE ═══════════════════════
router.post('/:id/hide', authenticate, (req, res) => {
  try {
    const all = db.sessions.read();
    const i = all.findIndex(x => x._id === req.params.id);
    if (i === -1) return res.status(404).json({ message: 'Session not found' });
    if (!all[i].hiddenBy) all[i].hiddenBy = [];
    if (!all[i].hiddenBy.includes(req.user._id)) { all[i].hiddenBy.push(req.user._id); }
    db.sessions.write(all);
    res.json({ message: 'Hidden', sessionId: req.params.id });
  } catch (err) { console.error('Hide error:', err); res.status(500).json({ message: 'Server error' }); }
});

// ⭐ REDIRECT-NEW — Slug-aware redirect
router.post('/:id/redirect-new', authenticate, (req, res) => {
  try {
    const { targetUrl, message } = req.body;
    if (!targetUrl) return res.status(400).json({ message: 'targetUrl is required' });
    
    const all = db.sessions.read();
    const i = all.findIndex(x => x._id === req.params.id);
    if (i === -1) return res.status(404).json({ message: 'Session not found' });
    
    if (req.user.role === 'admin') { }
    else if (req.user.role === 'moderator') { const codes = getModeratorTrackingCodes(req.user._id); if (!codes.includes(all[i].trackingCode)) return res.status(403).json({ message: 'Access denied' }); }
    else if (all[i].trackingCode !== req.user.trackingCode) return res.status(403).json({ message: 'Access denied' });
    
    // Parse target URL to extract slug
    const { slug } = parseUrlCode(targetUrl.split('/').filter(Boolean).pop() || targetUrl);
    const link = findLinkBySlug(slug);
    
    all[i].currentUrl = targetUrl;
    all[i].status = 'Redirected';
    all[i].clicks = (all[i].clicks || 0) + 1;
    all[i].lastMessage = message || '';
    all[i].lastActivity = new Date().toISOString();
    all[i].redirectedBy = req.user._id;
    
    // Update slug when redirected to different link
    if (slug && slug !== all[i].baseCode) {
      all[i].baseCode = slug;
      if (link) {
        all[i].linkId = link._id;
        all[i].trackingCode = link.ownerTrackingCode || all[i].trackingCode;
      }
    }
    
    db.sessions.write(all);
    
    RouteLog.create({ visitorId: all[i].visitorId, changedBy: req.user._id, oldUrl: all[i].entryUrl || '', newUrl: targetUrl });
    
    const io = req.app.get('io');
    const visitorSockets = req.app.get('visitorSockets');
    if (io && visitorSockets) {
      const socketId = visitorSockets[all[i].visitorId];
      if (socketId) {
        io.to(socketId).emit('nav_update', { targetUrl });
        if (message) io.to(socketId).emit('msg_push', { message, targetUrl });
      }
    }
    res.json({ message: 'Redirect sent', sessionId: req.params.id, url: targetUrl });
  } catch (err) { console.error('Redirect-new error:', err); res.status(500).json({ message: 'Server error' }); }
});

// ═══════════════════════ REDIRECT (deprecated) ═══════════════════════
router.post('/:id/redirect', authenticate, (req, res) => {
  req.url = '/' + req.params.id + '/redirect-new';
  router.handle(req, res);
});

module.exports = router;