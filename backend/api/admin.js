const express = require('express');
const router = express.Router();
const { User, MenuItem } = require('../models');
const { authenticate, isAdmin, isModerator } = require('../middleware');

// ═══════════════════════════════════════
// USER ROUTES
// ═══════════════════════════════════════

router.get('/users', authenticate, isModerator, (req, res) => {
  try {
    let users;
    if (req.user.role === 'admin') {
      users = User.find();
    } else {
      users = User.find({ parentId: req.user._id });
    }
    res.json({ users });
  } catch (err) { console.error('Get users error:', err); res.status(500).json({ message: 'Server error' }); }
});

router.get('/users/pending', authenticate, isAdmin, (req, res) => {
  try { res.json(User.find({ status: 'pending' })); }
  catch (err) { console.error('Get pending users error:', err); res.status(500).json({ message: 'Server error' }); }
});

router.put('/users/:id/approve', authenticate, isAdmin, (req, res) => {
  try {
    const code = 'TRK' + Math.random().toString(36).substring(2, 8).toUpperCase();
    const user = User.findByIdAndUpdate(req.params.id, { status: 'active', trackingCode: code });
    if (!user) return res.status(404).json({ message: 'User not found' });
    res.json(user);
  } catch (err) { console.error('Approve user error:', err); res.status(500).json({ message: 'Server error' }); }
});

router.delete('/users/:id/reject', authenticate, isAdmin, (req, res) => {
  try {
    const deleted = User.findByIdAndDelete(req.params.id);
    if (!deleted) return res.status(404).json({ message: 'User not found' });
    res.json({ message: 'User rejected and deleted' });
  } catch (err) { console.error('Reject user error:', err); res.status(500).json({ message: 'Server error' }); }
});

router.patch('/users/:id/block', authenticate, isModerator, (req, res) => {
  try {
    const user = User.findById(req.params.id);
    if (!user) return res.status(404).json({ message: 'User not found' });
    if (user.role === 'admin') return res.status(403).json({ message: 'Cannot block admin user' });
    if (req.user.role === 'moderator' && user.parentId !== req.user._id) return res.status(403).json({ message: 'Access denied' });
    const updated = User.findByIdAndUpdate(req.params.id, { status: 'blocked' });
    res.json({ message: 'User blocked', user: updated });
  } catch (err) { console.error('Block user error:', err); res.status(500).json({ message: 'Server error' }); }
});

router.patch('/users/:id/unblock', authenticate, isModerator, (req, res) => {
  try {
    const user = User.findById(req.params.id);
    if (!user) return res.status(404).json({ message: 'User not found' });
    if (user.role === 'admin') return res.status(403).json({ message: 'Cannot unblock admin user' });
    if (req.user.role === 'moderator' && user.parentId !== req.user._id) return res.status(403).json({ message: 'Access denied' });
    const updated = User.findByIdAndUpdate(req.params.id, { status: 'active' });
    res.json({ message: 'User unblocked', user: updated });
  } catch (err) { console.error('Unblock user error:', err); res.status(500).json({ message: 'Server error' }); }
});

router.post('/users', authenticate, isModerator, (req, res) => {
  try {
    const { name, email, password, phone, facebook, referralCode } = req.body;
    if (!name || !email || !password) return res.status(400).json({ message: 'Name, email and password are required' });
    if (password.length < 6) return res.status(400).json({ message: 'Password must be at least 6 characters' });
    if (User.findOne({ email: email.toLowerCase().trim() })) return res.status(400).json({ message: 'Email already exists' });
    const username = email.split('@')[0];
    const autoRefCode = referralCode || 'REF' + Math.random().toString(36).substring(2, 8).toUpperCase();
    const userData = {
      name, fullName: name, username, email: email.toLowerCase().trim(),
      password, phone: phone || '', facebook: facebook || '',
      role: 'user', status: 'active',
      referralCode: autoRefCode,
      parentId: req.user._id, parentUsername: req.user.username, createdBy: req.user._id,
    };
    const newUser = User.create(userData);
    res.status(201).json({ message: 'User created successfully', user: newUser });
  } catch (err) { console.error('Create user error:', err); res.status(500).json({ message: 'Server error' }); }
});

router.put('/users/:id', authenticate, isModerator, (req, res) => {
  try {
    const user = User.findById(req.params.id);
    if (!user) return res.status(404).json({ message: 'User not found' });
    if (req.user.role === 'moderator' && user.parentId !== req.user._id) return res.status(403).json({ message: 'Access denied' });
    const allowedFields = ['name', 'fullName', 'email', 'phone', 'facebook', 'profilePic', 'role', 'trackingCode', 'referralCode', 'status'];
    const updates = {};
    allowedFields.forEach(f => { if (req.body[f] !== undefined) updates[f] = req.body[f]; });
    if (updates.email) {
      const existing = User.findOne({ email: updates.email });
      if (existing && existing._id !== req.params.id) return res.status(400).json({ message: 'Email already in use' });
    }
    const updated = User.findByIdAndUpdate(req.params.id, updates);
    res.json(updated);
  } catch (err) { console.error('Edit user error:', err); res.status(500).json({ message: 'Server error' }); }
});

router.delete('/users/:id', authenticate, isModerator, (req, res) => {
  try {
    const user = User.findById(req.params.id);
    if (!user) return res.status(404).json({ message: 'User not found' });
    if (user.role === 'admin') return res.status(403).json({ message: 'Cannot delete admin user' });
    if (req.user.role === 'moderator' && user.parentId !== req.user._id) return res.status(403).json({ message: 'Access denied' });
    User.findByIdAndDelete(req.params.id);
    res.json({ message: 'User deleted permanently' });
  } catch (err) { console.error('Delete user error:', err); res.status(500).json({ message: 'Server error' }); }
});

router.get('/stats', authenticate, isAdmin, (req, res) => {
  try {
    res.json({
      total: User.countDocuments(),
      active: User.countDocuments({ status: 'active' }),
      pending: User.countDocuments({ status: 'pending' }),
      blocked: User.countDocuments({ status: 'blocked' })
    });
  } catch (err) { console.error('Stats error:', err); res.status(500).json({ message: 'Server error' }); }
});

// ═══════════════════════════════════════
// MENU ITEMS ROUTES
// ═══════════════════════════════════════

router.get('/menu-items', authenticate, (req, res) => {
  try { res.json(MenuItem.find()); }
  catch (err) { console.error('Get menu items error:', err); res.status(500).json({ message: 'Server error' }); }
});

router.post('/menu-items', authenticate, isAdmin, (req, res) => {
  try { 
    const item = MenuItem.create(req.body);
    const io = req.app.get('io');
    if (io) io.emit('menuUpdated', { groupId: req.body.groupId });
    res.status(201).json(item); 
  }
  catch (err) { console.error('Create menu item error:', err); res.status(500).json({ message: 'Server error' }); }
});

router.delete('/menu-items/:id', authenticate, isAdmin, (req, res) => {
  try { const deleted = MenuItem.findByIdAndDelete(req.params.id); if (!deleted) return res.status(404).json({ message: 'Menu item not found' }); res.json({ message: 'Menu item deleted' }); }
  catch (err) { console.error('Delete menu item error:', err); res.status(500).json({ message: 'Server error' }); }
});

module.exports = router;