const socket = io();
let playerId = null;
let players = [];
let isRolling = false;

// Éléments DOM
const nameModal = document.getElementById('nameModal');
const playerNameInput = document.getElementById('playerNameInput');
const joinButton = document.getElementById('joinButton');
const gameContainer = document.getElementById('gameContainer');

// Gérer la connexion
joinButton.addEventListener('click', () => {
  const name = playerNameInput.value.trim();
  if (name) {
    socket.emit('player:join', name);
    nameModal.classList.add('hidden');
    gameContainer.classList.remove('hidden');
  }
});

playerNameInput.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') {
    joinButton.click();
  }
});

// Écouter les mises à jour des joueurs
socket.on('players:update', (playersList) => {
  players = playersList;
  playerId = socket.id;
  renderPlayers();
});

// Écouter les lancers de dé
socket.on('dice:rolled', (data) => {
  const playerCard = document.querySelector(`[data-player-id="${data.playerId}"]`);
  if (playerCard) {
    rollDice(playerCard, data.result, data.playerId === playerId);
  }
});

// Rendre les joueurs
function renderPlayers() {
  gameContainer.innerHTML = '';
  gameContainer.className = `game-container players-${players.length}`;

  players.forEach((player) => {
    const playerCard = createPlayerCard(player);
    gameContainer.appendChild(playerCard);
  });
}

// Créer une carte joueur
function createPlayerCard(player) {
  const card = document.createElement('div');
  card.className = 'player-card';
  card.setAttribute('data-player-id', player.id);

  const nameDiv = document.createElement('div');
  nameDiv.className = 'player-name';
  nameDiv.textContent = player.name;
  // Animation d'entrée
  setTimeout(() => {
    nameDiv.style.animation = 'nameEnter 0.5s ease-out';
  }, 10);

  const diceContainer = document.createElement('div');
  diceContainer.className = 'dice-container';

  const dice = document.createElement('div');
  dice.className = 'dice';
  dice.id = `dice-${player.id}`;

  // Créer un simple carré avec le nombre au centre
  const diceNumber = document.createElement('div');
  diceNumber.className = 'dice-number';
  diceNumber.textContent = '?';
  dice.appendChild(diceNumber);

  diceContainer.appendChild(dice);

  const resultDisplay = document.createElement('div');
  resultDisplay.className = 'result-display';
  resultDisplay.id = `result-${player.id}`;

  const rollButton = document.createElement('button');
  rollButton.className = 'roll-button';
  rollButton.textContent = 'Lancer le dé';
  rollButton.id = `roll-btn-${player.id}`;
  
  if (player.id === playerId) {
    rollButton.addEventListener('click', () => {
      if (!isRolling) {
        socket.emit('dice:roll');
      }
    });
  } else {
    rollButton.disabled = true;
    rollButton.style.display = 'none';
  }

  card.appendChild(nameDiv);
  card.appendChild(diceContainer);
  card.appendChild(resultDisplay);
  card.appendChild(rollButton);

  return card;
}

