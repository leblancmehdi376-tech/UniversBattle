import express from "express";
import cors from "cors";
import multer from "multer";

import {
  createLobby,
  getLobby,
  saveLobby,
  joinLobby,
  getLobbyForPlayer,
  touchPlayer,
  removePlayer,
  sanitizeLobby,
  computePickQuotas,
  VALID_TOURNAMENT_SIZES,
} from "./lobbyManager.js";
import {
  buildBracket,
  buildNextRound,
  resolveMatch,
  allMatchesResolved,
} from "./bracket.js";
import { searchAnime } from "./apis/anime.js";
import { searchGames } from "./apis/games.js";
import { searchCartoons } from "./apis/cartoons.js";
import { register, login, logout, getAccountByToken, setAvatar } from "./accounts.js";
import { saveAvatar, deleteAvatar, UPLOAD_DIR } from "./avatarStore.js";

const CLIENT_URL = process.env.CLIENT_URL || "http://localhost:5173";

const app = express();
app.use(cors({ origin: CLIENT_URL }));
app.use(express.json());
app.use("/uploads", express.static(UPLOAD_DIR));

app.get("/health", (_req, res) => res.json({ ok: true }));

// --- Comptes (optionnels) : inscription, connexion, photo de profil ---

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 3 * 1024 * 1024 }, // 3 Mo max
  fileFilter: (_req, file, cb) => {
    if (!file.mimetype.startsWith("image/")) {
      cb(new Error("Seules les images sont acceptées."));
      return;
    }
    cb(null, true);
  },
});

async function requireAuth(req, res, next) {
  const token = req.headers.authorization?.replace("Bearer ", "");
  const account = await getAccountByToken(token);
  if (!account) return res.status(401).json({ error: "Non connecté." });
  req.authToken = token;
  req.account = account;
  next();
}

app.post("/api/auth/register", async (req, res) => {
  const { username, password } = req.body || {};
  const result = await register(username, password);
  if (result.error) return res.status(400).json(result);
  res.json(result);
});

app.post("/api/auth/login", async (req, res) => {
  const { username, password } = req.body || {};
  const result = await login(username, password);
  if (result.error) return res.status(401).json(result);
  res.json(result);
});

app.post("/api/auth/logout", requireAuth, async (req, res) => {
  await logout(req.authToken);
  res.json({ ok: true });
});

app.get("/api/auth/me", requireAuth, (req, res) => {
  res.json({ account: req.account });
});

app.post("/api/auth/avatar", requireAuth, (req, res) => {
  upload.single("avatar")(req, res, async (err) => {
    if (err) return res.status(400).json({ error: err.message });
    if (!req.file) return res.status(400).json({ error: "Aucune image reçue." });

    const avatarUrl = await saveAvatar(
      req.file.buffer,
      req.file.mimetype,
      req.file.originalname
    );
    const result = await setAvatar(req.authToken, avatarUrl);
    if (result.error) return res.status(400).json(result);

    if (result.previousAvatarUrl) {
      deleteAvatar(result.previousAvatarUrl); // best-effort, pas d'await bloquant
    }

    res.json({ account: result.account });
  });
});

// --- Lobby / tournoi (remplace les anciens événements Socket.io) ---

function searchByCategory(category, query) {
  switch (category) {
    case "anime":
      return searchAnime(query);
    case "jeuxvideo":
      return searchGames(query);
    case "dessinanime":
      return searchCartoons(query);
    default:
      throw new Error("Catégorie inconnue");
  }
}

function findPlayer(lobby, playerId) {
  return lobby.players.find((p) => p.id === playerId);
}

function everyoneSubmittedPicks(lobby) {
  return lobby.players.every((p) => p.picks.length === p.pickQuota);
}

// Ids déjà validés par des joueurs ayant déjà soumis leurs picks (ready).
// Sert à empêcher deux joueurs de choisir le même item (point 10).
function takenItemIds(lobby, excludePlayerId = null) {
  const ids = new Set();
  for (const p of lobby.players) {
    if (p.ready && p.id !== excludePlayerId) {
      for (const item of p.picks) ids.add(item.id);
    }
  }
  return ids;
}

function startTournament(lobby) {
  const allItems = lobby.players.flatMap((p) =>
    p.picks.map((item) => ({
      ...item,
      ownerId: p.id,
      ownerName: p.name,
      ownerAvatarUrl: p.avatarUrl || null,
    }))
  );
  lobby.bracket = buildBracket(allItems);
  lobby.phase = "tournament";

  // Auto-avance les byes déjà résolus au round 1
  advanceIfRoundComplete(lobby);
}

function advanceIfRoundComplete(lobby) {
  if (!lobby.bracket || lobby.bracket.finished) return;
  if (allMatchesResolved(lobby.bracket)) {
    lobby.bracket = buildNextRound(lobby.bracket);
    if (lobby.bracket.finished) {
      lobby.phase = "finished";
    } else {
      // Nouveau round: résoudre en cascade d'éventuels autres byes
      advanceIfRoundComplete(lobby);
    }
  }
}

