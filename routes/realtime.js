/**
 * routes/realtime.js
 * Endpoint SSE para eventos em tempo-real.
 */

'use strict';

const express = require('express');
const router  = express.Router();
const jwt     = require('jsonwebtoken');
const env     = require('../config/env');
const RealtimeService = require('../services/realtime.service');

router.get('/events', (req, res) => {
  const token = req.cookies?.[env.COOKIE_NAME] || req.headers.authorization?.split(' ')[1];
  
  if (!token) {
    return res.status(401).end();
  }

  try {
    const decoded = jwt.verify(token, env.JWT_SECRET);
    const userId  = decoded.id;

    // Configuração Handshake SSE
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no'); // Desativa buffer em Nginx
    res.flushHeaders();

    // Adiciona ao hub
    RealtimeService.addClient(userId, res);

    // Keep-alive heartbeat (a cada 30s)
    const keepAlive = setInterval(() => {
      res.write(': keep-alive\n\n');
    }, 30000);

    res.on('close', () => {
      clearInterval(keepAlive);
    });

  } catch (err) {
    return res.status(401).end();
  }
});

module.exports = router;
