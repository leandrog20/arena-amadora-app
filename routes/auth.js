/**
 * routes/auth.js
 * Autenticação: register, login, logout, /me
 * Lógica de negócio delegada ao service — aqui só HTTP.
 */

'use strict';

const router  = require('express').Router();
const bcrypt  = require('bcryptjs');
const jwt     = require('jsonwebtoken');
const db      = require('../db/database');
const env     = require('../config/env');
const UsersRepo = require('../repositories/users.repository');
const { loginLimiter, registerLimiter } = require('../middlewares/rateLimit.middleware');
const { requireAuth } = require('../middlewares/auth.middleware');

// ── POST /api/auth/register ───────────────────────────────
router.post('/register', registerLimiter, async (req, res, next) => {
  try {
    const { name, phone, password } = req.body;

    if (!name || !phone || !password)
      return res.status(400).json({ error: 'Preencha todos os campos.' });

    const nameTrimmed = name.trim();

    if (nameTrimmed.length < 3 || nameTrimmed.length > 30)
      return res.status(400).json({ error: 'Nome deve ter entre 3 e 30 caracteres.' });

    if (password.length < 6)
      return res.status(400).json({ error: 'Senha deve ter ao menos 6 caracteres.' });

    if (nameTrimmed.toLowerCase() === 'admin')
      return res.status(400).json({ error: 'Este nome não é permitido.' });

    if (UsersRepo.findByName(nameTrimmed))
      return res.status(400).json({ error: 'Este nome já está em uso.' });

    const passwordHash = await bcrypt.hash(password, 12); // 12 rounds (mais seguro que 10)
    UsersRepo.create({ name: nameTrimmed, phone: phone.trim(), passwordHash });

    res.status(201).json({ ok: true, message: 'Conta criada com sucesso!' });
  } catch (e) {
    next(e);
  }
});

// ── POST /api/auth/login ──────────────────────────────────
router.post('/login', loginLimiter, async (req, res, next) => {
  try {
    const { name, password } = req.body;

    if (!name || !password)
      return res.status(400).json({ error: 'Preencha todos os campos.' });

    // ── Admin ──────────────────────────────────────────────
    if (name.trim().toLowerCase() === 'admin') {
      let adminOk = false;

      if (env.ADMIN_PASSWORD_HASH) {
        // Modo produção: comparar com hash bcrypt
        adminOk = await bcrypt.compare(password, env.ADMIN_PASSWORD_HASH);
      } else {
        // Modo dev: senha plain (com aviso no log)
        adminOk = (password === env.ADMIN_PASSWORD);
        if (adminOk) {
          console.warn('[WARN] Admin autenticado com senha plain. Defina ADMIN_PASSWORD_HASH em produção!');
        }
      }

      if (!adminOk)
        return res.status(401).json({ error: 'Credenciais inválidas.' });

      const token = jwt.sign(
        { id: 0, name: 'admin', role: 'admin' },
        env.JWT_SECRET,
        { expiresIn: env.JWT_EXPIRES_IN }
      );
      res.cookie(env.COOKIE_NAME, token, env.COOKIE_OPTS);
      return res.json({ ok: true, role: 'admin', name: 'admin' });
    }

    // ── Usuário comum ──────────────────────────────────────
    const user = UsersRepo.findByName(name.trim());

    // Timing-safe: sempre roda bcrypt mesmo se user não existir (evita user enumeration)
    const dummyHash = '$2a$12$invalidhashtopreventtimingattack1234567890ABCDEF';
    const ok = user
      ? await bcrypt.compare(password, user.password)
      : await bcrypt.compare(password, dummyHash).then(() => false);

    if (!user || !ok)
      return res.status(401).json({ error: 'Nome ou senha incorretos.' });

    const token = jwt.sign(
      { id: user.id, name: user.name, role: user.role },
      env.JWT_SECRET,
      { expiresIn: env.JWT_EXPIRES_IN }
    );
    res.cookie(env.COOKIE_NAME, token, env.COOKIE_OPTS);
    res.json({ ok: true, role: user.role, name: user.name });

  } catch (e) {
    next(e);
  }
});

// ── POST /api/auth/logout ─────────────────────────────────
router.post('/logout', (req, res) => {
  res.clearCookie(env.COOKIE_NAME, { ...env.COOKIE_OPTS, maxAge: 0 });
  res.json({ ok: true });
});

// ── GET /api/auth/me ──────────────────────────────────────
router.get('/me', requireAuth, (req, res, next) => {
  try {
    if (req.user.role === 'admin') {
      return res.json({ id: 0, name: 'admin', role: 'admin', saldo: 0 });
    }

    const user = UsersRepo.findById(req.user.id);
    if (!user) return res.status(404).json({ error: 'Usuário não encontrado.' });

    res.json(user);
  } catch (e) {
    next(e);
  }
});

module.exports = router;
