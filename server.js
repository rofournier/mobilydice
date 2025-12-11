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
      isRolling: false
    });

    // Envoyer la liste des joueurs à tous
    const playersList = Array.from(players.values());
    io.emit('players:update', playersList);

    console.log(`Joueur ${playerName} (${socket.id}) a rejoint. Total: ${players.size}`);
  });

  // Quand un joueur lance le dé
  socket.on('dice:roll', () => {
    const player = players.get(socket.id);
    if (!player || player.isRolling) {
      return;
    }

    // Générer un résultat aléatoire entre 1 et 20
    const result = Math.floor(Math.random() * 20) + 1;

    // Marquer le joueur comme en train de lancer
    player.isRolling = true;
    players.set(socket.id, player);

    // Diffuser le lancer à tous les clients
    io.emit('dice:rolled', {
      playerId: socket.id,
      playerName: player.name,
      result: result
    });

    console.log(`${player.name} a lancé un ${result}`);
  });

  // Quand l'animation est terminée
  socket.on('dice:animation:complete', () => {
    const player = players.get(socket.id);
    if (player) {
      player.isRolling = false;
      players.set(socket.id, player);
    }
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

