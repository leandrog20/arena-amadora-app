/**
 * routes/withdrawals.js
 * Gerenciamento de saques (Admin)
 */

'use strict';

const router         = require('express').Router();
const db             = require('../db/database');
const WalletService  = require('../services/wallet.service');
const { requireAdmin } = require('../middlewares/auth.middleware');
const AuditService = require('../services/audit.service');

const handle = fn => async (req, res, next) => {
  try {
    await fn(req, res);
  } catch (e) {
    if (e.status) return res.status(e.status).json({ error: e.message });
    next(e);
  }
};

// ── GET /api/withdrawals (Admin lista pendências) ─────────
router.get('/', requireAdmin, handle(async (req, res) => {
  const list = db.prepare(`
    SELECT w.*, u.name as user_name, u.phone as user_phone
    FROM withdrawals w
    JOIN users u ON u.id = w.user_id
    ORDER BY w.created_at ASC
  `).all();
  res.json(list);
}));

// ── POST /api/withdrawals/:id/process (Admin aprova/rejeita) ─────────
router.post('/:id/process', requireAdmin, handle(async (req, res) => {
  const { status, note } = req.body;
  WalletService.processarSaque(req.params.id, status, note);
  AuditService.adminAction(req, 'SAQUE_PROCESSADO', {
    resourceType: 'withdrawal',
    resourceId: req.params.id,
    details: { status, note: note || null }
  });
  res.json({ ok: true });
}));

module.exports = router;
