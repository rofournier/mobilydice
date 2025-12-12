/**
 * DiceManager - Gestion de Fantastic Dice
 */

export class DiceManager {
  constructor(configManager, socketManager) {
    this.configManager = configManager;
    this.socketManager = socketManager;
    this.diceBox = null;
    this.isInitialized = false;
    this.isRolling = false;
    this.currentResults = [];
    this.onRollCompleteCallback = null;
    this.onDieCompleteCallback = null;
  }

  async init() {
    try {
      // Vérifier que le container est visible
      const container = document.getElementById('diceContainer');
      if (!container) {
        throw new Error('Dice container not found');
      }
      
      // S'assurer que le container est visible
      if (container.offsetWidth === 0 || container.offsetHeight === 0) {
        console.warn('Container not visible, waiting for it to become visible...');
        // Attendre que le container devienne visible
        let attempts = 0;
        while ((container.offsetWidth === 0 || container.offsetHeight === 0) && attempts < 50) {
          await new Promise(resolve => setTimeout(resolve, 100));
          attempts++;
        }
        if (container.offsetWidth === 0 || container.offsetHeight === 0) {
          throw new Error('Container never became visible');
        }
      }
      
      // Attendre que DiceBox soit disponible
      let DiceBox;
      
      // Attendre jusqu'à 5 secondes que DiceBox soit chargé
      let attempts = 0;
      const maxAttempts = 50;
      
      while (!window.DiceBox && attempts < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, 100));
        attempts++;
      }
      
      if (window.DiceBox) {
        DiceBox = window.DiceBox;
      } else {
        throw new Error('DiceBox not loaded');
      }

      // Obtenir la couleur depuis configManager
      const diceColor = this.configManager ? this.configManager.getConfig().diceColor : '#ffffff';

      // Créer une instance de DiceBox avec la configuration
      this.diceBox = new DiceBox({
        assetPath: '/assets/dice-box/',
        theme: 'default',
        themeColor: diceColor,
        scale: 9,
        container: '#diceContainer',
        settleTimeout: 8000
      });

      // Setup callbacks
      this.diceBox.onRollComplete = (results) => {
        this.handleRollComplete(results);
      };

      this.diceBox.onDieComplete = (dieResult) => {
        this.handleDieComplete(dieResult);
      };

      // Initialize
      await this.diceBox.init();
      this.isInitialized = true;
      
      // Vérifier que le canvas est créé
      const canvas = document.querySelector('#diceContainer canvas, #dice-canvas');
      if (canvas) {
        console.log('Canvas créé avec dimensions:', canvas.width, 'x', canvas.height);
      } else {
        console.warn('Canvas non trouvé après initialisation');
      }
      
