# 🎲 Whos - Multiplayer Dice Roller

Application multijoueur de lancer de dés avec mode sync et Game Master.

## 🚀 Déploiement sur Render

### Méthode rapide (2 minutes)

1. **Créer un compte sur [Render.com](https://render.com)**

2. **Créer un nouveau Web Service**
   - Cliquer sur "New +" → "Web Service"
   - Connecter votre repository GitHub/GitLab
   - Ou utiliser "Public Git repository" avec l'URL de votre repo

3. **Configuration**
   - **Name**: `whos-dice-roller` (ou votre choix)
   - **Environment**: `Node`
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
   - **Plan**: Free (ou votre choix)

4. **Variables d'environnement** (optionnel, déjà dans render.yaml)
   - `NODE_ENV`: `production`
   - `PORT`: `10000` (Render définit automatiquement PORT)

5. **Déployer**
   - Cliquer sur "Create Web Service"
   - Render va automatiquement détecter `render.yaml` et utiliser la configuration

### Alternative : Configuration manuelle

Si vous préférez configurer manuellement sans `render.yaml`:

- **Build Command**: `npm install`
- **Start Command**: `npm start`
- **Environment**: Node
- Le port est automatiquement géré par Render via `process.env.PORT`

## 📦 Installation locale

```bash
npm install
npm start
```

L'application sera accessible sur `http://localhost:3000`

## 🎮 Fonctionnalités

- 🎲 Lancer des dés 3D avec Fantastic Dice
- 👥 Mode multijoueur en temps réel (Socket.io)
- 👑 Système de Game Master (premier joueur connecté)
- 🔄 Mode Sync avec tours synchronisés
- 🏆 Animations de victoire/défaite
- 🎨 Interface casino élégante

## 🛠️ Technologies

- Node.js + Express
- Socket.io
- Fantastic Dice (@3d-dice/dice-box)
- Vanilla JavaScript (ES Modules)
- CSS3 avec animations
