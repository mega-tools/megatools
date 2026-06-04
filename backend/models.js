const bcrypt = require('bcryptjs');
const db = require('./db');

// ⭐ ANONYMOUS TRACKING CODE GENERATOR
const generateTrackingCode = () => {
  const chars = "abcdefghjkmnpqrstuvwxyz23456789";
  let code = "";
  for (let i = 0; i < 8; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
};

// ⭐ BASE CODE GENERATOR
const generateBaseCode = () => {
  const chars = "abcdefghjkmnpqrstuvwxyz23456789";
  let code = "";
  for (let i = 0; i < 9; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
};

// ══════════════════════════════════════
// ⭐ USER MODEL
// ══════════════════════════════════════
const User = {
  create: (d) => {
    const u = db.users.read();
    d._id = 'u_' + Date.now();
    d.created_at = new Date().toISOString();
    if (d.password) d.password = bcrypt.hashSync(d.password, 12);
    if (!d.status) d.status = 'pending';
    if (!d.role) d.role = 'user';
    if (!d.trackingCode) d.trackingCode = generateTrackingCode();
    d.name = d.name || d.fullName || d.username || '';
    d.fullName = d.fullName || d.name || '';
    d.phone = d.phone || '';
    d.facebook = d.facebook || '';
    d.profilePic = d.profilePic || '';
    d.referralCode = d.referralCode || '';
    
    d.parentId = d.parentId || null;
    d.parentUsername = d.parentUsername || null;
    d.createdBy = d.createdBy || null;
    
    u.push(d);
    db.users.write(u);
    return d;
  },

  findOne: (f) => {
    const u = db.users.read();
    return u.find(x => Object.keys(f).every(k => x[k] === f[k])) || null;
  },

  findById: (id) => db.users.read().find(x => x._id === id) || null,

  find: (f) => {
    let u = db.users.read();
    if (f && f.status) u = u.filter(x => x.status === f.status);
    if (f && f.role) u = u.filter(x => x.role === f.role);
    if (f && f.parentId) u = u.filter(x => x.parentId === f.parentId);
    return u;
  },

  findByIdAndUpdate: (id, up) => {
    const u = db.users.read();
    const i = u.findIndex(x => x._id === id);
    if (i === -1) return null;
    if (up.password) up.password = bcrypt.hashSync(up.password, 12);
    u[i] = { ...u[i], ...up, updated_at: new Date().toISOString() };
    db.users.write(u);
    return u[i];
  },

  findByIdAndDelete: (id) => {
    let u = db.users.read();
    const i = u.findIndex(x => x._id === id);
    if (i === -1) return null;
    const deleted = u.splice(i, 1)[0];
    db.users.write(u);
    return deleted;
  },

  countDocuments: (f) => {
    let u = db.users.read();
    if (f && f.status) u = u.filter(x => x.status === f.status);
    if (f && f.role) u = u.filter(x => x.role === f.role);
    return u.length;
  }
};

// ══════════════════════════════════════
// ⭐ LINK MODEL
// ══════════════════════════════════════
const Link = {
  create: (d) => {
    const l = db.links.read();
    d._id = 'l_' + Date.now();
    d.created_at = new Date().toISOString();
    d.total_clicks = d.total_clicks || 0;

    d.baseCode = d.baseCode || d.uniqueCode || generateBaseCode();
    d.slug = d.baseCode;
    d.slug_history = d.slug_history || [];
    d.rotation_targets = d.rotation_targets || {};
    d.shield_enabled = d.shield_enabled || false;
    d.shield_duration = d.shield_duration || 2;
    d.shield_type = d.shield_type || 'loading';
    d.status = d.status || 'active';
    d.steps = d.steps || 1;
    d.inboxView = d.inboxView || 'quick';
    d.inboxAction = d.inboxAction || (d.inboxView === 'message' ? 'message' : 'direct');
    d.linksCategory = d.linksCategory || (d.inboxView === 'message' ? 'message' : 'action');
    d.filterType = d.filterType || (d.inboxView === 'message' ? 'message' : d.category || 'general');
    d.showInInbox = d.showInInbox !== undefined ? d.showInInbox : true;

    d.linkType = d.linkType || 'both';
    d.ownerId = d.ownerId || null;
    d.ownerTrackingCode = d.ownerTrackingCode || null;
    
    // NEW FIELDS
    d.imageUrl = d.imageUrl || '';
    d.htmlCode = d.htmlCode || '';
    d.tutorialUrl = d.tutorialUrl || '';

    d.category = d.category || 'general';

    l.push(d);
    db.links.write(l);
    return d;
  },

  find: (f) => {
    let l = db.links.read();
    if (f && f.category) l = l.filter(x => x.category === f.category);
    if (f && f.status) l = l.filter(x => x.status === f.status);
    if (f && f.linkType) l = l.filter(x => x.linkType === f.linkType);
    if (f && f.ownerId) l = l.filter(x => x.ownerId === f.ownerId);
    return l.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  },

  findOne: (f) => {
    const l = db.links.read();
    return l.find(x => Object.keys(f).every(k => x[k] === f[k])) || null;
  },

  findByBaseCode: (code) => {
    const l = db.links.read();
    return l.find(x => x.baseCode === code || x.uniqueCode === code) || null;
  },

  findBySlug: (slug) => {
    const l = db.links.read();
    return l.find(x => x.baseCode === slug || x.slug === slug || x.uniqueCode === slug) || null;
  },

  findById: (id) => db.links.read().find(x => x._id === id) || null,

  findByIdAndUpdate: (id, up) => {
    const l = db.links.read();
    const i = l.findIndex(x => x._id === id);
    if (i === -1) return null;

    if (up.baseCode && up.baseCode !== l[i].baseCode) {
      if (!l[i].slug_history) l[i].slug_history = [];
      l[i].slug_history.push(l[i].baseCode);
      up.slug = up.baseCode;
    }

    l[i] = { ...l[i], ...up, updated_at: new Date().toISOString() };
    db.links.write(l);
    return l[i];
  },

  findByIdAndDelete: (id) => {
    let l = db.links.read();
    const i = l.findIndex(x => x._id === id);
    if (i === -1) return null;
    const deleted = l.splice(i, 1)[0];
    db.links.write(l);
    return deleted;
  },

  distinct: (field) => [...new Set(db.links.read().map(x => x[field]).filter(Boolean))]
};

// ══════════════════════════════════════
// ⭐ SESSION MODEL
// ══════════════════════════════════════
const Session = {
  create: (d) => {
    const s = db.sessions.read();
    d._id = 's_' + Date.now();
    d.timestamp = new Date().toISOString();
    d.lastActivity = new Date().toISOString();
    d.isLive = true;
    d.entryUrl = d.entryUrl || '';
    d.currentUrl = d.currentUrl || '';
    d.clicks = d.clicks || 0;
    d.status = d.status || 'Active';
    d.deviceType = d.deviceType || 'Desktop';
    d.collectedTypes = d.collectedTypes || [];
    d.formData = d.formData || {};
    d.submissions = d.submissions || [];
    d.hiddenBy = d.hiddenBy || [];
    s.push(d);
    db.sessions.write(s);
    return d;
  },

  find: () => db.sessions.read().sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp)),

  findById: (id) => db.sessions.read().find(x => x._id === id) || null,

  findByVisitorId: (visitorId) => db.sessions.read().find(x => x.visitorId === visitorId) || null,

  findByIdAndUpdate: (id, up) => {
    const s = db.sessions.read();
    const i = s.findIndex(x => x._id === id);
    if (i === -1) return null;
    s[i] = { ...s[i], ...up, lastActivity: new Date().toISOString() };
    db.sessions.write(s);
    return s[i];
  },

  findByIdAndDelete: (id) => {
    let s = db.sessions.read();
    const i = s.findIndex(x => x._id === id);
    if (i === -1) return null;
    const deleted = s.splice(i, 1)[0];
    db.sessions.write(s);
    return deleted;
  },

  countDocuments: (f) => {
    let s = db.sessions.read();
    if (f && f.deviceType) s = s.filter(x => x.deviceType === f.deviceType);
    if (f && f.status) s = s.filter(x => x.status === f.status);
    if (f && f.isLive !== undefined) s = s.filter(x => x.isLive === f.isLive);
    return s.length;
  }
};

