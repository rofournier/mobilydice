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

// Servir les fichiers statiques
app.use(express.static(path.join(__dirname, 'public')));

// Stocker les joueurs connectés
const players = new Map();

io.on('connection', (socket) => {
  console.log('Un utilisateur s\'est connecté:', socket.id);

  // Quand un joueur envoie son nom
  socket.on('player:join', (playerName) => {
    players.set(socket.id, {
      id: socket.id,
      name: playerName,
      isRolling: false,
      diceType: 20 // Par défaut d20
    });

    // Envoyer la liste des joueurs à tous
    const playersList = Array.from(players.values());
    io.emit('players:update', playersList);

    console.log(`Joueur ${playerName} (${socket.id}) a rejoint. Total: ${players.size}`);
  });

  // Quand un joueur change son type de dé
  socket.on('dice:changeType', (diceType) => {
    const player = players.get(socket.id);
    if (player && [4, 6, 8, 10, 12, 20].includes(diceType)) {
      player.diceType = diceType;
      players.set(socket.id, player);
      const playersList = Array.from(players.values());
      io.emit('players:update', playersList);
    }
  });

  // Quand un joueur lance le dé
  socket.on('dice:roll', () => {
    const player = players.get(socket.id);
    if (!player || player.isRolling) {
      return;
    }

    // Générer un résultat aléatoire selon le type de dé
    const diceType = player.diceType || 20;
    const result = Math.floor(Math.random() * diceType) + 1;

    // Marquer le joueur comme en train de lancer
    player.isRolling = true;
    players.set(socket.id, player);

    // Diffuser le lancer à tous les clients
    io.emit('dice:rolled', {
      playerId: socket.id,
      playerName: player.name,
      result: result,
      diceType: diceType
    });

    console.log(`${player.name} a lancé un d${diceType} et obtenu ${result}`);
  });

  // Quand l'animation est terminée
  socket.on('dice:animation:complete', () => {
    const player = players.get(socket.id);
    if (player) {
      player.isRolling = false;
      players.set(socket.id, player);
    }
  });

  // Gestion des messages de chat
  socket.on('chat:message', (message) => {
    const player = players.get(socket.id);
    if (!player || !message.trim()) {
      return;
    }

    const messageData = {
      id: Date.now().toString(),
      playerId: socket.id,
      playerName: player.name,
      message: message.trim(),
      timestamp: new Date().toISOString()
    };

    // Diffuser le message à tous les clients
    io.emit('chat:message', messageData);
    console.log(`[Chat] ${player.name}: ${message}`);
  });

  // Quand un joueur se déconnecte
  socket.on('disconnect', () => {
    const player = players.get(socket.id);
    if (player) {
      players.delete(socket.id);
      const playersList = Array.from(players.values());
      io.emit('players:update', playersList);
      console.log(`Joueur ${player.name} (${socket.id}) s'est déconnecté. Total: ${players.size}`);
    }
  });
});

const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || '0.0.0.0';

server.listen(PORT, HOST, () => {
  console.log(`Serveur démarré sur http://${HOST}:${PORT}`);
});

