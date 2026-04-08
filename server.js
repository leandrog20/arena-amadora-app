/**
 * server.js
 * Bootstrap do servidor Express.
 * Middlewares de segurança, rotas e error handler global.
 */

'use strict';

require('dotenv').config();

const express      = require('express');
const helmet       = require('helmet');
const cors         = require('cors');
const cookieParser = require('cookie-parser');
const path         = require('path');
const env          = require('./config/env');
const { apiLimiter } = require('./middlewares/rateLimit.middleware');
const { requestContext } = require('./middlewares/request.middleware');
const Logger = require('./services/logger.service');

const app = express();

// Estado simples de liveness/readiness para orquestradores
let isShuttingDown = false;

// ── Segurança: Headers HTTP ───────────────────────────────
app.use(helmet({
  contentSecurityPolicy: false,  // desativado para simplificar (ativar em prod com config correta)
  crossOriginEmbedderPolicy: false
}));

// ── CORS ─────────────────────────────────────────────────
app.use(cors({
  origin(origin, callback) {
    // Permite requests sem origin (Postman, SSR) e as origens configuradas
    if (!origin || env.ALLOWED_ORIGINS.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error(`CORS: Origin ${origin} não permitida.`));
    }
  },
  credentials: true
}));

// ── Body + Cookies ────────────────────────────────────────
app.use(express.json({ limit: '1mb' }));
app.use(cookieParser());
app.use(requestContext);

// ── Rate Limit global na API ──────────────────────────────
app.use('/api', apiLimiter);

// ── Arquivos estáticos ────────────────────────────────────
app.use(express.static(path.join(__dirname, 'public')));

<<<<<<< HEAD
// ── Rotas da API ──────────────────────────────────────────
app.get('/api/health', (req, res) => {
  if (isShuttingDown) {
    return res.status(503).json({ status: 'shutting_down' });
  }
  res.json({ status: 'ok', uptime: process.uptime(), env: env.NODE_ENV });
});

app.use('/api/auth',     require('./routes/auth'));
app.use('/api/torneios', require('./routes/torneios'));
app.use('/api/users',    require('./routes/users'));
app.use('/api/matches',  require('./routes/matches'));
app.use('/api/config',   require('./routes/config'));
app.use('/api/withdrawals', require('./routes/withdrawals'));
app.use('/api/realtime', require('./routes/realtime'));
app.use('/api/audit', require('./routes/audit'));
=======
// ── API Routes ────────────────────────────────────────────
app.use('/api/auth', require('./routes/auth'));
app.use('/api/torneios', require('./routes/torneios'));
app.use('/api/users', require('./routes/users'));
app.use('/api/config', require('./routes/config'));
>>>>>>> upstream/main

// ── 404 para rotas API desconhecidas ─────────────────────
app.use('/api/*', (req, res) => {
  res.status(404).json({ error: 'Endpoint não encontrado.' });
});

// ── Fallback SPA ──────────────────────────────────────────
app.get(/^(?!\/api).*/, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

// ── Error Handler Global ──────────────────────────────────
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  // CORS error
  if (err.message?.startsWith('CORS:')) {
    return res.status(403).json({ error: err.message });
  }

  // Erros não tratados — nunca expor detalhes em produção
  Logger.error('unhandled_error', {
    requestId: req.requestId,
    method: req.method,
    path: req.originalUrl,
    message: err.message,
    stack: env.isProd ? undefined : err.stack
  });
  res.status(500).json({
    error: env.isProd ? 'Erro interno do servidor.' : err.message
  });
});

<<<<<<< HEAD
// ── Start ─────────────────────────────────────────────────
const server = app.listen(env.PORT, () => {
  console.log(`🏆 Arena Amadora rodando em http://localhost:${env.PORT} [${env.NODE_ENV}]`);
  if (!env.isProd) {
    console.log('⚠️  Modo desenvolvimento — configure .env para produção');
  }
});

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`[BOOT] Porta ${env.PORT} já está em uso. Defina outra porta via PORT.`);
    process.exit(1);
  }
  console.error('[BOOT] Falha ao iniciar servidor:', err.message);
  process.exit(1);
});

function gracefulShutdown(signal) {
  if (isShuttingDown) return;
  isShuttingDown = true;
  Logger.warn('shutdown_start', { signal });

  server.close((err) => {
    if (err) {
      Logger.error('shutdown_error', { message: err.message });
      process.exit(1);
    }
    Logger.info('shutdown_complete');
    process.exit(0);
  });

  setTimeout(() => {
    Logger.error('shutdown_timeout');
    process.exit(1);
  }, 10000).unref();
=======
if (process.env.NODE_ENV !== 'production') {
  require('dotenv').config()
>>>>>>> upstream/main
}

process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));

module.exports = app;