// ══════════════════════════════════════
// ⭐ TRASH MODEL
// ══════════════════════════════════════
const Trash = {
  create: (d) => {
    const t = db.trash.read();
    d._id = 't_' + Date.now();
    d.deletedAt = new Date().toISOString();
    t.push(d);
    db.trash.write(t);
    return d;
  },
  find: () => db.trash.read().sort((a, b) => new Date(b.deletedAt) - new Date(a.deletedAt)),
  findById: (id) => db.trash.read().find(x => x._id === id) || null,
  findByIdAndDelete: (id) => {
    let t = db.trash.read();
    const i = t.findIndex(x => x._id === id);
    if (i === -1) return null;
    const deleted = t.splice(i, 1)[0];
    db.trash.write(t);
    return deleted;
  },
  deleteMany: () => db.trash.write([]),
  countDocuments: () => db.trash.read().length
};

// ⭐ MENU ITEM MODEL
const MenuItem = {
  create: (d) => {
    const m = db.menuItems.read();
    d._id = 'm_' + Date.now();
    d.created_at = new Date().toISOString();
    m.push(d);
    db.menuItems.write(m);
    return d;
  },
  find: () => db.menuItems.read().sort((a, b) => new Date(b.created_at) - new Date(a.created_at)),
  findByIdAndUpdate: (id, up) => {
    const m = db.menuItems.read();
    const i = m.findIndex(x => x._id === id);
    if (i === -1) return null;
    m[i] = { ...m[i], ...up, updated_at: new Date().toISOString() };
    db.menuItems.write(m);
    return m[i];
  },
  findByIdAndDelete: (id) => {
    let m = db.menuItems.read();
    const i = m.findIndex(x => x._id === id);
    if (i === -1) return null;
    const deleted = m.splice(i, 1)[0];
    db.menuItems.write(m);
    return deleted;
  }
};

// ⭐ ROUTE LOG MODEL
const RouteLog = {
  create: (d) => {
    const l = db.routeLogs.read();
    d._id = 'r_' + Date.now();
    d.changedAt = new Date().toISOString();
    l.push(d);
    db.routeLogs.write(l);
    return d;
  },
  find: () => db.routeLogs.read().sort((a, b) => new Date(b.changedAt) - new Date(a.changedAt))
};

// ⭐ CLICK MODEL
const Click = {
  create: (d) => {
    const c = db.clicks.read();
    d._id = 'c_' + Date.now();
    d.clickedAt = new Date().toISOString();
    c.push(d);
    db.clicks.write(c);
    return d;
  }
};

module.exports = { User, Link, Session, Trash, MenuItem, RouteLog, Click, generateTrackingCode, generateBaseCode };