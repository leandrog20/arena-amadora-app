/**
 * services/realtime.service.js
 * Gerencia conexões Server-Sent Events (SSE).
 * Permite broadcast global ou mensagens direcionadas a usuários específicos.
 */

'use strict';

// Mapa de userId -> Array de responses de conexão (o mesmo user pode estar em abas diferentes)
const clients = new Map();

const RealtimeService = {

  /** Adiciona um novo cliente SSE */
  addClient(userId, res) {
    if (!clients.has(userId)) {
      clients.set(userId, []);
    }
    clients.get(userId).push(res);

    // Remove ao desconectar
    res.on('close', () => {
      this.removeClient(userId, res);
    });
  },

  /** Remove cliente da lista */
  removeClient(userId, res) {
    const userClients = clients.get(userId);
    if (userClients) {
      const filtered = userClients.filter(c => c !== res);
      if (filtered.length === 0) {
        clients.delete(userId);
      } else {
        clients.set(userId, filtered);
      }
    }
  },

  /** Envia evento para um usuário específico */
  sendToUser(userId, event, data) {
    const userClients = clients.get(userId);
    if (!userClients) return;

    const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
    
    for (const res of userClients) {
      res.write(payload);
    }
  },

  /** Envia evento para todos os conectados */
  broadcast(event, data) {
    const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
    
    for (const [userId, userClients] of clients.entries()) {
      for (const res of userClients) {
        res.write(payload);
      }
    }
  }

};

module.exports = RealtimeService;
