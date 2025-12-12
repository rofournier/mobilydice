const socket = io();
let playerId = null;
let players = [];
let isRolling = false;

// État du mode Sync
let isSyncMode = false;
let isLeader = false;
let currentTurn = 1;
let turnDiceType = 20;
let playersWhoRolledThisTurn = [];

// Éléments DOM
const nameModal = document.getElementById('nameModal');
const playerNameInput = document.getElementById('playerNameInput');
const joinButton = document.getElementById('joinButton');
const gameContainer = document.getElementById('gameContainer');
