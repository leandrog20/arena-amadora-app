const router = require('express').Router();
const db = require('../db/database');
const { requireAuth, requireAdmin } = require('./auth');
const { randomUUID } = require('crypto');

// ── GET /api/torneios ─────────────────────────────────────
router.get('/', requireAuth, (req, res) => {
  const torneios = db.prepare(`
    SELECT t.*,
      COUNT(i.id) as inscricoes_count
    FROM torneios t
    LEFT JOIN inscricoes i ON i.torneio_id = t.id
    GROUP BY t.id
    ORDER BY t.created_at DESC
  `).all();

  // Adicionar se o usuário atual está inscrito
  const userId = req.user.id;
  const result = torneios.map(t => ({
    ...t,
    inscrito: userId ? !!db.prepare('SELECT 1 FROM inscricoes WHERE torneio_id=? AND user_id=?').get(t.id, userId) : false
  }));

  res.json(result);
});

// ── POST /api/torneios (admin) ────────────────────────────
router.post('/', requireAdmin, (req, res) => {
  const { nome, jogo, data_txt, vagas, taxa, premio, formato, regras } = req.body;
  if (!nome || !jogo) return res.status(400).json({ error: 'Nome e jogo são obrigatórios.' });

  const id = 'T' + Date.now();
  db.prepare(`
    INSERT INTO torneios (id, nome, jogo, data_txt, vagas, taxa, premio, formato, regras)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, nome, jogo, data_txt||'A definir', vagas||32, taxa||0, premio||0, formato||'eliminatorio', regras||'');

  res.json({ ok: true, id });
});

// ── DELETE /api/torneios/:id (admin) ─────────────────────
router.delete('/:id', requireAdmin, (req, res) => {
  db.prepare('DELETE FROM torneios WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

// ── PATCH /api/torneios/:id/status (admin) ───────────────
router.patch('/:id/status', requireAdmin, (req, res) => {
  const { status } = req.body;
  db.prepare('UPDATE torneios SET status=? WHERE id=?').run(status, req.params.id);
  res.json({ ok: true });
});

// ── GET /api/torneios/:id/inscritos (admin) ───────────────
router.get('/:id/inscritos', requireAdmin, (req, res) => {
  const inscritos = db.prepare(`
    SELECT u.name, u.phone, i.created_at
    FROM inscricoes i
    JOIN users u ON u.id = i.user_id
    WHERE i.torneio_id = ?
    ORDER BY i.created_at
  `).all(req.params.id);
  res.json(inscritos);
});

// ── POST /api/torneios/:id/inscrever ─────────────────────
router.post('/:id/inscrever', requireAuth, (req, res) => {
  if (req.user.role === 'admin') return res.status(400).json({ error: 'Admin não pode se inscrever.' });

  const torneio = db.prepare('SELECT * FROM torneios WHERE id=?').get(req.params.id);
  if (!torneio) return res.status(404).json({ error: 'Torneio não encontrado.' });
  if (torneio.status !== 'aberto') return res.status(400).json({ error: 'Torneio não está aberto.' });

  const count = db.prepare('SELECT COUNT(*) as c FROM inscricoes WHERE torneio_id=?').get(req.params.id).c;
  if (count >= torneio.vagas) return res.status(400).json({ error: 'Torneio lotado.' });

  const jaInscrito = db.prepare('SELECT 1 FROM inscricoes WHERE torneio_id=? AND user_id=?').get(req.params.id, req.user.id);
  if (jaInscrito) return res.status(400).json({ error: 'Você já está inscrito.' });

  const user = db.prepare('SELECT * FROM users WHERE id=?').get(req.user.id);
  if (torneio.taxa > 0 && user.saldo < torneio.taxa)
    return res.status(400).json({ error: `Saldo insuficiente. Você tem R$${user.saldo.toFixed(2)}.` });

  // Transação atômica
  const inscrever = db.transaction(() => {
    db.prepare('INSERT INTO inscricoes (torneio_id, user_id) VALUES (?,?)').run(req.params.id, req.user.id);
    if (torneio.taxa > 0) {
      db.prepare('UPDATE users SET saldo = saldo - ? WHERE id=?').run(torneio.taxa, req.user.id);
      db.prepare('INSERT INTO historico (user_id, tipo, descricao, valor) VALUES (?,?,?,?)').run(
        req.user.id, 'debit', 'Inscrição: ' + torneio.nome, torneio.taxa
      );
    }
  });
  inscrever();

  res.json({ ok: true });
});

module.exports = router;
