/**
 * UIManager - Gestion de l'interface utilisateur
 */

export class UIManager {
  constructor() {
    this.nameModal = document.getElementById('nameModal');
    this.gameContainer = document.getElementById('gameContainer');
    this.playerNameInput = document.getElementById('playerNameInput');
    this.joinButton = document.getElementById('joinButton');
    this.rollButton = document.getElementById('rollButton');
    this.diceTypeSelect = document.getElementById('diceTypeSelect');
    this.diceQuantitySelect = document.getElementById('diceQuantitySelect');
    this.syncModeToggle = document.getElementById('syncModeToggle');
    this.nextTurnButton = null;
    this.isGM = false;
    this.syncMode = false;
    this.hasRolledThisTurn = false;
    
    this.init();
  }

  init() {
    this.setupNameModal();
    this.setupRollButton();
    this.setupDiceControls();
    this.setupSyncModeToggle();
    this.createNextTurnButton();
  }

  createNextTurnButton() {
    // Créer le bouton "Tour suivant" (sera affiché seulement pour le GM en mode sync)
    const headerCard = document.querySelector('.header-card');
    if (headerCard && !this.nextTurnButton) {
      this.nextTurnButton = document.createElement('button');
      this.nextTurnButton.id = 'nextTurnButton';
      this.nextTurnButton.className = 'next-turn-button hidden';
      this.nextTurnButton.innerHTML = '<span>⏭️ Tour Suivant</span>';
      this.nextTurnButton.addEventListener('click', () => {
        window.dispatchEvent(new CustomEvent('game:turn:next'));
      });
      headerCard.appendChild(this.nextTurnButton);
    }
  }

  setupSyncModeToggle() {
    if (!this.syncModeToggle) return;

    this.syncModeToggle.addEventListener('change', (e) => {
      if (this.isGM) {
        window.dispatchEvent(new CustomEvent('game:sync:toggle'));
      } else {
        // Réinitialiser si ce n'est pas le GM
        e.target.checked = false;
      }
    });
  }