// Un seul duel "actif" à la fois pour tout le lobby: le premier match du
// round courant qui n'a pas encore de gagnant (les byes sont déjà résolus
// à la construction du round, donc ignorés ici). Dérivé, pas stocké - ça
// suffit à garantir que tout le monde vote sur le même duel en même temps.
function getCurrentMatch(bracket) {
  return bracket.matches.find((m) => m.a && m.b && !m.winner) ?? null;
}

app.post("/api/lobby", async (req, res) => {
  const { name, authToken } = req.body || {};
  const account = await getAccountByToken(authToken);
  const finalName = account ? account.username : (name?.trim() || "Host");
  const avatarUrl = account?.avatarUrl || null;
  const { lobby, playerId } = await createLobby(finalName, avatarUrl);
  res.json({ lobby: sanitizeLobby(lobby), playerId });
});

app.post("/api/lobby/:code/join", async (req, res) => {
  const { name, authToken } = req.body || {};
  const account = await getAccountByToken(authToken);
  const finalName = account ? account.username : (name?.trim() || "Joueur");
  const avatarUrl = account?.avatarUrl || null;
  const result = await joinLobby(req.params.code.trim().toUpperCase(), finalName, avatarUrl);
  if (result.error) return res.status(400).json({ error: result.error });
  res.json({ lobby: sanitizeLobby(result.lobby), playerId: result.playerId });
});

// Reprise au montage + tick de polling: un seul endpoint, l'identité (playerId)
// n'étant plus liée à une connexion transport, il n'y a rien à "reconnecter".
app.get("/api/lobby/:code", async (req, res) => {
  const { playerId } = req.query;
  const result = await getLobbyForPlayer(req.params.code, playerId);
  if (result.error) return res.status(404).json({ error: result.error });
  res.json({ lobby: sanitizeLobby(result.lobby), playerId });
});

app.patch("/api/lobby/:code/category", async (req, res) => {
  const { playerId, category } = req.body || {};
  const lobby = await getLobby(req.params.code);
  const player = lobby && findPlayer(lobby, playerId);
  if (!lobby || !player || lobby.hostId !== player.id) {
    return res.status(403).json({ error: "Action réservée à l'hôte." });
  }
  lobby.category = category;
  touchPlayer(lobby, playerId);
  await saveLobby(lobby);
  res.json({ lobby: sanitizeLobby(lobby) });
});

app.patch("/api/lobby/:code/tournament-size", async (req, res) => {
  const { playerId, size } = req.body || {};
  const lobby = await getLobby(req.params.code);
  const player = lobby && findPlayer(lobby, playerId);
  if (!lobby || !player || lobby.hostId !== player.id) {
    return res.status(403).json({ error: "Action réservée à l'hôte." });
  }
  if (!VALID_TOURNAMENT_SIZES.includes(Number(size))) {
    return res.status(400).json({ error: "Taille de tournoi invalide (16, 32, 64 ou 128)." });
  }
  lobby.tournamentSize = Number(size);
  touchPlayer(lobby, playerId);
  await saveLobby(lobby);
  res.json({ lobby: sanitizeLobby(lobby) });
});

app.post("/api/lobby/:code/start", async (req, res) => {
  const { playerId } = req.body || {};
  const lobby = await getLobby(req.params.code);
  const player = lobby && findPlayer(lobby, playerId);
  if (!lobby || !player || lobby.hostId !== player.id) {
    return res.status(403).json({ error: "Action réservée à l'hôte." });
  }
  if (!lobby.category) return res.status(400).json({ error: "Choisis d'abord une catégorie." });
  if (lobby.players.length < 2) return res.status(400).json({ error: "Il faut au moins 2 joueurs." });

  const quotas = computePickQuotas(lobby.players.length, lobby.tournamentSize);
  lobby.players.forEach((p, i) => {
    p.pickQuota = quotas[i];
  });
  lobby.phase = "picking";
  touchPlayer(lobby, playerId);
  await saveLobby(lobby);
  res.json({ lobby: sanitizeLobby(lobby) });
});

