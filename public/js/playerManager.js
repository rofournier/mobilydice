/**
 * PlayerManager - Gestion des joueurs
 * Intégré avec Socket.io
 */

export class PlayerManager {
  constructor(socketManager) {
    this.socketManager = socketManager;
    this.currentPlayer = null;
    this.players = new Map();
    this.playersListElement = document.getElementById('playersList');
    this.numberRollIntervals = new Map(); // Stocker les intervals pour chaque joueur
    this.init();
  }

  init() {
    // Le socketManager sera configuré depuis main.js
  }

  setCurrentPlayer(playerName) {
    // L'ID sera défini par le serveur via Socket.io
    // Pour l'instant, on crée un joueur temporaire
    this.currentPlayer = {
      id: null, // Sera mis à jour par le serveur
      name: playerName,
      isRolling: false,
      lastResult: null,
      diceType: 20,
      diceQuantity: 1
    };
  }

  addPlayer(player) {
    this.players.set(player.id, player);
    this.renderPlayers();
  }

  updatePlayer(playerId, updates) {
    const player = this.players.get(playerId);
    if (player) {
      Object.assign(player, updates);
      this.players.set(playerId, player);
      this.renderPlayers();
    }
  }

  removePlayer(playerId) {
    this.players.delete(playerId);
    this.renderPlayers();
  }

  updatePlayers(playersArray) {
    // Mettre à jour depuis le serveur
    const socketId = this.socketManager ? this.socketManager.getSocketId() : null;
    
    // Optimisation : mise à jour incrémentale au lieu de re-render complet
    const existingIds = new Set(this.players.keys());
    const newIds = new Set(playersArray.map(p => p.id));
    
    // Supprimer les joueurs qui ne sont plus là
    existingIds.forEach(id => {
      if (!newIds.has(id)) {
        this.removePlayerCard(id);
      }
    });
    
    // Mettre à jour ou créer les joueurs
    playersArray.forEach(player => {
      const existing = this.players.get(player.id);
      
      if (existing) {
        // Mise à jour incrémentale : seulement si quelque chose a changé
        const hasChanged = 
          existing.name !== player.name ||
          existing.isRolling !== player.isRolling ||
          existing.lastResult !== player.lastResult ||
          existing.diceType !== player.diceType ||
          existing.diceQuantity !== player.diceQuantity ||
          existing.isGM !== player.isGM;
        
        if (hasChanged) {
          this.players.set(player.id, player);
          this.updatePlayerCard(player);
        }
      } else {
        // Nouveau joueur
        this.players.set(player.id, player);
        this.addPlayerCard(player);
      }
      
      // Si c'est notre joueur, mettre à jour currentPlayer
      if (socketId && player.id === socketId) {
        this.currentPlayer = player;
      }
    });
  }

  triggerRollAnimation(playerId, rollData) {
    // Déclencher l'animation de spin sur la card du joueur
    const playerCard = this.playersListElement?.querySelector(`[data-player-id="${playerId}"]`);
    
    if (playerCard) {
      // Ajouter la classe d'animation
      playerCard.classList.add('rolling-animation');
      
      // Arrêter l'animation de chiffres qui défilent et afficher le résultat final
      const centerSection = playerCard.querySelector('.player-card-center');
      if (centerSection) {
        this.stopNumberRollAnimation(playerId, centerSection, rollData.result);
      }
      
      // Mettre à jour le résultat
      this.updatePlayerResult(playerId, rollData.result, rollData.diceType);
      
      // Retirer l'animation après la durée
      setTimeout(() => {
        playerCard.classList.remove('rolling-animation');
      }, 1000); // Durée de l'animation
    } else {
      // Si la card n'existe pas encore (peu probable), mettre à jour quand même
      this.updatePlayerResult(playerId, rollData.result, rollData.diceType);
    }
  }