  setupNameModal() {
    if (!this.joinButton || !this.playerNameInput) return;

    const handleJoin = () => {
      const playerName = this.playerNameInput.value.trim();
      if (playerName.length < 1) {
        this.showError('Veuillez entrer un nom');
        return;
      }
      
      if (playerName.length > 20) {
        this.showError('Le nom ne peut pas dépasser 20 caractères');
        return;
      }

      this.hideNameModal();
      this.showGameContainer();
      
      // Émettre l'événement pour que main.js puisse gérer
      window.dispatchEvent(new CustomEvent('player:joined', { 
        detail: { playerName } 
      }));
    };

    this.joinButton.addEventListener('click', handleJoin);
    
    this.playerNameInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        handleJoin();
      }
    });
  }

  setupRollButton() {
    if (!this.rollButton) return;

    this.rollButton.addEventListener('click', () => {
      window.dispatchEvent(new CustomEvent('dice:roll:request'));
    });
  }

  setupDiceControls() {
    if (this.diceTypeSelect) {
      this.diceTypeSelect.addEventListener('change', (e) => {
        // En mode sync, seul le GM peut changer
        if (this.syncMode && !this.isGM) {
          const currentValue = this.getDiceType();
          e.target.value = currentValue;
          return;
        }
        window.dispatchEvent(new CustomEvent('dice:type:changed', {
          detail: { diceType: parseInt(e.target.value) }
        }));
      });
    }

    if (this.diceQuantitySelect) {
      this.diceQuantitySelect.addEventListener('change', (e) => {
        // En mode sync, seul le GM peut changer
        if (this.syncMode && !this.isGM) {
          const currentValue = this.getDiceQuantity();
          e.target.value = currentValue;
          return;
        }
        window.dispatchEvent(new CustomEvent('dice:quantity:changed', {
          detail: { quantity: parseInt(e.target.value) }
        }));
      });
    }
  }

  showNameModal() {
    if (this.nameModal) {
      this.nameModal.classList.remove('hidden');
      if (this.playerNameInput) {
        this.playerNameInput.focus();
      }
    }
  }

  hideNameModal() {
    if (this.nameModal) {
      this.nameModal.classList.add('hidden');
    }
  }

  showGameContainer() {
    if (this.gameContainer) {
      this.gameContainer.classList.remove('hidden');
      this.gameContainer.classList.add('fade-in');
    }
  }

  hideGameContainer() {
    if (this.gameContainer) {
      this.gameContainer.classList.add('hidden');
    }
  }

  showError(message) {
    // Simple alert pour l'instant, peut être amélioré avec une modale
    alert(message);
  }

  setRollButtonEnabled(enabled) {
    if (this.rollButton) {
      this.rollButton.disabled = !enabled;
    }
  }

  getDiceType() {
    return this.diceTypeSelect ? parseInt(this.diceTypeSelect.value) : 20;
  }

  getDiceQuantity() {
    return this.diceQuantitySelect ? parseInt(this.diceQuantitySelect.value) : 1;
  }

  setGameMaster(isGM) {
    this.isGM = isGM;
    if (this.syncModeToggle) {
      this.syncModeToggle.disabled = !isGM;
      const hint = this.syncModeToggle.closest('.option-group')?.querySelector('.option-hint');
      if (hint) {
        hint.textContent = isGM ? 'Vous êtes le Game Master' : 'Seul le Game Master peut activer';
      }
    }
  }

  setSyncMode(enabled, syncDiceType = null, syncDiceQuantity = null) {
    this.syncMode = enabled;
    this.hasRolledThisTurn = false;

    if (this.syncModeToggle) {
      this.syncModeToggle.checked = enabled;
    }

    // Afficher/masquer le bouton "Tour suivant" pour le GM
    if (this.nextTurnButton) {
      if (enabled && this.isGM) {
        this.nextTurnButton.classList.remove('hidden');
      } else {
        this.nextTurnButton.classList.add('hidden');
      }
    }

    // En mode sync, désactiver les selects pour les non-GM
    if (enabled) {
      if (this.diceTypeSelect) {
        this.diceTypeSelect.disabled = !this.isGM;
      }
      if (this.diceQuantitySelect) {
        this.diceQuantitySelect.disabled = !this.isGM;
      }

      // Synchroniser les valeurs si fournies
      if (syncDiceType !== null && this.diceTypeSelect) {
        this.diceTypeSelect.value = syncDiceType;
      }
      if (syncDiceQuantity !== null && this.diceQuantitySelect) {
        this.diceQuantitySelect.value = syncDiceQuantity;
      }
    } else {
      // Sortir du mode sync : réactiver les selects
      if (this.diceTypeSelect) {
        this.diceTypeSelect.disabled = false;
      }
      if (this.diceQuantitySelect) {
        this.diceQuantitySelect.disabled = false;
      }
    }

    // Mettre à jour le texte du bouton de lancer
    this.updateRollButtonState();
  }

  setHasRolledThisTurn(hasRolled) {
    this.hasRolledThisTurn = hasRolled;
    this.updateRollButtonState();
  }

  updateRollButtonState() {
    if (!this.rollButton) return;

    if (this.syncMode) {
      if (this.hasRolledThisTurn) {
        this.rollButton.disabled = true;
        const text = this.rollButton.querySelector('.roll-button-text');
        if (text) {
          text.textContent = '✓ Déjà lancé ce tour';
        }
      } else {
        this.rollButton.disabled = false;
        const text = this.rollButton.querySelector('.roll-button-text');
        if (text) {
          text.textContent = '🎲 Lancer les dés';
        }
      }
    } else {
      this.rollButton.disabled = false;
      const text = this.rollButton.querySelector('.roll-button-text');
      if (text) {
        text.textContent = '🎲 Lancer les dés';
      }
    }
  }

  showRoundComplete(winners, losers, scores = null) {
    // Créer une modale pour afficher les résultats du tour
    const modal = document.createElement('div');
    modal.className = 'round-complete-modal';
    
    // Construire la liste des gagnants avec scores
    const winnersList = winners.map(id => {
      const playerInfo = scores && scores[id] ? scores[id] : { name: this.getPlayerName(id), score: '?' };
      return `<li><span class="player-name-modal">${playerInfo.name}</span> <span class="player-score-modal">${playerInfo.score}</span></li>`;
    }).join('');
    
    // Construire la liste des perdants avec scores
    const losersList = losers.length > 0 ? losers.map(id => {
      const playerInfo = scores && scores[id] ? scores[id] : { name: this.getPlayerName(id), score: '?' };
      return `<li><span class="player-name-modal">${playerInfo.name}</span> <span class="player-score-modal">${playerInfo.score}</span></li>`;
    }).join('') : '';
    
    modal.innerHTML = `
      <div class="round-complete-content">
        <h2>🎉 Tour terminé !</h2>
        <div class="round-results">
          <div class="winners">
            <h3>🏆 Gagnants</h3>
            <ul>
              ${winnersList}
            </ul>
          </div>
          ${losers.length > 0 ? `
          <div class="losers">
            <h3>😔 Perdants</h3>
            <ul>
              ${losersList}
            </ul>
          </div>
          ` : ''}
        </div>
        ${this.isGM ? '<button class="next-turn-modal-button">Tour Suivant</button>' : ''}
      </div>
    `;

    document.body.appendChild(modal);

    // Animation d'entrée
    setTimeout(() => modal.classList.add('show'), 10);

    // Bouton "Tour suivant" dans la modale
    const nextTurnBtn = modal.querySelector('.next-turn-modal-button');
    if (nextTurnBtn) {
      nextTurnBtn.addEventListener('click', () => {
        modal.remove();
        window.dispatchEvent(new CustomEvent('game:turn:next'));
      });
    }

    // Auto-fermeture après 5 secondes si pas GM
    if (!this.isGM) {
      setTimeout(() => {
        if (modal.parentNode) {
          modal.remove();
        }
      }, 5000);
    }
  }

  getPlayerName(playerId) {
    // Utiliser PlayerManager pour obtenir le nom
    const playerManager = window.app?.playerManager;
    if (playerManager) {
      return playerManager.getPlayerName(playerId);
    }
    return playerId;
  }
}
