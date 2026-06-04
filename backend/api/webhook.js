const express = require('express');
const router = express.Router();
router.post('/click', (req, res) => { console.log('Webhook click:', req.body); res.json({ ok: true }); });
router.post('/form-submit', (req, res) => { console.log('Webhook submit:', req.body); res.json({ ok: true }); });
module.exports = router;