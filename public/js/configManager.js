/**
 * ConfigManager - Gestion de la configuration (musique, background, textures)
 */

export class ConfigManager {
  constructor() {
    this.config = {
      music: 'none',
      background: 'casino',
      diceColor: '#ffffff',
      diceType: 20,
      diceQuantity: 1
    };
    
    this.audioElement = document.getElementById('backgroundMusic');
    this.backgroundImages = {
      casino: null, // Fond CSS par défaut
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
    // Appliquer le fond par défaut
    this.setBackground('casino');
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
    
    if (backgroundKey === 'casino') {
      // Fond cosy avec texture fine et palette verte du dice board
      styleElement.textContent = `
        body::before {
          background-image: none !important;
          background: 
            /* Base vert foncé cosy dans la palette du dice board */
            linear-gradient(135deg, 
              #0d1f0f 0%, 
              #0f2412 20%, 
              #0a1a0d 40%, 
              #0f2412 60%, 
              #0d1f0f 80%, 
              #0a1a0d 100%
            ),
            /* Texture fine - lignes verticales subtiles */
            repeating-linear-gradient(
              0deg,
              rgba(0, 0, 0, 0.03) 0px,
              rgba(0, 0, 0, 0.03) 0.5px,
              transparent 0.5px,
              transparent 1px
            ),
            /* Texture fine - lignes horizontales subtiles */
            repeating-linear-gradient(
              90deg,
              rgba(0, 0, 0, 0.02) 0px,
              rgba(0, 0, 0, 0.02) 0.5px,
              transparent 0.5px,
              transparent 1px
            ),
            /* Texture granuleuse très fine */
            radial-gradient(
              circle at 0.5px 0.5px,
              rgba(139, 195, 74, 0.02) 0.3px,
              transparent 0.3px
            ),
            radial-gradient(
              circle at 1.5px 1.5px,
              rgba(0, 0, 0, 0.02) 0.3px,
              transparent 0.3px
            ),
            /* Accents verts doux et cosy */
            radial-gradient(
              ellipse 40% 30% at 20% 30%,
              rgba(139, 195, 74, 0.06) 0%,
              transparent 50%
            ),
            radial-gradient(
              ellipse 35% 25% at 80% 70%,
              rgba(139, 195, 74, 0.04) 0%,
              transparent 50%
            ),
            radial-gradient(
              ellipse 30% 20% at 50% 50%,
              rgba(139, 195, 74, 0.03) 0%,
              transparent 50%
            ) !important;
          background-size: 
            100% 100%,
            1.5px 1.5px,
            1.5px 1.5px,
            2px 2px,
            3px 3px,
            100% 100%,
            100% 100%,
            100% 100% !important;
          background-position: 
            0 0,
            0 0,
            0 0,
            0 0,
            0 0,
            0 0,
            0 0,
            0 0 !important;
          opacity: 1 !important;
        }
      `;
    } else if (bgImage) {
      // Image personnalisée
      styleElement.textContent = `
        body::before {
          background-image: url(${bgImage}) !important;
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
  }
}
