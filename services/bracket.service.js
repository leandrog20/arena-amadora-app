/**
 * services/bracket.service.js
 * Lógica pura de geração de chaves (brackets) de eliminação simples.
 */

'use strict';

const TorneiosRepo = require('../repositories/torneios.repository');
const MatchesRepo  = require('../repositories/matches.repository');

/**
 * Função Fisher-Yates para embaralhar o array
 */
function shuffle(array) {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

const BracketService = {

  /**
   * Gera o Bracket completo de Eliminatória Simples com Byes
   * Cria os placeholders em branco (sem jogadores) até a final.
   */
  gerarChaveamento(torneioId) {
    const inscritos = TorneiosRepo.findInscritos(torneioId);
    
    // Se não há inscritos não tem bracket
    if (inscritos.length < 2) {
      throw Object.assign(new Error('É necessário ao menos 2 jogadores para iniciar o torneio.'), { status: 400 });
    }

    // Calcula potência de 2 mais próxima (ex: se tem 12 players, precisa de uma chave de 16)
    const qtPlayers = inscritos.length;
    let bracketSize = 2;
    while (bracketSize < qtPlayers) bracketSize *= 2;

    const rndPlayers = shuffle(inscritos.map(u => u.id));

    // Array de chaves: null será considerado "Bye" (folga)
    const startingSlots = new Array(bracketSize).fill(null);
    for (let i = 0; i < qtPlayers; i++) {
      startingSlots[i] = rndPlayers[i];
    }
    // Melhor espalhamento seria interligar seeds, mas random funciona para amador

    const matchesToInsert = [];
    let totalRounds = Math.log2(bracketSize);

    // ROUND 1
    for (let i = 0; i < bracketSize / 2; i++) {
        const p1 = startingSlots[i * 2];
        const p2 = startingSlots[i * 2 + 1];

        matchesToInsert.push({
            torneio_id: torneioId,
            round: 1,
            match_number: i + 1,
            player1_id: p1,
            player2_id: p2
        });
    }

    // ROUNDS FUTUROS (vazios criando o esqueleto do bracket até a final)
    let currentMatchesInRound = bracketSize / 2;
    for (let r = 2; r <= totalRounds; r++) {
        currentMatchesInRound = currentMatchesInRound / 2;
        for (let m = 1; m <= currentMatchesInRound; m++) {
            matchesToInsert.push({
                torneio_id: torneioId,
                round: r,
                match_number: m,
                player1_id: null,
                player2_id: null
            });
        }
    }

    // Deleta se já houver (reseta chaveamento)
    MatchesRepo.deleteAllByTorneio(torneioId);
    MatchesRepo.createMany(matchesToInsert);

    // Avançar automaticamente W.O para Byes (onde player2_id for null no Round 1)
    const generated = MatchesRepo.findByTorneio(torneioId);
    for (const match of generated) {
        if (match.round === 1) {
            if (match.player1_id && !match.player2_id) {
               // W.O instantâneo - avança P1
               MatchesRepo.confirmWinner(match.id, match.player1_id);
               advancePlayerToNextRound(torneioId, match.round, match.match_number, match.player1_id);
            } else if (!match.player1_id && match.player2_id) {
               // W.O instantâneo - avança P2
               MatchesRepo.confirmWinner(match.id, match.player2_id);
               advancePlayerToNextRound(torneioId, match.round, match.match_number, match.player2_id);
            } else if (!match.player1_id && !match.player2_id) {
               // Vazio vazio (ignora)
               MatchesRepo.confirmWinner(match.id, null);
            }
        }
    }
  }

};

function advancePlayerToNextRound(torneioId, currentRound, currentMatchNumber, playerId) {
    const nextMatch = MatchesRepo.findNextMatchSlot(torneioId, currentRound, currentMatchNumber);
    if (nextMatch) {
        MatchesRepo.advancePlayer(nextMatch.id, playerId, currentMatchNumber);
    }
}

module.exports = { BracketService, advancePlayerToNextRound };
