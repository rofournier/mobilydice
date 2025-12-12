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
    
    this.init();
  }

  init() {
    this.setupNameModal();
    this.setupRollButton();
    this.setupDiceControls();
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
        window.dispatchEvent(new CustomEvent('dice:type:changed', {
          detail: { diceType: parseInt(e.target.value) }
        }));
      });
    }

    if (this.diceQuantitySelect) {
      this.diceQuantitySelect.addEventListener('change', (e) => {
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
}
