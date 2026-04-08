/**
 * middlewares/rateLimit.middleware.js
 * Limitadores de taxa por endpoint crítico.
 */

'use strict';

const rateLimit = require('express-rate-limit');

const handler = (req, res) => {
  res.status(429).json({ error: 'Muitas tentativas. Aguarde alguns minutos e tente novamente.' });
};

/** Login: 10 tentativas por 15 minutos por IP */
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  handler
});

/** Cadastro: 5 cadastros por hora por IP */
const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  handler
});

/** Depósito: 5 depósitos por minuto por IP */
const depositLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  handler
});

/** API geral: 150 requests por minuto por IP */
const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 150,
  standardHeaders: true,
  legacyHeaders: false,
  handler
});

module.exports = { loginLimiter, registerLimiter, depositLimiter, apiLimiter };
