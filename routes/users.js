const router = require('express').Router();
const db = require('../db/database');
const { requireAuth, requireAdmin } = require('./auth');

// ── GET /api/users (admin) ────────────────────────────────
router.get('/', requireAdmin, (req, res) => {
  const users = db.prepare(`
    SELECT u.id, u.name, u.phone, u.role, u.saldo, u.created_at,
      COUNT(i.id) as inscricoes_count
    FROM users u
    LEFT JOIN inscricoes i ON i.user_id = u.id
    GROUP BY u.id
    ORDER BY u.created_at DESC
  `).all();
  res.json(users);
});

// ── DELETE /api/users/:id (admin) ────────────────────────
router.delete('/:id', requireAdmin, (req, res) => {
  db.prepare('DELETE FROM users WHERE id=?').run(req.params.id);
  res.json({ ok: true });
});

// ── GET /api/users/historico ──────────────────────────────
router.get('/historico', requireAuth, (req, res) => {
  if (req.user.role === 'admin') return res.json([]);
  const hist = db.prepare(`
    SELECT * FROM historico WHERE user_id=? ORDER BY created_at DESC LIMIT 20
  `).all(req.user.id);
  res.json(hist);
});

// ── GET /api/users/ranking ────────────────────────────────
router.get('/ranking', requireAuth, (req, res) => {
  const ranking = db.prepare(`
    SELECT u.name, COUNT(i.id) as inscricoes, u.saldo
    FROM users u
    LEFT JOIN inscricoes i ON i.user_id = u.id
    GROUP BY u.id
    ORDER BY inscricoes DESC, u.saldo DESC
    LIMIT 20
  `).all();
  res.json(ranking);
});

// ── POST /api/users/deposito (simula depósito PIX) ────────
router.post('/deposito', requireAuth, (req, res) => {
  if (req.user.role === 'admin') return res.status(400).json({ error: 'Admin não tem carteira.' });
  const { valor } = req.body;
  if (!valor || valor <= 0 || valor > 1000)
    return res.status(400).json({ error: 'Valor inválido.' });

  db.prepare('UPDATE users SET saldo = saldo + ? WHERE id=?').run(valor, req.user.id);
  db.prepare('INSERT INTO historico (user_id, tipo, descricao, valor) VALUES (?,?,?,?)').run(
    req.user.id, 'credito', 'Depósito via PIX', valor
  );

  const user = db.prepare('SELECT saldo FROM users WHERE id=?').get(req.user.id);
  res.json({ ok: true, saldo: user.saldo });
});

module.exports = router;
