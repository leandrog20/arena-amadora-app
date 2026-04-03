const router = require('express').Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../db/database');

const SECRET = process.env.JWT_SECRET || 'arena_amadora_secret_2024';
const COOKIE_OPTS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax',
  maxAge: 7 * 24 * 60 * 60 * 1000 // 7 dias
};

// ── POST /api/auth/register ───────────────────────────────
router.post('/register', async (req, res) => {
  try {
    const { name, phone, password } = req.body;
    if (!name || !phone || !password)
      return res.status(400).json({ error: 'Preencha todos os campos.' });
    if (password.length < 6)
      return res.status(400).json({ error: 'Senha deve ter ao menos 6 caracteres.' });
    if (name.toLowerCase() === 'admin')
      return res.status(400).json({ error: 'Este nome não é permitido.' });

    const exists = db.prepare('SELECT id FROM users WHERE name = ?').get(name);
    if (exists) return res.status(400).json({ error: 'Este nome já está em uso.' });

    const hash = await bcrypt.hash(password, 10);
    db.prepare('INSERT INTO users (name, phone, password) VALUES (?,?,?)').run(name, phone, hash);

    res.json({ ok: true, message: 'Conta criada com sucesso!' });
  } catch (e) {
    res.status(500).json({ error: 'Erro interno.' });
  }
});

// ── POST /api/auth/login ──────────────────────────────────
router.post('/login', async (req, res) => {
  try {
    const { name, password } = req.body;
    if (!name || !password)
      return res.status(400).json({ error: 'Preencha todos os campos.' });

    // Admin hardcoded (senha via env)
    const ADMIN_PASS = process.env.ADMIN_PASSWORD || 'admin123';
    if (name.toLowerCase() === 'admin') {
      if (password !== ADMIN_PASS)
        return res.status(401).json({ error: 'Credenciais inválidas.' });
      const token = jwt.sign({ id: 0, name: 'admin', role: 'admin' }, SECRET, { expiresIn: '7d' });
      res.cookie('aa_token', token, COOKIE_OPTS);
      return res.json({ ok: true, role: 'admin', name: 'admin' });
    }

    const user = db.prepare('SELECT * FROM users WHERE name = ?').get(name);
    if (!user) return res.status(401).json({ error: 'Nome ou senha incorretos.' });

    const ok = await bcrypt.compare(password, user.password);
    if (!ok) return res.status(401).json({ error: 'Nome ou senha incorretos.' });

    const token = jwt.sign({ id: user.id, name: user.name, role: user.role }, SECRET, { expiresIn: '7d' });
    res.cookie('aa_token', token, COOKIE_OPTS);
    res.json({ ok: true, role: user.role, name: user.name });
  } catch (e) {
    res.status(500).json({ error: 'Erro interno.' });
  }
});

// ── POST /api/auth/logout ─────────────────────────────────
router.post('/logout', (req, res) => {
  res.clearCookie('aa_token');
  res.json({ ok: true });
});

// ── GET /api/auth/me ──────────────────────────────────────
router.get('/me', requireAuth, (req, res) => {
  if (req.user.role === 'admin') return res.json({ name: 'admin', role: 'admin', saldo: 0 });
  const user = db.prepare('SELECT id, name, phone, role, saldo, created_at FROM users WHERE id = ?').get(req.user.id);
  if (!user) return res.status(404).json({ error: 'Usuário não encontrado.' });
  res.json(user);
});

// ── Middleware ────────────────────────────────────────────
function requireAuth(req, res, next) {
  const token = req.cookies?.aa_token;
  if (!token) return res.status(401).json({ error: 'Não autenticado.' });
  try {
    req.user = jwt.verify(token, SECRET);
    next();
  } catch {
    res.status(401).json({ error: 'Sessão expirada. Faça login novamente.' });
  }
}

function requireAdmin(req, res, next) {
  const token = req.cookies?.aa_token;
  if (!token) return res.status(401).json({ error: 'Não autenticado.' });
  try {
    req.user = jwt.verify(token, SECRET);
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Acesso negado.' });
    next();
  } catch {
    res.status(401).json({ error: 'Sessão expirada.' });
  }
}

module.exports = router;
module.exports.requireAuth = requireAuth;
module.exports.requireAdmin = requireAdmin;
