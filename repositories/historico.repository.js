/**
 * repositories/historico.repository.js
 * Queries de histórico/transações financeiras.
 */

'use strict';

const db = require('../db/database');

const HistoricoRepository = {

  /** Histórico do usuário (últimas N transações) */
  findByUser(userId, limit = 20) {
    return db.prepare(`
      SELECT * FROM historico
      WHERE user_id = ?
      ORDER BY created_at DESC
      LIMIT ?
    `).all(userId, limit);
  },

  /** Cria registro de transação */
  create({ userId, tipo, descricao, valor }) {
    return db.prepare(
      'INSERT INTO historico (user_id, tipo, descricao, valor) VALUES (?, ?, ?, ?)'
    ).run(userId, tipo, descricao, valor);
  },

};

module.exports = HistoricoRepository;
