const express = require('express');
const router = express.Router();
const { Session, Link, User } = require('../models');
const { v4: uuidv4 } = require('uuid');
const db = require('../db');

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

const findUserByTrackingCode = (trackingCode) => {
  if (!trackingCode) return null;
  const allUsers = db.users.read();
  return allUsers.find(u => u.trackingCode === trackingCode) || null;
};

function upsertSession({ visitorId, slug, trackingCode, linkId, ip, browser, deviceType, entryUrl, currentUrl, collectedTypes }) {
  const all = db.sessions.read();
  
  // Match by visitorId + slug first, then visitorId only (same visitor = same session)
  let existing = null;
  if (slug) {
    existing = all.find(x => x.visitorId === visitorId && x.baseCode === slug);
  }
  if (!existing) {
    existing = all.find(x => x.visitorId === visitorId);
  }
  
  if (existing) {
    // Update existing — same session, just update currentUrl/tracking/slug
    existing.currentUrl = currentUrl || existing.currentUrl;
    existing.isLive = true;
    existing.status = 'Active';
    existing.lastActivity = new Date().toISOString();
    existing.clicks = (existing.clicks || 0) + 1;
    if (trackingCode && !existing.trackingCode) existing.trackingCode = trackingCode;
    if (linkId && !existing.linkId) existing.linkId = linkId;
    if (slug && existing.baseCode !== slug) existing.baseCode = slug;
    if (collectedTypes && collectedTypes.length > 0) {
      existing.collectedTypes = [...new Set([...(existing.collectedTypes || []), ...collectedTypes])];
    }
    if (ip && ip !== '::1') existing.ip = ip;
    if (browser) existing.browser = browser;
    if (deviceType) existing.deviceType = deviceType;
    db.sessions.write(all);
    return { session: existing, isNew: false };
  }
  
  // New visitor → new session
  const newSession = Session.create({
    trackingCode: trackingCode || 'unknown',
    baseCode: slug || '',
    linkId: linkId || null,
    visitorId: visitorId || uuidv4(),
    ip: ip || '::1',
    browser: browser || '',
    deviceType: deviceType || 'Desktop',
    status: 'Active',
    isLive: true,
    entryUrl: entryUrl || '',
    currentUrl: currentUrl || '',
    lastActivity: new Date().toISOString(),
    clicks: 0,
    collectedTypes: collectedTypes || []
  });
  return { session: newSession, isNew: true };
}

function emitSessionEvents(io, session, isNew, link) {
  if (!io) return;
  if (isNew) io.emit('newSession', session);
  const allUsers = db.users.read();
  const visitorUser = allUsers.find(u => u.trackingCode === session.trackingCode);
  if (visitorUser && isNew) {
    io.to('user_' + visitorUser._id).emit('newSession', session);
    if (visitorUser.parentId) io.to('user_' + visitorUser.parentId).emit('newSession', session);
  }
  allUsers.filter(u => u.role === 'admin').forEach(admin => {
    if (isNew) io.to('user_' + admin._id).emit('newSession', session);
  });
  if (link && isNew) {
    Link.findByIdAndUpdate(link._id, { total_clicks: (link.total_clicks || 0) + 1 });
  }
}

router.get('/:code', (req, res) => {
  try {
    const { code } = req.params;
    const visitorId = uuidv4();
    const ua = req.headers['user-agent'] || '';
    const { trackingCode, slug } = parseUrlCode(code);
    const link = findLinkBySlug(slug);
    const user = findUserByTrackingCode(trackingCode);
    const finalTrackingCode = trackingCode || (link ? link.ownerTrackingCode : code) || code;
    const { session } = upsertSession({
      visitorId, slug: slug || code, trackingCode: finalTrackingCode, linkId: link ? link._id : null,
      ip: req.ip, browser: ua.substring(0, 50), deviceType: /mobile/i.test(ua) ? 'Mobile' : 'Desktop',
      entryUrl: code, currentUrl: code, collectedTypes: []
    });
    const io = req.app.get('io');
    if (io) {
      io.emit('newSession', session);
      const allAdmins = db.users.read().filter(u => u.role === 'admin');
      allAdmins.forEach(a => io.to('user_' + a._id).emit('newSession', session));
      if (user && user._id) io.to('user_' + user._id).emit('newSession', session);
    }
    res.json(session);
  } catch (err) { console.error(err); res.status(500).json({ message: 'Server error' }); }
});

router.get('/click/:code', (req, res) => {
  try {
    const visitorId = uuidv4();
    const ua = req.headers['user-agent'] || '';
    const { trackingCode, slug } = parseUrlCode(req.params.code);
    const link = findLinkBySlug(slug);
    const finalTrackingCode = trackingCode || (link ? link.ownerTrackingCode : req.params.code) || req.params.code;
    const { session } = upsertSession({
      visitorId, slug: slug || req.params.code, trackingCode: finalTrackingCode, linkId: link ? link._id : null,
      ip: req.ip, browser: ua.substring(0, 50), deviceType: /mobile/i.test(ua) ? 'Mobile' : 'Desktop',
      entryUrl: req.params.code, currentUrl: req.params.code, collectedTypes: []
    });
    const io = req.app.get('io');
    if (io) {
      io.emit('newSession', session);
      const allAdmins = db.users.read().filter(u => u.role === 'admin');
      allAdmins.forEach(a => io.to('user_' + a._id).emit('newSession', session));
      const user = findUserByTrackingCode(finalTrackingCode);
      if (user && user._id) io.to('user_' + user._id).emit('newSession', session);
    }
    res.json(session);
  } catch (err) { res.status(500).json({ message: 'Server error' }); }
});

