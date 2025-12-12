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
    
    // Exposer l'instance globalement pour UIManager
    window.app = this;
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
      const { quantity } = e.detail;
      // Envoyer au serveur
      this.socketManager.sendDiceQuantityChanged(quantity);
    });

    // Événements du mode sync
    window.addEventListener('game:sync:toggle', () => {
      this.socketManager.toggleSyncMode();
    });

    window.addEventListener('game:turn:next', () => {
      this.socketManager.nextTurn();
    });
  }

  async handleRollRequest() {
    if (!this.isInitialized || this.diceManager.isRolling) {
      return;
    }

    // En mode sync, vérifier qu'on n'a pas déjà lancé ce tour
    if (this.uiManager.syncMode && this.uiManager.hasRolledThisTurn) {
      console.warn('Déjà lancé ce tour');
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

    // En mode sync, marquer qu'on a lancé ce tour
    if (this.uiManager.syncMode) {
      this.uiManager.setHasRolledThisTurn(true);
    } else {
      this.uiManager.setRollButtonEnabled(true);
    }

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

    // Écouter les erreurs du serveur (pour afficher des messages)
    this.socketManager.on('socket:error', (error) => {
      if (error && error.message) {
        // Afficher l'erreur de manière visible
        const errorDiv = document.createElement('div');
        errorDiv.className = 'server-error-message';
        errorDiv.textContent = error.message;
        errorDiv.style.cssText = `
          position: fixed;
          top: 20px;
          right: 20px;
          background: rgba(239, 68, 68, 0.9);
          color: white;
          padding: var(--spacing-md) var(--spacing-lg);
          border-radius: var(--radius-md);
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
          z-index: 10000;
          animation: slideInRight 0.3s ease-out;
        `;
        document.body.appendChild(errorDiv);
        
        setTimeout(() => {
          errorDiv.remove();
        }, 3000);
      }
    });

    // Les erreurs sont gérées dans setupSocketListeners

    // Écouter l'état du jeu (GM, mode sync)
    this.socketManager.on('game:state', (state) => {
      // Attendre un peu pour que players:update soit traité d'abord
      setTimeout(() => {
        const socketId = this.socketManager.getSocketId();
        const player = socketId ? this.playerManager.getPlayer(socketId) : null;
        const isGM = player?.isGM || false;
        
        this.uiManager.setGameMaster(isGM);
        this.uiManager.setSyncMode(
          state.syncMode, 
          state.syncDiceType, 
          state.syncDiceQuantity
        );
        
        // Vérifier si le joueur a déjà lancé ce tour
        if (state.syncMode) {
          if (player && player.lastResult) {
            this.uiManager.setHasRolledThisTurn(true);
          } else {
            this.uiManager.setHasRolledThisTurn(false);
          }
        } else {
          this.uiManager.setHasRolledThisTurn(false);
        }
      }, 100);
    });

    // Écouter la fin d'un tour
    this.socketManager.on('round:complete', (results) => {
      const socketId = this.socketManager.getSocketId();
      const isWinner = results.winners.includes(socketId);
      const isLoser = results.losers.includes(socketId);
      
      // Déclencher les animations de victoire/défaite
      if (isWinner) {
        this.playerManager.showVictoryAnimation(socketId);
      }
      if (isLoser) {
        this.playerManager.showDefeatAnimation(socketId);
      }
      
      // Afficher la modale de résultats avec les scores
      this.uiManager.showRoundComplete(results.winners, results.losers, results.scores);
      
      // Réinitialiser l'état de roll pour le prochain tour
      this.uiManager.setHasRolledThisTurn(false);
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
