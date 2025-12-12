/**
 * Main - Point d'entrée de l'application
 * Orchestre tous les managers
 */

import { ConfigManager } from './configManager.js';
import { DiceManager } from './diceManager.js';
import { PlayerManager } from './playerManager.js';
import { UIManager } from './uiManager.js';
import { SocketManager } from './socketManager.js';

class DiceRollerApp {
  constructor() {
    this.configManager = null;
    this.diceManager = null;
    this.playerManager = null;
    this.uiManager = null;
    this.socketManager = null;
    this.isInitialized = false;
  }

  async init() {
    try {
      // Initialiser les managers
      this.configManager = new ConfigManager();
      this.socketManager = new SocketManager();
      this.playerManager = new PlayerManager(this.socketManager);
      this.uiManager = new UIManager();
      
      // Initialiser DiceManager avec configManager et socketManager
      this.diceManager = new DiceManager(this.configManager, this.socketManager);
      
      // Connecter Socket.io
      this.socketManager.connect();
      
      // Setup event listeners
      this.setupEventListeners();
      this.setupSocketListeners();
      
      // Setup dice callbacks AVANT l'initialisation
      this.diceManager.setOnRollComplete((results) => {
        this.handleRollComplete(results);
      });

      this.diceManager.setOnDieComplete((dieResult) => {
        this.handleDieComplete(dieResult);
      });

      // Écouter les changements de couleur des dés
      window.addEventListener('dice:color:changed', (e) => {
        const { color } = e.detail;
        this.diceManager.updateDiceColor(color);
      });

      this.isInitialized = true;
      console.log('App initialized successfully');
      
      // Afficher la modale de nom
      this.uiManager.showNameModal();
      
      // Initialiser Fantastic Dice APRÈS que l'utilisateur ait rejoint (container visible)
      // On le fera dans l'événement player:joined
      
    } catch (error) {
      console.error('Error initializing app:', error);
    }
  }

  setupEventListeners() {
    // Événement quand le joueur rejoint
    window.addEventListener('player:joined', async (e) => {
      const { playerName } = e.detail;
      
      // Rejoindre le jeu via Socket.io
      this.socketManager.joinGame(playerName);
      
      // Maintenant que le container est visible, initialiser DiceBox
      if (!this.diceManager.isInitialized) {
        const diceInitSuccess = await this.diceManager.init();
        if (!diceInitSuccess) {
          console.error('Failed to initialize dice');
        }
      }
    });

    // Événement pour lancer les dés
    window.addEventListener('dice:roll:request', () => {
      this.handleRollRequest();
    });

    // Événements de changement de configuration
    window.addEventListener('dice:type:changed', (e) => {
      const { diceType } = e.detail;
      // Envoyer au serveur
      this.socketManager.sendDiceTypeChanged(diceType);
    });

    window.addEventListener('dice:quantity:changed', (e) => {
      // Peut être utilisé pour prévisualiser ou autres
      console.log('Dice quantity changed:', e.detail.quantity);
    });
  }

  async handleRollRequest() {
    if (!this.isInitialized || this.diceManager.isRolling) {
      return;
    }

    const diceType = this.uiManager.getDiceType();
    const quantity = this.uiManager.getDiceQuantity();
    
    // Vérifier qu'on est connecté
    if (!this.socketManager.isConnected) {
      console.error('Not connected to server');
      return;
    }

    // Informer le serveur qu'on commence à lancer
    this.socketManager.sendDiceRolling();

    // Mettre à jour l'état du joueur localement
    const socketId = this.socketManager.getSocketId();
    if (socketId) {
      this.playerManager.updatePlayerRoll(socketId, true);
    }
    this.uiManager.setRollButtonEnabled(false);

    // Lancer les dés - la promesse retourne les résultats finaux
    const results = await this.diceManager.roll(diceType, quantity);

    if (results && results.length > 0) {
      // Utiliser directement les résultats de la promesse
      this.handleRollComplete(results);
    } else {
      // En cas d'erreur
      const socketId = this.socketManager.getSocketId();
      if (socketId) {
        this.playerManager.updatePlayerRoll(socketId, false);
      }
      this.uiManager.setRollButtonEnabled(true);
    }
  }

  handleDieComplete(dieResult) {
    // Peut être utilisé pour des animations individuelles
    console.log('Die complete:', dieResult);
  }

  handleRollComplete(results) {
    const diceType = this.uiManager.getDiceType();
    const quantity = this.uiManager.getDiceQuantity();

    // Calculer le total
    const total = this.diceManager.getTotalFromResults(results);
    
    // Mettre à jour le joueur avec le résultat localement
    // Le serveur va mettre à jour la liste, mais on met à jour localement pour l'UI immédiate
    const socketId = this.socketManager.getSocketId();
    if (socketId) {
      this.playerManager.updatePlayerResult(socketId, total, diceType);
    }

    // Envoyer le résultat au serveur pour synchroniser avec les autres joueurs
    this.socketManager.sendDiceRoll({
      result: total,
      diceType: diceType,
      quantity: quantity
    });

    // Réactiver le bouton
    this.uiManager.setRollButtonEnabled(true);

    console.log('Roll complete:', { total, diceType, quantity, results });
  }

  setupSocketListeners() {
    // Debounce pour les mises à jour de joueurs (évite trop de re-renders)
    let playersUpdateTimeout = null;
    this.socketManager.on('players:update', (players) => {
      if (playersUpdateTimeout) {
        clearTimeout(playersUpdateTimeout);
      }
      playersUpdateTimeout = setTimeout(() => {
        this.playerManager.updatePlayers(players);
        playersUpdateTimeout = null;
      }, 50); // Debounce de 50ms
    });

    // Écouter quand un autre joueur lance les dés
    this.socketManager.on('dice:rolled', (data) => {
      // Déclencher l'animation de spin sur la card du joueur
      // Le résultat sera mis à jour immédiatement, puis confirmé par players:update
      this.playerManager.triggerRollAnimation(data.playerId, data);
    });

    // Écouter quand un joueur commence à lancer
    this.socketManager.on('player:rolling', (data) => {
      this.playerManager.updatePlayerRoll(data.playerId, true);
    });

    // Écouter les erreurs
    this.socketManager.on('socket:error', (error) => {
      console.error('[Socket] Erreur:', error);
    });
  }
}

// Initialiser l'application quand le DOM est prêt
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    const app = new DiceRollerApp();
    app.init();
  });
} else {
  const app = new DiceRollerApp();
  app.init();
}
