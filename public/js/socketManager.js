/**
 * SocketManager - Gestion de la connexion Socket.io
 * Centralise toute la communication réseau
 */

export class SocketManager {
  constructor() {
    this.socket = null;
    this.isConnected = false;
    this.currentPlayerId = null;
    this.eventHandlers = new Map();
  }

  connect() {
    // Importer Socket.io depuis le CDN ou depuis le serveur
    if (typeof io === 'undefined') {
      console.error('Socket.io not loaded');
      return false;
    }

    this.socket = io();

    // Événements de connexion
    this.socket.on('connect', () => {
      this.isConnected = true;
      console.log('[Socket] Connecté au serveur:', this.socket.id);
      this.emit('socket:connected');
    });

    this.socket.on('disconnect', () => {
      this.isConnected = false;
      console.log('[Socket] Déconnecté du serveur');
      this.emit('socket:disconnected');
    });

    this.socket.on('connect_error', (error) => {
      console.error('[Socket] Erreur de connexion:', error);
      this.emit('socket:error', error);
    });

    // Événements de jeu
    this.socket.on('players:update', (players) => {
      this.emit('players:update', players);
    });

    this.socket.on('dice:rolled', (data) => {
      this.emit('dice:rolled', data);
    });

    this.socket.on('player:rolling', (data) => {
      this.emit('player:rolling', data);
    });

    this.socket.on('error', (error) => {
      console.error('[Socket] Erreur serveur:', error);
      this.emit('socket:error', error);
    });

    this.socket.on('game:state', (state) => {
      this.emit('game:state', state);
    });

    this.socket.on('round:complete', (results) => {
      this.emit('round:complete', results);
    });

    return true;
  }

  // Méthodes pour envoyer des événements au serveur
  joinGame(playerName) {
    if (!this.isConnected || !this.socket) {
      console.error('[Socket] Pas connecté, impossible de rejoindre');
      return;
    }

    this.socket.emit('player:join', playerName);
  }

  sendDiceRoll(rollData) {
    if (!this.isConnected || !this.socket) {
      console.error('[Socket] Pas connecté, impossible d\'envoyer le lancer');
      return;
    }

    this.socket.emit('dice:roll', rollData);
  }

  sendDiceRolling() {
    if (!this.isConnected || !this.socket) {
      return;
    }

    this.socket.emit('dice:rolling');
  }

  sendDiceTypeChanged(diceType) {
    if (!this.isConnected || !this.socket) {
      return;
    }

    this.socket.emit('dice:type:changed', diceType);
  }

  sendDiceQuantityChanged(quantity) {
    if (!this.isConnected || !this.socket) {
      return;
    }

    this.socket.emit('dice:quantity:changed', quantity);
  }

  toggleSyncMode() {
    if (!this.isConnected || !this.socket) {
      return;
    }

    this.socket.emit('game:sync:toggle');
  }

  nextTurn() {
    if (!this.isConnected || !this.socket) {
      return;
    }

    this.socket.emit('game:turn:next');
  }

  // Système d'événements locaux (pub/sub)
  on(event, handler) {
    if (!this.eventHandlers.has(event)) {
      this.eventHandlers.set(event, []);
    }
    this.eventHandlers.get(event).push(handler);
  }

  off(event, handler) {
    if (this.eventHandlers.has(event)) {
      const handlers = this.eventHandlers.get(event);
      const index = handlers.indexOf(handler);
      if (index > -1) {
        handlers.splice(index, 1);
      }
    }
  }

  emit(event, data) {
    if (this.eventHandlers.has(event)) {
      this.eventHandlers.get(event).forEach(handler => {
        try {
          handler(data);
        } catch (error) {
          console.error(`[Socket] Erreur dans le handler pour ${event}:`, error);
        }
      });
    }
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
      this.isConnected = false;
    }
  }

  getSocketId() {
    return this.socket ? this.socket.id : null;
  }
}
