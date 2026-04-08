const router = require('express').Router();
const db = require('../db/database');
const { requireAdmin } = require('../middlewares/auth.middleware');
const AuditService = require('../services/audit.service');

// ── GET /api/config ───────────────────────────────────────
router.get('/', (req, res) => {
  const rows = db.prepare('SELECT key, value FROM config').all();
  const cfg = {};
  rows.forEach(r => cfg[r.key] = r.value);
  res.json(cfg);
});

// ── PUT /api/config (admin) ───────────────────────────────
router.put('/', requireAdmin, (req, res) => {
  const upsert = db.prepare('INSERT OR REPLACE INTO config (key, value) VALUES (?,?)');
  const update = db.transaction((data) => {
    for (const [key, value] of Object.entries(data)) {
      if (typeof value === 'string') upsert.run(key, value);
    }
  });
  update(req.body);
  AuditService.adminAction(req, 'CONFIG_ATUALIZADA', {
    resourceType: 'config',
    details: { keys: Object.keys(req.body || {}) }
  });
  res.json({ ok: true });
});

// ── GET /api/config/stats (admin) ────────────────────────
router.get('/stats', requireAdmin, (req, res) => {
  const torneios   = db.prepare('SELECT COUNT(*) as c FROM torneios').get().c;
  const usuarios   = db.prepare('SELECT COUNT(*) as c FROM users').get().c;
  const inscricoes = db.prepare('SELECT COUNT(*) as c FROM inscricoes').get().c;
  const receita    = db.prepare(`
    SELECT COALESCE(SUM(t.taxa), 0) as total
    FROM inscricoes i JOIN torneios t ON t.id = i.torneio_id
  `).get().total;
  res.json({ torneios, usuarios, inscricoes, receita });
});

module.exports = router;