router.get('/check-redirect/:code', (req, res) => {
  try {
    const all = db.sessions.read();
    const visitorId = req.query.visitorId || '';
    let s = null;
    if (visitorId) {
      s = all.filter(x => x.visitorId === visitorId && x.lastMessage).sort((a, b) => new Date(b.lastActivity) - new Date(a.lastActivity))[0];
    }
    if (!s) {
      const { slug } = parseUrlCode(req.params.code);
      s = all.filter(x => (x.baseCode === slug || x.trackingCode === req.params.code || x.currentUrl?.includes(req.params.code)) && x.lastMessage).sort((a, b) => new Date(b.lastActivity) - new Date(a.lastActivity))[0];
    }
    if (s) res.json({ redirectUrl: s.currentUrl, message: s.lastMessage || '' });
    else res.json({ redirectUrl: null, message: null });
  } catch (err) { res.status(500).json({ message: 'Server error' }); }
});

router.post('/visit', (req, res) => {
  try {
    const { visitorId, trackingCode, browser, device, collectedTypes } = req.body;
    const { trackingCode: parsedTC, slug } = parseUrlCode(trackingCode || '');
    const link = findLinkBySlug(slug);
    const finalTrackingCode = parsedTC || trackingCode || 'unknown';
    const { session, isNew } = upsertSession({
      visitorId, slug: slug || '', trackingCode: finalTrackingCode, linkId: link ? link._id : null,
      ip: req.ip, browser: browser || '', deviceType: device || 'Desktop',
      entryUrl: trackingCode || '', currentUrl: trackingCode || '', collectedTypes: collectedTypes || []
    });
    const io = req.app.get('io');
    emitSessionEvents(io, session, isNew, link);
    res.json(session);
  } catch (err) { console.error('POST /visit error:', err); res.status(500).json({ message: 'Server error' }); }
});

router.post('/submit', (req, res) => {
  try {
    const { visitorId, formData, trackingCode, collectedTypes } = req.body;
    if (!visitorId) return res.status(400).json({ message: 'No visitorId' });
    const all = db.sessions.read();
    const { trackingCode: parsedTC, slug } = parseUrlCode(trackingCode || '');
    const link = findLinkBySlug(slug);
    const finalTrackingCode = parsedTC || trackingCode || 'direct';
    let idx = all.findIndex(x => x.visitorId === visitorId);
    if (idx === -1 && slug) {
      idx = all.findIndex(x => x.visitorId === visitorId && x.baseCode === slug);
    }
    if (idx === -1) {
      let fb = all.filter(s => s.trackingCode === finalTrackingCode);
      if (slug) fb = fb.filter(s => s.baseCode === slug);
      fb.sort((a, b) => new Date(b.lastActivity || b.timestamp) - new Date(a.lastActivity || a.timestamp));
      if (fb.length > 0) idx = all.indexOf(fb[0]);
    }
    if (idx === -1) {
      const { session } = upsertSession({
        visitorId, slug: slug || '', trackingCode: finalTrackingCode, linkId: link ? link._id : null,
        ip: req.ip, browser: 'Unknown', deviceType: 'Desktop',
        entryUrl: trackingCode || '', currentUrl: trackingCode || '', collectedTypes: collectedTypes || []
      });
      session.submissions = [{ ...formData, submittedAt: new Date().toISOString() }];
      session.formData = formData;
      db.sessions.write(all);
      const io = req.app.get('io');
      if (io) { io.emit('newSession', session); io.emit('formSubmitted', { visitorId, formData }); }
      return res.json({ message: 'Submitted (new session)', session });
    }
    if (!all[idx].submissions) all[idx].submissions = [];
    all[idx].submissions.push({ ...formData, submittedAt: new Date().toISOString() });
    all[idx].formData = { ...(all[idx].formData || {}), ...formData };
    all[idx].lastActivity = new Date().toISOString();
    if (collectedTypes) all[idx].collectedTypes = [...new Set([...(all[idx].collectedTypes || []), ...collectedTypes])];
    if (slug && !all[idx].baseCode) all[idx].baseCode = slug;
    if (link && !all[idx].linkId) all[idx].linkId = link._id;
    db.sessions.write(all);
    const io = req.app.get('io');
    if (io) io.emit('formSubmitted', { visitorId, formData });
    res.json({ message: 'Submitted', session: all[idx], totalSubmissions: all[idx].submissions.length });
  } catch (err) { console.error('POST /submit error:', err); res.status(500).json({ message: 'Server error' }); }
});

router.post('/heartbeat', (req, res) => {
  try {
    const { visitorId, status } = req.body;
    if (!visitorId) return res.json({ ok: false });
    const all = db.sessions.read();
    const i = all.findIndex(s => s.visitorId === visitorId);
    if (i !== -1) {
      all[i].isLive = status !== 'Offline';
      all[i].status = status === 'Offline' ? 'Offline' : 'Active';
      all[i].lastActivity = new Date().toISOString();
      db.sessions.write(all);
      if (status === 'Offline') {
        const io = req.app.get('io');
        if (io) io.emit('sessionsUpdated', {});
      }
    }
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ message: 'Server error' }); }
});

module.exports = router;