      console.log('DiceBox initialized successfully');
      return true;
    } catch (error) {
      console.error('Error initializing DiceBox:', error);
      return false;
    }
  }

  handleDieComplete(dieResult) {
    if (this.onDieCompleteCallback) {
      this.onDieCompleteCallback(dieResult);
    }
  }

  handleRollComplete(results) {
    // Cette méthode est appelée par le callback onRollComplete de DiceBox
    // Mais on utilise les résultats de la promesse roll() dans main.js
    this.currentResults = results;
    
    if (this.onRollCompleteCallback) {
      this.onRollCompleteCallback(results);
    }
  }

  createConfettiEffect() {
    const container = document.getElementById('diceContainer');
    if (!container) {
      console.warn('Dice container not found for glitter effect');
      return;
    }

    console.log('Creating glitter explosion effect');
    const glitterOverlay = document.createElement('div');
    glitterOverlay.className = 'glitter-overlay';
    
    // Couleurs de glitter élégantes
    const colors = [
      '#FFD700', // Or
      '#FFA500', // Orange
      '#FF69B4', // Rose
      '#00CED1', // Cyan
      '#9370DB', // Violet
      '#32CD32', // Vert
      '#FF6347', // Tomate
      '#1E90FF'  // Bleu
    ];
    
    // Obtenir les dimensions du container
    const rect = container.getBoundingClientRect();
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;
    
    // Créer beaucoup de particules de glitter pour un effet explosif
    const particleCount = 80;
    
    for (let i = 0; i < particleCount; i++) {
      const glitter = document.createElement('div');
      glitter.className = 'glitter-particle';
      
      // Angle pour explosion dans toutes les directions
      const baseAngle = (Math.PI * 2 * i) / particleCount;
      const angle = baseAngle + (Math.random() * 0.4 - 0.2); // Variation légère
      const distance = 50 + Math.random() * 100; // Distance variable en pixels
      const duration = 1.2 + Math.random() * 0.8; // Durée variable
      const delay = Math.random() * 0.1; // Délai léger
      
      // Position finale calculée en pixels (mouvement depuis le centre)
      const moveX = Math.cos(angle) * distance;
      const moveY = Math.sin(angle) * distance;
      
      // Rotation aléatoire
      const rotation = Math.random() * 720; // 0 à 720 degrés
      
      // Taille variable pour plus de réalisme
      const size = 4 + Math.random() * 5; // 4-9px
      
      // Couleur aléatoire
      const color = colors[Math.floor(Math.random() * colors.length)];
      
      // Styles - position initiale au centre
      glitter.style.left = `${centerX}px`;
      glitter.style.top = `${centerY}px`;
      glitter.style.width = `${size}px`;
      glitter.style.height = `${size}px`;
      glitter.style.background = color;
      glitter.style.boxShadow = `0 0 ${size * 1.5}px ${color}, 0 0 ${size * 3}px ${color}`;
      glitter.style.animationDuration = `${duration}s`;
      glitter.style.animationDelay = `${delay}s`;
      glitter.style.animationTimingFunction = 'ease-out';
      glitter.style.setProperty('--move-x', `${moveX}px`);
      glitter.style.setProperty('--move-y', `${moveY}px`);
      glitter.style.setProperty('--rotation', `${rotation}deg`);
      
      glitterOverlay.appendChild(glitter);
    }

    container.appendChild(glitterOverlay);
    console.log(`Created ${particleCount} glitter particles`);

    // Retirer après l'animation
    setTimeout(() => {
      glitterOverlay.remove();
    }, 3000);
  }

  async roll(diceType, quantity = 1) {
    if (!this.isInitialized) {
      console.error('DiceBox not initialized');
      return null;
    }

    if (this.isRolling) {
      console.warn('Dice are already rolling');
      return null;
    }

    this.isRolling = true;
    this.currentResults = [];

    const diceContainer = document.getElementById('diceContainer');
    if (diceContainer) {
      diceContainer.classList.add('rolling');
    }

    try {
      const notation = quantity > 1 ? `${quantity}d${diceType}` : `1d${diceType}`;
      
      // La promesse roll() attend que les dés se stabilisent et retourne les résultats
      const results = await this.diceBox.roll(notation);
      
      // Mettre à jour l'état après que les dés aient fini
      this.isRolling = false;
      
      const diceContainer = document.getElementById('diceContainer');
      if (diceContainer) {
        diceContainer.classList.remove('rolling');
        diceContainer.classList.add('result-ready');
        
        // Retirer la classe après l'animation
        setTimeout(() => {
          diceContainer.classList.remove('result-ready');
        }, 600);
      }

      // Créer un effet de confetti
      this.createConfettiEffect();
      
      return results;
    } catch (error) {
      console.error('Error rolling dice:', error);
      this.isRolling = false;
      if (diceContainer) {
        diceContainer.classList.remove('rolling');
      }
      return null;
    }
  }

  clear() {
    if (this.diceBox && this.isInitialized) {
      this.diceBox.clear();
    }
  }

  updateDiceColor(color) {
    if (this.diceBox && this.isInitialized) {
      // Utiliser updateConfig pour changer la couleur des dés
      this.diceBox.updateConfig({
        themeColor: color
      });
      console.log('Dice color updated to:', color);
    }
  }

  setOnRollComplete(callback) {
    this.onRollCompleteCallback = callback;
  }

  setOnDieComplete(callback) {
    this.onDieCompleteCallback = callback;
  }

  getResults() {
    return this.currentResults;
  }

  getTotalFromResults(results) {
    if (!results || !Array.isArray(results) || results.length === 0) {
      return 0;
    }

    let total = 0;
    results.forEach(group => {
      // Selon la doc, chaque groupe a une propriété 'value' qui est la somme
      if (group.value !== undefined) {
        total += group.value;
      } else if (group.rolls && Array.isArray(group.rolls)) {
        // Sinon, additionner les valeurs individuelles
        group.rolls.forEach(roll => {
          total += roll.value || 0;
        });
      }
      
      // Ajouter les modificateurs
      if (group.mods && Array.isArray(group.mods)) {
        group.mods.forEach(mod => {
          if (mod.type === 'add' || !mod.type) {
            total += mod.value || 0;
          } else if (mod.type === 'subtract') {
            total -= mod.value || 0;
          }
        });
      }
    });

    return total;
  }
}
