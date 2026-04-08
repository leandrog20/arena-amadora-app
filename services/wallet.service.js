/**
 * services/wallet.service.js
 * Regras de negócio de carteira/saldo.
 * Sem req/res — testável de forma isolada.
 */

'use strict';

const db              = require('../db/database');
const UsersRepo       = require('../repositories/users.repository');
const HistoricoRepo   = require('../repositories/historico.repository');
const RealtimeService = require('./realtime.service');

const WalletService = {

  /** Debita saldo do usuário em transação atômica */
  debitar(userId, valor, descricao) {
    const user = UsersRepo.findByIdFull(userId);
    if (!user) throw Object.assign(new Error('Usuário não encontrado.'), { status: 404 });
    if (user.saldo < valor) {
      throw Object.assign(
        new Error(`Saldo insuficiente. Você tem R$${user.saldo.toFixed(2)}.`),
        { status: 400 }
      );
    }

    db.transaction(() => {
      UsersRepo.debitSaldo(userId, valor);
      HistoricoRepo.create({ userId, tipo: 'debit', descricao, valor });
    })();

    RealtimeService.sendToUser(userId, 'BALANCE_UPDATED', { novoSaldo: user.saldo - valor });
  },

  /** Credita saldo do usuário em transação atômica */
  creditar(userId, valor, descricao) {
    if (valor <= 0) throw Object.assign(new Error('Valor inválido.'), { status: 400 });

    db.transaction(() => {
      UsersRepo.creditSaldo(userId, valor);
      HistoricoRepo.create({ userId, tipo: 'credito', descricao, valor });
    })();

    // Busca saldo atualizado para enviar
    const user = UsersRepo.findByIdFull(userId);
    RealtimeService.sendToUser(userId, 'BALANCE_UPDATED', { novoSaldo: user.saldo });
  },

  /** Simula depósito via PIX (validações de negócio) */
  depositar(userId, valor) {
    const MIN = 1;
    const MAX = 1000;
    if (!valor || valor < MIN || valor > MAX) {
      throw Object.assign(
        new Error(`Valor inválido. Mínimo R$${MIN}, máximo R$${MAX}.`),
        { status: 400 }
      );
    }
    this.creditar(userId, valor, 'Depósito via PIX');
    return UsersRepo.findById(userId);
  },

  /** Solicita saque PIX */
  solicitarSaque(userId, amount, pixKey) {
    if (!amount || amount < 10) throw Object.assign(new Error('Saque mínimo de R$ 10,00.'), { status: 400 });
    if (!pixKey || pixKey.trim().length < 5) throw Object.assign(new Error('Chave PIX inválida.'), { status: 400 });

    const user = UsersRepo.findByIdFull(userId);
    if (!user) throw Object.assign(new Error('Usuário não encontrado.'), { status: 404 });
    if (user.saldo < amount) throw Object.assign(new Error('Saldo insuficiente.'), { status: 400 });

    // Deduz do usuário o saldo que ele está solicitando, e loga
    db.transaction(() => {
      UsersRepo.debitSaldo(userId, amount);
      HistoricoRepo.create({ userId, tipo: 'debit', descricao: `Saque Solicitado (${pixKey})`, valor: amount });
      
      const insert = db.prepare('INSERT INTO withdrawals (user_id, amount, pix_key, status) VALUES (?, ?, ?, ?)').run(userId, amount, pixKey, 'pending');
    })();
  },

  /** Administrador Processa o Saque (Aprova/Rejeita) */
  processarSaque(withdrawalId, status, memo) {
    if (!['approved', 'rejected'].includes(status)) throw Object.assign(new Error('Status inválido para processamento de saque.'), { status: 400 });

    const withdrawal = db.prepare('SELECT w.*, u.name as user_name FROM withdrawals w JOIN users u ON u.id = w.user_id WHERE w.id = ?').get(withdrawalId);
    if (!withdrawal) throw Object.assign(new Error('Solicitação de saque não encontrada.'), { status: 404 });
    if (withdrawal.status !== 'pending') throw Object.assign(new Error('Saque já foi processado anteriormente.'), { status: 400 });

    db.transaction(() => {
      db.prepare('UPDATE withdrawals SET status = ?, admin_note = ? WHERE id = ?').run(status, memo || '', withdrawalId);

      if (status === 'rejected') {
         // Devolve o saldo para o usuário
         UsersRepo.creditSaldo(withdrawal.user_id, withdrawal.amount);
         HistoricoRepo.create({ 
           userId: withdrawal.user_id, 
           tipo: 'credito', 
           descricao: `Estorno Saque Rejeitado: ${memo || 'Problema na chave PIX'}`, 
           valor: withdrawal.amount 
         });
      } else if (status === 'approved') {
         // Apenas loga visualmente para o jogador que a transferência bancária foi feita
         HistoricoRepo.create({ 
           userId: withdrawal.user_id, 
           tipo: 'info', 
           descricao: `Saque (PIX) Aprovado e Enviado!`, 
           valor: 0 
         });
      }
    })();
  },

};

module.exports = WalletService;