  renderPlayers() {
    if (!this.playersListElement) return;

    // Vérifier si on doit afficher le message vide
    const playersArray = Array.from(this.players.values());
    
    if (playersArray.length === 0) {
      // Vérifier si le message existe déjà
      const existingMessage = this.playersListElement.querySelector('.empty-message');
      if (!existingMessage) {
        this.playersListElement.innerHTML = '';
        const emptyMessage = document.createElement('div');
        emptyMessage.className = 'empty-message';
        emptyMessage.textContent = 'Aucun joueur pour le moment';
        emptyMessage.style.cssText = 'text-align: center; color: var(--color-text-muted); padding: var(--spacing-xl); width: 100%;';
        this.playersListElement.appendChild(emptyMessage);
      }
      return;
    }

    // Supprimer le message vide s'il existe
    const existingMessage = this.playersListElement.querySelector('.empty-message');
    if (existingMessage) {
      existingMessage.remove();
    }

    // Re-render complet seulement si nécessaire (fallback)
    // Normalement, updatePlayers() utilise les méthodes incrémentales
    if (!this.playersListElement.querySelector('.player-card')) {
      playersArray.forEach(player => {
        const playerCard = this.createPlayerCard(player);
        this.playersListElement.appendChild(playerCard);
      });
    }
  }

  addPlayerCard(player) {
    if (!this.playersListElement) return;
    
    // Supprimer le message vide s'il existe
    const existingMessage = this.playersListElement.querySelector('.empty-message');
    if (existingMessage) {
      existingMessage.remove();
    }
    
    const playerCard = this.createPlayerCard(player);
    this.playersListElement.appendChild(playerCard);
  }

  removePlayerCard(playerId) {
    if (!this.playersListElement) return;
    
    // Arrêter l'animation si elle est en cours
    const centerSection = this.playersListElement.querySelector(`[data-player-id="${playerId}"] .player-card-center`);
    if (centerSection) {
      this.stopNumberRollAnimation(playerId, centerSection, null);
    }
    
    const card = this.playersListElement.querySelector(`[data-player-id="${playerId}"]`);
    if (card) {
      card.remove();
    }
    
    // Si plus de joueurs, afficher le message
    const remainingCards = this.playersListElement.querySelectorAll('.player-card');
    if (remainingCards.length === 0) {
      const emptyMessage = document.createElement('div');
      emptyMessage.className = 'empty-message';
      emptyMessage.textContent = 'Aucun joueur pour le moment';
      emptyMessage.style.cssText = 'text-align: center; color: var(--color-text-muted); padding: var(--spacing-xl); width: 100%;';
      this.playersListElement.appendChild(emptyMessage);
    }
  }

  updatePlayerCard(player) {
    if (!this.playersListElement) return;
    
    const card = this.playersListElement.querySelector(`[data-player-id="${player.id}"]`);
    if (!card) {
      // Si la card n'existe pas, la créer
      this.addPlayerCard(player);
      return;
    }

    // Mise à jour incrémentale des éléments
    const socketId = this.socketManager ? this.socketManager.getSocketId() : null;
    
    // Mettre à jour la classe current-player
    if (player.id === socketId || player.id === this.currentPlayer?.id) {
      card.classList.add('current-player');
    } else {
      card.classList.remove('current-player');
    }

    // Mettre à jour le nom
    const nameEl = card.querySelector('.player-name');
    if (nameEl) {
      nameEl.textContent = player.name || 'Joueur';
    }

    // Mettre à jour le status
    const statusEl = card.querySelector('.player-status');
    if (statusEl) {
      statusEl.className = 'player-status';
      if (player.isRolling) {
        statusEl.classList.add('rolling');
        statusEl.textContent = '🎲 Lance...';
      } else if (player.lastResult !== null) {
        statusEl.classList.add('ready');
        statusEl.textContent = '✓ Prêt';
      } else {
        statusEl.classList.add('waiting');
        statusEl.textContent = '⏳ En attente';
      }
    }

    // Mettre à jour le score
    const centerSection = card.querySelector('.player-card-center');
    if (centerSection) {
      if (player.isRolling) {
        // Démarrer l'animation de chiffres qui défilent
        this.startNumberRollAnimation(player.id, player.diceType || 20, centerSection);
      } else {
        // Arrêter l'animation et afficher le résultat
        this.stopNumberRollAnimation(player.id, centerSection, player.lastResult);
      }
    }

    // Afficher le badge GM si c'est le Game Master
    let gmBadge = card.querySelector('.gm-badge');
    if (player.isGM) {
      if (!gmBadge) {
        gmBadge = document.createElement('div');
        gmBadge.className = 'gm-badge';
        gmBadge.textContent = '👑 GM';
        const header = card.querySelector('.player-card-header');
        if (header) {
          header.appendChild(gmBadge);
        }
      }
    } else if (gmBadge) {
      gmBadge.remove();
    }

    // Mettre à jour les infos de dés
    const diceTypeEl = card.querySelector('.player-dice-type');
    const diceQuantityEl = card.querySelector('.player-dice-quantity');
    if (diceTypeEl) {
      diceTypeEl.textContent = `d${player.diceType || 20}`;
    }
    if (diceQuantityEl) {
      diceQuantityEl.textContent = `×${player.diceQuantity || 1}`;
    }
  }

