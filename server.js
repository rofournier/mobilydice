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
      joinedAt: Date.now()
    };

    players.set(socket.id, player);

    // Envoyer la liste complète des joueurs à tous
    const playersList = Array.from(players.values());
    io.emit('players:update', playersList);

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

    // Mettre à jour le joueur (isRolling devient false)
    player.isRolling = false;
    player.lastResult = result;
    player.diceType = diceType;
    player.diceQuantity = quantity;
    players.set(socket.id, player);

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

    const validDiceTypes = [4, 6, 8, 10, 12, 20, 100];
    if (validDiceTypes.includes(parseInt(diceType))) {
      player.diceType = parseInt(diceType);
      players.set(socket.id, player);

      const playersList = Array.from(players.values());
      io.emit('players:update', playersList);
    }
  });

  // Quand un joueur se déconnecte
  socket.on('disconnect', () => {
    const player = players.get(socket.id);
    if (player) {
      players.delete(socket.id);
      
      const playersList = Array.from(players.values());
      io.emit('players:update', playersList);
      
      console.log(`[Socket] ${player.name} (${socket.id}) s'est déconnecté. Total: ${players.size}`);
    }
  });
});

const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || '0.0.0.0';

server.listen(PORT, HOST, () => {
  console.log(`🚀 Serveur démarré sur http://${HOST}:${PORT}`);
  console.log(`📁 Fichiers statiques servis depuis: ${path.join(__dirname, 'public')}`);
  console.log(`🔌 Socket.io prêt pour les connexions`);
});
