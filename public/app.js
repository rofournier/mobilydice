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
  
  // Afficher le bouton chat et contrôle musique une fois connecté
  if (playerId) {
    document.getElementById('chatToggleBtn').classList.remove('hidden');
    document.getElementById('musicControl').classList.remove('hidden');
    const currentPlayer = playersList.find(p => p.id === socket.id);
    if (currentPlayer) {
      playerName = currentPlayer.name;
    }
  }
});

// Écouter les lancers de dé
socket.on('dice:rolled', (data) => {
  const playerCard = document.querySelector(`[data-player-id="${data.playerId}"]`);
  if (playerCard) {
    rollDice(playerCard, data.result, data.diceType || 20, data.playerId === playerId);
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
  // Afficher le nom avec le type de dé pour tout le monde
  const diceType = player.diceType || 20;
  nameDiv.innerHTML = `<span class="player-name-text">${player.name}</span> <span class="player-dice-type">d${diceType}</span>`;
  // Animation d'entrée
  setTimeout(() => {
    nameDiv.style.animation = 'nameEnter 0.5s ease-out';
  }, 10);

  // Sélecteur de type de dé (seulement pour le joueur actuel)
  if (player.id === playerId) {
    const diceSelectorContainer = document.createElement('div');
    diceSelectorContainer.className = 'dice-selector-container';
    
    const diceSelectorLabel = document.createElement('label');
    diceSelectorLabel.className = 'dice-selector-label';
    diceSelectorLabel.textContent = '🎲 Type de dé:';
    
    const diceSelector = document.createElement('select');
    diceSelector.className = 'dice-selector';
    diceSelector.id = `dice-selector-${player.id}`;
    
    const diceTypes = [4, 6, 8, 10, 12, 20];
    diceTypes.forEach(type => {
      const option = document.createElement('option');
      option.value = type;
      option.textContent = `d${type}`;
      if (player.diceType === type || (!player.diceType && type === 20)) {
        option.selected = true;
      }
      diceSelector.appendChild(option);
    });
    
    diceSelector.addEventListener('change', (e) => {
      const selectedType = parseInt(e.target.value);
      socket.emit('dice:changeType', selectedType);
    });
    
    diceSelectorContainer.appendChild(diceSelectorLabel);
    diceSelectorContainer.appendChild(diceSelector);
    card.appendChild(diceSelectorContainer);
  } else {
    // Afficher le type de dé pour les autres joueurs
    const diceTypeDisplay = document.createElement('div');
    diceTypeDisplay.className = 'dice-type-display';
    diceTypeDisplay.textContent = `🎲 d${player.diceType || 20}`;
    card.appendChild(diceTypeDisplay);
  }

  const diceContainer = document.createElement('div');
  diceContainer.className = 'dice-container';

  const dice = document.createElement('div');
  dice.className = 'dice';
  dice.id = `dice-${player.id}`;
  dice.setAttribute('data-dice-type', player.diceType || 20);

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
  rollButton.textContent = '⚔️ Lancer le dé';
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
function rollDice(playerCard, result, diceType, isMyRoll) {
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
        randomNum = Math.random() < (progress - 0.7) * 3.33 ? result : Math.floor(Math.random() * diceType) + 1;
      } else {
        randomNum = Math.floor(Math.random() * diceType) + 1;
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
        resultDisplay.textContent = `${result} / d${diceType}`;
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

// ==================== GESTION DU CHAT ====================

// Éléments du chat
const chatModal = document.getElementById('chatModal');
const chatToggleBtn = document.getElementById('chatToggleBtn');
const chatCloseBtn = document.getElementById('chatClose');
// const chatMinimizeBtn = document.getElementById('chatMinimize');
const chatHeader = document.getElementById('chatHeader');
const chatBody = document.getElementById('chatBody');
const chatMessages = document.getElementById('chatMessages');
const chatInput = document.getElementById('chatInput');
const chatSendBtn = document.getElementById('chatSendBtn');
const chatResizeHandle = document.getElementById('chatResizeHandle');
const chatBadge = document.getElementById('chatBadge');
const chatToggleBadge = document.getElementById('chatToggleBadge');

let chatMinimized = false;
let unreadCount = 0;
let playerName = '';

// Toggle chat
chatToggleBtn.addEventListener('click', () => {
  if (chatModal.classList.contains('hidden')) {
    openChat();
  } else {
    closeChat();
  }
});

// Ouvrir le chat
function openChat() {
  chatModal.classList.remove('hidden');
  chatMinimized = false;
  chatBody.style.display = 'flex';
  chatInput.focus();
  unreadCount = 0;
  updateBadges();
}

// Fermer le chat
function closeChat() {
  chatModal.classList.add('hidden');
  chatMinimized = false;
}


chatCloseBtn.addEventListener('click', (e) => {
  e.stopPropagation();
  closeChat();
});

// Envoyer un message
function sendMessage() {
  const message = chatInput.value.trim();
  if (message && playerId) {
    socket.emit('chat:message', message);
    chatInput.value = '';
  }
}

chatSendBtn.addEventListener('click', sendMessage);
chatInput.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') {
    sendMessage();
  }
});

// Recevoir un message
socket.on('chat:message', (messageData) => {
  addMessageToChat(messageData);
  
  // Si le chat est fermé ou minimisé, incrémenter le compteur
  if (chatModal.classList.contains('hidden') || chatMinimized) {
    unreadCount++;
    updateBadges();
  }
  
  // Scroll automatique
  scrollToBottom();
});

// Ajouter un message au chat
function addMessageToChat(messageData) {
  const messageDiv = document.createElement('div');
  messageDiv.className = 'chat-message';
  
  const isOwnMessage = messageData.playerId === playerId;
  if (isOwnMessage) {
    messageDiv.classList.add('own-message');
  }
  
  const time = new Date(messageData.timestamp).toLocaleTimeString('fr-FR', {
    hour: '2-digit',
    minute: '2-digit'
  });
  
  messageDiv.innerHTML = `
    <div class="chat-message-header">
      <span class="chat-message-author">${escapeHtml(messageData.playerName)}</span>
      <span class="chat-message-time">${time}</span>
    </div>
    <div class="chat-message-content">${escapeHtml(messageData.message)}</div>
  `;
  
  chatMessages.appendChild(messageDiv);
  scrollToBottom();
}

// Échapper le HTML pour éviter les injections
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// Scroll vers le bas
function scrollToBottom() {
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

// Mettre à jour les badges
function updateBadges() {
  if (unreadCount > 0) {
    chatBadge.textContent = unreadCount;
    chatToggleBadge.textContent = unreadCount;
    chatBadge.style.display = 'inline-block';
    chatToggleBadge.style.display = 'inline-block';
  } else {
    chatBadge.style.display = 'none';
    chatToggleBadge.style.display = 'none';
  }
}

// ==================== DRAG & RESIZE ====================

let isDragging = false;
let isResizing = false;
let dragOffset = { x: 0, y: 0 };
let startPos = { x: 0, y: 0 };

// Fonction pour démarrer le drag (utilisée pour mouse et touch)
function startDrag(e) {
  const clientX = e.touches ? e.touches[0].clientX : e.clientX;
  const clientY = e.touches ? e.touches[0].clientY : e.clientY;
  
  if (e.target === chatHeader || e.target.closest('.chat-title') || e.target.closest('.chat-controls')) {
    if (e.target === chatCloseBtn) return;
    
    isDragging = true;
    const rect = chatModal.getBoundingClientRect();
    dragOffset.x = clientX - rect.left;
    dragOffset.y = clientY - rect.top;
    chatModal.style.transition = 'none';
    e.preventDefault();
  }
}

// Drag
chatHeader.addEventListener('mousedown', startDrag);
chatHeader.addEventListener('touchstart', startDrag);

// Resize
chatResizeHandle.addEventListener('mousedown', (e) => {
  isResizing = true;
  startPos.x = e.clientX;
  startPos.y = e.clientY;
  const rect = chatModal.getBoundingClientRect();
  startPos.width = rect.width;
  startPos.height = rect.height;
  chatModal.style.transition = 'none';
  e.preventDefault();
});

// Fonction pour le mouvement (utilisée pour mouse et touch)
function handleMove(e) {
  const clientX = e.touches ? e.touches[0].clientX : e.clientX;
  const clientY = e.touches ? e.touches[0].clientY : e.clientY;
  
  if (isDragging) {
    const x = clientX - dragOffset.x;
    const y = clientY - dragOffset.y;
    
    // Limiter aux bords de l'écran
    const maxX = window.innerWidth - chatModal.offsetWidth;
    const maxY = window.innerHeight - chatModal.offsetHeight;
    
    chatModal.style.left = Math.max(0, Math.min(x, maxX)) + 'px';
    chatModal.style.top = Math.max(0, Math.min(y, maxY)) + 'px';
  }
  
  if (isResizing) {
    const deltaX = clientX - startPos.x;
    const deltaY = clientY - startPos.y;
    
    const newWidth = Math.max(300, Math.min(800, startPos.width + deltaX));
    const newHeight = Math.max(200, Math.min(600, startPos.height + deltaY));
    
    chatModal.style.width = newWidth + 'px';
    chatModal.style.height = newHeight + 'px';
  }
}

// Mouse move
document.addEventListener('mousemove', handleMove);
document.addEventListener('touchmove', handleMove);

// Fonction pour arrêter le drag/resize
function stopDrag() {
  if (isDragging || isResizing) {
    isDragging = false;
    isResizing = false;
    chatModal.style.transition = '';
  }
}

// Mouse up / Touch end
document.addEventListener('mouseup', stopDrag);
document.addEventListener('touchend', stopDrag);

// Empêcher la sélection de texte pendant le drag
chatHeader.addEventListener('selectstart', (e) => {
  if (isDragging) e.preventDefault();
});

// ==================== GESTION DE LA MUSIQUE ====================

const musicToggle = document.getElementById('musicToggle');
const backgroundMusic = document.getElementById('backgroundMusic');

// Charger l'état sauvegardé (par défaut false)
const savedMusicState = localStorage.getItem('musicEnabled');
musicToggle.checked = savedMusicState === 'true';

// Gérer le toggle de la musique
musicToggle.addEventListener('change', () => {
  if (musicToggle.checked) {
    backgroundMusic.play().catch(e => {
      console.log('Impossible de jouer la musique:', e);
    });
    localStorage.setItem('musicEnabled', 'true');
  } else {
    backgroundMusic.pause();
    localStorage.setItem('musicEnabled', 'false');
  }
});

