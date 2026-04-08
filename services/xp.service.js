/**
 * services/xp.service.js
 * Sistema de gamificação, Experiência (XP) e Níveis
 */

'use strict';

const db = require('../db/database');

const XPRules = {
  INSCRICAO: 25,
  VITORIA_PARTIDA: 50,
  VITORIA_TORNEIO: 250,
  LOGIN_DIARIO: 5
};

const XPService = {
  /** 
   * Calcula o nível atual baseado no XP. 
   * Fórmula simples: Level = floor(sqrt(xp / 100)) + 1
   */
  calcularLevel(xp) {
    if (xp < 0) return 1;
    return Math.floor(Math.sqrt(xp / 100)) + 1;
  },

  /** Adiciona XP a um usuário e atualiza seu Level */
  addXP(userId, amount) {
    const user = db.prepare('SELECT xp FROM users WHERE id = ?').get(userId);
    if (!user) return;
    
    const novoXp = user.xp + amount;
    const novoLevel = this.calcularLevel(novoXp);
    
    db.prepare('UPDATE users SET xp = ?, level = ? WHERE id = ?').run(novoXp, novoLevel, userId);
  },
  
  /** Conceder recompensa nominal */
  recompensar(userId, tipo) {
    if (XPRules[tipo]) {
      this.addXP(userId, XPRules[tipo]);
    }
  }
};

module.exports = XPService;
