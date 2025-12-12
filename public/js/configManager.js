/**
 * ConfigManager - Gestion de la configuration (musique, background, textures)
 */

export class ConfigManager {
  constructor() {
    this.config = {
      music: 'none',
      background: 'casino',
      diceColor: '#ffffff',
      containerColor: 'green',
      diceType: 20,
      diceQuantity: 1
    };
    
    this.audioElement = document.getElementById('backgroundMusic');
    this.backgroundImages = {
      casino: 'assets/images/bg2.jpg',
      bg: 'assets/images/bg.jpg'
    };
    
    this.musicFiles = {
      music1: 'assets/music/music1.mp3',
      music2: 'assets/music/music2.mp3'
    };
    
    this.init();
  }

  init() {
    this.setupMusicSelect();
    this.setupBackgroundSelect();
    this.setupDiceColorSelect();
    this.setupContainerColorSelect();
    // Appliquer le fond par défaut
    this.setBackground('casino');
    // Appliquer la couleur des containers par défaut
    this.setContainerColor('green');
  }

  setupMusicSelect() {
    const select = document.getElementById('musicSelect');
    if (!select) return;

    select.addEventListener('change', (e) => {
      this.setMusic(e.target.value);
    });
  }

  setupBackgroundSelect() {
    const select = document.getElementById('backgroundSelect');
    if (!select) return;

    select.addEventListener('change', (e) => {
      this.setBackground(e.target.value);
    });
  }

  setupDiceColorSelect() {
    const select = document.getElementById('diceColorSelect');
    if (!select) return;

    select.addEventListener('change', (e) => {
      this.setDiceColor(e.target.value);
    });
  }

  setupContainerColorSelect() {
    const select = document.getElementById('containerColorSelect');
    if (!select) return;

    select.addEventListener('change', (e) => {
      this.setContainerColor(e.target.value);
    });
  }


  setMusic(musicKey) {
    this.config.music = musicKey;
    
    if (musicKey === 'none') {
      this.audioElement.pause();
      this.audioElement.src = '';
      return;
    }

    const musicPath = this.musicFiles[musicKey];
    if (musicPath) {
      this.audioElement.src = musicPath;
      this.audioElement.play().catch(err => {
        console.warn('Impossible de lire la musique:', err);
      });
    }
  }

  setBackground(backgroundKey) {
    this.config.background = backgroundKey;
    const bgImage = this.backgroundImages[backgroundKey];
    
    let styleElement = document.getElementById('dynamic-bg-style');
    if (!styleElement) {
      styleElement = document.createElement('style');
      styleElement.id = 'dynamic-bg-style';
      document.head.appendChild(styleElement);
    }
    
    if (bgImage) {
      // Image personnalisée
      styleElement.textContent = `
        body::before {
          background-image: url(/${bgImage}) !important;
          background-size: cover !important;
          background-position: center !important;
          background-repeat: no-repeat !important;
          opacity: 1 !important;
        }
      `;
    }
  }

  getConfig() {
    return { ...this.config };
  }

  getDiceColor() {
    return this.config.diceColor;
  }

  setDiceColor(color) {
    this.config.diceColor = color;
    // Émettre un événement pour que DiceManager puisse mettre à jour
    window.dispatchEvent(new CustomEvent('dice:color:changed', {
      detail: { color }
    }));
  }

