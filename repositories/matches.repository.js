/**
 * repositories/matches.repository.js
 * Centraliza queries relacionadas a matches e seus resultados.
 */

'use strict';

const db = require('../db/database');

const MatchesRepository = {

  /** Lista todas as partidas de um torneio */
  findByTorneio(torneioId) {
    return db.prepare(`
      SELECT m.*,
             u1.name as p1_name,
             u2.name as p2_name,
             w.name as winner_name
      FROM matches m
      LEFT JOIN users u1 ON u1.id = m.player1_id
      LEFT JOIN users u2 ON u2.id = m.player2_id
      LEFT JOIN users w ON w.id = m.winner_id
      WHERE m.torneio_id = ?
      ORDER BY m.round ASC, m.match_number ASC
    `).all(torneioId);
  },

  /** Busca partida pelo ID com info dos jogadores */
  findById(id) {
    return db.prepare(`
      SELECT m.*, 
             t.nome as torneio_nome,
             u1.name as p1_name,
             u2.name as p2_name
      FROM matches m
      JOIN torneios t ON t.id = m.torneio_id
      LEFT JOIN users u1 ON u1.id = m.player1_id
      LEFT JOIN users u2 ON u2.id = m.player2_id
      WHERE m.id = ?
    `).get(id);
  },

  /** Cria múltiplas partidas (usado pela geração de brackets) */
  createMany(matchesArray) {
    const insert = db.prepare(`
      INSERT INTO matches (torneio_id, round, match_number, player1_id, player2_id)
      VALUES (?, ?, ?, ?, ?)
    `);

    db.transaction(() => {
      for (const m of matchesArray) {
        insert.run(m.torneio_id, m.round, m.match_number, m.player1_id, m.player2_id);
      }
    })();
  },

  /** Insere um registro de report de resultado de partida */
  createResultReport({ matchId, reportedBy, claimedWinner, proofUrl }) {
    db.transaction(() => {
      db.prepare(`
        INSERT INTO match_results (match_id, reported_by, claimed_winner, proof_url)
        VALUES (?, ?, ?, ?)
      `).run(matchId, reportedBy, claimedWinner, proofUrl || null);

      // Muda o status da partida para "awaiting_result" (dupla confirmação)
      db.prepare(`UPDATE matches SET status = 'awaiting_result' WHERE id = ?`).run(matchId);
    })();
  },

  /** Aceita a vitória diretamente (confirmação do oponente ou admin) */
  confirmWinner(matchId, winnerId) {
    db.prepare(`
      UPDATE matches 
      SET status = 'finished', winner_id = ?
      WHERE id = ?
    `).run(winnerId, matchId);
  },

  /** Define a partida como "disputada" para o admin analisar */
  markAsDisputed(matchId) {
    db.prepare(`UPDATE matches SET status = 'disputed' WHERE id = ?`).run(matchId);
  },

  /** Procura a partida seguinte que o ganhador deve ocupar */
  findNextMatchSlot(torneioId, currentRound, currentMatchNumber) {
    const nextRound = currentRound + 1;
    const nextMatchNumber = Math.ceil(currentMatchNumber / 2);
    return db.prepare(`
        SELECT * FROM matches 
        WHERE torneio_id = ? AND round = ? AND match_number = ?
    `).get(torneioId, nextRound, nextMatchNumber);
  },

  /** Avança o player para a próxima chave */
  advancePlayer(matchId, playerId, sourceMatchNumber) {
    // Se a partida de onde ele veio era ÍMPAR (1, 3, 5...), ele vai para P1 da próxima
    // Se era PAR (2, 4, 6...), ele vai para P2 da próxima
    const slotIsPlayer1 = (sourceMatchNumber % 2) !== 0;

    const columnToUpdate = slotIsPlayer1 ? 'player1_id' : 'player2_id';

    db.prepare(`UPDATE matches SET ${columnToUpdate} = ? WHERE id = ?`).run(playerId, matchId);
  },

  /** Limpa todas as partidas de um torneio */
  deleteAllByTorneio(torneioId) {
    db.prepare(`DELETE FROM matches WHERE torneio_id = ?`).run(torneioId);
  }

};

module.exports = MatchesRepository;
