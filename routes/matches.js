/**
 * routes/matches.js
 * Rotas expostas para as partidas e confirmações de resultado.
 */

'use strict';

const router         = require('express').Router();
const MatchService   = require('../services/match.service');
const MatchesRepo    = require('../repositories/matches.repository');
const { requireAuth, requireAdmin } = require('../middlewares/auth.middleware');
const AuditService = require('../services/audit.service');

const handle = fn => async (req, res, next) => {
  try {
    await fn(req, res);
  } catch (e) {
    if (e.status) return res.status(e.status).json({ error: e.message });
    next(e);
  }
};

// ── GET /api/matches/torneio/:id (Todos) ──────────────────────────
// Lista todas as partidas/chaves de um torneio
router.get('/torneio/:id', requireAuth, handle(async (req, res) => {
  const matches = MatchesRepo.findByTorneio(req.params.id);
  res.json(matches);
}));

// ── POST /api/matches/:id/report (Jogador) ─────────────────────────
// Jogador reporta quem venceu e adiciona link de prova
router.post('/:id/report', requireAuth, handle(async (req, res) => {
  const { winnerId, proofUrl } = req.body;
  if (!winnerId) return res.status(400).json({ error: 'Informe o vencedor.' });

  MatchService.reportResult(req.params.id, req.user.id, winnerId, proofUrl);
  res.json({ ok: true, message: 'Resultado enviado! Aguardando o adversário.' });
}));

// ── POST /api/matches/:id/dispute (Jogador) ────────────────────────
router.post('/:id/dispute', requireAuth, handle(async (req, res) => {
  MatchService.disputeResult(req.params.id, req.user.id);
  res.json({ ok: true, message: 'Disputa aberta. O Admin analisará as provas.' });
}));

// ── POST /api/matches/:id/resolve (Admin) ──────────────────────────
// Admin define imperativamente quem ganhou
router.post('/:id/resolve', requireAdmin, handle(async (req, res) => {
  const { winnerId } = req.body;
  if (winnerId === undefined) return res.status(400).json({ error: 'Faltam dados: winnerId é obrigatório.' });

  MatchService.resolveAdmin(req.params.id, winnerId);
  AuditService.adminAction(req, 'PARTIDA_RESOLVIDA_ADMIN', {
    resourceType: 'match',
    resourceId: req.params.id,
    details: { winnerId }
  });
  res.json({ ok: true });
}));

module.exports = router;