  setContainerColor(colorKey) {
    this.config.containerColor = colorKey;
    
    // Définir les couleurs selon la palette choisie
    const colorPalettes = {
      green: {
        primary: '139, 195, 74', // #8bc34a
        dark: '76, 175, 80', // #4caf50
        light: '156, 204, 101' // #9ccc65
      },
      blue: {
        primary: '66, 165, 245', // #42a5f5
        dark: '33, 150, 243', // #2196f3
        light: '100, 181, 246' // #64b5f6
      },
      red: {
        primary: '239, 83, 80', // #ef5350
        dark: '229, 57, 53', // #e53935
        light: '244, 67, 54' // #f44336
      },
      purple: {
        primary: '156, 39, 176', // #9c27b0
        dark: '142, 36, 170', // #8e24aa
        light: '171, 71, 188' // #ab47bc
      },
      gold: {
        primary: '255, 193, 7', // #ffc107
        dark: '255, 160, 0', // #ffa000
        light: '255, 224, 130' // #ffe082
      },
      emerald: {
        primary: '16, 185, 129', // #10b981
        dark: '5, 150, 105', // #059669
        light: '52, 211, 153' // #34d399
      },
      teal: {
        primary: '20, 184, 166', // #14b8a6
        dark: '13, 148, 136', // #0d9488
        light: '45, 212, 191' // #2dd4bf
      },
      amber: {
        primary: '245, 158, 11', // #f59e0b
        dark: '217, 119, 6', // #d97706
        light: '251, 191, 36' // #fbbf24
      }
    };

    const palette = colorPalettes[colorKey] || colorPalettes.green;

    // Créer ou mettre à jour le style pour les containers
    let styleElement = document.getElementById('container-color-style');
    if (!styleElement) {
      styleElement = document.createElement('style');
      styleElement.id = 'container-color-style';
      document.head.appendChild(styleElement);
    }

    // Créer des couleurs foncées opaques pour la base
    const darkR = parseInt(palette.dark.split(',')[0].trim());
    const darkG = parseInt(palette.dark.split(',')[1].trim());
    const darkB = parseInt(palette.dark.split(',')[2].trim());
    const primaryR = parseInt(palette.primary.split(',')[0].trim());
    const primaryG = parseInt(palette.primary.split(',')[1].trim());
    const primaryB = parseInt(palette.primary.split(',')[2].trim());
    
    // Couleurs foncées pour la base (30-40% de la couleur originale)
    const baseDark = `rgb(${Math.floor(darkR * 0.3)}, ${Math.floor(darkG * 0.3)}, ${Math.floor(darkB * 0.3)})`;
    const basePrimary = `rgb(${Math.floor(primaryR * 0.35)}, ${Math.floor(primaryG * 0.35)}, ${Math.floor(primaryB * 0.35)})`;

    styleElement.textContent = `
      .casino-felt {
        background: 
          /* Base opaque avec la couleur principale */
          linear-gradient(135deg, 
            ${baseDark} 0%, 
            ${basePrimary} 20%, 
            ${baseDark} 40%, 
            ${basePrimary} 60%, 
            ${baseDark} 80%, 
            ${basePrimary} 100%
          ),
          /* Texture fine - lignes verticales */
          repeating-linear-gradient(
            0deg,
            rgba(0, 0, 0, 0.03) 0px,
            rgba(0, 0, 0, 0.03) 0.5px,
            transparent 0.5px,
            transparent 1px
          ),
          /* Texture fine - lignes horizontales */
          repeating-linear-gradient(
            90deg,
            rgba(0, 0, 0, 0.02) 0px,
            rgba(0, 0, 0, 0.02) 0.5px,
            transparent 0.5px,
            transparent 1px
          ),
          /* Texture granuleuse */
          radial-gradient(
            circle at 0.5px 0.5px,
            rgba(${palette.primary}, 0.02) 0.3px,
            transparent 0.3px
          ),
          radial-gradient(
            circle at 1.5px 1.5px,
            rgba(0, 0, 0, 0.02) 0.3px,
            transparent 0.3px
          ),
          /* Accents de couleur */
          radial-gradient(
            ellipse 80% 50% at 30% 20%,
            rgba(${palette.primary}, 0.08) 0%,
            transparent 50%
          ),
          radial-gradient(
            ellipse 60% 40% at 70% 80%,
            rgba(${palette.primary}, 0.06) 0%,
            transparent 50%
          );
        border-color: rgba(${palette.primary}, 0.25) !important;
      }

      .casino-felt::before {
        background: 
          radial-gradient(
            ellipse 60% 40% at 20% 30%,
            rgba(${palette.primary}, 0.12) 0%,
            transparent 60%
          ),
          radial-gradient(
            ellipse 50% 30% at 80% 70%,
            rgba(${palette.primary}, 0.08) 0%,
            transparent 60%
          ),
          linear-gradient(
            135deg,
            rgba(255, 255, 255, 0.03) 0%,
            transparent 30%,
            transparent 70%,
            rgba(0, 0, 0, 0.05) 100%
          );
      }

      .casino-felt::after {
        box-shadow: 
          inset 0 2px 4px rgba(0, 0, 0, 0.3),
          inset 0 -2px 4px rgba(${palette.primary}, 0.1);
      }
    `;
  }

  updateConfig(newConfig) {
    this.config = { ...this.config, ...newConfig };
    
    if (newConfig.music !== undefined) {
      this.setMusic(newConfig.music);
    }
    if (newConfig.background !== undefined) {
      this.setBackground(newConfig.background);
    }
    if (newConfig.diceColor !== undefined) {
      this.setDiceColor(newConfig.diceColor);
    }
    if (newConfig.containerColor !== undefined) {
      this.setContainerColor(newConfig.containerColor);
    }
  }
}
