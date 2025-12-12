const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

// Middleware pour servir les fichiers JS avec le bon type MIME
app.use((req, res, next) => {
  if (req.path.endsWith('.js')) {
    res.setHeader('Content-Type', 'application/javascript');
  } else if (req.path.endsWith('.wasm')) {
    res.setHeader('Content-Type', 'application/wasm');
  }
  next();
});

// Servir les fichiers statiques depuis le dossier public
app.use(express.static(path.join(__dirname, 'public'), {
  setHeaders: (res, filePath) => {
    if (filePath.endsWith('.js')) {
      res.setHeader('Content-Type', 'application/javascript');
    } else if (filePath.endsWith('.wasm')) {
      res.setHeader('Content-Type', 'application/wasm');
    }
  }
}));

// Route pour servir index.html (pour le routing côté client si nécessaire)
app.get('*', (req, res, next) => {
  const hasExtension = /\.(js|css|png|jpg|jpeg|gif|svg|ico|woff|woff2|ttf|eot|wasm|json|mp3|wav|ogg)$/i.test(req.path);
  
  if (hasExtension) {
    return res.status(404).send('File not found');
  }
  
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ============================================
// SOCKET.IO - Gestion multijoueur
// ============================================

// Stocker les joueurs connectés
const players = new Map();

// État global du jeu
const gameState = {
  syncMode: false,
  turnRolls: new Map(), // Map<playerId, result> pour le tour actuel
  turnStartedAt: null,
  syncDiceType: 20, // Type de dé en mode sync (défini par le GM)
  syncDiceQuantity: 1 // Nombre de dés en mode sync (défini par le GM)
};

// Fonction pour déterminer le GM (premier joueur par ordre d'arrivée)
function getGameMaster() {
  if (players.size === 0) return null;
  
  const playersArray = Array.from(players.values());
  // Trier par joinedAt pour avoir le premier arrivé
  playersArray.sort((a, b) => a.joinedAt - b.joinedAt);
  return playersArray[0];
}

// Fonction pour assigner le GM
function assignGameMaster() {
  const currentGM = Array.from(players.values()).find(p => p.isGM);
  const newGM = getGameMaster();
  
  if (newGM && (!currentGM || currentGM.id !== newGM.id)) {
    // Retirer le statut GM de tous
    players.forEach(player => {
      player.isGM = false;
    });
    
    // Assigner au nouveau GM
    if (newGM) {
      newGM.isGM = true;
      players.set(newGM.id, newGM);
      console.log(`[Game] ${newGM.name} est maintenant le Game Master`);
    }
    
    return true;
  }
  
  return false;
}

// Fonction pour vérifier si tous les joueurs ont lancé
function allPlayersRolled() {
  if (!gameState.syncMode) return false;
  if (players.size === 0) return false;
  
  const playersArray = Array.from(players.values());
  return playersArray.every(player => {
    return gameState.turnRolls.has(player.id) || player.isRolling;
  });
}

// Fonction pour déterminer le gagnant et les perdants
function getRoundResults() {
  const rolls = Array.from(gameState.turnRolls.entries());
  if (rolls.length === 0) return null;
  
  // Créer un map avec les noms des joueurs
  const resultsWithNames = rolls.map(([id, result]) => {
    const player = players.get(id);
    return {
      id,
      name: player ? player.name : id,
      score: result
    };
  });
  
  // Trier par résultat décroissant
  resultsWithNames.sort((a, b) => b.score - a.score);
  
  const maxResult = resultsWithNames[0].score;
  const winners = resultsWithNames.filter(r => r.score === maxResult).map(r => r.id);
  const losers = resultsWithNames.filter(r => r.score < maxResult).map(r => r.id);
  
  // Créer un map des scores pour faciliter l'affichage
  const scores = {};
  resultsWithNames.forEach(r => {
    scores[r.id] = { name: r.name, score: r.score };
  });
  
  return { winners, losers, maxResult, scores };
}

io.on('connection', (socket) => {
  console.log(`[Socket] Nouvelle connexion: ${socket.id}`);

  // Quand un joueur rejoint avec son nom
  socket.on('player:join', (playerName) => {
    if (!playerName || typeof playerName !== 'string' || playerName.trim().length === 0) {
      socket.emit('error', { message: 'Nom de joueur invalide' });
      return;
    }

    const trimmedName = playerName.trim().substring(0, 20);

    // Créer le joueur
    const player = {
      id: socket.id,
      name: trimmedName,
      isRolling: false,
      lastResult: null,
      diceType: 20,
      diceQuantity: 1,
      joinedAt: Date.now(),
      isGM: false
    };

    players.set(socket.id, player);

    // Assigner le GM si nécessaire
    const gmChanged = assignGameMaster();

    // Envoyer la liste complète des joueurs à tous
    const playersList = Array.from(players.values());
    io.emit('players:update', playersList);
    
    // Envoyer l'état du jeu à tous (chaque client déterminera s'il est GM)
    io.emit('game:state', {
      syncMode: gameState.syncMode,
      syncDiceType: gameState.syncDiceType,
      syncDiceQuantity: gameState.syncDiceQuantity
    });

    console.log(`[Socket] ${trimmedName} (${socket.id}) a rejoint. Total: ${players.size}`);
  });

  // Quand un joueur lance les dés (résultat final)
  socket.on('dice:roll', (rollData) => {
    const player = players.get(socket.id);
    if (!player) {
      socket.emit('error', { message: 'Joueur non trouvé' });
      return;
    }

    // Valider les données
    const diceType = parseInt(rollData.diceType) || 20;
    const quantity = parseInt(rollData.quantity) || 1;
    const result = parseInt(rollData.result);

    if (!result || result <= 0) {
      socket.emit('error', { message: 'Résultat invalide' });
      return;
    }

    // En mode sync, vérifier que le joueur n'a pas déjà lancé ce tour
    if (gameState.syncMode && gameState.turnRolls.has(socket.id)) {
      socket.emit('error', { message: 'Vous avez déjà lancé ce tour' });
      return;
    }

    // Mettre à jour le joueur (isRolling devient false)
    player.isRolling = false;
    player.lastResult = result;
    player.diceType = diceType;
    player.diceQuantity = quantity;
    players.set(socket.id, player);

    // En mode sync, enregistrer le résultat du tour
    if (gameState.syncMode) {
      gameState.turnRolls.set(socket.id, result);
    }

    // Diffuser le résultat à tous les autres joueurs
    // (le joueur qui a lancé a déjà son résultat localement)
    socket.broadcast.emit('dice:rolled', {
      playerId: socket.id,
      playerName: player.name,
      result: result,
      diceType: diceType,
      quantity: quantity
    });

    // Mettre à jour la liste des joueurs pour tous (avec le résultat)
    const playersList = Array.from(players.values());
    io.emit('players:update', playersList);

    console.log(`[Socket] ${player.name} a lancé ${quantity}d${diceType} = ${result}`);

    // En mode sync, vérifier si tous ont lancé
    if (gameState.syncMode && allPlayersRolled()) {
      const results = getRoundResults();
      if (results) {
        io.emit('round:complete', results);
        console.log(`[Game] Tour terminé. Gagnants: ${results.winners.join(', ')}`);
      }
    }
  });

  // Quand un joueur commence à lancer (pour l'animation)
  socket.on('dice:rolling', () => {
    const player = players.get(socket.id);
    if (!player) return;

    player.isRolling = true;
    players.set(socket.id, player);

    // Informer les autres joueurs que ce joueur est en train de lancer
    socket.broadcast.emit('player:rolling', {
      playerId: socket.id,
      playerName: player.name
    });

    // Mettre à jour la liste
    const playersList = Array.from(players.values());
    io.emit('players:update', playersList);
  });

  // Quand un joueur change son type de dé
  socket.on('dice:type:changed', (diceType) => {
    const player = players.get(socket.id);
    if (!player) return;

    // En mode sync, seul le GM peut changer le type de dé
    if (gameState.syncMode && !player.isGM) {
      socket.emit('error', { message: 'En mode sync, seul le Game Master peut changer le type de dé' });
      return;
    }

    const validDiceTypes = [4, 6, 8, 10, 12, 20, 100];
    if (validDiceTypes.includes(parseInt(diceType))) {
      const newDiceType = parseInt(diceType);
      player.diceType = newDiceType;
      players.set(socket.id, player);

      // En mode sync, mettre à jour le type global et synchroniser à tous
      if (gameState.syncMode && player.isGM) {
        gameState.syncDiceType = newDiceType;
        // Mettre à jour tous les joueurs avec le nouveau type
        players.forEach(p => {
          p.diceType = newDiceType;
          players.set(p.id, p);
        });
      }

      const playersList = Array.from(players.values());
      io.emit('players:update', playersList);

      // En mode sync, envoyer l'état mis à jour
      if (gameState.syncMode) {
        io.emit('game:state', {
          syncMode: gameState.syncMode,
          syncDiceType: gameState.syncDiceType,
          syncDiceQuantity: gameState.syncDiceQuantity
        });
      }
    }
  });

  // Quand un joueur change le nombre de dés
  socket.on('dice:quantity:changed', (quantity) => {
    const player = players.get(socket.id);
    if (!player) return;

    // En mode sync, seul le GM peut changer le nombre de dés
    if (gameState.syncMode && !player.isGM) {
      socket.emit('error', { message: 'En mode sync, seul le Game Master peut changer le nombre de dés' });
      return;
    }

    const validQuantities = [1, 2, 3, 4];
    if (validQuantities.includes(parseInt(quantity))) {
      const newQuantity = parseInt(quantity);
      player.diceQuantity = newQuantity;
      players.set(socket.id, player);

      // En mode sync, mettre à jour la quantité globale et synchroniser à tous
      if (gameState.syncMode && player.isGM) {
        gameState.syncDiceQuantity = newQuantity;
        // Mettre à jour tous les joueurs avec la nouvelle quantité
        players.forEach(p => {
          p.diceQuantity = newQuantity;
          players.set(p.id, p);
        });
      }

      const playersList = Array.from(players.values());
      io.emit('players:update', playersList);

      // En mode sync, envoyer l'état mis à jour
      if (gameState.syncMode) {
        io.emit('game:state', {
          syncMode: gameState.syncMode,
          syncDiceType: gameState.syncDiceType,
          syncDiceQuantity: gameState.syncDiceQuantity
        });
      }
    }
  });

  // Toggle mode sync (seulement pour le GM)
  socket.on('game:sync:toggle', () => {
    const player = players.get(socket.id);
    if (!player || !player.isGM) {
      socket.emit('error', { message: 'Seul le Game Master peut activer/désactiver le mode sync' });
      return;
    }

    gameState.syncMode = !gameState.syncMode;
    
    if (gameState.syncMode) {
      // Démarrer le mode sync avec les réglages du GM
      gameState.syncDiceType = player.diceType || 20;
      gameState.syncDiceQuantity = player.diceQuantity || 1;
      gameState.turnRolls.clear();
      gameState.turnStartedAt = Date.now();
      
      // Synchroniser les réglages à tous les joueurs
      players.forEach(p => {
        p.diceType = gameState.syncDiceType;
        p.diceQuantity = gameState.syncDiceQuantity;
        players.set(p.id, p);
      });
      
      console.log(`[Game] Mode sync activé par ${player.name} (d${gameState.syncDiceType}, ×${gameState.syncDiceQuantity})`);
    } else {
      // Désactiver le mode sync
      gameState.turnRolls.clear();
      gameState.turnStartedAt = null;
      console.log(`[Game] Mode sync désactivé par ${player.name}`);
    }

    // Diffuser l'état du jeu à tous
    io.emit('game:state', {
      syncMode: gameState.syncMode,
      syncDiceType: gameState.syncDiceType,
      syncDiceQuantity: gameState.syncDiceQuantity
    });

    // Mettre à jour les joueurs avec les nouveaux réglages
    const playersList = Array.from(players.values());
    io.emit('players:update', playersList);
  });

  // Passer au tour suivant (seulement pour le GM)
  socket.on('game:turn:next', () => {
    const player = players.get(socket.id);
    if (!player || !player.isGM) {
      socket.emit('error', { message: 'Seul le Game Master peut passer au tour suivant' });
      return;
    }

    if (!gameState.syncMode) {
      socket.emit('error', { message: 'Le mode sync n\'est pas activé' });
      return;
    }

    // Nouveau tour
    gameState.turnRolls.clear();
    gameState.turnStartedAt = Date.now();

    // Réinitialiser les résultats des joueurs pour le nouveau tour
    players.forEach(p => {
      p.lastResult = null;
      p.isRolling = false;
    });

    console.log(`[Game] Nouveau tour commencé par ${player.name}`);

    // Diffuser l'état du jeu à tous
    io.emit('game:state', {
      syncMode: gameState.syncMode,
      syncDiceType: gameState.syncDiceType,
      syncDiceQuantity: gameState.syncDiceQuantity
    });

    const playersList = Array.from(players.values());
    io.emit('players:update', playersList);
  });

  // Quand un joueur se déconnecte
  socket.on('disconnect', () => {
    const player = players.get(socket.id);
    if (player) {
      const wasGM = player.isGM;
      players.delete(socket.id);
      
      // Retirer du tour actuel si en mode sync
      if (gameState.syncMode) {
        gameState.turnRolls.delete(socket.id);
      }
      
      // Réassigner le GM si nécessaire
      if (wasGM) {
        assignGameMaster();
      }
      
      const playersList = Array.from(players.values());
      io.emit('players:update', playersList);
      
      // Envoyer l'état du jeu mis à jour
      io.emit('game:state', {
        syncMode: gameState.syncMode,
        syncDiceType: gameState.syncDiceType,
        syncDiceQuantity: gameState.syncDiceQuantity
      });
      
      console.log(`[Socket] ${player.name} (${socket.id}) s'est déconnecté. Total: ${players.size}`);
    }
  });
});

const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || '0.0.0.0';

// Pour Render, écouter sur toutes les interfaces
const listenHost = process.env.RENDER ? '0.0.0.0' : HOST;

server.listen(PORT, listenHost, () => {
  console.log(`🚀 Serveur démarré sur http://${listenHost}:${PORT}`);
  console.log(`📁 Fichiers statiques servis depuis: ${path.join(__dirname, 'public')}`);
  console.log(`🔌 Socket.io prêt pour les connexions`);
});
