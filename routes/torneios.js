/**
 * routes/torneios.js
 * Apenas mapeamento HTTP → service. Sem lógica de negócio.
 */

'use strict';

const router          = require('express').Router();
const TorneiosService = require('../services/torneios.service');
const { requireAuth, requireAdmin } = require('../middlewares/auth.middleware');
const AuditService = require('../services/audit.service');

/** Handler wrapper: captura erros de serviço e retorna JSON correto */
const handle = fn => async (req, res, next) => {
  try {
    await fn(req, res);
  } catch (e) {
    if (e.status) return res.status(e.status).json({ error: e.message });
    next(e);
  }
};

// ── GET /api/torneios ─────────────────────────────────────
router.get('/', requireAuth, handle(async (req, res) => {
  const torneios = TorneiosService.listar(req.user.id);
  res.json(torneios);
}));

// ── POST /api/torneios (admin) ────────────────────────────
router.post('/', requireAdmin, handle(async (req, res) => {
  const result = TorneiosService.criar(req.body);
  AuditService.adminAction(req, 'TORNEIO_CRIADO', {
    resourceType: 'torneio',
    resourceId: result.id,
    details: { nome: req.body?.nome, jogo: req.body?.jogo }
  });
  res.status(201).json({ ok: true, ...result });
}));

// ── DELETE /api/torneios/:id (admin) ─────────────────────
router.delete('/:id', requireAdmin, handle(async (req, res) => {
  TorneiosService.excluir(req.params.id);
  AuditService.adminAction(req, 'TORNEIO_EXCLUIDO', {
    resourceType: 'torneio',
    resourceId: req.params.id
  });
  res.json({ ok: true });
}));

// ──  POST /api/torneios/:id/start (admin) ─────────────────
router.post('/:id/start', requireAdmin, handle(async (req, res) => {
  const { BracketService } = require('../services/bracket.service');
  TorneiosService.atualizarStatus(req.params.id, 'em_andamento');
  BracketService.gerarChaveamento(req.params.id);
  AuditService.adminAction(req, 'TORNEIO_INICIADO', {
    resourceType: 'torneio',
    resourceId: req.params.id
  });
  res.json({ ok: true, message: 'Torneio iniciado! Chaves geradas.' });
}));

// ── PATCH /api/torneios/:id/status (admin) ───────────────
router.patch('/:id/status', requireAdmin, handle(async (req, res) => {
  TorneiosService.atualizarStatus(req.params.id, req.body.status);
  AuditService.adminAction(req, 'TORNEIO_STATUS_ALTERADO', {
    resourceType: 'torneio',
    resourceId: req.params.id,
    details: { status: req.body?.status }
  });
  res.json({ ok: true });
}));

// ── GET /api/torneios/:id/inscritos (admin) ───────────────
router.get('/:id/inscritos', requireAdmin, handle(async (req, res) => {
  const inscritos = TorneiosService.listarInscritos(req.params.id);
  res.json(inscritos);
}));

// ── POST /api/torneios/:id/inscrever ─────────────────────
router.post('/:id/inscrever', requireAuth, handle(async (req, res) => {
  TorneiosService.inscrever(req.params.id, req.user);
  res.json({ ok: true });
}));

module.exports = router;