  createPlayerCard(player) {
    const card = document.createElement('div');
    card.className = 'player-card';
    card.dataset.playerId = player.id;

    // Vérifier si c'est le joueur courant
    const socketId = this.socketManager ? this.socketManager.getSocketId() : null;
    if (player.id === socketId || player.id === this.currentPlayer?.id) {
      card.classList.add('current-player');
    }

    // Header avec nom et status
    const header = document.createElement('div');
    header.className = 'player-card-header';

    const name = document.createElement('div');
    name.className = 'player-name';
    name.textContent = player.name || 'Joueur';

    const status = document.createElement('div');
    status.className = 'player-status';
    
    if (player.isRolling) {
      status.classList.add('rolling');
      status.textContent = '🎲 Lance...';
    } else if (player.lastResult !== null) {
      status.classList.add('ready');
      status.textContent = '✓ Prêt';
    } else {
      status.classList.add('waiting');
      status.textContent = '⏳ En attente';
    }

    header.appendChild(name);
    header.appendChild(status);
    card.appendChild(header);

    // Zone centrale avec le score en gros
    const centerSection = document.createElement('div');
    centerSection.className = 'player-card-center';

    if (player.isRolling) {
      // Démarrer l'animation de chiffres qui défilent
      this.startNumberRollAnimation(player.id, player.diceType || 20, centerSection);
    } else if (player.lastResult !== null) {
      // Score en gros au centre
      const scoreValue = document.createElement('div');
      scoreValue.className = 'player-score-value';
      scoreValue.textContent = player.lastResult;
      centerSection.appendChild(scoreValue);
    } else {
      // Placeholder quand pas de résultat
      const placeholder = document.createElement('div');
      placeholder.className = 'player-score-placeholder';
      placeholder.textContent = '—';
      centerSection.appendChild(placeholder);
    }

    card.appendChild(centerSection);

    // Footer avec infos détaillées
    const footer = document.createElement('div');
    footer.className = 'player-card-footer';

    // Type de dé et nombre de dés
    const diceInfo = document.createElement('div');
    diceInfo.className = 'player-dice-info';
    
    const diceType = document.createElement('span');
    diceType.className = 'player-dice-type';
    diceType.textContent = `d${player.diceType || 20}`;
    
    const diceQuantity = document.createElement('span');
    diceQuantity.className = 'player-dice-quantity';
    diceQuantity.textContent = `×${player.diceQuantity || 1}`;
    
    diceInfo.appendChild(diceType);
    diceInfo.appendChild(diceQuantity);
    footer.appendChild(diceInfo);

    card.appendChild(footer);

    return card;
  }

  updatePlayerRoll(playerId, isRolling) {
    const player = this.players.get(playerId);
    if (player) {
      const wasRolling = player.isRolling;
      player.isRolling = isRolling;
      this.players.set(playerId, player);
      
      // Si on passe de non-rolling à rolling, démarrer l'animation
      if (!wasRolling && isRolling) {
        const card = this.playersListElement?.querySelector(`[data-player-id="${playerId}"]`);
        if (card) {
          const centerSection = card.querySelector('.player-card-center');
          if (centerSection) {
            this.startNumberRollAnimation(playerId, player.diceType || 20, centerSection);
          }
        }
      }
      
      // Mettre à jour la card pour le status
      this.updatePlayerCard(player);
    }
  }

