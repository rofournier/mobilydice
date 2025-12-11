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

// État du mode Sync
let isSyncMode = false;
let leaderId = null; // ID du chef (première personne connectée)
let currentTurn = 1;
let turnDiceType = 20; // Type de dé pour le tour actuel
let playersWhoRolledThisTurn = new Set(); // Joueurs qui ont lancé ce tour

io.on('connection', (socket) => {
  console.log('Un utilisateur s\'est connecté:', socket.id);

  // Quand un joueur envoie son nom
  socket.on('player:join', (playerName) => {
    // Si c'est le premier joueur, il devient le chef
    if (players.size === 0) {
      leaderId = socket.id;
      console.log(`Le joueur ${playerName} (${socket.id}) est maintenant le chef`);
    }

    players.set(socket.id, {
      id: socket.id,
      name: playerName,
      isRolling: false,
      diceType: 20, // Par défaut d20
      hasRolledThisTurn: false // Pour le mode Sync
    });

    // Envoyer la liste des joueurs et l'état du mode Sync à tous
    const playersList = Array.from(players.values());
    io.emit('players:update', playersList);
    io.emit('sync:state', {
      isSyncMode,
      leaderId,
      currentTurn,
      turnDiceType,
      playersWhoRolledThisTurn: Array.from(playersWhoRolledThisTurn)
    });

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

  // Toggle le mode Sync (seulement le chef)
  socket.on('sync:toggle', () => {
    if (socket.id !== leaderId) {
      return; // Seul le chef peut toggle
    }

    isSyncMode = !isSyncMode;
    
    if (isSyncMode) {
      // Démarrer un nouveau tour
      currentTurn = 1;
      turnDiceType = 20;
      playersWhoRolledThisTurn.clear();
      // Réinitialiser l'état de tous les joueurs
      players.forEach((player) => {
        player.hasRolledThisTurn = false;
        players.set(player.id, player);
      });
    } else {
      // Sortir du mode Sync : réinitialiser
      currentTurn = 1;
      playersWhoRolledThisTurn.clear();
      players.forEach((player) => {
        player.hasRolledThisTurn = false;
        players.set(player.id, player);
      });
    }

    io.emit('sync:state', {
      isSyncMode,
      leaderId,
      currentTurn,
      turnDiceType,
      playersWhoRolledThisTurn: Array.from(playersWhoRolledThisTurn)
    });

    console.log(`Mode Sync ${isSyncMode ? 'activé' : 'désactivé'} par le chef`);
  });

  // Changer le type de dé pour le tour (seulement le chef en mode Sync)
  socket.on('sync:changeTurnDiceType', (diceType) => {
    if (socket.id !== leaderId || !isSyncMode) {
      return;
    }

    if ([4, 6, 8, 10, 12, 20].includes(diceType)) {
      turnDiceType = diceType;
      io.emit('sync:state', {
        isSyncMode,
        leaderId,
        currentTurn,
        turnDiceType,
        playersWhoRolledThisTurn: Array.from(playersWhoRolledThisTurn)
      });
      console.log(`Le chef a changé le type de dé du tour à d${diceType}`);
    }
  });

  // Quand un joueur lance le dé
  socket.on('dice:roll', () => {
    const player = players.get(socket.id);
    if (!player || player.isRolling) {
      return;
    }

    // En mode Sync, vérifier les restrictions
    if (isSyncMode) {
      // Vérifier si le joueur a déjà lancé ce tour
      if (player.hasRolledThisTurn || playersWhoRolledThisTurn.has(socket.id)) {
        return;
      }
    }

    // Générer un résultat aléatoire selon le type de dé
    let diceType;
    if (isSyncMode) {
      diceType = turnDiceType; // En mode Sync, utiliser le type de dé du tour
    } else {
      diceType = player.diceType || 20; // Sinon, utiliser le type de dé personnel
    }
    const result = Math.floor(Math.random() * diceType) + 1;

    // Marquer le joueur comme en train de lancer
    player.isRolling = true;
    players.set(socket.id, player);

    // Stocker le résultat pour le mode Sync
    if (isSyncMode) {
      player.lastResult = result;
    }

    // Diffuser le lancer à tous les clients
    io.emit('dice:rolled', {
      playerId: socket.id,
      playerName: player.name,
      result: result,
      diceType: diceType
    });

    console.log(`${player.name} a lancé un d${diceType} et obtenu ${result}`);

    // En mode Sync, marquer que le joueur a lancé ce tour
    if (isSyncMode) {
      player.hasRolledThisTurn = true;
      playersWhoRolledThisTurn.add(socket.id);
      players.set(socket.id, player);

      // Mettre à jour l'état pour tous les clients
      io.emit('sync:state', {
        isSyncMode,
        leaderId,
        currentTurn,
        turnDiceType,
        playersWhoRolledThisTurn: Array.from(playersWhoRolledThisTurn)
      });

      // Vérifier si tout le monde a lancé (après un court délai pour laisser les animations démarrer)
      setTimeout(() => {
        const allPlayers = Array.from(players.values());
        const allHaveRolled = allPlayers.length > 0 && allPlayers.every(p => 
          p.hasRolledThisTurn || playersWhoRolledThisTurn.has(p.id)
        );

        if (allHaveRolled) {
          // Attendre que les animations se terminent, puis émettre la fin de tour
          setTimeout(() => {
            io.emit('sync:turnComplete', {
              turn: currentTurn,
              results: allPlayers.map(p => ({
                name: p.name,
                result: p.lastResult || 0
              }))
            });

            // Passer au tour suivant
            currentTurn++;
            playersWhoRolledThisTurn.clear();
            allPlayers.forEach(p => {
              p.hasRolledThisTurn = false;
              p.lastResult = null;
              players.set(p.id, p);
            });

            io.emit('sync:state', {
              isSyncMode,
              leaderId,
              currentTurn,
              turnDiceType,
              playersWhoRolledThisTurn: Array.from(playersWhoRolledThisTurn)
            });
          }, 3000); // Attendre 3 secondes pour les animations
        }
      }, 100);
    }
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
      const wasLeader = socket.id === leaderId;
      players.delete(socket.id);
      playersWhoRolledThisTurn.delete(socket.id);

      // Si le chef se déconnecte, le suivant devient chef
      if (wasLeader && players.size > 0) {
        const newLeader = Array.from(players.values())[0];
        leaderId = newLeader.id;
        console.log(`Le joueur ${newLeader.name} (${newLeader.id}) est maintenant le nouveau chef`);
      } else if (players.size === 0) {
        // Si plus personne, réinitialiser
        leaderId = null;
        isSyncMode = false;
        currentTurn = 1;
        playersWhoRolledThisTurn.clear();
      }

      const playersList = Array.from(players.values());
      io.emit('players:update', playersList);
      io.emit('sync:state', {
        isSyncMode,
        leaderId,
        currentTurn,
        turnDiceType,
        playersWhoRolledThisTurn: Array.from(playersWhoRolledThisTurn)
      });
      console.log(`Joueur ${player.name} (${socket.id}) s'est déconnecté. Total: ${players.size}`);
    }
  });
});

const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || '0.0.0.0';

server.listen(PORT, HOST, () => {
  console.log(`Serveur démarré sur http://${HOST}:${PORT}`);
});