// Lancer le dé avec animation
function rollDice(playerCard, result, isMyRoll) {
  const dice = playerCard.querySelector('.dice');
  const diceNumber = dice.querySelector('.dice-number');
  const resultDisplay = playerCard.querySelector('.result-display');
  const rollButton = playerCard.querySelector('.roll-button');
  
  if (isMyRoll) {
    isRolling = true;
    if (rollButton) rollButton.disabled = true;
  }

  // Réinitialiser l'affichage
  resultDisplay.textContent = '';
  resultDisplay.classList.remove('show');
  diceNumber.textContent = '?';

  // Activer l'animation de rotation
  dice.classList.add('rolling');

  // Durée de l'animation (slight drama = 1.5 secondes)
  const animationDuration = 1500;
  const startTime = Date.now();
  let lastUpdate = 0;

  // Animation avec ralentissement progressif
  const animate = () => {
    const elapsed = Date.now() - startTime;
    const progress = Math.min(elapsed / animationDuration, 1);
    
    // Ralentissement progressif (ease-out)
    const easeOut = 1 - Math.pow(1 - progress, 3);
    
    // Changer les nombres plus lentement vers la fin
    const updateInterval = 50 + (easeOut * 150);
    
    if (elapsed - lastUpdate >= updateInterval) {
      lastUpdate = elapsed;
      
      // Vers la fin, favoriser le résultat
      let randomNum;
      if (progress > 0.7) {
        // 30% de chance d'afficher le résultat, 70% aléatoire
        randomNum = Math.random() < (progress - 0.7) * 3.33 ? result : Math.floor(Math.random() * 20) + 1;
      } else {
        randomNum = Math.floor(Math.random() * 20) + 1;
      }
      
      diceNumber.textContent = randomNum;
    }

    // Rotation dynamique qui ralentit progressivement
    const baseRotation = elapsed * (1 - easeOut * 0.8) * 0.8;
    dice.style.transform = `rotateX(${baseRotation}deg) rotateY(${baseRotation * 1.3}deg) rotateZ(${baseRotation * 0.7}deg)`;

    if (progress < 1) {
      requestAnimationFrame(animate);
    } else {
      // Animation terminée - arrêter la rotation
      dice.classList.remove('rolling');
      dice.style.transform = 'rotateX(0deg) rotateY(0deg) rotateZ(0deg)';
      dice.style.transition = 'transform 0.5s ease-out';

      // Afficher le résultat final
      diceNumber.textContent = result;
      diceNumber.classList.add('result');

      // Effets de fête !
      createConfetti(playerCard);

      // Afficher le résultat avec animation
      setTimeout(() => {
        resultDisplay.textContent = result;
        resultDisplay.classList.add('show');

        // Réactiver le bouton après un court délai
        setTimeout(() => {
          if (isMyRoll) {
            isRolling = false;
            if (rollButton) rollButton.disabled = false;
            socket.emit('dice:animation:complete');
          }
          dice.style.transition = '';
          diceNumber.classList.remove('result');
        }, 1000);
      }, 100);
    }
  };

  requestAnimationFrame(animate);
}

// Créer des confettis pour célébrer
function createConfetti(playerCard) {
  const colors = ['#667eea', '#764ba2', '#f093fb', '#4facfe', '#43e97b', '#fa709a', '#fee140', '#30cfd0', '#ff6b6b', '#ffd93d'];
  const confettiCount = 80;
  const rect = playerCard.getBoundingClientRect();
  
  for (let i = 0; i < confettiCount; i++) {
    const confetti = document.createElement('div');
    confetti.className = 'confetti';
    
    // Position de départ au centre du carré
    const startX = rect.width / 2;
    const startY = rect.height / 2;
    
    // Direction aléatoire
    const angle = Math.random() * Math.PI * 2;
    const distance = Math.random() * 300 + 200;
    const endX = startX + Math.cos(angle) * distance;
    const endY = startY + Math.sin(angle) * distance;
    const rotation = Math.random() * 1080; // 3 tours
    
    confetti.style.left = startX + 'px';
    confetti.style.top = startY + 'px';
    confetti.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];
    
    // Forme aléatoire (carré ou cercle)
    const isSquare = Math.random() > 0.5;
    const size = Math.random() * 8 + 6;
    confetti.style.width = size + 'px';
    confetti.style.height = size + 'px';
    confetti.style.borderRadius = isSquare ? '2px' : '50%';
    confetti.style.opacity = Math.random() * 0.4 + 0.6;
    
    // Animation avec keyframes dynamiques
    const keyframes = [
      { 
        transform: `translate(0, 0) rotate(0deg) scale(1)`, 
        opacity: confetti.style.opacity 
      },
      { 
        transform: `translate(${endX - startX}px, ${endY - startY}px) rotate(${rotation}deg) scale(0)`, 
        opacity: 0 
      }
    ];
    
    confetti.animate(keyframes, {
      duration: Math.random() * 1000 + 1500,
      easing: 'cubic-bezier(0.25, 0.46, 0.45, 0.94)'
    });
    
    playerCard.appendChild(confetti);
    
    setTimeout(() => {
      confetti.remove();
    }, 2500);
  }
}

