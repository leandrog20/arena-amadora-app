/**
 * services/torneios.service.js
 * Regras de negócio de torneios e inscrições.
 * Sem req/res — testável de forma isolada.
 */

'use strict';

const { randomUUID } = require('crypto');
const TorneiosRepo   = require('../repositories/torneios.repository');
const UsersRepo      = require('../repositories/users.repository');
const WalletService  = require('./wallet.service');
const RealtimeService = require('./realtime.service');

const VALID_GAMES    = ['coc', 'cr', 'brawl', 'ff', 'pubg', 'efootball', 'mc'];
const VALID_FORMATS  = ['eliminatorio', 'dupla', 'grupos', 'liga'];
const VALID_STATUS   = ['aberto', 'em_andamento', 'finalizado', 'cancelado'];

const TorneiosService = {

  /** Lista todos os torneios com flag de inscrição para o usuário */
  listar(userId = null) {
    const torneios  = TorneiosRepo.findAllWithCount();
    // Correção do N+1: busca todos os torneios em que o user está inscrito de uma vez
    const inscritosSet = TorneiosRepo.inscritosSetByUser(userId);

    return torneios.map(t => ({
      ...t,
      inscrito: inscritosSet.has(t.id)
    }));
  },

  /** Cria novo torneio (somente admin) */
  criar({ nome, jogo, data_txt, vagas, taxa, premio, formato, regras }) {
    if (!nome?.trim()) throw Object.assign(new Error('Nome é obrigatório.'), { status: 400 });
    if (!jogo || !VALID_GAMES.includes(jogo)) throw Object.assign(new Error('Jogo inválido.'), { status: 400 });
    if (formato && !VALID_FORMATS.includes(formato)) throw Object.assign(new Error('Formato inválido.'), { status: 400 });
    if (vagas && (vagas < 4 || vagas > 256)) throw Object.assign(new Error('Vagas: mínimo 4, máximo 256.'), { status: 400 });
    if (taxa < 0) throw Object.assign(new Error('Taxa não pode ser negativa.'), { status: 400 });
    if (premio < 0) throw Object.assign(new Error('Prêmio não pode ser negativo.'), { status: 400 });

    const id = 'T' + Date.now();
    TorneiosRepo.create({
      id,
      nome: nome.trim(),
      jogo,
      data_txt: data_txt || 'A definir',
      vagas:    vagas    || 32,
      taxa:     taxa     ?? 0,
      premio:   premio   ?? 0,
      formato:  formato  || 'eliminatorio',
      regras:   regras   || ''
    });

    RealtimeService.broadcast('TOURNAMENT_CREATED', { nome: nome.trim() });

    return { id };
  },

  /** Exclui torneio */
  excluir(id) {
    const torneio = TorneiosRepo.findById(id);
    if (!torneio) throw Object.assign(new Error('Torneio não encontrado.'), { status: 404 });
    TorneiosRepo.deleteById(id);
  },

  /** Atualiza status do torneio */
  atualizarStatus(id, status) {
    if (!VALID_STATUS.includes(status)) throw Object.assign(new Error('Status inválido.'), { status: 400 });
    const torneio = TorneiosRepo.findById(id);
    if (!torneio) throw Object.assign(new Error('Torneio não encontrado.'), { status: 404 });
    TorneiosRepo.updateStatus(id, status);

    RealtimeService.broadcast('TOURNAMENT_UPDATED', { id, status });
  },

  /** Inscreve usuário no torneio com validações completas */
  inscrever(torneioId, user) {
    if (user.role === 'admin') {
      throw Object.assign(new Error('Admin não pode se inscrever em torneios.'), { status: 400 });
    }

    const torneio = TorneiosRepo.findById(torneioId);
    if (!torneio) throw Object.assign(new Error('Torneio não encontrado.'), { status: 404 });
    if (torneio.status !== 'aberto') throw Object.assign(new Error('Torneio não está aberto para inscrições.'), { status: 400 });

    const count = TorneiosRepo.countInscricoes(torneioId);
    if (count >= torneio.vagas) throw Object.assign(new Error('Torneio lotado.'), { status: 400 });

    if (TorneiosRepo.isInscrito(torneioId, user.id)) {
      throw Object.assign(new Error('Você já está inscrito neste torneio.'), { status: 400 });
    }

    // Transação: inscrever + debitar (se houver taxa)
    const XPService = require('./xp.service');

    if (torneio.taxa > 0) {
      WalletService.debitar(user.id, torneio.taxa, 'Inscrição: ' + torneio.nome);
    }

    TorneiosRepo.createInscricao(torneioId, user.id);
    XPService.recompensar(user.id, 'INSCRICAO');

    RealtimeService.broadcast('TOURNAMENT_UPDATED', { id: torneioId });
  },

  /** Lista inscritos de um torneio */
  listarInscritos(torneioId) {
    const torneio = TorneiosRepo.findById(torneioId);
    if (!torneio) throw Object.assign(new Error('Torneio não encontrado.'), { status: 404 });
    return TorneiosRepo.findInscritos(torneioId);
  },

};

module.exports = TorneiosService;
