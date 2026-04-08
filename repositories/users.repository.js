/**
 * repositories/users.repository.js
 * Todas as queries SQL relacionadas a users em um único lugar.
 * Quando o banco migrar para PostgreSQL/Prisma, só este arquivo muda.
 */

'use strict';

const db = require('../db/database');

const UsersRepository = {

  /** Busca usuário pelo ID (sem senha) */
  findById(id) {
    return db.prepare(
      'SELECT id, name, phone, role, saldo, xp, level, created_at FROM users WHERE id = ?'
    ).get(id);
  },

  /** Busca usuário completo pelo ID (com hash — apenas para auth interna) */
  findByIdFull(id) {
    return db.prepare('SELECT * FROM users WHERE id = ?').get(id);
  },

  /** Busca usuário pelo nome (case-insensitive via COLLATE NOCASE no schema) */
  findByName(name) {
    return db.prepare('SELECT * FROM users WHERE name = ?').get(name);
  },

  /** Cria novo usuário, retorna o lastInsertRowid */
  create({ name, phone, passwordHash }) {
    return db.prepare(
      'INSERT INTO users (name, phone, password) VALUES (?, ?, ?)'
    ).run(name, phone, passwordHash);
  },

  /** Lista todos os usuários com contagem de inscrições */
  findAllWithStats() {
    return db.prepare(`
      SELECT u.id, u.name, u.phone, u.role, u.saldo, u.xp, u.level, u.created_at,
             COUNT(i.id) AS inscricoes_count
      FROM users u
      LEFT JOIN inscricoes i ON i.user_id = u.id
      GROUP BY u.id
      ORDER BY u.created_at DESC
    `).all();
  },

  /** Deleta usuário pelo ID */
  deleteById(id) {
    return db.prepare('DELETE FROM users WHERE id = ?').run(id);
  },

  /** Ranking: top 20 por inscrições */
  ranking(limit = 20) {
    return db.prepare(`
      SELECT u.id, u.name, COUNT(i.id) AS inscricoes, u.saldo
      FROM users u
      LEFT JOIN inscricoes i ON i.user_id = u.id
      GROUP BY u.id
      ORDER BY inscricoes DESC, u.saldo DESC
      LIMIT ?
    `).all(limit);
  },

  /** Credita saldo no usuário */
  creditSaldo(userId, valor) {
    return db.prepare('UPDATE users SET saldo = saldo + ? WHERE id = ?').run(valor, userId);
  },

  /** Debita saldo no usuário */
  debitSaldo(userId, valor) {
    return db.prepare('UPDATE users SET saldo = saldo - ? WHERE id = ?').run(valor, userId);
  },

};

module.exports = UsersRepository;
