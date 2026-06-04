const express = require('express');
const router = express.Router();
const db = require('../db');
const { authenticate, isAdmin } = require('../middleware');

// Get all themes
router.get('/', (req, res) => {
  try {
    const themes = db.readJson('themes') || [];
    res.json(themes);
  } catch (err) { res.status(500).json({ message: 'Server error' }); }
});

// Get single theme by code
router.get('/:code', (req, res) => {
  try {
    const themes = db.readJson('themes') || [];
    const theme = themes.find(t => t.code === req.params.code);
    if (!theme) return res.status(404).json({ message: 'Not found' });
    res.json(theme);
  } catch (err) { res.status(500).json({ message: 'Server error' }); }
});

// Create theme (admin only)
router.post('/', authenticate, isAdmin, (req, res) => {
  try {
    const themes = db.readJson('themes') || [];
    const theme = { _id: 'th_' + Date.now(), ...req.body, created_at: new Date().toISOString() };
    themes.push(theme);
    db.writeJson('themes', themes);
    res.status(201).json(theme);
  } catch (err) { res.status(500).json({ message: 'Server error' }); }
});

// Update theme (admin only)
router.put('/:id', authenticate, isAdmin, (req, res) => {
  try {
    const themes = db.readJson('themes') || [];
    const idx = themes.findIndex(t => t._id === req.params.id);
    if (idx === -1) return res.status(404).json({ message: 'Not found' });
    themes[idx] = { ...themes[idx], ...req.body };
    db.writeJson('themes', themes);
    res.json(themes[idx]);
  } catch (err) { res.status(500).json({ message: 'Server error' }); }
});

// Delete theme (admin only)
router.delete('/:id', authenticate, isAdmin, (req, res) => {
  try {
    let themes = db.readJson('themes') || [];
    themes = themes.filter(t => t._id !== req.params.id);
    db.writeJson('themes', themes);
    res.json({ message: 'Deleted' });
  } catch (err) { res.status(500).json({ message: 'Server error' }); }
});

module.exports = router;