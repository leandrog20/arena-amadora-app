/**
 * routes/users.js
 * Usuários, ranking, histórico e depósito.
 */

'use strict';

const router         = require('express').Router();
const UsersRepo      = require('../repositories/users.repository');
const HistoricoRepo  = require('../repositories/historico.repository');
const WalletService  = require('../services/wallet.service');
const { requireAuth, requireAdmin } = require('../middlewares/auth.middleware');
const { depositLimiter } = require('../middlewares/rateLimit.middleware');
const AuditService = require('../services/audit.service');

const handle = fn => async (req, res, next) => {
  try {
    await fn(req, res);
  } catch (e) {
    if (e.status) return res.status(e.status).json({ error: e.message });
    next(e);
  }
};

// ── GET /api/users (admin) ────────────────────────────────
router.get('/', requireAdmin, handle(async (req, res) => {
  res.json(UsersRepo.findAllWithStats());
}));

// ── DELETE /api/users/:id (admin) ────────────────────────
router.delete('/:id', requireAdmin, handle(async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (!id || id <= 0) return res.status(400).json({ error: 'ID inválido.' });
  UsersRepo.deleteById(id);
  AuditService.adminAction(req, 'USUARIO_EXCLUIDO', {
    resourceType: 'user',
    resourceId: id
  });
  res.json({ ok: true });
}));

// ── GET /api/users/historico ──────────────────────────────
router.get('/historico', requireAuth, handle(async (req, res) => {
  if (req.user.role === 'admin') return res.json([]);
  res.json(HistoricoRepo.findByUser(req.user.id));
}));

// ── GET /api/users/ranking ────────────────────────────────
router.get('/ranking', requireAuth, handle(async (req, res) => {
  res.json(UsersRepo.ranking());
}));

// ── POST /api/users/deposito ──────────────────────────────
router.post('/deposito', requireAuth, depositLimiter, handle(async (req, res) => {
  if (req.user.role === 'admin') {
    return res.status(400).json({ error: 'Admin não possui carteira.' });
  }
  const user = WalletService.depositar(req.user.id, req.body.valor);
  res.json({ ok: true, saldo: user.saldo });
}));

// ── POST /api/users/saque ─────────────────────────────────
router.post('/saque', requireAuth, depositLimiter, handle(async (req, res) => {
  if (req.user.role === 'admin') {
    return res.status(400).json({ error: 'Admin não possui carteira.' });
  }
  WalletService.solicitarSaque(req.user.id, req.body.amount, req.body.pixKey);
  res.json({ ok: true });
}));

// ── GET /api/users/saques ─────────────────────────────────
router.get('/saques', requireAuth, handle(async (req, res) => {
  const db = require('../db/database');
  const list = db.prepare(`
    SELECT * FROM withdrawals 
    WHERE user_id = ? 
    ORDER BY created_at DESC 
    LIMIT 5
  `).all(req.user.id);
  res.json(list);
}));

module.exports = router;
