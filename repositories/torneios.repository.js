/**
 * repositories/torneios.repository.js
 * Todas as queries SQL relacionadas a torneios e inscrições.
 */

'use strict';

const db = require('../db/database');

const TorneiosRepository = {

  /** Lista todos os torneios com contagem de inscrições (sem N+1) */
  findAllWithCount() {
    return db.prepare(`
      SELECT t.*,
             COUNT(i.id) AS inscricoes_count
      FROM torneios t
      LEFT JOIN inscricoes i ON i.torneio_id = t.id
      GROUP BY t.id
      ORDER BY t.created_at DESC
    `).all();
  },

  /** Busca torneio por ID */
  findById(id) {
    return db.prepare('SELECT * FROM torneios WHERE id = ?').get(id);
  },

  /** Cria novo torneio */
  create({ id, nome, jogo, data_txt, vagas, taxa, premio, formato, regras }) {
    return db.prepare(`
      INSERT INTO torneios (id, nome, jogo, data_txt, vagas, taxa, premio, formato, regras)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id, nome, jogo, data_txt, vagas, taxa, premio, formato, regras);
  },

  /** Deleta torneio por ID */
  deleteById(id) {
    return db.prepare('DELETE FROM torneios WHERE id = ?').run(id);
  },

  /** Atualiza status do torneio */
  updateStatus(id, status) {
    return db.prepare('UPDATE torneios SET status = ? WHERE id = ?').run(status, id);
  },

  /** Retorna o Set de IDs de torneios em que um usuário está inscrito */
  inscritosSetByUser(userId) {
    if (!userId) return new Set();
    const rows = db.prepare(
      'SELECT torneio_id FROM inscricoes WHERE user_id = ?'
    ).all(userId);
    return new Set(rows.map(r => r.torneio_id));
  },

  /** Conta inscrições em um torneio */
  countInscricoes(torneioId) {
    return db.prepare(
      'SELECT COUNT(*) AS c FROM inscricoes WHERE torneio_id = ?'
    ).get(torneioId).c;
  },

  /** Verifica se usuário já está inscrito no torneio */
  isInscrito(torneioId, userId) {
    return !!db.prepare(
      'SELECT 1 FROM inscricoes WHERE torneio_id = ? AND user_id = ?'
    ).get(torneioId, userId);
  },

  /** Lista inscritos de um torneio com dados do usuário */
  findInscritos(torneioId) {
    return db.prepare(`
      SELECT u.id, u.name, u.phone, i.created_at
      FROM inscricoes i
      JOIN users u ON u.id = i.user_id
      WHERE i.torneio_id = ?
      ORDER BY i.created_at
    `).all(torneioId);
  },

  /** Cria inscrição */
  createInscricao(torneioId, userId) {
    return db.prepare(
      'INSERT INTO inscricoes (torneio_id, user_id) VALUES (?, ?)'
    ).run(torneioId, userId);
  },

};

module.exports = TorneiosRepository;
