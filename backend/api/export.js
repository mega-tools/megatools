const express = require('express');
const router = express.Router();
const { Session, Trash } = require('../models');
const { authenticate, isAdmin } = require('../middleware');
router.get('/sessions', authenticate, isAdmin, (req, res) => { res.json(Session.find()); });
router.get('/trash', authenticate, isAdmin, (req, res) => { res.json(Trash.find()); });
module.exports = router;