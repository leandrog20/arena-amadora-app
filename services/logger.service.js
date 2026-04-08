/**
 * services/logger.service.js
 * Logger simples em JSON para observabilidade.
 */

'use strict';

function safeStringify(payload) {
  try {
    return JSON.stringify(payload);
  } catch {
    return JSON.stringify({ level: 'error', message: 'Falha ao serializar log' });
  }
}

function base(level, message, meta = {}) {
  const entry = {
    ts: new Date().toISOString(),
    level,
    message,
    ...meta
  };
  return safeStringify(entry);
}

const Logger = {
  info(message, meta = {}) {
    console.log(base('info', message, meta));
  },

  warn(message, meta = {}) {
    console.warn(base('warn', message, meta));
  },

  error(message, meta = {}) {
    console.error(base('error', message, meta));
  }
};

module.exports = Logger;
