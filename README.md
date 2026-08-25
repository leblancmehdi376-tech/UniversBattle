# UniverseBattle

Un lobby de 2 à 10 joueurs choisit une catégorie (anime, jeux vidéo, dessin
animé), chacun sélectionne ses favoris via une API, puis tout le monde vote
dans un arbre de tournoi jusqu'à un champion final.

## Structure du projet

```
universebattle/
  server/     Node.js + Express + Socket.io (temps réel, en mémoire)
  client/     React + Vite
```

## 1. Lancer le serveur

```bash
cd server
npm install
cp .env.example .env
```

Édite `.env` :
- `RAWG_API_KEY` : obtiens une clé **gratuite** sur https://rawg.io/apidocs
  (nécessaire uniquement pour la catégorie "Jeux vidéo")
- Les catégories Anime (Jikan) et Dessin animé (TVmaze) ne nécessitent
  aucune clé.

```bash
npm run dev
```

Le serveur tourne sur `http://localhost:4000`.

## 2. Lancer le client

Dans un autre terminal :

```bash
cd client
npm install
npm run dev
```

Ouvre `http://localhost:5173`. Ouvre plusieurs onglets/navigateurs pour
simuler plusieurs joueurs.

## Comment ça marche

1. **Lobby** : un joueur crée un lobby (code à 5 caractères), les autres le
   rejoignent avec ce code.
2. **Configuration (hôte uniquement)** : catégorie + nombre de favoris par
   joueur.
3. **Picking** : chaque joueur recherche et sélectionne ses favoris via
   l'API de la catégorie choisie.
4. **Tournoi** : dès que tout le monde a validé, le serveur mélange tous
   les picks et construit un arbre à élimination directe. Chaque round,
   tous les joueurs votent sur chaque duel ; le round suivant démarre
   automatiquement une fois tous les votes reçus. Si le nombre de
   participants n'est pas une puissance de 2, des "byes" (passages
   automatiques) comblent les places manquantes.
5. **Champion** : le dernier survivant de l'arbre est affiché.

## Comptes optionnels (photo de profil)

Un joueur peut créer un compte (pseudo + mot de passe) pour garder une
photo de profil d'une partie à l'autre. Ce n'est jamais obligatoire pour
jouer — sans compte, on choisit juste un pseudo à chaque partie.

- Les comptes sont stockés dans `server/data/accounts.json` (mots de passe
  hachés avec `scrypt`, jamais en clair).
- Les photos de profil sont uploadées depuis le PC du joueur et stockées
  dans `server/uploads/`, servies via `/uploads/...`.
- Les sessions de connexion sont en mémoire : elles ne survivent pas à un
  redémarrage du serveur (l'utilisateur devra se reconnecter).
- Ni `server/data/` ni `server/uploads/` ne sont versionnés dans Git
  (voir `.gitignore`) — chaque déploiement démarre avec une base vide.

## Reconnexion instantanée

Chaque joueur reçoit un `playerId` stable (distinct du `socket.id`, qui
change à chaque connexion) au moment où il rejoint un lobby. Ce `playerId`
est stocké dans le `localStorage` du navigateur. Si la page est rafraîchie
ou perd sa connexion, le client renvoie automatiquement ce `playerId` au
serveur via l'événement `lobby:reconnect`, qui réassocie le joueur à son
ancien slot (nom, picks, votes déjà faits) sans que la partie ne redémarre.

Un joueur simplement déconnecté (onglet fermé, wifi coupé) reste dans la
partie avec `connected: false` — il peut revenir à tout moment tant que le
lobby existe encore. Pour quitter *volontairement* une partie (bouton
"Rejouer"/"Quitter" sur l'écran final), le client envoie `lobby:leave`, qui
retire vraiment le joueur.

## Tester le flow complet sans navigateur

Un script de test end-to-end simule deux joueurs, une reconnexion en plein
milieu du picking, puis un tournoi complet jusqu'au champion :

```bash
cd server
npm install
npm run dev          # dans un terminal
npm run test:e2e     # dans un autre terminal
```

## Points d'extension pour la suite

- **Persistance** : `server/lobbyManager.js` utilise une `Map` en mémoire.
  Remplace-la par Redis (lobbies éphémères, TTL naturel) si tu veux
  supporter plusieurs instances de serveur, ou par Postgres si tu veux
  garder un historique des parties/statistiques.
- **Nettoyage des lobbies fantômes** : un joueur qui ferme définitivement
  son onglet reste `connected: false` indéfiniment. Un `setTimeout` de
  quelques minutes après déconnexion pourrait le retirer automatiquement
  s'il ne revient pas.
- **Dessins animés** : TVmaze n'est pas spécialisée cartoons, le filtre
  actuel est approximatif (genre "Animation"/"Anime"). Pour un meilleur
  résultat, on peut brancher une base custom ou une autre API dédiée.
- **Affichage de l'arbre complet** : la version actuelle affiche uniquement
  le round en cours (les rounds précédents ne sont pas conservés en
  mémoire). Si tu veux un arbre visuel complet avec l'historique, il faut
  garder tous les rounds dans `lobby.bracket.history` au lieu de les
  écraser.
