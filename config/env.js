/**
 * config/env.js
 * Valida e centraliza todas as variáveis de ambiente.
 * Falha em startup se algo crítico estiver faltando — nunca silenciosamente.
 */

'use strict';

const NODE_ENV = process.env.NODE_ENV || 'development';
const isProd   = NODE_ENV === 'production';

// ── JWT ───────────────────────────────────────────────────
const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET) {
  if (isProd) {
    throw new Error('[FATAL] JWT_SECRET não definido. Defina a variável de ambiente antes de iniciar em produção.');
  }
  console.warn('[WARN] JWT_SECRET não definido. Usando fallback de desenvolvimento — NUNCA use assim em produção!');
}

// ── Admin ─────────────────────────────────────────────────
const ADMIN_PASSWORD      = process.env.ADMIN_PASSWORD;
const ADMIN_PASSWORD_HASH = process.env.ADMIN_PASSWORD_HASH;

if (!ADMIN_PASSWORD && !ADMIN_PASSWORD_HASH) {
  console.warn('[WARN] ADMIN_PASSWORD / ADMIN_PASSWORD_HASH não definidos. Usando senha padrão — troque em produção!');
}

// ── CORS ─────────────────────────────────────────────────
const ALLOWED_ORIGINS = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',').map(o => o.trim())
  : ['http://localhost:3000', 'http://127.0.0.1:3000'];

module.exports = {
  NODE_ENV,
  isProd,
  PORT: parseInt(process.env.PORT || '3000', 10),

  // JWT
  JWT_SECRET:     JWT_SECRET || 'arena_amadora_dev_secret_NAO_USE_EM_PRODUCAO',
  JWT_EXPIRES_IN: '7d',

  // Admin
  ADMIN_PASSWORD:      ADMIN_PASSWORD      || 'admin123',
  ADMIN_PASSWORD_HASH: ADMIN_PASSWORD_HASH || null,

  // CORS
  ALLOWED_ORIGINS,

  // Cookie
  COOKIE_NAME: 'aa_token',
  COOKIE_OPTS: {
    httpOnly: true,
    secure:   isProd,
    sameSite: isProd ? 'strict' : 'lax',
    maxAge:   7 * 24 * 60 * 60 * 1000 // 7 dias
  }
};
