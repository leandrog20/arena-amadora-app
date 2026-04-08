/**
 * middlewares/request.middleware.js
 * Request id e log de ciclo de vida da requisição.
 */

'use strict';

const { randomUUID } = require('crypto');
const Logger = require('../services/logger.service');

function requestContext(req, res, next) {
  req.requestId = randomUUID();
  req.startedAt = Date.now();
  res.setHeader('x-request-id', req.requestId);

  res.on('finish', () => {
    const durationMs = Date.now() - req.startedAt;
    Logger.info('http_request', {
      requestId: req.requestId,
      method: req.method,
      path: req.originalUrl,
      statusCode: res.statusCode,
      durationMs,
      userId: req.user?.id ?? null,
      role: req.user?.role ?? null,
      ip: req.ip
    });
  });

  next();
}

module.exports = { requestContext };
