const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { User } = require('../models');
const { authenticate, isAdmin } = require('../middleware');
const db = require('../db');

// ═══════════════════════════════════════
// SIGNUP — Referral Code → Auto Active (No Admin Approval)
// ═══════════════════════════════════════
router.post('/signup', async (req, res) => {
  try {
    const { name, fullName, username, email, password, phone, facebook, profilePic, referralCode, parentUsername } = req.body;

    const finalName = name || fullName || username || (email ? email.split('@')[0] : 'User');
    const finalUsername = username || (email ? email.split('@')[0] : finalName);
    const finalFullName = fullName || name || finalName;

    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required' });
    }

    if (password.length < 6) {
      return res.status(400).json({ message: 'Password must be at least 6 characters' });
    }

    if (User.findOne({ username: finalUsername })) {
      return res.status(400).json({ message: 'Username already exists' });
    }
    if (User.findOne({ email: email.toLowerCase().trim() })) {
      return res.status(400).json({ message: 'Email already exists' });
    }

    let role = 'user';
    let parentId = null;
    let finalParentUsername = null;
    let finalReferralCode = (referralCode || '').toUpperCase();

    if (finalReferralCode) {
      let referrals = db.readJson('referrals') || [];
      const ref = referrals.find(r => r.code === finalReferralCode && !r.used);

      if (!ref) {
        return res.status(400).json({ message: 'Invalid or already used referral code' });
      }

      if (ref.type === 'moderator') {
        role = 'moderator';
      }

      referrals = referrals.filter(r => r.code !== finalReferralCode);
      db.writeJson('referrals', referrals);

      parentId = ref.createdBy || null;
    }

    if (parentUsername) {
      const parent = User.findOne({ username: parentUsername, role: 'moderator', status: 'active' });
      if (!parent) {
        return res.status(400).json({ message: 'Moderator not found' });
      }
      role = 'user';
      parentId = parent._id;
      finalParentUsername = parentUsername;
    }

    const userStatus = 'active';

    const userData = {
      name: finalName,
      fullName: finalFullName,
      username: finalUsername,
      email: email.toLowerCase().trim(),
      password,
      phone: phone || '',
      facebook: facebook || '',
      profilePic: profilePic || '',
      referralCode: finalReferralCode,
      role,
      status: userStatus,
      parentId: parentId || null,
      parentUsername: finalParentUsername || null,
      createdBy: parentId || null,
    };

    const newUser = User.create(userData);
    res.status(201).json({
      message: role === 'moderator' 
        ? 'Moderator account created successfully! You can now sign in.' 
        : 'Account created successfully!',
      user: newUser
    });
  } catch (err) {
    console.error('Signup error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// ═══════════════════════════════════════
// LOGIN
// ═══════════════════════════════════════
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ message: 'Email and password required' });

    const user = User.findOne({ email: email.toLowerCase().trim() });
    if (!user) return res.status(400).json({ message: 'Invalid credentials' });
    if (user.status === 'pending') return res.status(403).json({ message: 'Account pending approval. Contact admin.' });
    if (user.status === 'blocked') return res.status(403).json({ message: 'Account blocked. Contact admin.' });

    const match = await bcrypt.compare(password, user.password);
    if (!match) return res.status(400).json({ message: 'Invalid credentials' });

    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: '7d' });
    res.cookie('token', token, {
      httpOnly: true,
      secure: true,
      sameSite: 'none',
      maxAge: 7 * 24 * 60 * 60 * 1000
    });

    res.json({
      user: {
        _id: user._id,
        id: user._id,
        name: user.name || user.fullName || user.username,
        fullName: user.fullName || user.name,
        email: user.email,
        role: user.role,
        trackingCode: user.trackingCode || '',
        phone: user.phone || '',
        facebook: user.facebook || '',
        profilePic: user.profilePic || '',
        referralCode: user.referralCode || '',
        parentId: user.parentId || null,
        parentUsername: user.parentUsername || null,
        created_at: user.created_at,
        status: user.status
      },
      token
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

router.post('/logout', (req, res) => {
  res.clearCookie('token');
  res.json({ message: 'Logged out' });
});

router.get('/me', authenticate, (req, res) => {
  const u = req.user;
  res.json({
    _id: u._id,
    id: u._id,
    name: u.name || u.fullName || u.username,
    fullName: u.fullName || u.name,
    email: u.email,
    role: u.role,
    trackingCode: u.trackingCode || '',
    phone: u.phone || '',
    facebook: u.facebook || '',
    profilePic: u.profilePic || '',
    referralCode: u.referralCode || '',
    parentId: u.parentId || null,
    parentUsername: u.parentUsername || null,
    created_at: u.created_at,
    status: u.status
  });
});

router.put('/profile', authenticate, async (req, res) => {
  try {
    const allowedFields = ['name', 'fullName', 'phone', 'facebook', 'profilePic', 'email'];
    const updates = {};
    allowedFields.forEach(f => {
      if (req.body[f] !== undefined) updates[f] = req.body[f];
    });
    const u = User.findByIdAndUpdate(req.user._id, updates);
    res.json(u);
  } catch (err) {
    console.error('Profile update error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

router.put('/password', authenticate, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const user = User.findById(req.user._id);
    const match = await bcrypt.compare(currentPassword, user.password);
    if (!match) return res.status(400).json({ message: 'Current password is wrong' });
    const hash = await bcrypt.hash(newPassword, 12);
    User.findByIdAndUpdate(req.user._id, { password: hash });
    res.json({ message: 'Password updated' });
  } catch (err) {
    console.error('Password update error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

router.get('/check-moderator/:username', (req, res) => {
  try {
    const user = User.findOne({ username: req.params.username, role: 'moderator', status: 'active' });
    if (user) {
      return res.json({
        exists: true,
        moderatorName: user.name || user.fullName || user.username,
        moderatorUsername: user.username,
        moderatorId: user._id
      });
    }
    return res.status(404).json({ exists: false, message: 'Moderator not found' });
  } catch (err) {
    console.error('Check moderator error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

router.get('/users-map', authenticate, (req, res) => {
  try {
    const allUsers = db.users.read();
    const map = {};
    allUsers.forEach(u => {
      if (u.trackingCode) {
        map[u.trackingCode] = {
          name: u.name || u.fullName || u.username || 'Unknown',
          profilePic: u.profilePic || null,
          role: u.role || 'user'
        };
      }
    });
    res.json(map);
  } catch (err) {
    console.error('Users map error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

router.post('/generate-referral', authenticate, isAdmin, (req, res) => {
  try {
    const { count, type } = req.body;
    const codes = [];
    for (let i = 0; i < (count || 1); i++) {
      const code = 'REF' + Math.random().toString(36).substring(2, 10).toUpperCase();
      codes.push(code);
    }
    const referrals = db.readJson('referrals') || [];
    codes.forEach(code => {
      referrals.push({
        code,
        type: type || 'moderator',
        used: false,
        usedBy: null,
        usedAt: null,
        createdBy: req.user._id,
        created_at: new Date().toISOString()
      });
    });
    db.writeJson('referrals', referrals);
    res.json({ codes, message: `${codes.length} referral code(s) generated` });
  } catch (err) {
    console.error('Generate referral error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

router.get('/referrals', authenticate, (req, res) => {
  try {
    const referrals = db.readJson('referrals') || [];
    res.json(referrals.sort((a, b) => new Date(b.created_at) - new Date(a.created_at)));
  } catch (err) {
    console.error('Referrals list error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;