  updatePlayerResult(playerId, result, diceType) {
    const player = this.players.get(playerId);
    if (player) {
      const hasChanged = 
        player.lastResult !== result ||
        player.isRolling !== false ||
        player.diceType !== (diceType || 20);
      
      if (hasChanged) {
        player.lastResult = result;
        player.isRolling = false;
        player.diceType = diceType || 20;
        this.players.set(playerId, player);
        this.updatePlayerCard(player);
      }
    }
  }

  getCurrentPlayer() {
    return this.currentPlayer;
  }

  getPlayer(playerId) {
    return this.players.get(playerId);
  }

  getAllPlayers() {
    return Array.from(this.players.values());
  }

  showVictoryAnimation(playerId) {
    const card = this.playersListElement?.querySelector(`[data-player-id="${playerId}"]`);
    if (card) {
      card.classList.add('victory-animation');
      setTimeout(() => {
        card.classList.remove('victory-animation');
      }, 2000);
    }
  }

  showDefeatAnimation(playerId) {
    const card = this.playersListElement?.querySelector(`[data-player-id="${playerId}"]`);
    if (card) {
      card.classList.add('defeat-animation');
      setTimeout(() => {
        card.classList.remove('defeat-animation');
      }, 2000);
    }
  }

  getPlayerName(playerId) {
    const player = this.players.get(playerId);
    return player ? player.name : playerId;
  }

  startNumberRollAnimation(playerId, diceType, centerSection) {
    // Arrêter l'animation précédente si elle existe
    this.stopNumberRollAnimation(playerId, centerSection, null);

    // Créer l'élément pour afficher les chiffres
    const rollingValue = document.createElement('div');
    rollingValue.className = 'player-score-rolling';
    rollingValue.textContent = '—';
    centerSection.innerHTML = '';
    centerSection.appendChild(rollingValue);

    // Vitesse de défilement (ms entre chaque changement)
    let speed = 50; // Commence rapide
    const minSpeed = 150; // Ralentit progressivement
    const speedIncrease = 2; // Augmentation de la vitesse à chaque itération
    
    let iteration = 0;
    const maxIterations = 30 + Math.floor(Math.random() * 20); // 30-50 itérations pour un effet réaliste

    const animate = () => {
      iteration++;
      
      // Générer un nombre aléatoire dans la plage du dé
      const randomNumber = Math.floor(Math.random() * diceType) + 1;
      rollingValue.textContent = randomNumber;

      // Ralentir progressivement vers la fin
      if (iteration > maxIterations * 0.7) {
        speed = Math.min(speed + speedIncrease, minSpeed);
      }

      // Continuer ou arrêter
      if (iteration < maxIterations) {
        const timeoutId = setTimeout(animate, speed);
        this.numberRollIntervals.set(playerId, timeoutId);
      } else {
        // Garder le dernier nombre affiché jusqu'à ce que le résultat arrive
        this.numberRollIntervals.delete(playerId);
      }
    };

    // Démarrer l'animation
    const timeoutId = setTimeout(animate, speed);
    this.numberRollIntervals.set(playerId, timeoutId);
  }

  stopNumberRollAnimation(playerId, centerSection, finalResult) {
    // Arrêter le timeout si il existe
    const timeoutId = this.numberRollIntervals.get(playerId);
    if (timeoutId) {
      clearTimeout(timeoutId);
      this.numberRollIntervals.delete(playerId);
    }

    // Afficher le résultat final ou le placeholder
    centerSection.innerHTML = '';
    if (finalResult !== null && finalResult !== undefined) {
      const scoreValue = document.createElement('div');
      scoreValue.className = 'player-score-value';
      scoreValue.textContent = finalResult;
      centerSection.appendChild(scoreValue);
    } else {
      const placeholder = document.createElement('div');
      placeholder.className = 'player-score-placeholder';
      placeholder.textContent = '—';
      centerSection.appendChild(placeholder);
    }
  }
}