app.get("/api/lobby/:code/search", async (req, res) => {
  const lobby = await getLobby(req.params.code);
  if (!lobby || !lobby.category) {
    return res.status(400).json({ error: "Lobby ou catégorie invalide." });
  }
  try {
    const results = await searchByCategory(lobby.category, req.query.query);
    const taken = takenItemIds(lobby);
    res.json({ results: results.filter((item) => !taken.has(item.id)) });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post("/api/lobby/:code/picks", async (req, res) => {
  const { playerId, items } = req.body || {};
  const lobby = await getLobby(req.params.code);
  if (!lobby || lobby.phase !== "picking") {
    return res.status(400).json({ error: "Ce n'est pas la phase de sélection." });
  }
  const player = findPlayer(lobby, playerId);
  if (!player) return res.status(404).json({ error: "Joueur introuvable." });

  const submitted = (items || []).slice(0, player.pickQuota);
  if (submitted.length !== player.pickQuota) {
    return res.status(400).json({ error: `Choisis exactement ${player.pickQuota} favori(s).` });
  }

  const taken = takenItemIds(lobby, playerId);
  const conflicts = submitted.filter((item) => taken.has(item.id));
  if (conflicts.length > 0) {
    const titles = conflicts.map((item) => item.name).join(", ");
    return res.status(400).json({
      error: `Déjà pris par un autre joueur: ${titles}. Choisis autre chose.`,
    });
  }

  player.picks = submitted;
  player.ready = true;

  if (everyoneSubmittedPicks(lobby)) {
    startTournament(lobby);
  }
  touchPlayer(lobby, playerId);
  await saveLobby(lobby);
  res.json({ lobby: sanitizeLobby(lobby) });
});

app.post("/api/lobby/:code/vote", async (req, res) => {
  const { playerId, matchId, choice } = req.body || {};
  const lobby = await getLobby(req.params.code);
  if (!lobby || lobby.phase !== "tournament" || !lobby.bracket) {
    return res.status(400).json({ error: "Ce n'est pas la phase de tournoi." });
  }
  const player = findPlayer(lobby, playerId);
  if (!player) return res.status(404).json({ error: "Joueur introuvable." });

  // Tant que le gagnant du duel précédent n'a pas été acquitté par l'hôte
  // (bouton "Duel suivant"), personne ne peut voter sur le duel d'après.
  if (lobby.bracket.pendingReveal) {
    return res.status(409).json({ error: "En attente que l'hôte passe au duel suivant." });
  }

  // Un seul duel actif à la fois pour tout le lobby: on rejette un vote sur
  // un autre match (client pas encore resynchronisé via le poll).
  const match = getCurrentMatch(lobby.bracket);
  if (!match || match.id !== matchId) {
    return res.status(409).json({ error: "Ce duel n'est plus d'actualité, resynchronisation…" });
  }
  if (choice !== "a" && choice !== "b") return res.status(400).json({ error: "Choix invalide." });

  match.votes[player.id] = choice;

  // Duel tranché quand tous les joueurs ont voté: on affiche le gagnant et on
  // attend que l'hôte choisisse de passer au suivant (plus d'auto-avance).
  if (Object.keys(match.votes).length >= lobby.players.length) {
    resolveMatch(match);
    lobby.bracket.pendingReveal = match.id;
  }
  touchPlayer(lobby, playerId);
  await saveLobby(lobby);
  res.json({ lobby: sanitizeLobby(lobby) });
});

// L'hôte confirme avoir vu le gagnant du duel et fait passer tout le monde au
// suivant (ou au round suivant si c'était le dernier duel du round en cours).
app.post("/api/lobby/:code/advance", async (req, res) => {
  const { playerId } = req.body || {};
  const lobby = await getLobby(req.params.code);
  if (!lobby || lobby.phase !== "tournament" || !lobby.bracket) {
    return res.status(400).json({ error: "Ce n'est pas la phase de tournoi." });
  }
  const player = findPlayer(lobby, playerId);
  if (!player || lobby.hostId !== player.id) {
    return res.status(403).json({ error: "Action réservée à l'hôte." });
  }
  if (!lobby.bracket.pendingReveal) {
    return res.status(400).json({ error: "Aucun duel en attente de validation." });
  }
  lobby.bracket.pendingReveal = null;
  advanceIfRoundComplete(lobby);
  touchPlayer(lobby, playerId);
  await saveLobby(lobby);
  res.json({ lobby: sanitizeLobby(lobby) });
});

// Départ volontaire (bouton "Quitter"), distinct d'un simple refresh: ici on
// retire vraiment le joueur du lobby.
app.post("/api/lobby/:code/leave", async (req, res) => {
  const { playerId } = req.body || {};
  const updated = await removePlayer(req.params.code, playerId);
  res.json({ lobby: updated ? sanitizeLobby(updated) : null });
});

// Rejouer avec les mêmes joueurs: retour en salle d'attente, catégorie et
// taille de tournoi conservées pour un relaunch rapide.
app.post("/api/lobby/:code/replay", async (req, res) => {
  const { playerId } = req.body || {};
  const lobby = await getLobby(req.params.code);
  const player = lobby && findPlayer(lobby, playerId);
  if (!lobby || !player || lobby.hostId !== player.id) {
    return res.status(403).json({ error: "Action réservée à l'hôte." });
  }
  lobby.phase = "waiting";
  lobby.bracket = null;
  for (const p of lobby.players) {
    p.picks = [];
    p.ready = false;
    p.pickQuota = null;
  }
  touchPlayer(lobby, playerId);
  await saveLobby(lobby);
  res.json({ lobby: sanitizeLobby(lobby) });
});

export default app;
