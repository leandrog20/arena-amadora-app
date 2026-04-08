/**
 * middlewares/auth.middleware.js
 * requireAuth e requireAdmin extraídos de auth.js para uso centralizado.
 */

'use strict';

const jwt  = require('jsonwebtoken');
const env  = require('../config/env');

/**
 * Verifica token JWT e popula req.user.
 * Retorna 401 se ausente ou inválido.
 */
function requireAuth(req, res, next) {
  const token = req.cookies?.[env.COOKIE_NAME];
  if (!token) return res.status(401).json({ error: 'Não autenticado.' });

  try {
    req.user = jwt.verify(token, env.JWT_SECRET);
    next();
  } catch (err) {
    const msg = err.name === 'TokenExpiredError'
      ? 'Sessão expirada. Faça login novamente.'
      : 'Token inválido.';
    res.clearCookie(env.COOKIE_NAME);
    res.status(401).json({ error: msg });
  }
}

/**
 * Verifica token JWT e exige role === 'admin'.
 * Retorna 401 ou 403 conforme o caso.
 */
function requireAdmin(req, res, next) {
  const token = req.cookies?.[env.COOKIE_NAME];
  if (!token) return res.status(401).json({ error: 'Não autenticado.' });

  try {
    req.user = jwt.verify(token, env.JWT_SECRET);
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Acesso negado. Requer perfil admin.' });
    }
    next();
  } catch (err) {
    const msg = err.name === 'TokenExpiredError'
      ? 'Sessão expirada. Faça login novamente.'
      : 'Token inválido.';
    res.clearCookie(env.COOKIE_NAME);
    res.status(401).json({ error: msg });
  }
}

module.exports = { requireAuth, requireAdmin };
